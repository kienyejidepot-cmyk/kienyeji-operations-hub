import Decimal from "decimal.js";
import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  eq,
  gt,
  sql,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetStockQueryParams,
  GetStockResponse,
  ListStockCountsQueryParams,
  ListStockCountsResponse,
  ReceiveStockBody,
  ReceiveStockResponse,
  RecordStockCountBody,
  RecordStockCountResponse,
  RecordStockLossBody,
  RecordStockLossResponse,
} from "@workspace/api-zod";
import {
  db,
  branchesTable,
  productsTable,
  stockBatchesTable,
  stockCountsTable,
  stockLossesTable,
  stockMovementsTable,
  stockReceiptsTable,
} from "@workspace/db";
import {
  actorId,
  addAuditEvent,
  branchInBusiness,
  dateOf,
  getOwnedBusiness,
  isValidInstant,
  money,
  productInBusiness,
  quantity,
  requireBusiness,
  requireSignedIn,
} from "./common";
import { consumeFifo, InsufficientStockError } from "../lib/stockEngine";

const router: IRouter = Router();
router.use(requireSignedIn);

router.get("/stock", async (req, res): Promise<void> => {
  const params = GetStockQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const business = await requireBusiness(res);
  if (!business) return;
  if (
    params.data.branchId &&
    !(await branchInBusiness(params.data.branchId, business.id))
  ) {
    res.status(404).json({ error: "Shop branch not found." });
    return;
  }

  const where = params.data.branchId
    ? and(
        eq(stockBatchesTable.businessId, business.id),
        eq(stockBatchesTable.branchId, params.data.branchId),
        gt(stockBatchesTable.quantityRemaining, "0"),
      )
    : and(
        eq(stockBatchesTable.businessId, business.id),
        gt(stockBatchesTable.quantityRemaining, "0"),
      );
  const rows = await db
    .select({
      branchId: branchesTable.id,
      branchName: branchesTable.name,
      productId: productsTable.id,
      productName: productsTable.name,
      unit: productsTable.unit,
      quantityRemaining: stockBatchesTable.quantityRemaining,
      unitCost: stockBatchesTable.unitCost,
      receivedAt: stockBatchesTable.receivedAt,
    })
    .from(stockBatchesTable)
    .innerJoin(branchesTable, eq(stockBatchesTable.branchId, branchesTable.id))
    .innerJoin(productsTable, eq(stockBatchesTable.productId, productsTable.id))
    .where(where)
    .orderBy(asc(stockBatchesTable.receivedAt));

  const grouped = new Map<
    string,
    {
      branchId: string;
      branchName: string;
      productId: string;
      productName: string;
      unit: string;
      quantity: Decimal;
      stockValue: Decimal;
      oldestBatchDate: string | null;
    }
  >();
  for (const row of rows) {
    const key = `${row.branchId}:${row.productId}`;
    const item = grouped.get(key) ?? {
      branchId: row.branchId,
      branchName: row.branchName,
      productId: row.productId,
      productName: row.productName,
      unit: row.unit,
      quantity: new Decimal(0),
      stockValue: new Decimal(0),
      oldestBatchDate: dateOf(row.receivedAt),
    };
    const qty = new Decimal(row.quantityRemaining);
    item.quantity = item.quantity.plus(qty);
    item.stockValue = item.stockValue.plus(qty.times(row.unitCost));
    item.oldestBatchDate =
      item.oldestBatchDate && item.oldestBatchDate < dateOf(row.receivedAt)
        ? item.oldestBatchDate
        : dateOf(row.receivedAt);
    grouped.set(key, item);
  }

  res.json(
    GetStockResponse.parse(
      [...grouped.values()].map((item) => ({
        ...item,
        quantity: quantity(item.quantity),
        stockValue: money(item.stockValue),
      })),
    ),
  );
});

