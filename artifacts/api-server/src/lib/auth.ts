import { createHmac, randomBytes, timingSafeEqual, pbkdf2Sync } from "node:crypto";
import { usersTable, userSessionsTable, rolesTable, rolePermissionsTable, userRolesTable, businessesTable } from "@workspace/db";
import { db } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const SALT_ROUNDS = 250000;
const KEY_LENGTH = 64;
const TOKEN_BYTES = 32;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, SALT_ROUNDS, KEY_LENGTH, "sha256");
  return `pbkdf2_sha256$${SALT_ROUNDS}$${salt}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
  const rounds = Number(parts[1]);
  const salt = parts[2];
  const hash = parts[3];
  const computed = pbkdf2Sync(password, salt, rounds, KEY_LENGTH, "sha256").toString("hex");
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computed, "hex"));
}

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashToken(token: string): string {
  return createHmac("sha256", process.env.SESSION_SECRET || "kienyeji-dev-secret-change-in-production")
    .update(token)
    .digest("hex");
}

export interface AuthContext {
  userId: string;
  businessId: string;
  userEmail: string;
  userName: string;
  permissions: string[];
  roles: string[];
  branchId?: string;
}

export async function authenticateUser(email: string, password: string): Promise<{ user: AuthContext; token: string } | null> {
  const [user] = await db
    .select({
      id: usersTable.id,
      businessId: usersTable.businessId,
      email: usersTable.email,
      passwordHash: usersTable.passwordHash,
      fullName: usersTable.fullName,
      isActive: usersTable.isActive,
    })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user || !user.isActive || !user.passwordHash) return null;

  if (!verifyPassword(password, user.passwordHash)) return null;

  const permissions = await getUserPermissions(user.id);
  const roles = await getUserRoleNames(user.id);

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(userSessionsTable).values({
    userId: user.id,
    tokenHash,
    expiresAt,
    lastAccessedAt: new Date(),
  });

  const context: AuthContext = {
    userId: user.id,
    businessId: user.businessId,
    userEmail: user.email,
    userName: user.fullName,
    permissions,
    roles,
  };

  return { user: context, token };
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const rows = await db
    .select({ permission: rolePermissionsTable.permission })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .innerJoin(rolePermissionsTable, eq(rolesTable.id, rolePermissionsTable.roleId))
    .where(and(eq(userRolesTable.userId, userId), eq(rolesTable.isActive, true)));
  return [...new Set(rows.map((r) => r.permission))];
}

export async function getUserRoleNames(userId: string): Promise<string[]> {
  const rows = await db
    .select({ name: rolesTable.name })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .where(and(eq(userRolesTable.userId, userId), eq(rolesTable.isActive, true)));
  return rows.map((r) => r.name);
}

export async function validateSession(token: string): Promise<AuthContext | null> {
  const tokenHash = hashToken(token);
  const now = new Date();

  const [session] = await db
    .select({
      sessionId: userSessionsTable.id,
      userId: userSessionsTable.userId,
      expiresAt: userSessionsTable.expiresAt,
    })
    .from(userSessionsTable)
    .where(and(eq(userSessionsTable.tokenHash, tokenHash)))
    .limit(1);

  if (!session) return null;
  if (session.expiresAt <= now) return null;

  await db
    .update(userSessionsTable)
    .set({ lastAccessedAt: now })
    .where(eq(userSessionsTable.id, session.sessionId));

  const [user] = await db
    .select({
      id: usersTable.id,
      businessId: usersTable.businessId,
      email: usersTable.email,
      fullName: usersTable.fullName,
      isActive: usersTable.isActive,
    })
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .limit(1);

  if (!user || !user.isActive) return null;

  const permissions = await getUserPermissions(user.id);
  const roles = await getUserRoleNames(user.id);

  return {
    userId: user.id,
    businessId: user.businessId,
    userEmail: user.email,
    userName: user.fullName,
    permissions,
    roles,
  };
}

export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.delete(userSessionsTable).where(eq(userSessionsTable.tokenHash, tokenHash));
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.delete(userSessionsTable).where(eq(userSessionsTable.userId, userId));
}

export function hasPermission(context: AuthContext, permission: string): boolean {
  return context.permissions.includes(permission);
}

export function hasAnyPermission(context: AuthContext, permissions: string[]): boolean {
  return permissions.some((p) => context.permissions.includes(p));
}

export const PERMISSIONS = {
  SALES_CREATE: "sales.create",
  SALES_EDIT: "sales.edit",
  SALES_EDIT_OWN: "sales.edit_own",
  SALES_VOID: "sales.void",
  SALES_APPROVE_DISCOUNT: "sales.approve_discount",
  SALES_VIEW: "sales.view",
  PURCHASES_CREATE: "purchases.create",
  PURCHASES_EDIT: "purchases.edit",
  PURCHASES_APPROVE: "purchases.approve",
  PURCHASES_VIEW: "purchases.view",
  SLAUGHTER_CREATE: "slaughter.create",
  SLAUGHTER_EDIT: "slaughter.edit",
  SLAUGHTER_EDIT_OWN: "slaughter.edit_own",
  SLAUGHTER_CONFIRM: "slaughter.confirm",
  SLAUGHTER_VIEW: "slaughter.view",
  INVENTORY_RECEIVE: "inventory.receive",
  INVENTORY_COUNT: "inventory.count",
  INVENTORY_ADJUST: "inventory.adjust",
  INVENTORY_TRANSFER: "inventory.transfer",
  INVENTORY_VIEW: "inventory.view",
  EXPENSES_CREATE: "expenses.create",
  EXPENSES_EDIT: "expenses.edit",
  EXPENSES_APPROVE: "expenses.approve",
  EXPENSES_VIEW: "expenses.view",
  CUSTOMERS_MANAGE: "customers.manage",
  CUSTOMERS_VIEW: "customers.view",
  SUPPLIERS_MANAGE: "suppliers.manage",
  SUPPLIERS_VIEW: "suppliers.view",
  CASHBOOK_RECONCILE: "cashbook.reconcile",
  CASHBOOK_RECONCILE_OWN: "cashbook.reconcile_own",
  CASHBOOK_CLOSE_DAILY: "cashbook.close_daily",
  CASHBOOK_VIEW: "cashbook.view",
  ACCOUNTING_POST_JOURNAL: "accounting.post_journal",
  ACCOUNTING_REVERSE: "accounting.reverse",
  ACCOUNTING_VIEW_REPORTS: "accounting.view_reports",
  ACCOUNTING_LOCK_PERIOD: "accounting.lock_period",
  ACCOUNTING_MANAGE_CHART: "accounting.manage_chart_of_accounts",
  PAYROLL_MANAGE: "payroll.manage",
  PAYROLL_VIEW: "payroll.view",
  PAYROLL_VIEW_SENSITIVE: "payroll.view_sensitive",
  COMPLIANCE_MANAGE: "compliance.manage",
  COMPLIANCE_VIEW: "compliance.view",
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",
  SETTINGS_MANAGE: "settings.manage",
  REPORTS_VIEW_ALL: "reports.view_all",
  REPORTS_VIEW_OWN: "reports.view_own",
  REPORTS_EXPORT: "reports.export",
  REPORTS_VIEW_INVENTORY: "reports.view_inventory",
  ALERTS_MANAGE: "alerts.manage",
  ALERTS_VIEW: "alerts.view",
  AUDIT_LOG_VIEW: "audit.log.view",
  GROWTH_PLANNER_VIEW: "growth_planner.view",
  GROWTH_PLANNER_CREATE: "growth_planner.create",
} as const;
