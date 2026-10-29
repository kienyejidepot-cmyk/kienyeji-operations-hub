import { Router, type IRouter } from "express";
import Decimal from "decimal.js";
import {
  authenticateUser,
  generateToken,
  hashToken,
  revokeSession,
  validateSession,
} from "../lib/auth";
import { db } from "@workspace/db";
import {
  businessesTable,
  usersTable,
  userSessionsTable,
  rolesTable,
  rolePermissionsTable,
  userRolesTable,
  chartOfAccountsTable,
  taxCodesTable,
  accountingPeriodsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { PERMISSIONS } from "../lib/auth";

const router: IRouter = Router();

router.post("/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const result = await authenticateUser(email, password);
  if (!result) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  res.json({
    user: {
      id: result.user.userId,
      businessId: result.user.businessId,
      email: result.user.userEmail,
      fullName: result.user.userName,
      roles: result.user.roles,
      permissions: result.user.permissions,
    },
    token: result.token,
  });
});

router.post("/logout", async (req, res): Promise<void> => {
  const auth = req.headers["authorization"];
  if (auth && auth.startsWith("Bearer ")) {
    await revokeSession(auth.slice(7));
  }
  res.json({ ok: true });
});

router.get("/me", async (req, res): Promise<void> => {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const context = await validateSession(auth.slice(7));
  if (!context) {
    res.status(401).json({ error: "Invalid or expired session." });
    return;
  }

  res.json({
    user: {
      id: context.userId,
      businessId: context.businessId,
      email: context.userEmail,
      fullName: context.userName,
      roles: context.roles,
      permissions: context.permissions,
    },
  });
});

