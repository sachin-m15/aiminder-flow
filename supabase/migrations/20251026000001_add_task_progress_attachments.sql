-- ============================================================================
-- TASK PROGRESS ATTACHMENTS MIGRATION
-- Adds support for file attachments to task progress updates
-- Creates storage bucket, attachments table, and necessary policies
-- ============================================================================

-- ============================================================================
-- CREATE STORAGE BUCKET
-- ============================================================================

-- Create a storage bucket for task progress attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  false, -- Private bucket, files accessible only through RLS
  10485760, -- 10MB file size limit per file
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', -- .pptx
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- CREATE ATTACHMENTS TABLE
-- ============================================================================

-- Create task_attachments table to store metadata about uploaded files
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_update_id UUID NOT NULL REFERENCES public.task_updates(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Storage path: {task_id}/{task_update_id}/{filename}
  file_size BIGINT NOT NULL, -- Size in bytes
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_file_size CHECK (file_size > 0 AND file_size <= 10485760)
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_update_id 
  ON public.task_attachments(task_update_id);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id 
  ON public.task_attachments(task_id);

CREATE INDEX IF NOT EXISTS idx_task_attachments_user_id 
  ON public.task_attachments(user_id);

CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_at 
  ON public.task_attachments(uploaded_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on task_attachments table
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view attachments for tasks they're assigned to or created
CREATE POLICY "Users can view task attachments they have access to"
  ON public.task_attachments
  FOR SELECT
  USING (
    -- User is the uploader
    auth.uid() = user_id
    OR
    -- User is assigned to the task
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_attachments.task_id
      AND tasks.assigned_to = auth.uid()
    )
    OR
    -- User created the task (admin/staff)
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_attachments.task_id
      AND tasks.created_by = auth.uid()
    )
    OR
    -- User is an admin or staff
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'staff')
    )
  );

-- Policy: Users can insert attachments for their own updates
CREATE POLICY "Users can upload attachments for their own updates"
  ON public.task_attachments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND
    -- Verify the task_update belongs to the user
    EXISTS (
      SELECT 1 FROM public.task_updates
      WHERE task_updates.id = task_update_id
      AND task_updates.user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own attachments
CREATE POLICY "Users can delete their own attachments"
  ON public.task_attachments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Admins can delete any attachment
CREATE POLICY "Admins can delete any attachment"
  ON public.task_attachments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'staff')
    )
  );

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Policy: Users can view files they have access to
CREATE POLICY "Users can view task attachment files they have access to"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'task-attachments'
    AND
    (
      -- User uploaded the file
      auth.uid()::text = (storage.foldername(name))[3]
      OR
      -- User has access to the task (check via task_attachments table)
      EXISTS (
        SELECT 1 FROM public.task_attachments ta
        JOIN public.tasks t ON ta.task_id = t.id
        WHERE ta.file_path = name
        AND (
          t.assigned_to = auth.uid()
          OR t.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'staff')
          )
        )
      )
    )
  );

-- Policy: Users can upload files for their tasks
CREATE POLICY "Users can upload task attachment files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND
    -- Verify user is uploading to their own folder structure
    auth.uid()::text = (storage.foldername(name))[3]
    AND
    -- Verify the task belongs to the user
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id::text = (storage.foldername(name))[1]
      AND (
        tasks.assigned_to = auth.uid()
        OR tasks.created_by = auth.uid()
      )
    )
  );

-- Policy: Users can delete their own uploaded files
CREATE POLICY "Users can delete their own task attachment files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'task-attachments'
    AND auth.uid()::text = (storage.foldername(name))[3]
  );

-- Policy: Admins can delete any task attachment files
CREATE POLICY "Admins can delete any task attachment files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'task-attachments'
    AND
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'staff')
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get total attachment size for a task update
CREATE OR REPLACE FUNCTION public.get_task_update_attachments_size(p_task_update_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(file_size), 0)
  FROM public.task_attachments
  WHERE task_update_id = p_task_update_id;
$$;

-- Function to get attachment count for a task update
CREATE OR REPLACE FUNCTION public.get_task_update_attachments_count(p_task_update_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.task_attachments
  WHERE task_update_id = p_task_update_id;
$$;

-- Function to clean up orphaned storage files (files without database records)
-- This is useful for maintenance
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_attachment_files()
RETURNS TABLE(deleted_path TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  -- This function can be called manually by admins to clean up orphaned files
  -- Returns the paths of deleted files
  RETURN QUERY
  DELETE FROM storage.objects
  WHERE bucket_id = 'task-attachments'
  AND NOT EXISTS (
    SELECT 1 FROM public.task_attachments
    WHERE task_attachments.file_path = objects.name
  )
  RETURNING name;
END;
$$;

-- ============================================================================
-- TRIGGER FOR AUTOMATIC CLEANUP
-- ============================================================================

-- Function to delete storage file when attachment record is deleted
CREATE OR REPLACE FUNCTION public.delete_task_attachment_file()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  -- Delete the file from storage when the database record is deleted
  DELETE FROM storage.objects
  WHERE bucket_id = 'task-attachments'
  AND name = OLD.file_path;
  
  RETURN OLD;
END;
$$;

-- Create trigger to automatically delete files when attachment records are deleted
DROP TRIGGER IF EXISTS trigger_delete_task_attachment_file ON public.task_attachments;
CREATE TRIGGER trigger_delete_task_attachment_file
  AFTER DELETE ON public.task_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_task_attachment_file();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.task_attachments IS 
  'Stores metadata for files attached to task progress updates';

COMMENT ON COLUMN public.task_attachments.file_path IS 
  'Storage path format: {task_id}/{task_update_id}/{filename}';

COMMENT ON COLUMN public.task_attachments.file_size IS 
  'File size in bytes, maximum 10MB per file';

COMMENT ON FUNCTION public.get_task_update_attachments_size(UUID) IS 
  'Returns total size in bytes of all attachments for a task update';

COMMENT ON FUNCTION public.get_task_update_attachments_count(UUID) IS 
  'Returns the count of attachments for a task update';

COMMENT ON FUNCTION public.cleanup_orphaned_attachment_files() IS 
  'Maintenance function to delete storage files without database records';


-- Fix storage policies for task attachments
-- The original policies incorrectly assumed user_id was in the path
-- Path structure is: {task_id}/{task_update_id}/{filename}

-- Drop the incorrect policies
DROP POLICY IF EXISTS "Users can upload task attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own task attachment files" ON storage.objects;

-- Recreate with correct logic
-- Policy: Users can upload files for their tasks
CREATE POLICY "Users can upload task attachment files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND
    -- Verify the task belongs to the user (task_id is first folder)
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id::text = (storage.foldername(name))[1]
      AND (
        tasks.assigned_to = auth.uid()
        OR tasks.created_by = auth.uid()
      )
    )
  );

-- Policy: Users can delete their own uploaded files
CREATE POLICY "Users can delete their own task attachment files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'task-attachments'
    AND
    -- Check if user owns the attachment via task_attachments table
    EXISTS (
      SELECT 1 FROM public.task_attachments
      WHERE task_attachments.file_path = name
      AND task_attachments.user_id = auth.uid()
    )
  );
