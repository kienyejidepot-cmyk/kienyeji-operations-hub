import { Router, type IRouter } from "express";
import Decimal from "decimal.js";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  rolesTable,
  rolePermissionsTable,
  userRolesTable,
  chartOfAccountsTable,
  taxCodesTable,
  suppliersTable,
  customersTable,
  priceListsTable,
} from "@workspace/db";
import {
  requireAuth,
  requirePermission,
  type AuthenticatedRequest,
} from "../middleware/auth";
import {
  PERMISSIONS,
  getUserRoleNames,
  getUserPermissions,
} from "../lib/auth";
import { addAuditEvent } from "./common";

const router: IRouter = Router();
router.use(requireAuth);

function businessId(req: AuthenticatedRequest): string {
  const ctx = (req as any).appContext;
  if (!ctx) throw new Error("No business context");
  return ctx.businessId;
}

function paramId(req: AuthenticatedRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function authUserId(req: AuthenticatedRequest): string {
  return (req as AuthenticatedRequest).auth!.userId;
}

// ---------- USERS ----------

router.get("/users", requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      phone: usersTable.phone,
      isActive: usersTable.isActive,
      lastLoginAt: usersTable.lastLoginAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.businessId, businessId(req)))
    .orderBy(asc(usersTable.createdAt));

  const enriched = await Promise.all(
    rows.map(async (u) => {
      const roles = await getUserRoleNames(u.id);
      const permissions = await getUserPermissions(u.id);
      return {
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        phone: u.phone,
        isActive: u.isActive,
        roles,
        permissions,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
      };
    }),
  );
  res.json(enriched);
});

router.post("/users", requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res): Promise<void> => {
  const {
    email,
    password,
    fullName,
    phone,
    roleIds,
    branchId,
  } = req.body as {
    email?: string;
    password?: string;
    fullName?: string;
    phone?: string;
    roleIds?: string[];
    branchId?: string;
  };
  if (!email || !password || !fullName || !roleIds || roleIds.length === 0) {
    res.status(400).json({ error: "Email, password, full name, and at least one role are required." });
    return;
  }

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.businessId, businessId(req)),
        eq(usersTable.email, email.toLowerCase().trim()),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered for this business." });
    return;
  }

  const { hashPassword } = await import("../lib/auth");
  const user = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(usersTable)
      .values({
        businessId: businessId(req),
        email: email.toLowerCase().trim(),
        passwordHash: hashPassword(password),
        fullName: fullName.trim(),
        phone: phone ?? null,
        isActive: true,
        emailVerified: false,
      })
      .returning();

    for (const roleId of roleIds) {
      await tx.insert(userRolesTable).values({
        userId: u.id,
        roleId,
        branchId: branchId ?? null,
        assignedBy: authUserId(req),
      });
    }

    return u;
  });

  await addAuditEvent(
    businessId(req),
    null,
    authUserId(req),
    "user.created",
    "user",
    user.id,
    { email },
  );

  res.status(201).json({ id: user.id, email: user.email, fullName: user.fullName });
});

router.patch("/users/:id", requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res): Promise<void> => {
  const userId = paramId(req);
  const { fullName, phone, isActive } = req.body as {
    fullName?: string;
    phone?: string | null;
    isActive?: boolean;
  };

  const [current] = await db
    .select()
    .from(usersTable)
    .where(
      and(eq(usersTable.id, userId), eq(usersTable.businessId, businessId(req))),
    )
    .limit(1);

  if (!current) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (fullName !== undefined) updates.fullName = fullName.trim();
  if (phone !== undefined) updates.phone = phone;
  if (isActive !== undefined) updates.isActive = isActive;

  await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));

  if (isActive === false) {
    const { revokeAllUserSessions } = await import("../lib/auth");
    await revokeAllUserSessions(userId);
  }

  await addAuditEvent(
    businessId(req),
    null,
    authUserId(req),
    "user.updated",
    "user",
    userId,
    { fullName, phone, isActive },
  );

  res.json({ ok: true });
});

