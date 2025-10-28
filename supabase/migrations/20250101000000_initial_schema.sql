-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  public_key TEXT NOT NULL,
  push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  metadata JSONB,
  user_min UUID GENERATED ALWAYS AS (LEAST(user_a, user_b)) STORED,
  user_max UUID GENERATED ALWAYS AS (GREATEST(user_a, user_b)) STORED,
  CONSTRAINT unique_conversation UNIQUE (user_min, user_max)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ciphertext TEXT NOT NULL,
  ephemeral_pubkey TEXT,
  attached_files JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered BOOLEAN DEFAULT FALSE,
  read BOOLEAN DEFAULT FALSE
);

-- Create galleries table
CREATE TABLE IF NOT EXISTS public.galleries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_a UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  owner_b UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
  thumbnail_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_a ON public.conversations(user_a);
CREATE INDEX IF NOT EXISTS idx_conversations_user_b ON public.conversations(user_b);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender);
CREATE INDEX IF NOT EXISTS idx_galleries_owners ON public.galleries(owner_a, owner_b);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galleries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- RLS Policies for conversations table
CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT USING (
    user_a = auth.uid() OR user_b = auth.uid()
  );

CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (
    user_a = auth.uid() OR user_b = auth.uid()
  );

CREATE POLICY "Users can update own conversations" ON public.conversations
  FOR UPDATE USING (
    user_a = auth.uid() OR user_b = auth.uid()
  );

-- RLS Policies for messages table
CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.user_a = auth.uid() OR conversations.user_b = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages they send" ON public.messages
  FOR INSERT WITH CHECK (sender = auth.uid());

CREATE POLICY "Users can update own messages" ON public.messages
  FOR UPDATE USING (sender = auth.uid());

-- RLS Policies for galleries table
CREATE POLICY "Users can view galleries they own" ON public.galleries
  FOR SELECT USING (
    owner_a = auth.uid() OR owner_b = auth.uid()
  );

CREATE POLICY "Users can insert to galleries they own" ON public.galleries
  FOR INSERT WITH CHECK (
    owner_a = auth.uid() OR owner_b = auth.uid()
  );

CREATE POLICY "Users can delete from galleries they own" ON public.galleries
  FOR DELETE USING (
    owner_a = auth.uid() OR owner_b = auth.uid()
  );

-- Enable Realtime for messages and conversations
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
