CREATE TABLE IF NOT EXISTS student_accounts (
  student_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  account jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE student_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_accounts_self_read ON student_accounts
  FOR SELECT TO authenticated USING (auth.uid() = student_id);
