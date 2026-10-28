import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateBranchBody,
  CreateBranchResponse,
  CreateBusinessBody,
  CreateBusinessResponse,
  GetBusinessResponse,
  UpdateBranchBody,
  UpdateBranchParams,
  UpdateBranchResponse,
} from "@workspace/api-zod";
import { db, businessesTable, branchesTable } from "@workspace/db";
import {
  actorId,
  addAuditEvent,
  getOwnedBusiness,
  isCalendarDate,
  requireSignedIn,
} from "./common";

const router: IRouter = Router();
router.use(requireSignedIn);

router.get("/business", async (_req, res): Promise<void> => {
  const business = await getOwnedBusiness(actorId(res));
  if (!business) {
    res.json(GetBusinessResponse.parse({ business: null, branches: [] }));
    return;
  }
  const branches = await db
    .select()
    .from(branchesTable)
    .where(eq(branchesTable.businessId, business.id))
    .orderBy(branchesTable.createdAt);
  res.json(GetBusinessResponse.parse({ business, branches }));
});

router.post("/business", async (req, res): Promise<void> => {
  const parsed = CreateBusinessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!isCalendarDate(parsed.data.openingDate)) {
    res.status(400).json({ error: "Enter a valid business opening date." });
    return;
  }
  const userId = actorId(res);
  const existing = await getOwnedBusiness(userId);
  if (existing) {
    res.status(409).json({ error: "This account already has a business." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [business] = await tx
      .insert(businessesTable)
      .values({
        ownerUserId: userId,
        name: parsed.data.name.trim(),
        currency: "KES",
        openingDate: parsed.data.openingDate,
      })
      .returning();
    const [branch] = await tx
      .insert(branchesTable)
      .values({
        businessId: business.id,
        name: parsed.data.primaryBranchName.trim(),
        location: parsed.data.primaryBranchLocation.trim(),
        stockCountOwner: parsed.data.primaryBranchStockCountOwner?.trim() || "",
        cashReconciliationOwner:
          parsed.data.primaryBranchCashReconciliationOwner?.trim() || "",
        creditFollowUpOwner:
          parsed.data.primaryBranchCreditFollowUpOwner?.trim() || "",
        dayCloseOwner: parsed.data.primaryBranchDayCloseOwner?.trim() || "",
      })
      .returning();
    return { business, branch };
  });

  await addAuditEvent(
    result.business.id,
    result.branch.id,
    userId,
    "business.created",
    "business",
    result.business.id,
  );
  res
    .status(201)
    .json(
      CreateBusinessResponse.parse({
        business: result.business,
        branches: [result.branch],
      }),
    );
});

router.post("/branches", async (req, res): Promise<void> => {
  const parsed = CreateBranchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const business = await getOwnedBusiness(actorId(res));
  if (!business) {
    res.status(409).json({ error: "Complete business setup first." });
    return;
  }
  const [branch] = await db
    .insert(branchesTable)
    .values({
      businessId: business.id,
      name: parsed.data.name.trim(),
      location: parsed.data.location.trim(),
      stockCountOwner: parsed.data.stockCountOwner?.trim() || "",
      cashReconciliationOwner: parsed.data.cashReconciliationOwner?.trim() || "",
      creditFollowUpOwner: parsed.data.creditFollowUpOwner?.trim() || "",
      dayCloseOwner: parsed.data.dayCloseOwner?.trim() || "",
    })
    .returning();
  await addAuditEvent(
    business.id,
    branch.id,
    actorId(res),
    "branch.created",
    "branch",
    branch.id,
  );
  res.status(201).json(CreateBranchResponse.parse(branch));
});

router.patch("/branches/:id", async (req, res): Promise<void> => {
  const params = UpdateBranchParams.safeParse(req.params);
  const parsed = UpdateBranchBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({
      error: !params.success
        ? params.error.message
        : !parsed.success
          ? parsed.error.message
          : "Invalid branch update.",
    });
    return;
  }
  const business = await getOwnedBusiness(actorId(res));
  if (!business) {
    res.status(409).json({ error: "Complete business setup first." });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Provide at least one branch change." });
    return;
  }
  const updates = Object.fromEntries(
    Object.entries(parsed.data).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : value,
    ]),
  ) as typeof parsed.data;
  const [branch] = await db
    .update(branchesTable)
    .set(updates)
    .where(
      and(
        eq(branchesTable.id, params.data.id),
        eq(branchesTable.businessId, business.id),
      ),
    )
    .returning();
  if (!branch) {
    res.status(404).json({ error: "Shop branch not found." });
    return;
  }
  await addAuditEvent(
    business.id,
    branch.id,
    actorId(res),
    "branch.updated",
    "branch",
    branch.id,
    parsed.data,
  );
  res.json(UpdateBranchResponse.parse(branch));
});

export default router;
