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
import { businessesTable, branchesTable } from "./business";
import { z } from "zod/v4";

// Customers
export const customersTable = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    customerCode: text("customer_code"),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    email: text("email"),
    idNumber: text("id_number"),
    taxPin: text("tax_pin"),
    registrationNumber: text("registration_number"),
    address: text("address"),
    location: text("location"),
    customerType: text("customer_type").notNull().default("retail"), // retail, wholesale, hotel, restaurant, market_trader
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    paymentTermsDays: numeric("payment_terms_days", { precision: 5, scale: 0 })
      .notNull()
      .default("0"),
    isActive: boolean("is_active").notNull().default(true),
    isCreditApproved: boolean("is_credit_approved").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("customers_business_idx").on(table.businessId),
    index("customers_type_idx").on(table.customerType),
  ],
);

// Customer ledger (invoices/payments/credits)
export const customerInvoicesTable = pgTable(
  "customer_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customersTable.id),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceDate: date("invoice_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    saleId: uuid("sale_id"), // reference to sales
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).notNull().default("0"),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull(),
    status: text("status").notNull().default("open"), // open, partial, paid, void
    notes: text("notes"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("customer_invoices_business_number_unique").on(table.businessId, table.invoiceNumber),
    index("customer_invoices_customer_idx").on(table.customerId, table.invoiceDate),
    index("customer_invoices_due_idx").on(table.dueDate, table.status),
  ],
);

export const customerPaymentsTable = pgTable(
  "customer_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customersTable.id),
    invoiceId: uuid("invoice_id").references(() => customerInvoicesTable.id),
    paymentNumber: text("payment_number"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paymentMethod: text("payment_method").notNull(),
    reference: text("reference"),
    paymentDate: date("payment_date", { mode: "string" }).notNull(),
    notes: text("notes"),
    receivedBy: text("received_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("customer_payments_customer_idx").on(table.customerId, table.paymentDate),
    index("customer_payments_invoice_idx").on(table.invoiceId),
  ],
);

export const customerCreditNotesTable = pgTable(
  "customer_credit_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customersTable.id),
    invoiceId: uuid("invoice_id").references(() => customerInvoicesTable.id),
    creditNoteNumber: text("credit_note_number").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    creditDate: date("credit_date", { mode: "string" }).notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("credit_notes_business_number_unique").on(table.businessId, table.creditNoteNumber),
  ],
);

// Suppliers
export const suppliersTable = pgTable(
  "suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    supplierCode: text("supplier_code"),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    supplierType: text("supplier_type").notNull(), // farmer, broker, transporter, feed, packaging
    phone: text("phone"),
    email: text("email"),
    taxPin: text("tax_pin"),
    registrationNumber: text("registration_number"),
    address: text("address"),
    location: text("location"),
    paymentTermsDays: numeric("payment_terms_days", { precision: 5, scale: 0 })
      .notNull()
      .default("0"),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("suppliers_business_idx").on(table.businessId),
    index("suppliers_type_idx").on(table.supplierType),
  ],
);

// Supplier invoices
export const supplierInvoicesTable = pgTable(
  "supplier_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliersTable.id),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceDate: date("invoice_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    purchaseOrderId: uuid("purchase_order_id"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
    taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).notNull().default("0"),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull(),
    status: text("status").notNull().default("open"),
    notes: text("notes"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("supplier_invoices_business_number_unique").on(table.businessId, table.invoiceNumber),
    index("supplier_invoices_supplier_idx").on(table.supplierId, table.invoiceDate),
    index("supplier_invoices_due_idx").on(table.dueDate, table.status),
  ],
);

export const supplierPaymentsTable = pgTable(
  "supplier_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliersTable.id),
    invoiceId: uuid("invoice_id").references(() => supplierInvoicesTable.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paymentMethod: text("payment_method").notNull(),
    reference: text("reference"),
    paymentDate: date("payment_date", { mode: "string" }).notNull(),
    paidBy: text("paid_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("supplier_payments_supplier_idx").on(table.supplierId, table.paymentDate),
  ],
);

// Price lists (customer-specific and general pricing)
export const priceListsTable = pgTable(
  "price_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id").references(() => branchesTable.id),
    productId: uuid("product_id").notNull(),
    customerId: uuid("customer_id").references(() => customersTable.id),
    price: numeric("price", { precision: 14, scale: 2 }).notNull(),
    unit: text("unit").notNull(),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    effectiveTo: date("effective_to", { mode: "string" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("price_lists_business_idx").on(table.businessId),
    index("price_lists_product_idx").on(table.productId),
    index("price_lists_customer_idx").on(table.customerId),
    index("price_lists_effective_idx").on(table.effectiveFrom, table.effectiveTo),
  ],
);

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomerInvoiceSchema = createInsertSchema(customerInvoicesTable).omit({ id: true, createdAt: true });
export const insertSupplierInvoiceSchema = createInsertSchema(supplierInvoicesTable).omit({ id: true, createdAt: true });
export const insertPriceListSchema = createInsertSchema(priceListsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Customer = typeof customersTable.$inferSelect;
export type Supplier = typeof suppliersTable.$inferSelect;
export type CustomerInvoice = typeof customerInvoicesTable.$inferSelect;
export type SupplierInvoice = typeof supplierInvoicesTable.$inferSelect;
export type CustomerPayment = typeof customerPaymentsTable.$inferSelect;
export type SupplierPayment = typeof supplierPaymentsTable.$inferSelect;
export type PriceList = typeof priceListsTable.$inferSelect;
