import Decimal from "decimal.js";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  lte,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetBusinessReviewQueryParams,
  GetBusinessReviewResponse,
  GetDashboardSummaryQueryParams,
  GetDashboardSummaryResponse,
} from "@workspace/api-zod";
import {
  branchesTable,
  db,
  expensesTable,
  productsTable,
  salesTable,
  stockBatchesTable,
  stockCountsTable,
  stockLossesTable,
  collectionsTable,
} from "@workspace/db";
import {
  dateBounds,
  dateOf,
  money,
  quantity,
  requireBusiness,
  requireSignedIn,
} from "./common";

const router: IRouter = Router();
router.use(requireSignedIn);

type Period = { from: string; to: string; start: Date; end: Date };

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function resolvePeriod(
  from: string | undefined,
  to: string | undefined,
  openingDate: string,
): Period | null {
  const today = dateOf(new Date());
  const startDate = from ?? openingDate;
  const endDate = to ?? today;
  if (
    !isCalendarDate(startDate) ||
    !isCalendarDate(endDate) ||
    startDate > endDate
  ) {
    return null;
  }
  const [start, end] = dateBounds(startDate, endDate);
  return { from: startDate, to: endDate, start, end };
}

function total(values: string[]): Decimal {
  return values.reduce((sum, value) => sum.plus(value), new Decimal(0));
}

function unitBreakdown(
  values: Array<{ unit: string; value: string }>,
): Array<{ unit: string; quantity: string }> {
  const grouped = new Map<string, Decimal>();
  for (const item of values) {
    grouped.set(
      item.unit,
      (grouped.get(item.unit) ?? new Decimal(0)).plus(item.value),
    );
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([unit, value]) => ({ unit, quantity: quantity(value) }));
}

function conciseUnits(
  breakdown: Array<{ unit: string; quantity: string }>,
): string {
  if (breakdown.length === 0) return "0";
  if (breakdown.length > 1) return "Mixed units — see breakdown";
  return `${breakdown[0].quantity} ${breakdown[0].unit}`;
}