router.post("/stock/receipts", async (req, res): Promise<void> => {
  const parsed = ReceiveStockBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const business = await getOwnedBusiness(actorId(res));
  if (!business) {
    res.status(409).json({ error: "Complete business setup first." });
    return;
  }
  const branch = await branchInBusiness(parsed.data.branchId, business.id);
  if (!branch) {
    res.status(404).json({ error: "Shop branch not found." });
    return;
  }
  for (const line of parsed.data.lines) {
    if (!(await productInBusiness(line.productId, business.id))) {
      res.status(404).json({ error: "One or more products could not be found." });
      return;
    }
  }

  const receiptId = randomUUID();
  const receivedAt = new Date(parsed.data.receivedAt);
  const totalCost = parsed.data.lines.reduce(
    (total, line) =>
      total.plus(new Decimal(line.quantity).times(line.unitCost)),
    new Decimal(0),
  );
  await db.transaction(async (tx) => {
    await tx.insert(stockReceiptsTable).values({
      id: receiptId,
      businessId: business.id,
      branchId: branch.id,
      supplierName: parsed.data.supplierName.trim(),
      reference: parsed.data.reference?.trim() || null,
      receivedAt,
      notes: parsed.data.notes?.trim() || null,
      enteredBy: actorId(res),
    });
    for (const line of parsed.data.lines) {
      const [product] = await tx
        .select()
        .from(productsTable)
        .where(
          and(
            eq(productsTable.id, line.productId),
            eq(productsTable.businessId, business.id),
          ),
        )
        .limit(1);
      if (!product) throw new Error("Product is no longer available.");
      const batchId = randomUUID();
      const lineQuantity = quantity(line.quantity);
      const unitCost = money(line.unitCost);
      await tx.insert(stockBatchesTable).values({
        id: batchId,
        businessId: business.id,
        branchId: branch.id,
        productId: product.id,
        receiptId,
        supplierName: parsed.data.supplierName.trim(),
        receivedAt,
        quantityReceived: lineQuantity,
        quantityRemaining: lineQuantity,
        unitCost,
      });
      await tx.insert(stockMovementsTable).values({
        businessId: business.id,
        branchId: branch.id,
        productId: product.id,
        batchId,
        kind: "receipt",
        quantityChange: lineQuantity,
        unitCost,
        sourceId: receiptId,
        reason: parsed.data.reference?.trim() || "Supplier delivery",
        actorUserId: actorId(res),
        occurredAt: receivedAt,
      });
    }
  });
  await addAuditEvent(
    business.id,
    branch.id,
    actorId(res),
    "stock.received",
    "stock_receipt",
    receiptId,
    { supplierName: parsed.data.supplierName, lineCount: parsed.data.lines.length },
  );
  res.status(201).json(
    ReceiveStockResponse.parse({
      id: receiptId,
      supplierName: parsed.data.supplierName,
      receivedAt: receivedAt.toISOString(),
      lineCount: parsed.data.lines.length,
      totalCost: money(totalCost),
    }),
  );
});

