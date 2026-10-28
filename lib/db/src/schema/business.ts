import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const businessesTable = pgTable(
  "businesses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: text("owner_user_id").notNull().unique(),
    name: text("name").notNull(),
    currency: text("currency").notNull().default("KES"),
    openingDate: date("opening_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("businesses_owner_user_idx").on(table.ownerUserId)],
);

export const branchesTable = pgTable(
  "branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    name: text("name").notNull(),
    location: text("location").notNull().default(""),
    stockCountOwner: text("stock_count_owner").notNull().default(""),
    cashReconciliationOwner: text("cash_reconciliation_owner").notNull().default(""),
    creditFollowUpOwner: text("credit_follow_up_owner").notNull().default(""),
    dayCloseOwner: text("day_close_owner").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("branches_business_name_unique").on(table.businessId, table.name),
    index("branches_business_idx").on(table.businessId),
  ],
);

export const productsTable = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    lowStockThreshold: numeric("low_stock_threshold", {
      precision: 14,
      scale: 3,
    })
      .notNull()
      .default("0"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("products_business_name_unique").on(table.businessId, table.name),
    index("products_business_idx").on(table.businessId),
  ],
);

export const insertBusinessSchema = createInsertSchema(businessesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businessesTable.$inferSelect;
export type Branch = typeof branchesTable.$inferSelect;
export type Product = typeof productsTable.$inferSelect;