async function loadReportData(
  businessId: string,
  branchId: string | undefined,
  period: Period,
) {
  const branches = await db
    .select()
    .from(branchesTable)
    .where(
      branchId
        ? and(eq(branchesTable.businessId, businessId), eq(branchesTable.id, branchId))
        : eq(branchesTable.businessId, businessId),
    )
    .orderBy(asc(branchesTable.name));
  if (branchId && branches.length === 0) return null;
  const branchIds = branches.map((branch) => branch.id);

  const sales = await db
    .select({
      id: salesTable.id,
      branchId: salesTable.branchId,
      productId: salesTable.productId,
      productName: productsTable.name,
      unit: productsTable.unit,
      quantity: salesTable.quantity,
      total: salesTable.total,
      costOfGoods: salesTable.costOfGoods,
      initialPaidAmount: salesTable.initialPaidAmount,
      soldAt: salesTable.soldAt,
    })
    .from(salesTable)
    .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .where(
      and(
        eq(salesTable.businessId, businessId),
        gte(salesTable.soldAt, period.start),
        lte(salesTable.soldAt, period.end),
        ...(branchId ? [eq(salesTable.branchId, branchId)] : []),
      ),
    )
    .orderBy(asc(salesTable.soldAt));

  const expenses = await db
    .select()
    .from(expensesTable)
    .where(
      and(
        eq(expensesTable.businessId, businessId),
        gte(expensesTable.expenseDate, period.from),
        lte(expensesTable.expenseDate, period.to),
        ...(branchId ? [eq(expensesTable.branchId, branchId)] : []),
      ),
    )
    .orderBy(asc(expensesTable.expenseDate));

  const losses = await db
    .select()
    .from(stockLossesTable)
    .where(
      and(
        eq(stockLossesTable.businessId, businessId),
        gte(stockLossesTable.occurredAt, period.start),
        lte(stockLossesTable.occurredAt, period.end),
        ...(branchId ? [eq(stockLossesTable.branchId, branchId)] : []),
      ),
    )
    .orderBy(asc(stockLossesTable.occurredAt));

  const counts = await db
    .select({
      id: stockCountsTable.id,
      branchId: stockCountsTable.branchId,
      productId: stockCountsTable.productId,
      productName: productsTable.name,
      expectedQuantity: stockCountsTable.expectedQuantity,
      countedQuantity: stockCountsTable.countedQuantity,
      variance: stockCountsTable.variance,
      countedAt: stockCountsTable.countedAt,
    })
    .from(stockCountsTable)
    .innerJoin(productsTable, eq(stockCountsTable.productId, productsTable.id))
    .where(
      and(
        eq(stockCountsTable.businessId, businessId),
        gte(stockCountsTable.countedAt, period.start),
        lte(stockCountsTable.countedAt, period.end),
        ...(branchId ? [eq(stockCountsTable.branchId, branchId)] : []),
      ),
    )
    .orderBy(asc(stockCountsTable.countedAt));

  const batches = await db
    .select({
      id: stockBatchesTable.id,
      branchId: stockBatchesTable.branchId,
      branchName: branchesTable.name,
      productId: productsTable.id,
      productName: productsTable.name,
      unit: productsTable.unit,
      lowStockThreshold: productsTable.lowStockThreshold,
      quantityRemaining: stockBatchesTable.quantityRemaining,
      unitCost: stockBatchesTable.unitCost,
      receivedAt: stockBatchesTable.receivedAt,
    })
    .from(stockBatchesTable)
    .innerJoin(branchesTable, eq(stockBatchesTable.branchId, branchesTable.id))
    .innerJoin(productsTable, eq(stockBatchesTable.productId, productsTable.id))
    .where(
      and(
        eq(stockBatchesTable.businessId, businessId),
        gt(stockBatchesTable.quantityRemaining, "0"),
        ...(branchId ? [eq(stockBatchesTable.branchId, branchId)] : []),
      ),
    )
    .orderBy(asc(stockBatchesTable.receivedAt));

  const outstanding = await db
    .select({
      amountDue: salesTable.amountDue,
    })
    .from(salesTable)
    .where(
      and(
        eq(salesTable.businessId, businessId),
        gt(salesTable.amountDue, "0"),
        ...(branchId ? [eq(salesTable.branchId, branchId)] : []),
      ),
    );

  const collections = await db
    .select({
      amount: collectionsTable.amount,
    })
    .from(collectionsTable)
    .innerJoin(salesTable, eq(collectionsTable.saleId, salesTable.id))
    .where(
      and(
        eq(collectionsTable.businessId, businessId),
        gte(collectionsTable.paidAt, period.start),
        lte(collectionsTable.paidAt, period.end),
        ...(branchId ? [eq(salesTable.branchId, branchId)] : []),
      ),
    );

  const products = await db
    .select()
    .from(productsTable)
    .where(
      and(
        eq(productsTable.businessId, businessId),
        eq(productsTable.active, true),
      ),
    )
    .orderBy(asc(productsTable.name));

  const unitsSoldByUnit = unitBreakdown(
    sales.map((sale) => ({ unit: sale.unit, value: sale.quantity })),
  );
  const stockByUnit = unitBreakdown(
    batches.map((batch) => ({
      unit: batch.unit,
      value: batch.quantityRemaining,
    })),
  );
  const revenue = total(sales.map((sale) => sale.total));
  const costOfGoods = total(sales.map((sale) => sale.costOfGoods));
  const grossProfit = revenue.minus(costOfGoods);
  const expensesTotal = total(expenses.map((expense) => expense.amount));
  const stockLossValue = total(losses.map((loss) => loss.cost));
  const netProfit = grossProfit.minus(expensesTotal).minus(stockLossValue);
  const stockValue = total(
    batches.map((batch) =>
      new Decimal(batch.quantityRemaining).times(batch.unitCost).toFixed(2),
    ),
  );
  const collectedFromSales = total(
    sales.map((sale) => sale.initialPaidAmount),
  );
  const collectedFromInvoices = total(collections.map((item) => item.amount));
  const outstandingCredit = total(outstanding.map((item) => item.amountDue));
  const unpaidExpenses = total(expenses.map((expense) => expense.amountDue));
  const averageGrossProfitPerUnit =
    unitsSoldByUnit.length === 1 &&
    new Decimal(unitsSoldByUnit[0].quantity).gt(0)
      ? `${money(
          grossProfit.dividedBy(unitsSoldByUnit[0].quantity),
        )} per ${unitsSoldByUnit[0].unit}`
      : unitsSoldByUnit.length > 1
        ? "Not comparable across mixed units"
        : "No sales in period";

  const stockGroups = new Map<
    string,
    {
      branchId: string;
      branchName: string;
      productId: string;
      productName: string;
      unit: string;
      threshold: string;
      quantity: Decimal;
      value: Decimal;
      oldestBatchDate: string | null;
    }
  >();
  for (const batch of batches) {
    const key = `${batch.branchId}:${batch.productId}`;
    const group = stockGroups.get(key) ?? {
      branchId: batch.branchId,
      branchName: batch.branchName,
      productId: batch.productId,
      productName: batch.productName,
      unit: batch.unit,
      threshold: batch.lowStockThreshold,
      quantity: new Decimal(0),
      value: new Decimal(0),
      oldestBatchDate: dateOf(batch.receivedAt),
    };
    const remaining = new Decimal(batch.quantityRemaining);
    group.quantity = group.quantity.plus(remaining);
    group.value = group.value.plus(remaining.times(batch.unitCost));
    if (
      !group.oldestBatchDate ||
      dateOf(batch.receivedAt) < group.oldestBatchDate
    ) {
      group.oldestBatchDate = dateOf(batch.receivedAt);
    }
    stockGroups.set(key, group);
  }
  const lowStock = [];
  for (const branch of branches) {
    for (const product of products) {
      const threshold = new Decimal(product.lowStockThreshold);
      if (threshold.lte(0)) continue;
      const group = stockGroups.get(`${branch.id}:${product.id}`);
      const remaining = group?.quantity ?? new Decimal(0);
      if (remaining.lte(threshold)) {
        lowStock.push({
          branchId: branch.id,
          branchName: branch.name,
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          quantity: quantity(remaining),
          stockValue: money(group?.value ?? 0),
          oldestBatchDate: group?.oldestBatchDate ?? null,
        });
      }
    }
  }

  const trends = new Map<
    string,
    { revenue: Decimal; grossProfit: Decimal; expenses: Decimal }
  >();
  const getTrend = (month: string) => {
    const current = trends.get(month) ?? {
      revenue: new Decimal(0),
      grossProfit: new Decimal(0),
      expenses: new Decimal(0),
    };
    trends.set(month, current);
    return current;
  };
  for (const sale of sales) {
    const month = `${dateOf(sale.soldAt).slice(0, 7)}-01`;
    const current = getTrend(month);
    current.revenue = current.revenue.plus(sale.total);
    current.grossProfit = current.grossProfit.plus(
      new Decimal(sale.total).minus(sale.costOfGoods),
    );
  }
  for (const expense of expenses) {
    const month = `${expense.expenseDate.slice(0, 7)}-01`;
    const current = getTrend(month);
    current.expenses = current.expenses.plus(expense.amount);
  }

  const recentRows = await db
    .select({
      id: salesTable.id,
      receiptNumber: salesTable.receiptNumber,
      branchId: salesTable.branchId,
      productName: productsTable.name,
      quantity: salesTable.quantity,
      unit: productsTable.unit,
      unitPrice: salesTable.unitPrice,
      total: salesTable.total,
      costOfGoods: salesTable.costOfGoods,
      paidAmount: salesTable.paidAmount,
      amountDue: salesTable.amountDue,
      customerName: salesTable.customerName,
      paymentMethod: salesTable.paymentMethod,
      soldAt: salesTable.soldAt,
    })
    .from(salesTable)
    .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .where(
      and(
        eq(salesTable.businessId, businessId),
        ...(branchId ? [eq(salesTable.branchId, branchId)] : []),
      ),
    )
    .orderBy(desc(salesTable.soldAt))
    .limit(8);

  const currentStockByUnit = unitBreakdown(
    [...stockGroups.values()].map((group) => ({
      unit: group.unit,
      value: quantity(group.quantity),
    })),
  );
  const metrics = {
    revenue: money(revenue),
    grossProfit: money(grossProfit),
    expenses: money(expensesTotal),
    netProfit: money(netProfit),
    unitsSold: conciseUnits(unitsSoldByUnit),
    unitsSoldByUnit,
    stockOnHand: conciseUnits(currentStockByUnit),
    stockOnHandByUnit: currentStockByUnit,
    stockValue: money(stockValue),
    cashCollected: money(collectedFromSales.plus(collectedFromInvoices)),
    outstandingCredit: money(outstandingCredit),
    stockLossValue: money(stockLossValue),
    expensesUnpaid: money(unpaidExpenses),
    averageGrossProfitPerUnit,
  };
  return {
    branches,
    sales,
    expenses,
    losses,
    counts,
    batches,
    stockGroups,
    products,
    metrics,
    trends: [...trends.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({
        date,
        revenue: money(values.revenue),
        grossProfit: money(values.grossProfit),
        expenses: money(values.expenses),
      })),
    lowStock,
    recentSales: recentRows.map((row) => ({
      ...row,
      soldAt: row.soldAt.toISOString(),
    })),
    outstandingCredit,
    unpaidExpenses,
    stockLossValue,
    grossProfit,
  };
}

