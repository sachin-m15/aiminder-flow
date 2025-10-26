# Task Progress Attachments Feature

## Overview
This feature adds the ability for employees to attach files (PDFs, images, documents, etc.) when submitting progress updates for tasks. Files are securely stored in Supabase Storage and only uploaded when the progress update is submitted.

## Database Migration

### Migration File
`supabase/migrations/20251026000001_add_task_progress_attachments.sql`

### What's Included

#### 1. **Storage Bucket: `task-attachments`**
- **Privacy**: Private bucket (files accessible only through RLS policies)
- **File Size Limit**: 10MB per file
- **Allowed File Types**:
  - Images: JPEG, PNG, GIF, WebP
  - Documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX
  - Text: TXT, CSV
  - Archives: ZIP

#### 2. **New Table: `task_attachments`**
```sql
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY,
  task_update_id UUID REFERENCES task_updates(id),
  task_id UUID REFERENCES tasks(id),
  user_id UUID REFERENCES auth.users(id),
  file_name TEXT,
  file_path TEXT,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ
)
```

**Storage Path Format**: `{task_id}/{task_update_id}/{filename}`

#### 3. **Row Level Security (RLS) Policies**

**Database Policies (task_attachments table)**:
- ✅ Users can view attachments for tasks they're assigned to or created
- ✅ Admins/Staff can view all attachments
- ✅ Users can upload attachments for their own task updates
- ✅ Users can delete their own attachments
- ✅ Admins can delete any attachment

**Storage Policies (storage.objects)**:
- ✅ Users can view files they have access to (based on task assignment)
- ✅ Users can upload files to their task folders
- ✅ Users can delete their own uploaded files
- ✅ Admins can delete any attachment files

#### 4. **Helper Functions**

```sql
-- Get total size of attachments for a task update
get_task_update_attachments_size(task_update_id UUID) RETURNS BIGINT

-- Get count of attachments for a task update
get_task_update_attachments_count(task_update_id UUID) RETURNS INTEGER

-- Cleanup orphaned files (maintenance)
cleanup_orphaned_attachment_files() RETURNS TABLE
```

#### 5. **Automatic Cleanup**
- Trigger automatically deletes storage files when attachment records are deleted
- Maintains data consistency between database and storage

## Implementation Guide

### Step 1: Run the Migration

```bash
# Apply the migration to your Supabase project
supabase db push

# Or if using migrations locally
supabase migration up
```

### Step 2: Update TypeScript Types

```bash
# Generate new TypeScript types
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

### Step 3: Frontend Implementation

#### A. Update TaskDialog Component

Add file upload functionality to `src/components/dashboard/TaskDialog.tsx`:

```tsx
import { useState } from "react";
import { Upload, File, X } from "lucide-react";

// Add to component state
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
const [uploadingFiles, setUploadingFiles] = useState(false);

// File selection handler
const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  
  // Validate file size (10MB max per file)
  const validFiles = files.filter(file => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`${file.name} exceeds 10MB limit`);
      return false;
    }
    return true;
  });
  
  setSelectedFiles(prev => [...prev, ...validFiles]);
};

// Remove file from selection
const removeFile = (index: number) => {
  setSelectedFiles(prev => prev.filter((_, i) => i !== index));
};

// Upload files to storage
const uploadAttachments = async (taskUpdateId: string) => {
  if (selectedFiles.length === 0) return;
  
  setUploadingFiles(true);
  try {
    const uploadPromises = selectedFiles.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${task.id}/${taskUpdateId}/${fileName}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      // Save metadata to database
      const { error: dbError } = await supabase
        .from('task_attachments')
        .insert({
          task_update_id: taskUpdateId,
          task_id: task.id,
          user_id: userId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
        });
      
      if (dbError) throw dbError;
    });
    
    await Promise.all(uploadPromises);
    toast.success(`${selectedFiles.length} file(s) uploaded successfully`);
    setSelectedFiles([]);
  } catch (error) {
    console.error('Error uploading attachments:', error);
    toast.error('Failed to upload some files');
  } finally {
    setUploadingFiles(false);
  }
};

