import { createInsertSchema } from "drizzle-zod";
import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { businessesTable, branchesTable, productsTable } from "./business";
import { z } from "zod/v4";

export const stockReceiptsTable = pgTable(
  "stock_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    supplierName: text("supplier_name").notNull(),
    reference: text("reference"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
    enteredBy: text("entered_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stock_receipts_business_date_idx").on(
      table.businessId,
      table.receivedAt,
    ),
    index("stock_receipts_branch_date_idx").on(table.branchId, table.receivedAt),
  ],
);

export const stockBatchesTable = pgTable(
  "stock_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id),
    receiptId: uuid("receipt_id")
      .notNull()
      .references(() => stockReceiptsTable.id),
    supplierName: text("supplier_name").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    quantityReceived: numeric("quantity_received", {
      precision: 14,
      scale: 3,
    }).notNull(),
    quantityRemaining: numeric("quantity_remaining", {
      precision: 14,
      scale: 3,
    }).notNull(),
    unitCost: numeric("unit_cost", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stock_batches_business_product_idx").on(
      table.businessId,
      table.productId,
    ),
    index("stock_batches_branch_product_idx").on(table.branchId, table.productId),
    index("stock_batches_fifo_idx").on(
      table.businessId,
      table.branchId,
      table.productId,
      table.receivedAt,
    ),
  ],
);

export const stockMovementsTable = pgTable(
  "stock_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id),
    batchId: uuid("batch_id").references(() => stockBatchesTable.id),
    kind: text("kind").notNull(),
    quantityChange: numeric("quantity_change", {
      precision: 14,
      scale: 3,
    }).notNull(),
    unitCost: numeric("unit_cost", { precision: 14, scale: 2 }).notNull(),
    sourceId: uuid("source_id").notNull(),
    reason: text("reason"),
    actorUserId: text("actor_user_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stock_movements_business_date_idx").on(
      table.businessId,
      table.occurredAt,
    ),
    index("stock_movements_branch_product_date_idx").on(
      table.branchId,
      table.productId,
      table.occurredAt,
    ),
    index("stock_movements_source_idx").on(table.kind, table.sourceId),
  ],
);

export const stockLossesTable = pgTable(
  "stock_losses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    cause: text("cause").notNull(),
    notes: text("notes"),
    cost: numeric("cost", { precision: 14, scale: 2 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    enteredBy: text("entered_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stock_losses_business_date_idx").on(
      table.businessId,
      table.occurredAt,
    ),
    index("stock_losses_branch_idx").on(table.branchId, table.occurredAt),
  ],
);

export const stockCountsTable = pgTable(
  "stock_counts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id),
    expectedQuantity: numeric("expected_quantity", {
      precision: 14,
      scale: 3,
    }).notNull(),
    countedQuantity: numeric("counted_quantity", {
      precision: 14,
      scale: 3,
    }).notNull(),
    variance: numeric("variance", { precision: 14, scale: 3 }).notNull(),
    countedAt: timestamp("counted_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
    enteredBy: text("entered_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stock_counts_business_date_idx").on(
      table.businessId,
      table.countedAt,
    ),
    index("stock_counts_branch_product_idx").on(
      table.branchId,
      table.productId,
      table.countedAt,
    ),
  ],
);

export const insertStockCountSchema = createInsertSchema(stockCountsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertStockCount = z.infer<typeof insertStockCountSchema>;
