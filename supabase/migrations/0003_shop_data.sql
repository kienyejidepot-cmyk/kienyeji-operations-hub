CREATE TABLE IF NOT EXISTS shop_data (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_data_updated_at_idx ON shop_data (updated_at DESC);

ALTER TABLE shop_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow public read access to shop data"
ON shop_data
FOR SELECT
USING (true);

CREATE POLICY IF NOT EXISTS "Allow public upsert access to shop data"
ON shop_data
FOR INSERT
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow public update access to shop data"
ON shop_data
FOR UPDATE
USING (true)
WITH CHECK (true);
