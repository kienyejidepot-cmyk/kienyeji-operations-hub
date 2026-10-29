-- Migration: initial schema
-- Generated from Drizzle schema

CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL UNIQUE,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  opening_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS businesses_owner_user_idx ON businesses (owner_user_id);

CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  name text NOT NULL,
  location text NOT NULL DEFAULT '',
  stock_count_owner text NOT NULL DEFAULT '',
  cash_reconciliation_owner text NOT NULL DEFAULT '',
  credit_follow_up_owner text NOT NULL DEFAULT '',
  day_close_owner text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);
CREATE INDEX IF NOT EXISTS branches_business_idx ON branches (business_id);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  name text NOT NULL,
  unit text NOT NULL,
  low_stock_threshold numeric(14,3) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);
CREATE INDEX IF NOT EXISTS products_business_idx ON products (business_id);

CREATE TABLE IF NOT EXISTS stock_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  supplier_name text NOT NULL,
  reference text,
  received_at timestamptz NOT NULL,
  notes text,
  entered_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_receipts_business_date_idx ON stock_receipts (business_id, received_at);
CREATE INDEX IF NOT EXISTS stock_receipts_branch_date_idx ON stock_receipts (branch_id, received_at);

CREATE TABLE IF NOT EXISTS stock_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  product_id uuid NOT NULL REFERENCES products(id),
  receipt_id uuid NOT NULL REFERENCES stock_receipts(id),
  supplier_name text NOT NULL,
  received_at timestamptz NOT NULL,
  quantity_received numeric(14,3) NOT NULL,
  quantity_remaining numeric(14,3) NOT NULL,
  unit_cost numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_batches_business_product_idx ON stock_batches (business_id, product_id);
CREATE INDEX IF NOT EXISTS stock_batches_branch_product_idx ON stock_batches (branch_id, product_id);
CREATE INDEX IF NOT EXISTS stock_batches_fifo_idx ON stock_batches (business_id, branch_id, product_id, received_at);

CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  product_id uuid NOT NULL REFERENCES products(id),
  batch_id uuid REFERENCES stock_batches(id),
  kind text NOT NULL,
  quantity_change numeric(14,3) NOT NULL,
  unit_cost numeric(14,2) NOT NULL,
  source_id uuid NOT NULL,
  reason text,
  actor_user_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_business_date_idx ON stock_movements (business_id, occurred_at);
CREATE INDEX IF NOT EXISTS stock_movements_branch_product_date_idx ON stock_movements (branch_id, product_id, occurred_at);
CREATE INDEX IF NOT EXISTS stock_movements_source_idx ON stock_movements (kind, source_id);

CREATE TABLE IF NOT EXISTS stock_losses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity numeric(14,3) NOT NULL,
  cause text NOT NULL,
  notes text,
  cost numeric(14,2) NOT NULL,
  occurred_at timestamptz NOT NULL,
  entered_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_losses_business_date_idx ON stock_losses (business_id, occurred_at);
CREATE INDEX IF NOT EXISTS stock_losses_branch_idx ON stock_losses (branch_id, occurred_at);

CREATE TABLE IF NOT EXISTS stock_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  product_id uuid NOT NULL REFERENCES products(id),
  expected_quantity numeric(14,3) NOT NULL,
  counted_quantity numeric(14,3) NOT NULL,
  variance numeric(14,3) NOT NULL,
  counted_at timestamptz NOT NULL,
  notes text,
  entered_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_counts_business_date_idx ON stock_counts (business_id, counted_at);
CREATE INDEX IF NOT EXISTS stock_counts_branch_product_idx ON stock_counts (branch_id, product_id, counted_at);

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  product_id uuid NOT NULL REFERENCES products(id),
  receipt_number text NOT NULL,
  quantity numeric(14,3) NOT NULL,
  unit_price numeric(14,2) NOT NULL,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL,
  cost_of_goods numeric(14,2) NOT NULL,
  initial_paid_amount numeric(14,2) NOT NULL,
  paid_amount numeric(14,2) NOT NULL,
  amount_due numeric(14,2) NOT NULL,
  customer_name text,
  payment_method text NOT NULL,
  notes text,
  sold_at timestamptz NOT NULL,
  entered_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, receipt_number)
);
CREATE INDEX IF NOT EXISTS sales_business_date_idx ON sales (business_id, sold_at);
CREATE INDEX IF NOT EXISTS sales_branch_date_idx ON sales (branch_id, sold_at);
CREATE INDEX IF NOT EXISTS sales_customer_balance_idx ON sales (business_id, customer_name, amount_due);

CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  sale_id uuid NOT NULL REFERENCES sales(id),
  amount numeric(14,2) NOT NULL,
  payment_method text NOT NULL,
  reference text,
  paid_at timestamptz NOT NULL,
  entered_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collections_business_date_idx ON collections (business_id, paid_at);
CREATE INDEX IF NOT EXISTS collections_sale_idx ON collections (sale_id, paid_at);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  category text NOT NULL,
  description text,
  amount numeric(14,2) NOT NULL,
  paid_amount numeric(14,2) NOT NULL,
  amount_due numeric(14,2) NOT NULL,
  payment_status text NOT NULL,
  payment_method text NOT NULL,
  expense_date date NOT NULL,
  entered_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_business_date_idx ON expenses (business_id, expense_date);
CREATE INDEX IF NOT EXISTS expenses_branch_date_idx ON expenses (branch_id, expense_date);

CREATE TABLE IF NOT EXISTS business_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  title text NOT NULL,
  owner text NOT NULL,
  due_date date NOT NULL,
  success_metric text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_actions_business_due_idx ON business_actions (business_id, due_date);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid REFERENCES branches(id),
  actor_user_id text NOT NULL,
  action text NOT NULL,
  record_type text NOT NULL,
  record_id uuid NOT NULL,
  details text NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_business_created_idx ON audit_events (business_id, created_at);
CREATE INDEX IF NOT EXISTS audit_events_record_idx ON audit_events (record_type, record_id);
CREATE TABLE IF NOT EXISTS live_bird_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  breed text NOT NULL,
  supplier_name text NOT NULL,
  received_date date NOT NULL,
  birds_received numeric(14,0) NOT NULL,
  birds_sold_alive numeric(14,0) NOT NULL DEFAULT 0,
  birds_transferred_to_slaughter numeric(14,0) NOT NULL DEFAULT 0,
  birds_reserved numeric(14,0) NOT NULL DEFAULT 0,
  birds_dead numeric(14,0) NOT NULL DEFAULT 0,
  birds_remaining numeric(14,0) NOT NULL,
  purchase_cost_per_bird numeric(14,2) NOT NULL,
  total_batch_cost numeric(14,2) NOT NULL,
  avg_weight_kg numeric(14,3),
  feed_cost numeric(14,2) NOT NULL DEFAULT 0,
  entered_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_bird_batches_branch_date_idx ON live_bird_batches (branch_id, received_date);
CREATE INDEX IF NOT EXISTS live_bird_batches_business_breed_idx ON live_bird_batches (business_id, breed);

CREATE TABLE IF NOT EXISTS live_bird_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  batch_id uuid REFERENCES live_bird_batches(id),
  kind text NOT NULL,
  birds_change numeric(14,0) NOT NULL,
  reason text NOT NULL,
  actor_user_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_bird_movements_branch_date_idx ON live_bird_movements (branch_id, occurred_at);
CREATE INDEX IF NOT EXISTS live_bird_movements_batch_idx ON live_bird_movements (batch_id, occurred_at);

CREATE TABLE IF NOT EXISTS slaughter_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  batch_number text NOT NULL,
  source_batch_id uuid REFERENCES live_bird_batches(id),
  slaughter_date date NOT NULL,
  birds_selected numeric(14,0) NOT NULL,
  birds_slaughtered numeric(14,0) NOT NULL,
  birds_rejected numeric(14,0) NOT NULL DEFAULT 0,
  rejection_reason text,
  dressed_chickens_produced numeric(14,0) NOT NULL,
  total_dressed_weight_kg numeric(14,3) NOT NULL,
  avg_dressed_weight_kg numeric(14,3) NOT NULL,
  live_weight_kg numeric(14,3),
  offal_kg numeric(14,3) NOT NULL DEFAULT 0,
  feet_count numeric(14,0) NOT NULL DEFAULT 0,
  heads_count numeric(14,0) NOT NULL DEFAULT 0,
  processing_cost numeric(14,2) NOT NULL DEFAULT 0,
  staff_responsible text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  entered_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, batch_number)
);
CREATE INDEX IF NOT EXISTS slaughter_batches_branch_date_idx ON slaughter_batches (branch_id, slaughter_date);
