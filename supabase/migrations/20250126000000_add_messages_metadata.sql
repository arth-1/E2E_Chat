-- Add metadata column to messages table for storing media references
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add ciphertext_sender and ephemeral_pubkey_sender columns for sender's encrypted copy
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS ciphertext_sender TEXT;

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS ephemeral_pubkey_sender TEXT;

-- Create index on metadata for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_metadata ON public.messages USING GIN (metadata);
