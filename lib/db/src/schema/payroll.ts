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

export const employeesTable = pgTable(
  "employees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id").references(() => branchesTable.id),
    employeeNumber: text("employee_number"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    idNumber: text("id_number"),
    phone: text("phone"),
    email: text("email"),
    role: text("role").notNull(), // owner, manager, cashier, stock_controller, slaughter, etc.
    employmentType: text("employment_type").notNull().default("full_time"),
    hireDate: date("hire_date", { mode: "string" }).notNull(),
    terminationDate: date("termination_date", { mode: "string" }),
    basicSalary: numeric("basic_salary", { precision: 14, scale: 2 }).notNull().default("0"),
    wageRate: numeric("wage_rate", { precision: 14, scale: 2 }).notNull().default("0"),
    payFrequency: text("pay_frequency").notNull().default("monthly"),
    isActive: boolean("is_active").notNull().default(true),
    bankName: text("bank_name"),
    bankAccount: text("bank_account"),
    mpesaNumber: text("mpesa_number"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("employees_business_idx").on(table.businessId),
    index("employees_branch_idx").on(table.branchId),
  ],
);

export const attendanceTable = pgTable(
  "attendance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branchesTable.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employeesTable.id),
    attendanceDate: date("attendance_date", { mode: "string" }).notNull(),
    hoursWorked: numeric("hours_worked", { precision: 5, scale: 2 }).notNull().default("0"),
    overtimeHours: numeric("overtime_hours", { precision: 5, scale: 2 }).notNull().default("0"),
    status: text("status").notNull().default("present"),
    notes: text("notes"),
    recordedBy: text("recorded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("attendance_employee_date_unique").on(table.employeeId, table.attendanceDate),
    index("attendance_branch_date_idx").on(table.branchId, table.attendanceDate),
  ],
);

export const payrollRunsTable = pgTable(
  "payroll_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id").references(() => branchesTable.id),
    runNumber: text("run_number").notNull(),
    payPeriodStart: date("pay_period_start", { mode: "string" }).notNull(),
    payPeriodEnd: date("pay_period_end", { mode: "string" }).notNull(),
    payDate: date("pay_date", { mode: "string" }),
    status: text("status").notNull().default("draft"), // draft, approved, paid
    totalGross: numeric("total_gross", { precision: 14, scale: 2 }).notNull().default("0"),
    totalDeductions: numeric("total_deductions", { precision: 14, scale: 2 }).notNull().default("0"),
    totalNet: numeric("total_net", { precision: 14, scale: 2 }).notNull().default("0"),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("payroll_runs_business_number_unique").on(table.businessId, table.runNumber),
  ],
);

export const payrollItemsTable = pgTable(
  "payroll_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payrollRunId: uuid("payroll_run_id")
      .notNull()
      .references(() => payrollRunsTable.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employeesTable.id),
    basicPay: numeric("basic_pay", { precision: 14, scale: 2 }).notNull().default("0"),
    overtimePay: numeric("overtime_pay", { precision: 14, scale: 2 }).notNull().default("0"),
    allowances: numeric("allowances", { precision: 14, scale: 2 }).notNull().default("0"),
    grossPay: numeric("gross_pay", { precision: 14, scale: 2 }).notNull().default("0"),
    taxDeduction: numeric("tax_deduction", { precision: 14, scale: 2 }).notNull().default("0"),
    otherDeductions: numeric("other_deductions", { precision: 14, scale: 2 }).notNull().default("0"),
    advances: numeric("advances", { precision: 14, scale: 2 }).notNull().default("0"),
    totalDeductions: numeric("total_deductions", { precision: 14, scale: 2 }).notNull().default("0"),
    netPay: numeric("net_pay", { precision: 14, scale: 2 }).notNull().default("0"),
    paid: boolean("paid").notNull().default(false),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentMethod: text("payment_method"),
    paymentReference: text("payment_reference"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("payroll_items_run_idx").on(table.payrollRunId),
    index("payroll_items_employee_idx").on(table.employeeId),
  ],
);

export const employeeAdvancesTable = pgTable(
  "employee_advances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    branchId: uuid("branch_id").references(() => branchesTable.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employeesTable.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    advanceDate: date("advance_date", { mode: "string" }).notNull(),
    status: text("status").notNull().default("pending"),
    repaid: numeric("repaid", { precision: 14, scale: 2 }).notNull().default("0"),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull(),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    issuedBy: text("issued_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("employee_advances_employee_idx").on(table.employeeId, table.advanceDate),
  ],
);

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export const insertPayrollRunSchema = createInsertSchema(payrollRunsTable).omit({ id: true, createdAt: true });

export type Employee = typeof employeesTable.$inferSelect;
export type Attendance = typeof attendanceTable.$inferSelect;
export type PayrollRun = typeof payrollRunsTable.$inferSelect;
export type PayrollItem = typeof payrollItemsTable.$inferSelect;
export type EmployeeAdvance = typeof employeeAdvancesTable.$inferSelect;