// ---------- ROLES ----------

router.get("/roles", requirePermission(PERMISSIONS.ROLES_MANAGE), async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: rolesTable.id,
      name: rolesTable.name,
      description: rolesTable.description,
      isSystem: rolesTable.isSystem,
      isActive: rolesTable.isActive,
    })
    .from(rolesTable)
    .where(eq(rolesTable.businessId, businessId(req)))
    .orderBy(asc(rolesTable.name));

  const enriched = await Promise.all(
    rows.map(async (r) => {
      const perms = await db
        .select({ permission: rolePermissionsTable.permission })
        .from(rolePermissionsTable)
        .where(eq(rolePermissionsTable.roleId, r.id));
      return { ...r, permissions: perms.map((p) => p.permission) };
    }),
  );
  res.json(enriched);
});

router.post("/roles", requirePermission(PERMISSIONS.ROLES_MANAGE), async (req, res): Promise<void> => {
  const { name, description, permissions } = req.body as {
    name?: string;
    description?: string;
    permissions?: string[];
  };
  if (!name) {
    res.status(400).json({ error: "Role name is required." });
    return;
  }

  const [role] = await db
    .insert(rolesTable)
    .values({
      businessId: businessId(req),
      name: name.trim(),
      description: description ?? null,
      isSystem: false,
      isActive: true,
    })
    .returning();

  for (const perm of permissions ?? []) {
    await db.insert(rolePermissionsTable).values({
      roleId: role.id,
      permission: perm,
    });
  }

  await addAuditEvent(
    businessId(req),
    null,
    authUserId(req),
    "role.created",
    "role",
    role.id,
    { name },
  );

  res.status(201).json({ id: role.id, name: role.name });
});

// ---------- CHART OF ACCOUNTS ----------

router.get("/chart-of-accounts", requirePermission(PERMISSIONS.ACCOUNTING_VIEW_REPORTS), async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(chartOfAccountsTable)
    .where(eq(chartOfAccountsTable.businessId, businessId(req)))
    .orderBy(asc(chartOfAccountsTable.code));
  res.json(rows);
});

router.post("/chart-of-accounts", requirePermission(PERMISSIONS.ACCOUNTING_MANAGE_CHART), async (req, res): Promise<void> => {
  const {
    code,
    name,
    type,
    normalBalance,
    parentId,
    isPostable,
    description,
  } = req.body as {
    code?: string;
    name?: string;
    type?: string;
    normalBalance?: string;
    parentId?: string | null;
    isPostable?: boolean;
    description?: string;
  };
  if (!code || !name || !type || !normalBalance) {
    res.status(400).json({ error: "Code, name, type, and normal balance are required." });
    return;
  }

  const [account] = await db
    .insert(chartOfAccountsTable)
    .values({
      businessId: businessId(req),
      code: code.trim(),
      name: name.trim(),
      type,
      normalBalance,
      parentId: parentId ?? null,
      isActive: true,
      isPostable: isPostable ?? true,
      description: description ?? null,
    })
    .returning();

  await addAuditEvent(
    businessId(req),
    null,
    authUserId(req),
    "chart_of_account.created",
    "chart_of_account",
    account.id,
    { code },
  );

  res.status(201).json(account);
});

// ---------- TAX CODES ----------

router.get("/tax-codes", requirePermission(PERMISSIONS.ACCOUNTING_VIEW_REPORTS), async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(taxCodesTable)
    .where(eq(taxCodesTable.businessId, businessId(req)))
    .orderBy(asc(taxCodesTable.code));
  res.json(rows);
});

