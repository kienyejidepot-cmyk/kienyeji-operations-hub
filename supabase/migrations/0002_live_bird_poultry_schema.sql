-- Migration: live-bird and slaughter workflow for kienyeji operations

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'KE',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Nairobi';

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS branch_code text,
  ADD COLUMN IF NOT EXISTS manager text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Nairobi';

UPDATE branches
SET branch_code = COALESCE(
  branch_code,
  lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(id::text), 1, 4)
)
WHERE branch_code IS NULL;

ALTER TABLE branches
  ALTER COLUMN branch_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS branches_business_code_unique
  ON branches (business_id, branch_code);

ALTER TABLE live_bird_batches
  ADD COLUMN IF NOT EXISTS batch_code text,
  ADD COLUMN IF NOT EXISTS farmer_name text,
  ADD COLUMN IF NOT EXISTS holding_cost numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE live_bird_batches
SET batch_code = COALESCE(batch_code, 'LB-' || substr(md5(id::text), 1, 8))
WHERE batch_code IS NULL;

ALTER TABLE live_bird_batches
  ALTER COLUMN batch_code SET NOT NULL;

ALTER TABLE live_bird_batches
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE live_bird_movements
  ADD COLUMN IF NOT EXISTS movement_type text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';

UPDATE live_bird_movements
SET movement_type = COALESCE(movement_type, kind)
WHERE movement_type IS NULL;

ALTER TABLE live_bird_movements
  ALTER COLUMN movement_type SET NOT NULL;

ALTER TABLE slaughter_batches
  ADD COLUMN IF NOT EXISTS live_weight_kg numeric(14,3),
  ADD COLUMN IF NOT EXISTS dressing_yield_percent numeric(14,3),
  ADD COLUMN IF NOT EXISTS confirmed_by text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS slaughter_by_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  batch_id uuid NOT NULL REFERENCES slaughter_batches(id),
  product_type text NOT NULL,
  unit text NOT NULL,
  quantity numeric(14,3) NOT NULL,
  unit_value numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slaughter_by_products_batch_idx
  ON slaughter_by_products (batch_id);
CREATE INDEX IF NOT EXISTS slaughter_by_products_branch_idx
  ON slaughter_by_products (branch_id, product_type);

CREATE UNIQUE INDEX IF NOT EXISTS live_bird_batches_business_branch_code_unique
  ON live_bird_batches (business_id, branch_id, batch_code);

CREATE INDEX IF NOT EXISTS live_bird_movements_type_idx
  ON live_bird_movements (movement_type, occurred_at);

CREATE INDEX IF NOT EXISTS slaughter_batches_status_idx
  ON slaughter_batches (status, slaughter_date);
