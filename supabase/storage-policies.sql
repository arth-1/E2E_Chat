-- Storage buckets should be created via Supabase Dashboard or CLI
-- This file documents the required storage policies

-- Bucket: user-avatars (public)
-- Policy: Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-avatars');

-- Bucket: message-media (private)
-- Policy: Only conversation participants can access media
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

-- Bucket: stickers (public)
-- Policy: Public read, admin write
CREATE POLICY "Anyone can view stickers"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'stickers');

CREATE POLICY "Authenticated users can upload stickers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'stickers');
