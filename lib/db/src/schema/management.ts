import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { businessesTable, branchesTable } from "./business";

export const businessActionsTable = pgTable(
  "business_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    title: text("title").notNull(),
    owner: text("owner").notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    successMetric: text("success_metric").notNull(),
    status: text("status").notNull().default("open"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("business_actions_business_due_idx").on(
      table.businessId,
      table.dueDate,
    ),
  ],
);

export const auditEventsTable = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id").references(() => branchesTable.id),
    actorUserId: text("actor_user_id").notNull(),
    action: text("action").notNull(),
    recordType: text("record_type").notNull(),
    recordId: uuid("record_id").notNull(),
    details: text("details").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_business_created_idx").on(
      table.businessId,
      table.createdAt,
    ),
    index("audit_events_record_idx").on(table.recordType, table.recordId),
  ],
);

export type BusinessAction = typeof businessActionsTable.$inferSelect;
export type AuditEvent = typeof auditEventsTable.$inferSelect;