router.post("/stock/losses", async (req, res): Promise<void> => {
  const parsed = RecordStockLossBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const business = await getOwnedBusiness(actorId(res));
  if (!business) {
    res.status(409).json({ error: "Complete business setup first." });
    return;
  }
  const branch = await branchInBusiness(parsed.data.branchId, business.id);
  const product = await productInBusiness(parsed.data.productId, business.id);
  if (!branch || !product) {
    res.status(404).json({ error: "Shop branch or product not found." });
    return;
  }
  const lossId = randomUUID();
  const occurredAt = new Date(parsed.data.occurredAt);
  if (!isValidInstant(parsed.data.occurredAt)) {
    res.status(400).json({ error: "Enter a valid stock-loss date and time." });
    return;
  }
  let cost = new Decimal(0);
  try {
    cost = await db.transaction(async (tx) => {
      const totalCost = await consumeFifo(tx, {
        businessId: business.id,
        branchId: branch.id,
        productId: product.id,
        requestedQuantity: new Decimal(parsed.data.quantity),
        sourceId: lossId,
        movementKind: "loss",
        reason: parsed.data.cause,
        actorUserId: actorId(res),
        occurredAt,
      });
      await tx.insert(stockLossesTable).values({
        id: lossId,
        businessId: business.id,
        branchId: branch.id,
        productId: product.id,
        quantity: quantity(parsed.data.quantity),
        cause: parsed.data.cause.trim(),
        notes: parsed.data.notes?.trim() || null,
        cost: money(totalCost),
        occurredAt,
        enteredBy: actorId(res),
      });
      return totalCost;
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
  await addAuditEvent(
    business.id,
    branch.id,
    actorId(res),
    "stock.loss_recorded",
    "stock_loss",
    lossId,
    { cause: parsed.data.cause, cost: money(cost) },
  );
  res.status(201).json(
    RecordStockLossResponse.parse({
      id: lossId,
      branchId: branch.id,
      productName: product.name,
      quantity: quantity(parsed.data.quantity),
      cause: parsed.data.cause.trim(),
      cost: money(cost),
      occurredAt: occurredAt.toISOString(),
    }),
  );
});

router.post("/stock/counts", async (req, res): Promise<void> => {
  const parsed = RecordStockCountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const business = await getOwnedBusiness(actorId(res));
  if (!business) {
    res.status(409).json({ error: "Complete business setup first." });
    return;
  }
  const branch = await branchInBusiness(parsed.data.branchId, business.id);
  const product = await productInBusiness(parsed.data.productId, business.id);
  if (!branch || !product) {
    res.status(404).json({ error: "Shop branch or product not found." });
    return;
  }
  const [result] = await db
    .select({
      expected: sql<string>`coalesce(sum(${stockBatchesTable.quantityRemaining}), 0)`,
    })
    .from(stockBatchesTable)
    .where(
      and(
        eq(stockBatchesTable.businessId, business.id),
        eq(stockBatchesTable.branchId, branch.id),
        eq(stockBatchesTable.productId, product.id),
      ),
    );
  const expected = new Decimal(result.expected ?? "0");
  const counted = new Decimal(parsed.data.countedQuantity);
  const variance = counted.minus(expected);
  const countedAt = new Date(parsed.data.countedAt);
  if (!isValidInstant(parsed.data.countedAt)) {
    res.status(400).json({ error: "Enter a valid stock-count date and time." });
    return;
  }
  const [count] = await db
    .insert(stockCountsTable)
    .values({
      businessId: business.id,
      branchId: branch.id,
      productId: product.id,
      expectedQuantity: quantity(expected),
      countedQuantity: quantity(counted),
      variance: quantity(variance),
      countedAt,
      notes: parsed.data.notes?.trim() || null,
      enteredBy: actorId(res),
    })
    .returning();
  await addAuditEvent(
    business.id,
    branch.id,
    actorId(res),
    "stock.count_recorded",
    "stock_count",
    count.id,
    { variance: quantity(variance) },
  );
  res.status(201).json(
    RecordStockCountResponse.parse({
      id: count.id,
      branchId: branch.id,
      productName: product.name,
      expectedQuantity: quantity(expected),
      countedQuantity: quantity(counted),
      variance: quantity(variance),
      countedAt: countedAt.toISOString(),
      notes: count.notes,
    }),
  );
});

router.get("/stock/counts", async (req, res): Promise<void> => {
  const params = ListStockCountsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const business = await requireBusiness(res);
  if (!business) return;
  if (
    params.data.branchId &&
    !(await branchInBusiness(params.data.branchId, business.id))
  ) {
    res.status(404).json({ error: "Shop branch not found." });
    return;
  }
  const where = params.data.branchId
    ? and(
        eq(stockCountsTable.businessId, business.id),
        eq(stockCountsTable.branchId, params.data.branchId),
      )
    : eq(stockCountsTable.businessId, business.id);
  const rows = await db
    .select({
      id: stockCountsTable.id,
      branchId: stockCountsTable.branchId,
      productName: productsTable.name,
      expectedQuantity: stockCountsTable.expectedQuantity,
      countedQuantity: stockCountsTable.countedQuantity,
      variance: stockCountsTable.variance,
      countedAt: stockCountsTable.countedAt,
      notes: stockCountsTable.notes,
    })
    .from(stockCountsTable)
    .innerJoin(productsTable, eq(stockCountsTable.productId, productsTable.id))
    .where(where)
    .orderBy(asc(stockCountsTable.countedAt));
  res.json(
    ListStockCountsResponse.parse(
      rows.map((row) => ({
        ...row,
        countedAt: row.countedAt.toISOString(),
      })),
    ),
  );
});

export default router;
