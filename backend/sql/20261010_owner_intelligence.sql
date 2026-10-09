CREATE TABLE IF NOT EXISTS owner_business_goals (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  title VARCHAR(160) NOT NULL,
  metric VARCHAR(24) NOT NULL CHECK (metric IN ('REVENUE', 'CLIENTS', 'SERVICES')),
  target_value NUMERIC(14,2) NOT NULL CHECK (target_value > 0),
  period_type VARCHAR(16) NOT NULL CHECK (period_type IN ('WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL CHECK (period_end >= period_start),
  rationale TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS owner_business_goals_salon_period_idx
  ON owner_business_goals (salon_id, status, period_start, period_end);

CREATE TABLE IF NOT EXISTS salon_campaigns (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  campaign_type VARCHAR(16) NOT NULL CHECK (campaign_type IN ('ADVERT', 'EVENT', 'OFFER')),
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  discount_percent NUMERIC(5,2) CHECK (discount_percent IS NULL OR (discount_percent > 0 AND discount_percent <= 100)),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at >= starts_at),
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'ENDED', 'ARCHIVED')),
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS salon_campaigns_salon_status_dates_idx
  ON salon_campaigns (salon_id, status, starts_at, ends_at);
