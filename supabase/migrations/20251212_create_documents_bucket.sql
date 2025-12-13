-- Create the documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    false,
    10485760, -- 10MB in bytes
    ARRAY[
        'text/csv',
        'application/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/json',
        'image/jpeg',
        'image/png',
        'image/heic'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy: Allow authenticated users to upload files to their organization's folder
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can upload to their organization folder'
    ) THEN
        CREATE POLICY "Users can upload to their organization folder"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (
            bucket_id = 'documents' AND
            (storage.foldername(name))[1] IN (
                SELECT org_id::text 
                FROM organization_memberships 
                WHERE user_id = auth.uid()
            )
        );
    END IF;
END $$;

-- Policy: Allow authenticated users to read files from their organization's folder
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can read their organization files'
    ) THEN
        CREATE POLICY "Users can read their organization files"
        ON storage.objects
        FOR SELECT
        TO authenticated
        USING (
            bucket_id = 'documents' AND
            (storage.foldername(name))[1] IN (
                SELECT org_id::text 
                FROM organization_memberships 
                WHERE user_id = auth.uid()
            )
        );
    END IF;
END $$;

-- Policy: Allow authenticated users to delete files from their organization's folder
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can delete their organization files'
    ) THEN
        CREATE POLICY "Users can delete their organization files"
        ON storage.objects
        FOR DELETE
        TO authenticated
        USING (
            bucket_id = 'documents' AND
            (storage.foldername(name))[1] IN (
                SELECT org_id::text 
                FROM organization_memberships 
                WHERE user_id = auth.uid()
            )
        );
    END IF;
END $$;

-- Policy: Allow authenticated users to update files in their organization's folder
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can update their organization files'
    ) THEN
        CREATE POLICY "Users can update their organization files"
        ON storage.objects
        FOR UPDATE
        TO authenticated
        USING (
            bucket_id = 'documents' AND
            (storage.foldername(name))[1] IN (
                SELECT org_id::text 
                FROM organization_memberships 
                WHERE user_id = auth.uid()
            )
        );
    END IF;
END $$;


