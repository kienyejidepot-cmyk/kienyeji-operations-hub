import { and, eq, gt, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { Router, type IRouter } from "express";
import {
  CreateProductBody,
  CreateProductResponse,
  ListProductsResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";
import { db, productsTable, stockBatchesTable } from "@workspace/db";
import {
  actorId,
  addAuditEvent,
  getOwnedBusiness,
  requireBusiness,
  requireSignedIn,
} from "./common";

const router: IRouter = Router();
router.use(requireSignedIn);

router.get("/products", async (_req, res): Promise<void> => {
  const business = await requireBusiness(res);
  if (!business) return;
  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.businessId, business.id))
    .orderBy(productsTable.name);
  res.json(ListProductsResponse.parse(products));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const business = await getOwnedBusiness(actorId(res));
  if (!business) {
    res.status(409).json({ error: "Complete business setup first." });
    return;
  }
  const [product] = await db
    .insert(productsTable)
    .values({
      businessId: business.id,
      name: parsed.data.name.trim(),
      unit: parsed.data.unit.trim(),
      lowStockThreshold: String(parsed.data.lowStockThreshold),
    })
    .returning();
  await addAuditEvent(
    business.id,
    null,
    actorId(res),
    "product.created",
    "product",
    product.id,
  );
  res.status(201).json(CreateProductResponse.parse(product));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({
      error: !params.success
        ? params.error.message
        : !parsed.success
          ? parsed.error.message
          : "Invalid product update.",
    });
    return;
  }
  const business = await getOwnedBusiness(actorId(res));
  if (!business) {
    res.status(409).json({ error: "Complete business setup first." });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Provide at least one product change." });
    return;
  }
  const [current] = await db
    .select()
    .from(productsTable)
    .where(
      and(
        eq(productsTable.id, params.data.id),
        eq(productsTable.businessId, business.id),
      ),
    )
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (parsed.data.unit && parsed.data.unit !== current.unit) {
    const [stock] = await db
      .select({
        remaining: sql<string>`coalesce(sum(${stockBatchesTable.quantityRemaining}), 0)`,
      })
      .from(stockBatchesTable)
      .where(
        and(
          eq(stockBatchesTable.businessId, business.id),
          eq(stockBatchesTable.productId, current.id),
          gt(stockBatchesTable.quantityRemaining, "0"),
        ),
      );
    if (new Decimal(stock.remaining).gt(0)) {
      res.status(409).json({
        error: "Product unit cannot change while stock remains. Create a separate product for the new unit.",
      });
      return;
    }
  }
  const [product] = await db
    .update(productsTable)
    .set({
      ...parsed.data,
      name: parsed.data.name?.trim(),
      unit: parsed.data.unit?.trim(),
    })
    .where(
      and(
        eq(productsTable.id, params.data.id),
        eq(productsTable.businessId, business.id),
      ),
    )
    .returning();
  await addAuditEvent(
    business.id,
    null,
    actorId(res),
    "product.updated",
    "product",
    product.id,
    parsed.data,
  );
  res.json(UpdateProductResponse.parse(product));
});

export default router;