router.post("/register", async (req, res): Promise<void> => {
  const {
    email,
    password,
    fullName,
    phone,
    businessName,
    tradingName,
    taxPin,
    registrationNumber,
    vatRegistered,
    openingDate,
  } = req.body as {
    email?: string;
    password?: string;
    fullName?: string;
    phone?: string;
    businessName?: string;
    tradingName?: string;
    taxPin?: string;
    registrationNumber?: string;
    vatRegistered?: boolean;
    openingDate?: string;
  };

  if (!email || !password || !fullName || !businessName) {
    res.status(400).json({ error: "Email, password, full name, and business name are required." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered." });
    return;
  }

  const { hashPassword } = await import("../lib/auth");
  const passwordHash = hashPassword(password);

  const result = await db.transaction(async (tx) => {
    // 1. Create business (owner_user_id set after user creation)
    const [business] = await tx
      .insert(businessesTable)
      .values({
        ownerUserId: "",
        name: businessName.trim(),
        tradingName: tradingName?.trim() || null,
        currency: "KES",
        countryCode: "KE",
        timezone: "Africa/Nairobi",
        openingDate: openingDate || new Date().toISOString().split("T")[0],
        taxPin: taxPin?.trim() || null,
        registrationNumber: registrationNumber?.trim() || null,
        vatRegistered: vatRegistered ?? false,
        isSampleData: false,
      })
      .returning();

    // 2. Create user linked to business
    const [user] = await tx
      .insert(usersTable)
      .values({
        businessId: business.id,
        email: email.toLowerCase().trim(),
        passwordHash,
        fullName: fullName.trim(),
        phone: phone ?? null,
        isActive: true,
        emailVerified: false,
      })
      .returning();

    // 3. Link business owner to this user
    await tx
      .update(businessesTable)
      .set({ ownerUserId: user.id })
      .where(eq(businessesTable.id, business.id));

    // 4. Create Owner role with ALL permissions
    const [ownerRole] = await tx
      .insert(rolesTable)
      .values({
        businessId: business.id,
        name: "Owner / Administrator",
        description: "Full access to all modules and settings.",
        isSystem: true,
        isActive: true,
      })
      .returning();

    const allPermissions = Object.values(PERMISSIONS);
    for (const perm of allPermissions) {
      await tx.insert(rolePermissionsTable).values({
        roleId: ownerRole.id,
        permission: perm,
      });
    }

    // 5. Assign user to Owner role
    await tx.insert(userRolesTable).values({
      userId: user.id,
      roleId: ownerRole.id,
      assignedBy: user.id,
    });

    // 6. Default chart of accounts (production defaults, not sample data)
    const defaultAccounts = [
      { code: "1000", name: "Cash on Hand", type: "asset", normalBalance: "debit", description: "Physical cash in the till" },
      { code: "1010", name: "Bank Account", type: "asset", normalBalance: "debit", description: "Business bank account" },
      { code: "1020", name: "M-Pesa Account", type: "asset", normalBalance: "debit", description: "M-Pesa business till" },
      { code: "1100", name: "Trade Receivables", type: "asset", normalBalance: "debit", description: "Money owed by credit customers" },
      { code: "1200", name: "Inventory - Live Birds", type: "asset", normalBalance: "debit", description: "Live kienyeji birds on hand (at cost)" },
      { code: "1210", name: "Inventory - Dressed Chicken", type: "asset", normalBalance: "debit", description: "Whole dressed birds (at cost)" },
      { code: "1220", name: "Inventory - Cuts & Offal", type: "asset", normalBalance: "debit", description: "Portions and offal (at cost)" },
      { code: "2000", name: "Trade Payables", type: "liability", normalBalance: "credit", description: "Money owed to suppliers" },
      { code: "2300", name: "Tax Payable", type: "liability", normalBalance: "credit", description: "VAT and other taxes collected" },
      { code: "3000", name: "Owner Equity", type: "equity", normalBalance: "credit", description: "Owner capital investment" },
      { code: "3100", name: "Owner Drawings", type: "equity", normalBalance: "debit", description: "Owner withdrawals" },
      { code: "4000", name: "Sales Revenue", type: "revenue", normalBalance: "credit", description: "Income from sales of chicken products" },
      { code: "5000", name: "Cost of Goods Sold", type: "expense", normalBalance: "debit", description: "Cost of products sold" },
      { code: "6000", name: "Rent", type: "expense", normalBalance: "debit", description: "Shop rent" },
      { code: "6100", name: "Salaries & Wages", type: "expense", normalBalance: "debit", description: "Staff salaries" },
    ];

    for (const acc of defaultAccounts) {
      await tx.insert(chartOfAccountsTable).values({
        businessId: business.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        normalBalance: acc.normalBalance,
        description: acc.description,
      });
    }

    // 7. Default tax codes (Kenya)
    const defaultTaxCodes = [
      { code: "VAT-16", name: "VAT at 16%", type: "output_vat", rate: "0.1600", description: "Standard VAT rate on sales" },
      { code: "VAT-EXEMPT", name: "VAT Exempt", type: "output_vat", rate: "0.0000", description: "VAT-exempt supplies" },
      { code: "WHT-5", name: "Withholding Tax 5%", type: "withholding", rate: "0.0500", description: "Withholding tax on payments" },
      { code: "NONE", name: "No Tax", type: "none", rate: "0.0000", description: "No tax applicable" },
    ];

    for (const tc of defaultTaxCodes) {
      await tx.insert(taxCodesTable).values({
        businessId: business.id,
        code: tc.code,
        name: tc.name,
        type: tc.type,
        rate: new Decimal(tc.rate).toFixed(4),
        description: tc.description,
      });
    }

    // 8. Default accounting period (current calendar year)
    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);
    const yearEnd = new Date();
    yearEnd.setMonth(11, 31);
    yearEnd.setHours(23, 59, 59, 999);

    await tx.insert(accountingPeriodsTable).values({
      businessId: business.id,
      name: `FY ${yearStart.getFullYear()}`,
      startDate: yearStart,
      endDate: yearEnd,
      status: "open",
    });

    return { business, user, ownerRole };
  });

  // Generate session token for immediate login
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(userSessionsTable).values({
    userId: result.user.id,
    tokenHash,
    expiresAt,
    lastAccessedAt: new Date(),
  });

  res.status(201).json({
    user: {
      id: result.user.id,
      businessId: result.user.businessId,
      email: result.user.email,
      fullName: result.user.fullName,
      roles: ["Owner / Administrator"],
      permissions: Object.values(PERMISSIONS),
    },
    business: {
      id: result.business.id,
      name: result.business.name,
      tradingName: result.business.tradingName,
    },
    token,
  });
});

export default router;
