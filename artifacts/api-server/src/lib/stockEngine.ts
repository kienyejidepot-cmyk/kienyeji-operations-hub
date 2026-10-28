import Decimal from "decimal.js";
import { and, asc, eq, gt } from "drizzle-orm";
import type { db } from "@workspace/db";
import {
  stockBatchesTable,
  stockMovementsTable,
} from "@workspace/db";
import { quantity } from "../routes/common";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class InsufficientStockError extends Error {
  constructor() {
    super("There is not enough on-hand stock for this product at this shop.");
    this.name = "InsufficientStockError";
  }
}

export async function consumeFifo(
  tx: Transaction,
  input: {
    businessId: string;
    branchId: string;
    productId: string;
    requestedQuantity: Decimal;
    sourceId: string;
    movementKind: "sale" | "loss";
    reason: string | null;
    actorUserId: string;
    occurredAt: Date;
  },
): Promise<Decimal> {
  const batches = await tx
    .select()
    .from(stockBatchesTable)
    .where(
      and(
        eq(stockBatchesTable.businessId, input.businessId),
        eq(stockBatchesTable.branchId, input.branchId),
        eq(stockBatchesTable.productId, input.productId),
        gt(stockBatchesTable.quantityRemaining, "0"),
      ),
    )
    .orderBy(asc(stockBatchesTable.receivedAt), asc(stockBatchesTable.createdAt))
    .for("update");

  const available = batches.reduce(
    (total, batch) => total.plus(batch.quantityRemaining),
    new Decimal(0),
  );
  if (available.lessThan(input.requestedQuantity)) {
    throw new InsufficientStockError();
  }

  let remaining = input.requestedQuantity;
  let costOfGoods = new Decimal(0);
  for (const batch of batches) {
    if (remaining.isZero()) break;
    const balance = new Decimal(batch.quantityRemaining);
    const taken = Decimal.min(balance, remaining);
    const newBalance = balance.minus(taken);
    const batchCost = taken.times(batch.unitCost);

    await tx
      .update(stockBatchesTable)
      .set({ quantityRemaining: quantity(newBalance) })
      .where(eq(stockBatchesTable.id, batch.id));

    await tx.insert(stockMovementsTable).values({
      businessId: input.businessId,
      branchId: input.branchId,
      productId: input.productId,
      batchId: batch.id,
      kind: input.movementKind,
      quantityChange: quantity(taken.negated()),
      unitCost: batch.unitCost,
      sourceId: input.sourceId,
      reason: input.reason,
      actorUserId: input.actorUserId,
      occurredAt: input.occurredAt,
    });

    costOfGoods = costOfGoods.plus(batchCost);
    remaining = remaining.minus(taken);
  }

  return costOfGoods.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
