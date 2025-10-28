-- Add encrypted private key storage to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN users.encrypted_private_key IS 'Private key encrypted with user password (PBKDF2). Never store plaintext private keys.';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_encrypted_private_key ON users(id) WHERE encrypted_private_key IS NOT NULL;
