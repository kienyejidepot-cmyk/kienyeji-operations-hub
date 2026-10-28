import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import type { RequestHandler, Response } from "express";
import Decimal from "decimal.js";
import { db, businessesTable, branchesTable, productsTable } from "@workspace/db";

export const requireSignedIn: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access business records." });
    return;
  }
  res.locals.actorUserId = userId;
  next();
};

export function actorId(res: Response): string {
  return res.locals.actorUserId as string;
}

export async function getOwnedBusiness(userId: string) {
  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.ownerUserId, userId))
    .limit(1);
  return business ?? null;
}

export async function requireBusiness(res: Response) {
  const business = await getOwnedBusiness(actorId(res));
  if (!business) {
    res.status(409).json({ error: "Complete business setup first." });
    return null;
  }
  return business;
}

export async function branchInBusiness(branchId: string, businessId: string) {
  const [branch] = await db
    .select()
    .from(branchesTable)
    .where(
      and(
        eq(branchesTable.id, branchId),
        eq(branchesTable.businessId, businessId),
        eq(branchesTable.active, true),
      ),
    )
    .limit(1);
  return branch ?? null;
}

export async function productInBusiness(productId: string, businessId: string) {
  const [product] = await db
    .select()
    .from(productsTable)
    .where(
      and(
        eq(productsTable.id, productId),
        eq(productsTable.businessId, businessId),
        eq(productsTable.active, true),
      ),
    )
    .limit(1);
  return product ?? null;
}

export function money(value: Decimal.Value): string {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function quantity(value: Decimal.Value): string {
  return new Decimal(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toFixed(3);
}

export function dateBounds(from: string, to: string): [Date, Date] {
  return [
    new Date(`${from}T00:00:00.000+03:00`),
    new Date(`${to}T23:59:59.999+03:00`),
  ];
}

export function dateOf(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function isValidInstant(value: string): boolean {
  return value.length > 0 && Number.isFinite(new Date(value).getTime());
}

export async function addAuditEvent(
  businessId: string,
  branchId: string | null,
  actorUserId: string,
  action: string,
  recordType: string,
  recordId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  const { auditEventsTable } = await import("@workspace/db");
  await db.insert(auditEventsTable).values({
    businessId,
    branchId,
    actorUserId,
    action,
    recordType,
    recordId,
    details: JSON.stringify(details),
  });
}