// Modified handleUpdateProgress function
const handleUpdateProgress = async (data: TaskProgressFormData) => {
  setLoading(true);
  try {
    // 1. Update task progress
    const { error: taskError } = await supabase
      .from("tasks")
      .update({ 
        progress: data.progress, 
        status: data.progress === 100 ? "completed" : "ongoing" 
      })
      .eq("id", task.id);

    if (taskError) throw taskError;

    // 2. Create task update entry
    const { data: insertedUpdate, error: updateError } = await supabase
      .from("task_updates")
      .insert({
        task_id: task.id,
        user_id: userId,
        update_text: data.updateText?.trim() || `Progress updated to ${data.progress}%`,
        progress: data.progress,
        hours_logged: data.hoursLogged && data.hoursLogged > 0 ? data.hoursLogged : null,
      })
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. Upload attachments (only if task update was created successfully)
    if (insertedUpdate && selectedFiles.length > 0) {
      await uploadAttachments(insertedUpdate.id);
    }

    toast.success("Task updated successfully");
    form.reset();
    await loadTaskUpdates();
    onClose();
  } catch (error) {
    console.error("Error in handleUpdateProgress:", error);
    toast.error(error instanceof Error ? error.message : "Failed to update task");
  } finally {
    setLoading(false);
  }
};
```

#### B. Add File Upload UI

Add this to the progress update form in TaskDialog:

```tsx
{/* File Upload Section */}
<div className="space-y-2">
  <Label htmlFor="file-upload">Attach Files (Optional)</Label>
  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
    <Input
      id="file-upload"
      type="file"
      multiple
      onChange={handleFileSelect}
      className="hidden"
      accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
    />
    <label
      htmlFor="file-upload"
      className="flex flex-col items-center justify-center cursor-pointer"
    >
      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
      <span className="text-sm text-muted-foreground">
        Click to upload files (Max 10MB each)
      </span>
      <span className="text-xs text-muted-foreground mt-1">
        PDF, Images, Documents, etc.
      </span>
    </label>
  </div>
  
  {/* Selected Files List */}
  {selectedFiles.length > 0 && (
    <div className="space-y-2">
      {selectedFiles.map((file, index) => (
        <div
          key={index}
          className="flex items-center justify-between bg-muted p-2 rounded"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <File className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              ({(file.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeFile(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )}
</div>
```

#### C. Display Attachments in Task History

```tsx
// Add function to load attachments for updates
const loadAttachments = async (taskUpdateId: string) => {
  const { data, error } = await supabase
    .from('task_attachments')
    .select('*')
    .eq('task_update_id', taskUpdateId)
    .order('uploaded_at', { ascending: true });
  
  return data || [];
};

// Download file handler
const downloadFile = async (filePath: string, fileName: string) => {
  try {
    const { data, error } = await supabase.storage
      .from('task-attachments')
      .download(filePath);
    
    if (error) throw error;
    
    // Create download link
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading file:', error);
    toast.error('Failed to download file');
  }
};

// In the task history section, add attachments display:
{taskUpdates.map((update) => (
  <div key={update.id} className="border-l-2 border-primary pl-4 pb-4">
    {/* Existing update content */}
    
    {/* Attachments */}
    {update.attachments && update.attachments.length > 0 && (
      <div className="mt-2 space-y-1">
        <Label className="text-xs text-muted-foreground">Attachments:</Label>
        {update.attachments.map((attachment) => (
          <Button
            key={attachment.id}
            variant="outline"
            size="sm"
            onClick={() => downloadFile(attachment.file_path, attachment.file_name)}
            className="w-full justify-start"
          >
            <File className="h-3 w-3 mr-2" />
            <span className="truncate">{attachment.file_name}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              ({(attachment.file_size / 1024).toFixed(1)} KB)
            </span>
          </Button>
        ))}
      </div>
    )}
  </div>
))}
```

### Step 4: Update loadTaskUpdates Function

Modify the function to include attachments:

```tsx
const loadTaskUpdates = async () => {
  setLoadingUpdates(true);
  try {
    // Get task updates
    const { data: updatesData, error: updatesError } = await supabase
      .from("task_updates")
      .select(`
        id,
        update_text,
        progress,
        hours_logged,
        created_at,
        user_id
      `)
      .eq("task_id", task.id)
      .order("created_at", { ascending: false });

    if (updatesError) throw updatesError;

    // Get profiles
    const userIds = [...new Set(updatesData?.map(u => u.user_id) || [])];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    // Get attachments for all updates
    const updateIds = updatesData?.map(u => u.id) || [];
    const { data: attachmentsData } = await supabase
      .from("task_attachments")
      .select("*")
      .in("task_update_id", updateIds);

    // Merge data
    const updatesWithProfiles = updatesData?.map(update => ({
      ...update,
      profiles: profilesData?.find(p => p.id === update.user_id) || null,
      attachments: attachmentsData?.filter(a => a.task_update_id === update.id) || [],
    })) || [];

    setTaskUpdates(updatesWithProfiles);
  } catch (error) {
    console.error("Error loading task updates:", error);
  } finally {
    setLoadingUpdates(false);
  }
};
```

## Testing Checklist

- [ ] Run migration successfully
- [ ] Update TypeScript types
- [ ] Employee can select files before submitting progress
- [ ] Files are only uploaded when submit button is pressed
- [ ] Files appear in task history
- [ ] Attachments can be downloaded
- [ ] File size validation works (10MB limit)
- [ ] File type validation works
- [ ] RLS policies prevent unauthorized access
- [ ] Admin can view all attachments
- [ ] Deleting attachment removes storage file
- [ ] Multiple files can be uploaded at once
- [ ] UI shows upload progress/status

## Storage Structure

```
task-attachments/
├── {task_id_1}/
│   ├── {task_update_id_1}/
│   │   ├── 1730000001_abc123.pdf
│   │   └── 1730000002_def456.png
│   └── {task_update_id_2}/
│       └── 1730000003_ghi789.docx
└── {task_id_2}/
    └── {task_update_id_3}/
        └── 1730000004_jkl012.xlsx
```

## Security Features

1. **File Size Limits**: 10MB per file enforced at database and storage level
2. **MIME Type Validation**: Only allowed file types can be uploaded
3. **Row Level Security**: Users can only access files for their tasks
4. **Private Storage**: Files not publicly accessible
5. **Automatic Cleanup**: Orphaned files are removed when records are deleted
6. **User Verification**: Files linked to specific users and task updates

## Maintenance

### Clean Up Orphaned Files

```sql
-- Run this periodically to clean up files without database records
SELECT * FROM public.cleanup_orphaned_attachment_files();
```

### Check Storage Usage

```sql
-- Get total storage used per task
SELECT 
  task_id,
  COUNT(*) as file_count,
  SUM(file_size) as total_size_bytes,
  ROUND(SUM(file_size) / 1024.0 / 1024.0, 2) as total_size_mb
FROM public.task_attachments
GROUP BY task_id
ORDER BY total_size_bytes DESC;
```

## API Examples

### Upload File
```typescript
// Upload file to storage
const filePath = `${taskId}/${taskUpdateId}/${fileName}`;
await supabase.storage
  .from('task-attachments')
  .upload(filePath, file);

// Save metadata
await supabase
  .from('task_attachments')
  .insert({
    task_update_id: taskUpdateId,
    task_id: taskId,
    user_id: userId,
    file_name: file.name,
    file_path: filePath,
    file_size: file.size,
    mime_type: file.type,
  });
```

### Download File
```typescript
const { data } = await supabase.storage
  .from('task-attachments')
  .download(filePath);
```

### Delete File
```typescript
// Delete from database (triggers automatic storage deletion)
await supabase
  .from('task_attachments')
  .delete()
  .eq('id', attachmentId);
```

## Future Enhancements

- [ ] Add image preview/thumbnail generation
- [ ] Implement file compression for large images
- [ ] Add virus scanning for uploaded files
- [ ] Support for drag-and-drop file upload
- [ ] Progress bar for large file uploads
- [ ] Ability to add attachments to existing updates
- [ ] File version control
- [ ] Bulk download as ZIP
