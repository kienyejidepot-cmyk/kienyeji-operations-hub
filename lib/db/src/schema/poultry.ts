import { createInsertSchema } from "drizzle-zod";
import {
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { businessesTable, branchesTable } from "./business";
import { z } from "zod/v4";

export const liveBirdBatchesTable = pgTable(
  "live_bird_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    batchCode: text("batch_code").notNull(),
    breed: text("breed").notNull(),
    supplierName: text("supplier_name").notNull(),
    farmerName: text("farmer_name"),
    receivedDate: date("received_date", { mode: "string" }).notNull(),
    birdsReceived: numeric("birds_received", { precision: 14, scale: 0 }).notNull(),
    birdsSoldAlive: numeric("birds_sold_alive", { precision: 14, scale: 0 })
      .notNull()
      .default("0"),
    birdsTransferredToSlaughter: numeric("birds_transferred_to_slaughter", {
      precision: 14,
      scale: 0,
    })
      .notNull()
      .default("0"),
    birdsReserved: numeric("birds_reserved", { precision: 14, scale: 0 })
      .notNull()
      .default("0"),
    birdsDead: numeric("birds_dead", { precision: 14, scale: 0 })
      .notNull()
      .default("0"),
    birdsRemaining: numeric("birds_remaining", { precision: 14, scale: 0 }).notNull(),
    purchaseCostPerBird: numeric("purchase_cost_per_bird", {
      precision: 14,
      scale: 2,
    }).notNull(),
    totalBatchCost: numeric("total_batch_cost", { precision: 14, scale: 2 }).notNull(),
    avgWeightKg: numeric("avg_weight_kg", { precision: 14, scale: 3 }),
    feedCost: numeric("feed_cost", { precision: 14, scale: 2 }).notNull().default("0"),
    holdingCost: numeric("holding_cost", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),
    status: text("status").notNull().default("active"),
    enteredBy: text("entered_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("live_bird_batches_business_branch_code_unique").on(
      table.businessId,
      table.branchId,
      table.batchCode,
    ),
    index("live_bird_batches_branch_date_idx").on(table.branchId, table.receivedDate),
    index("live_bird_batches_business_breed_idx").on(table.businessId, table.breed),
  ],
);

export const liveBirdMovementsTable = pgTable(
  "live_bird_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    batchId: uuid("batch_id").references(() => liveBirdBatchesTable.id),
    movementType: text("movement_type").notNull(),
    birdsChange: numeric("birds_change", { precision: 14, scale: 0 }).notNull(),
    reason: text("reason").notNull(),
    sourceType: text("source_type"),
    sourceId: uuid("source_id"),
    actorUserId: text("actor_user_id").notNull(),
    approvalStatus: text("approval_status").notNull().default("approved"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("live_bird_movements_branch_date_idx").on(table.branchId, table.occurredAt),
    index("live_bird_movements_batch_idx").on(table.batchId, table.occurredAt),
    index("live_bird_movements_type_idx").on(table.movementType, table.occurredAt),
  ],
);

export const slaughterBatchesTable = pgTable(
  "slaughter_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    batchNumber: text("batch_number").notNull(),
    sourceBatchId: uuid("source_batch_id").references(() => liveBirdBatchesTable.id),
    slaughterDate: date("slaughter_date", { mode: "string" }).notNull(),
    birdsSelected: numeric("birds_selected", { precision: 14, scale: 0 }).notNull(),
    birdsSlaughtered: numeric("birds_slaughtered", { precision: 14, scale: 0 }).notNull(),
    birdsRejected: numeric("birds_rejected", { precision: 14, scale: 0 })
      .notNull()
      .default("0"),
    rejectionReason: text("rejection_reason"),
    dressedChickensProduced: numeric("dressed_chickens_produced", {
      precision: 14,
      scale: 0,
    }).notNull(),
    totalDressedWeightKg: numeric("total_dressed_weight_kg", {
      precision: 14,
      scale: 3,
    }).notNull(),
    avgDressedWeightKg: numeric("avg_dressed_weight_kg", {
      precision: 14,
      scale: 3,
    }).notNull(),
    liveWeightKg: numeric("live_weight_kg", { precision: 14, scale: 3 }),
    dressingYieldPercent: numeric("dressing_yield_percent", {
      precision: 14,
      scale: 3,
    }),
    offalKg: numeric("offal_kg", { precision: 14, scale: 3 }).notNull().default("0"),
    feetCount: numeric("feet_count", { precision: 14, scale: 0 }).notNull().default("0"),
    headsCount: numeric("heads_count", { precision: 14, scale: 0 }).notNull().default("0"),
    processingCost: numeric("processing_cost", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    staffResponsible: text("staff_responsible").notNull(),
    notes: text("notes"),
    status: text("status").notNull().default("draft"),
    enteredBy: text("entered_by").notNull(),
    confirmedBy: text("confirmed_by"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("slaughter_batches_branch_number_unique").on(
      table.branchId,
      table.batchNumber,
    ),
    index("slaughter_batches_branch_date_idx").on(table.branchId, table.slaughterDate),
    index("slaughter_batches_status_idx").on(table.status, table.slaughterDate),
  ],
);

export const slaughterByProductsTable = pgTable(
  "slaughter_by_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => slaughterBatchesTable.id),
    productType: text("product_type").notNull(),
    unit: text("unit").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitValue: numeric("unit_value", { precision: 14, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("slaughter_by_products_batch_idx").on(table.batchId),
    index("slaughter_by_products_branch_idx").on(table.branchId, table.productType),
  ],
);

export const insertLiveBirdBatchSchema = createInsertSchema(liveBirdBatchesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertLiveBirdMovementSchema = createInsertSchema(liveBirdMovementsTable).omit({
  id: true,
  createdAt: true,
});
export const insertSlaughterBatchSchema = createInsertSchema(slaughterBatchesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertSlaughterByProductSchema = createInsertSchema(slaughterByProductsTable).omit({
  id: true,
  createdAt: true,
});

export type LiveBirdBatch = typeof liveBirdBatchesTable.$inferSelect;
export type LiveBirdMovement = typeof liveBirdMovementsTable.$inferSelect;
export type SlaughterBatch = typeof slaughterBatchesTable.$inferSelect;
export type SlaughterByProduct = typeof slaughterByProductsTable.$inferSelect;
export type InsertLiveBirdBatch = z.infer<typeof insertLiveBirdBatchSchema>;
export type InsertLiveBirdMovement = z.infer<typeof insertLiveBirdMovementSchema>;
export type InsertSlaughterBatch = z.infer<typeof insertSlaughterBatchSchema>;
export type InsertSlaughterByProduct = z.infer<typeof insertSlaughterByProductSchema>;
