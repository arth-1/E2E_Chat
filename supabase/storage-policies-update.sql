-- ============================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================
-- This updates storage policies to allow gallery uploads

-- First, check if the message-media bucket exists
-- If not, create it in the Supabase Dashboard under Storage

-- Drop existing policies (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Users can upload media to their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Users can view media from their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own media" ON storage.objects;

-- Create policy for uploading media (supports both conversations and galleries)
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
        JOIN public.users ua ON c.user_a = ua.id
        JOIN public.users ub ON c.user_b = ub.id
        WHERE (storage.foldername(name))[2] = c.id::text
        AND (ua.auth_user_id = auth.uid() OR ub.auth_user_id = auth.uid())
      )
    )
    OR
    -- Allow uploads to galleries folder (user's own gallery folder)
    -- Path format: galleries/{public.users.id}/{filename}
    -- Note: The folder uses public.users.id, but we need to match it with auth.uid()
    (
      (storage.foldername(name))[1] = 'galleries'
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id::text = (storage.foldername(name))[2]
        AND u.auth_user_id = auth.uid()
      )
    )
  )
);

-- Create policy for viewing media (supports both conversations and galleries)
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
        JOIN public.users ua ON c.user_a = ua.id
        JOIN public.users ub ON c.user_b = ub.id
        WHERE (storage.foldername(name))[2] = c.id::text
        AND (ua.auth_user_id = auth.uid() OR ub.auth_user_id = auth.uid())
      )
    )
    OR
    -- Allow viewing galleries media
    -- User can view gallery files if they uploaded them OR if a gallery record exists with them as participant
    (
      (storage.foldername(name))[1] = 'galleries'
      AND (
        -- Can view own uploads (folder name matches their public.users.id)
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id::text = (storage.foldername(name))[2]
          AND u.auth_user_id = auth.uid()
        )
        OR
        -- Can view gallery items where user is a participant
        EXISTS (
          SELECT 1 FROM public.galleries g
          JOIN public.users ua ON g.owner_a = ua.id
          JOIN public.users ub ON g.owner_b = ub.id
          WHERE g.file_path = name
          AND (ua.auth_user_id = auth.uid() OR ub.auth_user_id = auth.uid())
        )
      )
    )
  )
);

-- Add policy for updating/deleting media
CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'message-media'
  AND (storage.foldername(name))[1] = 'galleries'
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id::text = (storage.foldername(name))[2]
    AND u.auth_user_id = auth.uid()
  )
);

-- ============================================
-- FIX GALLERIES TABLE RLS POLICIES
-- ============================================
-- The galleries table uses public.users.id, but RLS checks auth.uid()
-- We need to update the policies to join with the users table

-- Drop existing galleries policies
DROP POLICY IF EXISTS "Users can view galleries they own" ON public.galleries;
DROP POLICY IF EXISTS "Users can insert to galleries they own" ON public.galleries;
DROP POLICY IF EXISTS "Users can delete from galleries they own" ON public.galleries;

-- Create corrected policies that map public.users.id to auth.uid()
CREATE POLICY "Users can view galleries they own" ON public.galleries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = owner_a AND u.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = owner_b AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert to galleries they own" ON public.galleries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = owner_a AND u.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = owner_b AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete from galleries they own" ON public.galleries
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = owner_a AND u.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = owner_b AND u.auth_user_id = auth.uid()
    )
  );
