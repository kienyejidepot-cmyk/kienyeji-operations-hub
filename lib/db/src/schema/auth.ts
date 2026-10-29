import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
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
import { z } from "zod/v4";

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    isActive: boolean("is_active").notNull().default(true),
    emailVerified: boolean("email_verified").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("users_business_email_unique").on(table.businessId, table.email),
    index("users_business_idx").on(table.businessId),
    index("users_email_idx").on(table.email),
  ],
);

export const rolesTable = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessesTable.id),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("roles_business_name_unique").on(table.businessId, table.name),
    index("roles_business_idx").on(table.businessId),
  ],
);

export const rolePermissionsTable = pgTable(
  "role_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "cascade" }),
    permission: varchar("permission", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("role_permissions_role_permission_unique").on(
      table.roleId,
      table.permission,
    ),
    index("role_permissions_role_idx").on(table.roleId),
  ],
);

export const userRolesTable = pgTable(
  "user_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branchesTable.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    assignedBy: uuid("assigned_by").references(() => usersTable.id),
  },
  (table) => [
    unique("user_roles_user_role_branch_unique").on(
      table.userId,
      table.roleId,
      table.branchId,
    ),
    index("user_roles_user_idx").on(table.userId),
    index("user_roles_role_idx").on(table.roleId),
    index("user_roles_branch_idx").on(table.branchId),
  ],
);

export const userSessionsTable = pgTable(
  "user_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("user_sessions_user_idx").on(table.userId),
    index("user_sessions_token_idx").on(table.tokenHash),
    index("user_sessions_expires_idx").on(table.expiresAt),
  ],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertRoleSchema = createInsertSchema(rolesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertRolePermissionSchema = createInsertSchema(
  rolePermissionsTable,
).omit({ id: true, createdAt: true });
export const insertUserRoleSchema = createInsertSchema(userRolesTable).omit({
  id: true,
  assignedAt: true,
});
export const insertUserSessionSchema = createInsertSchema(userSessionsTable).omit({
  id: true,
  createdAt: true,
  lastAccessedAt: true,
});

export type User = typeof usersTable.$inferSelect;
export type Role = typeof rolesTable.$inferSelect;
export type RolePermission = typeof rolePermissionsTable.$inferSelect;
export type UserRole = typeof userRolesTable.$inferSelect;
export type UserSession = typeof userSessionsTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
