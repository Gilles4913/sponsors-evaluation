/*
  # Create club_exports storage bucket

  1. Storage
    - Create 'club_exports' bucket for PDF reports
    - Set public access for easy sharing
    - Add RLS policies for secure access

  2. Security
    - Authenticated users can upload to their tenant folder
    - Public read access for generated PDFs
    - Auto-cleanup old files (optional, can be done via cron)
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club_exports',
  'club_exports',
  true,
  10485760,
  ARRAY['application/pdf', 'text/csv', 'image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO NOTHING;

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
