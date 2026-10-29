import { and, asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateActionBody,
  CreateActionResponse,
  ListActionsResponse,
  UpdateActionBody,
  UpdateActionParams,
  UpdateActionResponse,
} from "@workspace/api-zod";
import { businessActionsTable, db } from "@workspace/db";
import {
  actorId,
  addAuditEvent,
  isCalendarDate,
  requireBusiness,
  requireSignedIn,
} from "./common";

const router: IRouter = Router();
router.use(requireSignedIn);

router.get("/actions", async (_req, res): Promise<void> => {
  const business = await requireBusiness(res);
  if (!business) return;
  const rows = await db
    .select()
    .from(businessActionsTable)
    .where(eq(businessActionsTable.businessId, business.id))
    .orderBy(asc(businessActionsTable.dueDate));
  res.json(
    ListActionsResponse.parse(
      rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    ),
  );
});

router.post("/actions", async (req, res): Promise<void> => {
  const parsed = CreateActionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const business = await requireBusiness(res);
  if (!business) return;
  const [action] = await db
    .insert(businessActionsTable)
    .values({
      businessId: business.id,
      title: parsed.data.title.trim(),
      owner: parsed.data.owner.trim(),
      dueDate: parsed.data.dueDate,
      successMetric: parsed.data.successMetric.trim(),
      status: parsed.data.status,
      createdBy: actorId(res),
    })
    .returning();
  await addAuditEvent(
    business.id,
    null,
    actorId(res),
    "action.created",
    "business_action",
    action.id,
  );
  res.status(201).json(
    CreateActionResponse.parse({
      ...action,
      createdAt: action.createdAt.toISOString(),
    }),
  );
});

router.patch("/actions/:id", async (req, res): Promise<void> => {
  const params = UpdateActionParams.safeParse(req.params);
  const parsed = UpdateActionBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({
      error: !params.success
        ? params.error.message
        : !parsed.success
          ? parsed.error.message
          : "Invalid action update.",
    });
    return;
  }
  const business = await requireBusiness(res);
  if (!business) return;
  const [action] = await db
    .update(businessActionsTable)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(
      and(
        eq(businessActionsTable.id, params.data.id),
        eq(businessActionsTable.businessId, business.id),
      ),
    )
    .returning();
  if (!action) {
    res.status(404).json({ error: "Management action not found." });
    return;
  }
  await addAuditEvent(
    business.id,
    null,
    actorId(res),
    "action.status_updated",
    "business_action",
    action.id,
    { status: action.status },
  );
  res.json(
    UpdateActionResponse.parse({
      ...action,
      createdAt: action.createdAt.toISOString(),
    }),
  );
});

export default router;
