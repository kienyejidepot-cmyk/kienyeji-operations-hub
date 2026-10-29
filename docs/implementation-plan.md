# Kienyeji live-bird operations implementation plan

## Phase 1 — Audit and preserve the real stack
- Confirm the existing schema, branch model, and stock movement patterns already in the repository.
- Preserve working concepts such as branch-scoped operations, KES default currency, and Africa/Nairobi date handling.
- Document the current live-bird and slaughter tables as the baseline for the real business model.

## Phase 2 — Business-model schema updates
- Add branch-level business metadata required for a Kenyan poultry shop: KES default, Africa/Nairobi timezone, branch code, status, and manager fields.
- Strengthen the live-bird ledger so every receipt, sale, transfer, mortality, and adjustment is represented with a reason and actor.
- Add a slaughter batch model with birds selected, birds processed, yield, and total dressed weight.
- Keep by-products and waste in separate units to avoid double counting the value of a processed bird.

## Phase 3 — Operational controls and reconciliation
- Require reconciliation logic for the formula: opening birds + receipts + transfers in - live sales - slaughter transfers - mortality - transfers out + adjustments.
- Prevent unexplained stock change by requiring a reason and an authorized user for manual adjustments.
- Keep slaughter confirmation and inventory deduction in a single transactional workflow to avoid duplicate processing entries.

## Phase 4 — Reporting and approval workflows
- Surface branch and all-shops dashboards that distinguish live stock, slaughter volumes, USD/KES monetary totals, and by-product inventory.
- Add review and approval states for slaughter batches, adjustments, and notebook-based entries so ambiguous values do not post financial transactions silently.
- Keep OCR and notebook review separate from financial posting so extraction never becomes an automatic ledger update.

## Phase 5 — Validation and deployment checks
- Run the project typecheck and database validation after dependencies are available.
- Verify there are no missing table or enum references and that the schema remains branch-scoped and safe for multi-shop operations.
- Keep configuration explicit for Kenya: KES, Africa/Nairobi, M-Pesa support, and configurable tax/compliance rules.
