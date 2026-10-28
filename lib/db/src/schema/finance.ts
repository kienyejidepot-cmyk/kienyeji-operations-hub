import { createInsertSchema } from "drizzle-zod";
import {
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { businessesTable, branchesTable, productsTable } from "./business";
import { z } from "zod/v4";

export const salesTable = pgTable(
  "sales",
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
    receiptNumber: text("receipt_number").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    costOfGoods: numeric("cost_of_goods", { precision: 14, scale: 2 }).notNull(),
    initialPaidAmount: numeric("initial_paid_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).notNull(),
    amountDue: numeric("amount_due", { precision: 14, scale: 2 }).notNull(),
    customerName: text("customer_name"),
    paymentMethod: text("payment_method").notNull(),
    notes: text("notes"),
    soldAt: timestamp("sold_at", { withTimezone: true }).notNull(),
    enteredBy: text("entered_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("sales_business_receipt_unique").on(
      table.businessId,
      table.receiptNumber,
    ),
    index("sales_business_date_idx").on(table.businessId, table.soldAt),
    index("sales_branch_date_idx").on(table.branchId, table.soldAt),
    index("sales_customer_balance_idx").on(
      table.businessId,
      table.customerName,
      table.amountDue,
    ),
  ],
);

export const collectionsTable = pgTable(
  "collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => salesTable.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paymentMethod: text("payment_method").notNull(),
    reference: text("reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    enteredBy: text("entered_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("collections_business_date_idx").on(table.businessId, table.paidAt),
    index("collections_sale_idx").on(table.saleId, table.paidAt),
  ],
);

export const expensesTable = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    category: text("category").notNull(),
    description: text("description"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).notNull(),
    amountDue: numeric("amount_due", { precision: 14, scale: 2 }).notNull(),
    paymentStatus: text("payment_status").notNull(),
    paymentMethod: text("payment_method").notNull(),
    expenseDate: date("expense_date", { mode: "string" }).notNull(),
    enteredBy: text("entered_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("expenses_business_date_idx").on(
      table.businessId,
      table.expenseDate,
    ),
    index("expenses_branch_date_idx").on(table.branchId, table.expenseDate),
  ],
);

export const insertSaleSchema = createInsertSchema(salesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSale = z.infer<typeof insertSaleSchema>;
