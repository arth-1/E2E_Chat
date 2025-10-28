-- Update storage policies for message-media bucket to support galleries

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload media to their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Users can view media from their conversations" ON storage.objects;

-- Create updated policies with gallery support
CREATE POLICY "Users can upload media to their conversations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-media'
  AND (
    -- Allow uploads to conversations folder
    (
      (storage.foldername(name))[1] = 'conversations'
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE (storage.foldername(name))[2] = c.id::text
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
      )
    )
    OR
    -- Allow uploads to galleries folder (user's own gallery)
    (
      (storage.foldername(name))[1] = 'galleries'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

CREATE POLICY "Users can view media from their conversations"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-media'
  AND (
    -- Allow viewing conversations media
    (
      (storage.foldername(name))[1] = 'conversations'
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE (storage.foldername(name))[2] = c.id::text
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
      )
    )
    OR
    -- Allow viewing galleries media (from galleries the user participates in)
    (
      (storage.foldername(name))[1] = 'galleries'
      AND EXISTS (
        SELECT 1 FROM public.galleries g
        WHERE (storage.foldername(name))[2]::uuid = g.owner_a
        AND (g.owner_a = auth.uid() OR g.owner_b = auth.uid())
      )
    )
  )
);

-- Add comment
COMMENT ON POLICY "Users can upload media to their conversations" ON storage.objects IS 'Allows authenticated users to upload media to their conversations and galleries';
COMMENT ON POLICY "Users can view media from their conversations" ON storage.objects IS 'Allows authenticated users to view media from their conversations and shared galleries';
