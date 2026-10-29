import { Request, RequestHandler, Response } from "express";
import { validateSession, revokeSession, type AuthContext, hasPermission } from "../lib/auth";
import { db } from "@workspace/db";
import { businessesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const context = await validateSession(token);
  if (!context) {
    res.status(401).json({ error: "Invalid or expired session." });
    return;
  }

  const [business] = await db
    .select({ id: businessesTable.id })
    .from(businessesTable)
    .where(eq(businessesTable.id, context.businessId))
    .limit(1);

  if (!business) {
    res.status(401).json({ error: "Business not found." });
    return;
  }

  (req as any).appContext = { businessId: context.businessId };

  (req as AuthenticatedRequest).auth = context;
  next();
};

export function requirePermission(permission: string): RequestHandler {
  return (req, res, next) => {
    const context = (req as AuthenticatedRequest).auth;
    if (!context) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!hasPermission(context, permission)) {
      res.status(403).json({ error: `Insufficient permissions: ${permission} required.` });
      return;
    }
    next();
  };
}

export function requireAnyPermission(permissions: string[]): RequestHandler {
  return (req, res, next) => {
    const context = (req as AuthenticatedRequest).auth;
    if (!context) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    const has = permissions.some((p) => context.permissions.includes(p));
    if (!has) {
      res.status(403).json({ error: `Insufficient permissions. One of: ${permissions.join(", ")} required.` });
      return;
    }
    next();
  };
}

export const optionalAuth: RequestHandler = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const context = await validateSession(token);
    if (context) {
      (req as any).appContext = { businessId: context.businessId };
      (req as AuthenticatedRequest).auth = context;
    }
  } catch {
    // ignore invalid sessions in optional mode
  }
  next();
};

function extractToken(req: Request): string | null {
  const auth = req.headers["authorization"];
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export function getBusinessContext(req: Request): { businessId: string } | null {
  return (req as any).appContext ?? null;
}

export { revokeSession };