function reviewFact(
  label: string,
  value: string,
  interpretation: string,
  sourceType: string,
  recordIds: string[],
) {
  return {
    label,
    value,
    interpretation,
    sourceType,
    recordIds: recordIds.slice(0, 20),
    evidenceCount: recordIds.length,
  };
}

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const params = GetDashboardSummaryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const business = await requireBusiness(res);
  if (!business) return;
  const period = resolvePeriod(
    params.data.from,
    params.data.to,
    business.openingDate,
  );
  if (!period) {
    res.status(400).json({ error: "Enter a valid date range." });
    return;
  }
  const data = await loadReportData(
    business.id,
    params.data.branchId,
    period,
  );
  if (!data) {
    res.status(404).json({ error: "Shop branch not found." });
    return;
  }
  res.json(
    GetDashboardSummaryResponse.parse({
      currency: business.currency,
      from: period.from,
      to: period.to,
      metrics: data.metrics,
      trends: data.trends,
      lowStock: data.lowStock,
      recentSales: data.recentSales,
    }),
  );
});

router.get("/business-review", async (req, res): Promise<void> => {
  const params = GetBusinessReviewQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const business = await requireBusiness(res);
  if (!business) return;
  const period = resolvePeriod(
    params.data.from,
    params.data.to,
    business.openingDate,
  );
  if (!period) {
    res.status(400).json({ error: "Enter a valid date range." });
    return;
  }
  const data = await loadReportData(
    business.id,
    params.data.branchId,
    period,
  );
  if (!data) {
    res.status(404).json({ error: "Shop branch not found." });
    return;
  }
  const branchName = params.data.branchId
    ? data.branches[0]?.name ?? "Selected shop"
    : "All shops";
  const saleIds = data.sales.map((row) => row.id);
  const expenseIds = data.expenses.map((row) => row.id);
  const lossIds = data.losses.map((row) => row.id);
  const countIds = data.counts.map((row) => row.id);
  const creditValue = money(data.outstandingCredit);
  const lossValue = money(data.stockLossValue);
  const discrepancyRows = data.counts.filter((row) =>
    !new Decimal(row.variance).isZero(),
  );

  const productResults = new Map<
    string,
    {
      productName: string;
      unit: string;
      revenue: Decimal;
      cogs: Decimal;
      quantity: Decimal;
      count: number;
    }
  >();
  for (const sale of data.sales) {
    const result = productResults.get(sale.productId) ?? {
      productName: sale.productName,
      unit: sale.unit,
      revenue: new Decimal(0),
      cogs: new Decimal(0),
      quantity: new Decimal(0),
      count: 0,
    };
    result.revenue = result.revenue.plus(sale.total);
    result.cogs = result.cogs.plus(sale.costOfGoods);
    result.quantity = result.quantity.plus(sale.quantity);
    result.count += 1;
    productResults.set(sale.productId, result);
  }
  const bestProduct = [...productResults.values()].sort((a, b) =>
    b.revenue
      .minus(b.cogs)
      .comparedTo(a.revenue.minus(a.cogs)),
  )[0];

  const metricFacts = [
    reviewFact(
      "Net sales revenue",
      `KES ${data.metrics.revenue}`,
      "Sum of posted sale totals for the selected period. Credit sales are included; collections are not counted again as revenue.",
      "sales",
      saleIds,
    ),
    reviewFact(
      "Gross profit",
      `KES ${data.metrics.grossProfit}`,
      "Net sales revenue less FIFO batch cost recorded on sales.",
      "sales",
      saleIds,
    ),
    reviewFact(
      "Operating expenses",
      `KES ${data.metrics.expenses}`,
      "Posted operating expenses for the selected period, whether paid or unpaid.",
      "expenses",
      expenseIds,
    ),
    reviewFact(
      "Net operating result",
      `KES ${data.metrics.netProfit}`,
      "Gross profit less recorded operating expenses and stock losses at batch purchase cost. It excludes unrecorded costs and taxes.",
      "sales_and_expenses",
      [...saleIds, ...expenseIds, ...lossIds],
    ),
    reviewFact(
      "Stock losses",
      `KES ${lossValue}`,
      "Recorded deaths or other stock losses valued at FIFO purchase cost; no holding-cost allocation is currently included.",
      "stock_losses",
      lossIds,
    ),
  ];
  const branchResponsibilities = data.branches
    .map((branch) => {
      const assignments = [
        branch.stockCountOwner && `stock counts: ${branch.stockCountOwner}`,
        branch.cashReconciliationOwner &&
          `cash reconciliation: ${branch.cashReconciliationOwner}`,
        branch.creditFollowUpOwner &&
          `credit follow-up: ${branch.creditFollowUpOwner}`,
        branch.dayCloseOwner && `day close: ${branch.dayCloseOwner}`,
      ].filter(Boolean);
      return assignments.length
        ? `${branch.name} — ${assignments.join("; ")}`
        : `${branch.name} — no daily owners recorded`;
    })
    .join(" | ");
  const peopleProcessProduct = [
    reviewFact(
      "Shop accountability",
      branchResponsibilities || "No active shops are configured.",
      "Branch-level responsibility labels are recorded, but named staff do not yet have individual sign-in accounts.",
      "branches",
      data.branches.map((branch) => branch.id),
    ),
    reviewFact(
      "Physical stock counts",
      `${data.counts.length} count records; ${discrepancyRows.length} with a variance`,
      "Recorded counts are compared to expected on-hand stock. Counts do not automatically change inventory.",
      "stock_counts",
      countIds,
    ),
    reviewFact(
      "Product contribution",
      bestProduct
        ? `${bestProduct.productName}: KES ${money(bestProduct.revenue.minus(bestProduct.cogs))} gross profit (${bestProduct.unit})`
        : "No posted sales in this period.",
      "Best recorded product contribution is net sales less FIFO purchase cost; it does not include allocated labour or holding costs.",
      "sales",
      saleIds,
    ),
  ];
  const unitEconomics = [
    reviewFact(
      "Units sold by base unit",
      data.metrics.unitsSoldByUnit
        .map((unit) => `${unit.quantity} ${unit.unit}`)
        .join("; ") || "0",
      "Products remain in their configured base units. Mixed units are not added together as if comparable.",
      "sales",
      saleIds,
    ),
    reviewFact(
      "Average gross profit per unit",
      data.metrics.averageGrossProfitPerUnit,
      "Gross profit divided by sold quantity only when the selected period contains one comparable unit.",
      "sales",
      saleIds,
    ),
    reviewFact(
      "Closing stock value",
      `KES ${data.metrics.stockValue}`,
      "On-hand quantity multiplied by each batch's recorded unit purchase cost.",
      "stock_batches",
      data.batches.map((row) => row.id),
    ),
  ];
  const cashAndCredit = [
    reviewFact(
      "Cash collected",
      `KES ${data.metrics.cashCollected}`,
      "Initial amounts received on sales plus later recorded customer collections during the period.",
      "sales_and_collections",
      saleIds,
    ),
    reviewFact(
      "Outstanding customer credit",
      `KES ${creditValue}`,
      "Current unpaid balances across invoices; this is an as-of balance, not a period revenue figure.",
      "sales",
      saleIds,
    ),
    reviewFact(
      "Unpaid expenses",
      `KES ${money(data.unpaidExpenses)}`,
      "Outstanding balances on expenses recorded during the selected period.",
      "expenses",
      expenseIds,
    ),
  ];

  const keyIssues: string[] = [];
  const likelyCauses: string[] = [];
  if (discrepancyRows.length > 0) {
    const signedVariance = discrepancyRows.reduce(
      (sum, row) => sum.plus(row.variance),
      new Decimal(0),
    );
    keyIssues.push(
      `${discrepancyRows.length} recorded stock counts have a combined signed variance of ${quantity(signedVariance)} product units; investigate the underlying counts before adjusting stock.`,
    );
    likelyCauses.push(
      "Possible causes include an unrecorded sale, a missed movement, loss not yet recorded, or a counting difference. The saved records do not establish which cause applies.",
    );
  }
  if (new Decimal(lossValue).gt(0)) {
    keyIssues.push(
      `Recorded stock losses total KES ${lossValue} at purchase cost during this period.`,
    );
    likelyCauses.push(
      "Loss causes come from staff-entered labels and have not been independently verified.",
    );
  }
  if (data.outstandingCredit.gt(0)) {
    keyIssues.push(
      `Current customer balances total KES ${creditValue}; invoice aging is not available in this release.`,
    );
    likelyCauses.push(
      "The records show unpaid balances but do not establish why customers have not paid.",
    );
  }
  if (keyIssues.length === 0) {
    keyIssues.push(
      "No recorded stock-count variance, stock loss, or outstanding customer balance was found for the selected view.",
    );
    likelyCauses.push(
      "This is limited to recorded data; missing transactions may not appear in the review.",
    );
  }
  const options = [
    "Option 1 — maintain the current routine and review the same measures next month. Impact is not estimated until more periods are recorded.",
    "Option 2 — run a short, owner-assigned check on the highest-priority recorded gap before changing prices or buying patterns. This keeps operating cost low and uses existing records.",
  ];
  const recommendations = [];
  if (discrepancyRows.length > 0) {
    recommendations.push({
      title: "Investigate the recorded stock-count differences",
      rationale: `${discrepancyRows.length} physical counts differ from expected stock; compare sales, receipts, losses, and recount evidence before any correction.`,
      priority: "high",
      dueInDays: 7,
    });
  }
  if (new Decimal(lossValue).gt(0)) {
    recommendations.push({
      title: "Review losses by batch and cause",
      rationale: `KES ${lossValue} of loss was posted at recorded purchase cost; confirm batch condition and cause before changing handling practice.`,
      priority: "high",
      dueInDays: 30,
    });
  }
  if (data.outstandingCredit.gt(0)) {
    recommendations.push({
      title: "Follow up customer balances",
      rationale: `Current unpaid balances total KES ${creditValue}; record collection attempts and payment references against the correct invoice.`,
      priority: "medium",
      dueInDays: 30,
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      title: "Keep daily records complete and review the next month",
      rationale:
        "No priority exception was found in the saved data, but additional periods are needed to assess a trend.",
      priority: "low",
      dueInDays: 30,
    });
  }
  recommendations.push({
    title: "Compare shop performance using the same units and period",
    rationale:
      "A 60-day comparison can show whether margin, loss, and collections changed after actions are completed.",
    priority: "low",
    dueInDays: 60,
  });
  recommendations.push({
    title: "Refresh the operating plan with 90 days of comparable data",
    rationale:
      "Review contribution, working cash, and per-unit costs after more complete cost and account records are available.",
    priority: "low",
    dueInDays: 90,
  });
  const recommendationSummary = recommendations[0].title;

  res.json(
    GetBusinessReviewResponse.parse({
      period: `${period.from} to ${period.to}`,
      branchName,
      executiveSummary: `For ${branchName} during ${period.from} to ${period.to}, recorded sales were KES ${data.metrics.revenue}, gross profit was KES ${data.metrics.grossProfit}, operating expenses were KES ${data.metrics.expenses}, and the recorded net operating result was KES ${data.metrics.netProfit}. ${keyIssues[0]}`,
      facts: metricFacts,
      peopleProcessProduct,
      unitEconomics,
      cashAndCredit,
      keyIssues,
      likelyCauses,
      options,
      recommendationSummary,
      recommendations,
      dataLimitations: [
        "Findings use only saved records; missing or late entries are not inferred.",
        "No holding-cost allocations, payroll allocations, tax calculations, returns, bad-debt write-offs, or supplier balances are included.",
        "Cash/bank/M-Pesa account balances and reconciliation are not configured; cash collected is not the same as cash available.",
        "Staff identities and role-based permissions are not configured; branch responsibility fields are labels only.",
        "Stock-loss value uses batch purchase cost only. No post-day-three holding cost is assigned.",
      ],
    }),
  );
});

export default router;
