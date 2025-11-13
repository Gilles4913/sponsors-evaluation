/*
  # Rename storage buckets with club_ prefix

  1. New Buckets
    - Create 'club_exports' bucket to replace 'exports'
    - Create 'club_public' bucket for public assets
    - Both buckets are public with file size limits
    - Configured MIME types for their specific use cases

  2. Security
    - RLS policies for authenticated users to upload to their tenant folder
    - Public read access for all files
    - Users can delete their own files
    
  3. Note
    - The old 'exports' bucket will need to be manually emptied and deleted
    - Files should be migrated from 'exports' to 'club_exports' if any exist
*/

-- Create club_exports bucket (replacement for exports)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club_exports',
  'club_exports',
  true,
  10485760,
  ARRAY['application/pdf', 'text/csv', 'image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create club_public bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club_public',
  'club_public',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for club_exports bucket
CREATE POLICY "Authenticated users can upload club exports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'club_exports' AND
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text
    FROM users
    WHERE users.id = auth.uid()
  )
);

CREATE POLICY "Public can view club exports"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'club_exports');

CREATE POLICY "Users can delete their own club exports"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'club_exports' AND
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text
    FROM users
    WHERE users.id = auth.uid()
  )
);

-- RLS policies for club_public bucket
CREATE POLICY "Authenticated users can upload to club public"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'club_public' AND
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text
    FROM users
    WHERE users.id = auth.uid()
  )
);

CREATE POLICY "Public can view club public files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'club_public');

CREATE POLICY "Users can delete their own club public files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'club_public' AND
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text
    FROM users
    WHERE users.id = auth.uid()
  )
);