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
    tradingName: text("trading_name"),
    currency: text("currency").notNull().default("KES"),
    countryCode: text("country_code").notNull().default("KE"),
    timezone: text("timezone").notNull().default("Africa/Nairobi"),
    openingDate: date("opening_date", { mode: "string" }).notNull(),
    taxPin: text("tax_pin"),
    registrationNumber: text("registration_number"),
    financialYearStartMonth: numeric("financial_year_start_month", {
      precision: 2,
      scale: 0,
    }).notNull().default("1"),
    financialYearStartDay: numeric("financial_year_start_day", {
      precision: 2,
      scale: 0,
    }).notNull().default("1"),
    vatRegistered: boolean("vat_registered").notNull().default(false),
    accountingMethod: text("accounting_method").notNull().default("accrual"),
    defaultInventoryMethod: text("default_inventory_method").notNull().default("weighted_average"),
    jointProductCostingMethod: text("joint_product_costing_method").notNull().default("relative_sales_value"),
    isSampleData: boolean("is_sample_data").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table: { ownerUserId: any; isSampleData: any; }) => [
    index("businesses_owner_user_idx").on(table.ownerUserId),
    index("businesses_sample_data_idx").on(table.isSampleData),
  ],
);

export const branchesTable = pgTable(
  "branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    name: text("name").notNull(),
    branchCode: text("branch_code").notNull(),
    location: text("location").notNull().default(""),
    manager: text("manager").notNull().default(""),
    businessStatus: text("business_status").notNull().default("open"),
    currency: text("currency").notNull().default("KES"),
    timezone: text("timezone").notNull().default("Africa/Nairobi"),
    stockCountOwner: text("stock_count_owner").notNull().default(""),
    cashReconciliationOwner: text("cash_reconciliation_owner").notNull().default(""),
    creditFollowUpOwner: text("credit_follow_up_owner").notNull().default(""),
    dayCloseOwner: text("day_close_owner").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table: { businessId: any; name: any; branchCode: any; }) => [
    unique("branches_business_name_unique").on(table.businessId, table.name),
    unique("branches_business_code_unique").on(table.businessId, table.branchCode),
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
  (table: { businessId: any; name: any; }) => [
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
