import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { businessesTable, branchesTable } from "./business";
import { usersTable } from "./auth";
import { z } from "zod/v4";

export const chartOfAccountsTable = pgTable(
  "chart_of_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id").references(() => branchesTable.id),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    normalBalance: varchar("normal_balance", { length: 10 }).notNull(),
    parentId: uuid("parent_id"),
    isActive: boolean("is_active").notNull().default(true),
    isPostable: boolean("is_postable").notNull().default(true),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("chart_of_accounts_business_code_unique").on(
      table.businessId,
      table.code,
    ),
    index("chart_of_accounts_business_idx").on(table.businessId),
    index("chart_of_accounts_parent_idx").on(table.parentId),
    index("chart_of_accounts_type_idx").on(table.type),
    check(
      "chart_of_accounts_type_check",
      sql`"type" IN ('asset','liability','equity','revenue','expense')`,
    ),
    check(
      "chart_of_accounts_normal_balance_check",
      sql`"normal_balance" IN ('debit','credit')`,
    ),
  ],
);

export const taxCodesTable = pgTable(
  "tax_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    type: varchar("type", { length: 30 }).notNull(),
    rate: numeric("rate", { precision: 14, scale: 4 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("tax_codes_business_code_unique").on(table.businessId, table.code),
    index("tax_codes_business_idx").on(table.businessId),
    index("tax_codes_type_idx").on(table.type),
  ],
);

export const accountingPeriodsTable = pgTable(
  "accounting_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    name: varchar("name", { length: 100 }).notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: uuid("locked_by").references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("accounting_periods_business_idx").on(table.businessId),
    index("accounting_periods_status_idx").on(table.status),
    index("accounting_periods_date_idx").on(table.startDate, table.endDate),
  ],
);

export const periodLocksTable = pgTable(
  "period_locks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id").references(() => branchesTable.id),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    lockedBy: uuid("locked_by").references(() => usersTable.id),
    lockedAt: timestamp("locked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reason: text("reason"),
  },
  (table) => [
    index("period_locks_business_idx").on(table.businessId),
    index("period_locks_date_idx").on(table.periodStart, table.periodEnd),
  ],
);

export const journalEntriesTable = pgTable(
  "journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id").references(() => branchesTable.id),
    reference: varchar("reference", { length: 50 }).notNull(),
    entryDate: timestamp("entry_date", { withTimezone: true }).notNull(),
    description: text("description").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    totalDebit: numeric("total_debit", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    totalCredit: numeric("total_credit", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    postedBy: uuid("posted_by").references(() => usersTable.id),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    reversedBy: uuid("reversed_by").references(() => usersTable.id),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversalReason: text("reversal_reason"),
    sourceType: varchar("source_type", { length: 50 }),
    sourceId: uuid("source_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("journal_entries_business_reference_unique").on(
      table.businessId,
      table.reference,
    ),
    index("journal_entries_business_idx").on(table.businessId),
    index("journal_entries_branch_idx").on(table.branchId),
    index("journal_entries_date_idx").on(table.entryDate),
    index("journal_entries_status_idx").on(table.status),
    index("journal_entries_source_idx").on(table.sourceType, table.sourceId),
    check(
      "journal_entries_status_check",
      sql`"status" IN ('draft','posted','reversed','closed')`,
    ),
  ],
);

export const journalLinesTable = pgTable(
  "journal_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => journalEntriesTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => chartOfAccountsTable.id),
    branchId: uuid("branch_id").references(() => branchesTable.id),
    debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
    credit: numeric("credit", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("journal_lines_entry_idx").on(table.journalEntryId),
    index("journal_lines_account_idx").on(table.accountId),
    index("journal_lines_branch_idx").on(table.branchId),
    check(
      "journal_lines_debit_credit_check",
      sql`("debit" = 0 AND "credit" > 0) OR ("credit" = 0 AND "debit" > 0) OR ("debit" = 0 AND "credit" = 0)`,
    ),
  ],
);

export const insertChartOfAccountSchema = createInsertSchema(
  chartOfAccountsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaxCodeSchema = createInsertSchema(taxCodesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertAccountingPeriodSchema = createInsertSchema(
  accountingPeriodsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPeriodLockSchema = createInsertSchema(periodLocksTable).omit({
  id: true,
  lockedAt: true,
});
export const insertJournalEntrySchema = createInsertSchema(
  journalEntriesTable,
).omit({
  id: true,
  totalDebit: true,
  totalCredit: true,
  postedBy: true,
  postedAt: true,
  reversedBy: true,
  reversedAt: true,
  createdAt: true,
  updatedAt: true,
});
export const insertJournalLineSchema = createInsertSchema(journalLinesTable).omit({
  id: true,
  createdAt: true,
});

export type ChartOfAccount = typeof chartOfAccountsTable.$inferSelect;
export type TaxCode = typeof taxCodesTable.$inferSelect;
export type AccountingPeriod = typeof accountingPeriodsTable.$inferSelect;
export type PeriodLock = typeof periodLocksTable.$inferSelect;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;
export type JournalLine = typeof journalLinesTable.$inferSelect;
export type InsertChartOfAccount = z.infer<typeof insertChartOfAccountSchema>;
export type InsertTaxCode = z.infer<typeof insertTaxCodeSchema>;
export type InsertAccountingPeriod = z.infer<
  typeof insertAccountingPeriodSchema
>;
export type InsertPeriodLock = z.infer<typeof insertPeriodLockSchema>;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type InsertJournalLine = z.infer<typeof insertJournalLineSchema>;
