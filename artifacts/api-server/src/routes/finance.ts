import Decimal from "decimal.js";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateExpenseBody,
  CreateExpenseResponse,
  CreateSaleBody,
  CreateSaleResponse,
  ListExpensesQueryParams,
  ListExpensesResponse,
  ListSalesQueryParams,
  ListSalesResponse,
  RecordCollectionBody,
  RecordCollectionResponse,
} from "@workspace/api-zod";
import {
  db,
  branchesTable,
  collectionsTable,
  expensesTable,
  productsTable,
  salesTable,
} from "@workspace/db";
import {
  actorId,
  addAuditEvent,
  branchInBusiness,
  dateBounds,
  getOwnedBusiness,
  isCalendarDate,
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

function validDateRange(from?: string, to?: string): [Date, Date] | null {
  if (!from && !to) return null;
  if (
    (from && !isCalendarDate(from)) ||
    (to && !isCalendarDate(to))
  ) {
    return null;
  }
  const startValue = from ?? to!;
  const endValue = to ?? from!;
  if (startValue > endValue) return null;
  return dateBounds(startValue, endValue);
}

router.get("/sales", async (req, res): Promise<void> => {
  const params = ListSalesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const business = await requireBusiness(res);
  if (!business) return;
  const period = validDateRange(params.data.from, params.data.to);
  if ((params.data.from || params.data.to) && !period) {
    res.status(400).json({ error: "Enter a valid Nairobi calendar date range." });
    return;
  }
  if (
    params.data.branchId &&
    !(await branchInBusiness(params.data.branchId, business.id))
  ) {
    res.status(404).json({ error: "Shop branch not found." });
    return;
  }
  const filters = [eq(salesTable.businessId, business.id)];
  if (params.data.branchId) {
    filters.push(eq(salesTable.branchId, params.data.branchId));
  }
  if (period) {
    filters.push(gte(salesTable.soldAt, period[0]), lte(salesTable.soldAt, period[1]));
  }
  const rows = await db
    .select({
      id: salesTable.id,
      receiptNumber: salesTable.receiptNumber,
      branchId: salesTable.branchId,
      productName: productsTable.name,
      quantity: salesTable.quantity,
      unit: productsTable.unit,
      unitPrice: salesTable.unitPrice,
      total: salesTable.total,
      costOfGoods: salesTable.costOfGoods,
      paidAmount: salesTable.paidAmount,
      amountDue: salesTable.amountDue,
      customerName: salesTable.customerName,
      paymentMethod: salesTable.paymentMethod,
      soldAt: salesTable.soldAt,
    })
    .from(salesTable)
    .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .where(and(...filters))
    .orderBy(desc(salesTable.soldAt));
  res.json(
    ListSalesResponse.parse(
      rows.map((row) => ({ ...row, soldAt: row.soldAt.toISOString() })),
    ),
  );
});

router.post("/sales", async (req, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
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
  if (!isValidInstant(parsed.data.soldAt)) {
    res.status(400).json({ error: "Enter a valid sale date and time." });
    return;
  }

  const saleQuantity = new Decimal(parsed.data.quantity);
  const unitPrice = new Decimal(parsed.data.unitPrice);
  const discount = new Decimal(parsed.data.discount);
  const total = saleQuantity.times(unitPrice).minus(discount).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  const paidAmount = new Decimal(parsed.data.paidAmount).toDecimalPlaces(2);
  if (saleQuantity.lte(0) || unitPrice.lte(0) || total.lte(0)) {
    res.status(400).json({ error: "Quantity, price, and sale total must be greater than zero." });
    return;
  }
  if (discount.lt(0) || discount.gte(saleQuantity.times(unitPrice))) {
    res.status(400).json({ error: "Discount must be less than the sale subtotal." });
    return;
  }
  if (paidAmount.lt(0) || paidAmount.gt(total)) {
    res.status(400).json({ error: "Amount received cannot exceed the sale total." });
    return;
  }
  if (
    (["cash", "mpesa", "bank"].includes(parsed.data.paymentMethod) &&
      !paidAmount.equals(total)) ||
    (parsed.data.paymentMethod === "credit" && !paidAmount.isZero())
  ) {
    res.status(400).json({
      error: "Use Split for partial payment, Credit for no payment, or the matching method for a fully paid sale.",
    });
    return;
  }
  const amountDue = total.minus(paidAmount);
  const customerName = parsed.data.customerName?.trim() || null;
  if (amountDue.gt(0) && !customerName) {
    res.status(400).json({ error: "Add the customer name for any unpaid balance." });
    return;
  }

  const id = randomUUID();
  const receiptNumber = `KYS-${new Date(parsed.data.soldAt).toISOString().slice(0, 10).replaceAll("-", "")}-${id.slice(0, 6).toUpperCase()}`;
  const soldAt = new Date(parsed.data.soldAt);
  let costOfGoods = new Decimal(0);
  try {
    costOfGoods = await db.transaction(async (tx) => {
      const cost = await consumeFifo(tx, {
        businessId: business.id,
        branchId: branch.id,
        productId: product.id,
        requestedQuantity: saleQuantity,
        sourceId: id,
        movementKind: "sale",
        reason: receiptNumber,
        actorUserId: actorId(res),
        occurredAt: soldAt,
      });
      await tx.insert(salesTable).values({
        id,
        businessId: business.id,
        branchId: branch.id,
        productId: product.id,
        receiptNumber,
        quantity: quantity(saleQuantity),
        unitPrice: money(unitPrice),
        discount: money(discount),
        total: money(total),
        costOfGoods: money(cost),
        initialPaidAmount: money(paidAmount),
        paidAmount: money(paidAmount),
        amountDue: money(amountDue),
        customerName,
        paymentMethod: parsed.data.paymentMethod,
        notes: parsed.data.notes?.trim() || null,
        soldAt,
        enteredBy: actorId(res),
      });
      return cost;
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
    "sale.posted",
    "sale",
    id,
    { receiptNumber, total: money(total), amountDue: money(amountDue) },
  );
  res.status(201).json(
    CreateSaleResponse.parse({
      id,
      receiptNumber,
      branchId: branch.id,
      productName: product.name,
      quantity: quantity(saleQuantity),
      unit: product.unit,
      unitPrice: money(unitPrice),
      total: money(total),
      costOfGoods: money(costOfGoods),
      paidAmount: money(paidAmount),
      amountDue: money(amountDue),
      customerName,
      paymentMethod: parsed.data.paymentMethod,
      soldAt: soldAt.toISOString(),
    }),
  );
});

router.post("/collections", async (req, res): Promise<void> => {
  const parsed = RecordCollectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const business = await getOwnedBusiness(actorId(res));
  if (!business) {
    res.status(409).json({ error: "Complete business setup first." });
    return;
  }
  const amount = new Decimal(parsed.data.amount);
  const paidAt = new Date(parsed.data.paidAt);
  if (!isValidInstant(parsed.data.paidAt)) {
    res.status(400).json({ error: "Enter a valid payment date and time." });
    return;
  }
  const collectionId = randomUUID();
  let updatedSale:
    | {
        id: string;
        branchId: string;
        amountDue: string;
      }
    | undefined;
  await db.transaction(async (tx) => {
    const [sale] = await tx
      .select()
      .from(salesTable)
      .where(
        and(
          eq(salesTable.id, parsed.data.saleId),
          eq(salesTable.businessId, business.id),
        ),
      )
      .for("update")
      .limit(1);
    if (!sale) throw new Error("Invoice not found for this business.");
    const due = new Decimal(sale.amountDue);
    if (amount.lte(0) || amount.gt(due)) {
      throw new Error("Payment amount must be positive and no greater than the balance due.");
    }
    const newPaid = new Decimal(sale.paidAmount).plus(amount);
    const newDue = due.minus(amount);
    await tx.insert(collectionsTable).values({
      id: collectionId,
      businessId: business.id,
      saleId: sale.id,
      amount: money(amount),
      paymentMethod: parsed.data.paymentMethod,
      reference: parsed.data.reference?.trim() || null,
      paidAt,
      enteredBy: actorId(res),
    });
    await tx
      .update(salesTable)
      .set({ paidAmount: money(newPaid), amountDue: money(newDue) })
      .where(eq(salesTable.id, sale.id));
    updatedSale = { id: sale.id, branchId: sale.branchId, amountDue: money(newDue) };
  });
  await addAuditEvent(
    business.id,
    updatedSale?.branchId ?? null,
    actorId(res),
    "customer.payment_received",
    "collection",
    collectionId,
    { saleId: updatedSale?.id, amount: money(amount), dueAfter: updatedSale?.amountDue },
  );
  res.status(201).json(
    RecordCollectionResponse.parse({
      id: collectionId,
      saleId: parsed.data.saleId,
      amount: money(amount),
      paymentMethod: parsed.data.paymentMethod,
      reference: parsed.data.reference?.trim() || null,
      paidAt: paidAt.toISOString(),
    }),
  );
});

router.get("/expenses", async (req, res): Promise<void> => {
  const params = ListExpensesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const business = await requireBusiness(res);
  if (!business) return;
  const period = validDateRange(params.data.from, params.data.to);
  if ((params.data.from || params.data.to) && !period) {
    res.status(400).json({ error: "Enter a valid Nairobi calendar date range." });
    return;
  }
  if (
    params.data.branchId &&
    !(await branchInBusiness(params.data.branchId, business.id))
  ) {
    res.status(404).json({ error: "Shop branch not found." });
    return;
  }
  const filters = [eq(expensesTable.businessId, business.id)];
  if (params.data.branchId) {
    filters.push(eq(expensesTable.branchId, params.data.branchId));
  }
  if (period) {
    const start = params.data.from ?? params.data.to!;
    const end = params.data.to ?? params.data.from!;
    filters.push(gte(expensesTable.expenseDate, start), lte(expensesTable.expenseDate, end));
  }
  const rows = await db
    .select()
    .from(expensesTable)
    .where(and(...filters))
    .orderBy(desc(expensesTable.expenseDate));
  res.json(
    ListExpensesResponse.parse(
      rows.map((row) => ({
        id: row.id,
        branchId: row.branchId,
        category: row.category,
        description: row.description,
        amount: row.amount,
        paidAmount: row.paidAmount,
        amountDue: row.amountDue,
        expenseDate: row.expenseDate,
      })),
    ),
  );
});

router.post("/expenses", async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
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
  if (!isCalendarDate(parsed.data.expenseDate)) {
    res.status(400).json({ error: "Enter a valid expense date." });
    return;
  }

  const amount = new Decimal(parsed.data.amount);
  const paidAmount = new Decimal(parsed.data.paidAmount);
  if (amount.lte(0) || paidAmount.lt(0) || paidAmount.gt(amount)) {
    res.status(400).json({ error: "Expense must be positive and payment cannot exceed its total." });
    return;
  }
  const expectedStatus = paidAmount.isZero()
    ? "unpaid"
    : paidAmount.equals(amount)
      ? "paid"
      : "partial";
  if (parsed.data.paymentStatus !== expectedStatus) {
    res.status(400).json({ error: `Payment status must be ${expectedStatus} for the entered amounts.` });
    return;
  }
  const [expense] = await db
    .insert(expensesTable)
    .values({
      businessId: business.id,
      branchId: branch.id,
      category: parsed.data.category.trim(),
      description: parsed.data.description?.trim() || null,
      amount: money(amount),
      paidAmount: money(paidAmount),
      amountDue: money(amount.minus(paidAmount)),
      paymentStatus: expectedStatus,
      paymentMethod: parsed.data.paymentMethod,
      expenseDate: parsed.data.expenseDate,
      enteredBy: actorId(res),
    })
    .returning();
  await addAuditEvent(
    business.id,
    branch.id,
    actorId(res),
    "expense.posted",
    "expense",
    expense.id,
    { category: expense.category, amount: expense.amount },
  );
  res.status(201).json(
    CreateExpenseResponse.parse({
      id: expense.id,
      branchId: expense.branchId,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      paidAmount: expense.paidAmount,
      amountDue: expense.amountDue,
      expenseDate: expense.expenseDate,
    }),
  );
});

export default router;
