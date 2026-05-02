ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS insurance_member_id text,
  ADD COLUMN IF NOT EXISTS client_address text,
  ADD COLUMN IF NOT EXISTS insurance_last_verified_date date,
  ADD COLUMN IF NOT EXISTS insurance_verification_notes text,
  ADD COLUMN IF NOT EXISTS insurance_verification_status text;
