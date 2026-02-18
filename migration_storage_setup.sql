-- ACEGAS ENTERPRISE - CLOUD STORAGE PROVISIONING
-- Run this in your Supabase SQL Editor to enable logo hosting.

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Security Policies (Allow Public Read)
CREATE POLICY "Public Assets Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'assets' );

-- 3. Storage Security Policies (Allow System Uploads)
-- Note: In a production environment with Auth, you would restrict this to authenticated users.
-- For the current 'System Sync' mode, we enable it for the anon role.
CREATE POLICY "System Assets Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'assets' );

CREATE POLICY "System Assets Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'assets' );

-- Ensure schema cache updated
NOTIFY pgrst, 'reload schema';