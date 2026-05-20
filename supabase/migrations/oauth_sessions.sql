CREATE TABLE IF NOT EXISTS oauth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL,
  refresh_token text,
  token_type text DEFAULT 'Bearer',
  expires_in integer DEFAULT 3600,
  scope text,
  user_email text,
  user_name text,
  user_picture text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE oauth_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON oauth_sessions FOR ALL USING (true);