router.post("/tax-codes", requirePermission(PERMISSIONS.ACCOUNTING_MANAGE_CHART), async (req, res): Promise<void> => {
  const {
    code,
    name,
    type,
    rate,
    isActive,
    description,
  } = req.body as {
    code?: string;
    name?: string;
    type?: string;
    rate?: string;
    isActive?: boolean;
    description?: string;
  };
  if (!code || !name || !type || rate === undefined) {
    res.status(400).json({ error: "Code, name, type, and rate are required." });
    return;
  }

  const [taxCode] = await db
    .insert(taxCodesTable)
    .values({
      businessId: businessId(req),
      code: code.trim(),
      name: name.trim(),
      type: type.trim(),
      rate: new Decimal(rate).toFixed(4),
      isActive: isActive ?? true,
      description: description ?? null,
    })
    .returning();

  res.status(201).json(taxCode);
});

// ---------- SUPPLIERS ----------

router.get("/suppliers", requirePermission(PERMISSIONS.SUPPLIERS_VIEW), async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.businessId, businessId(req)))
    .orderBy(asc(suppliersTable.name));
  res.json(rows);
});

router.post("/suppliers", requirePermission(PERMISSIONS.SUPPLIERS_MANAGE), async (req, res): Promise<void> => {
  const {
    name,
    contactPerson,
    phone,
    email,
    taxPin,
    registrationNumber,
    supplierType,
    location,
    paymentTermsDays,
    creditLimit,
    notes,
  } = req.body as {
    name?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    taxPin?: string;
    registrationNumber?: string;
    supplierType?: string;
    location?: string;
    paymentTermsDays?: string;
    creditLimit?: string;
    notes?: string;
  };
  if (!name || !supplierType) {
    res.status(400).json({ error: "Name and supplier type are required." });
    return;
  }

  const [supplier] = await db
    .insert(suppliersTable)
    .values({
      businessId: businessId(req),
      name: name.trim(),
      contactPerson: contactPerson ?? null,
      phone: phone ?? null,
      email: email ?? null,
      taxPin: taxPin ?? null,
      registrationNumber: registrationNumber ?? null,
      supplierType: supplierType.trim(),
      location: location ?? null,
      paymentTermsDays: new Decimal(paymentTermsDays ?? "0").toFixed(0),
      isActive: true,
      notes: notes ?? null,
    })
    .returning();

  await addAuditEvent(
    businessId(req),
    null,
    authUserId(req),
    "supplier.created",
    "supplier",
    supplier.id,
    { name },
  );

  res.status(201).json(supplier);
});

// ---------- CUSTOMERS ----------

router.get("/customers", requirePermission(PERMISSIONS.CUSTOMERS_VIEW), async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.businessId, businessId(req)))
    .orderBy(asc(customersTable.name));
  res.json(rows);
});

router.post("/customers", requirePermission(PERMISSIONS.CUSTOMERS_MANAGE), async (req, res): Promise<void> => {
  const {
    name,
    contactPerson,
    phone,
    email,
    taxPin,
    customerType,
    location,
    creditLimit,
    creditTermsDays,
    isCreditAllowed,
    notes,
  } = req.body as {
    name?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    taxPin?: string;
    customerType?: string;
    location?: string;
    creditLimit?: string;
    creditTermsDays?: string;
    isCreditAllowed?: boolean;
    notes?: string;
  };
  if (!name || !customerType) {
    res.status(400).json({ error: "Name and customer type are required." });
    return;
  }

  const [customer] = await db
    .insert(customersTable)
    .values({
      businessId: businessId(req),
      name: name.trim(),
      contactPerson: contactPerson ?? null,
      phone: phone ?? null,
      email: email ?? null,
      taxPin: taxPin ?? null,
      customerType: customerType.trim(),
      location: location ?? null,
      creditLimit: new Decimal(creditLimit ?? "0").toFixed(2),
      paymentTermsDays: new Decimal(creditTermsDays ?? "0").toFixed(0),
      isCreditApproved: isCreditAllowed ?? false,
      isActive: true,
      notes: notes ?? null,
    })
    .returning();

  await addAuditEvent(
    businessId(req),
    null,
    authUserId(req),
    "customer.created",
    "customer",
    customer.id,
    { name },
  );

  res.status(201).json(customer);
});

export default router;
