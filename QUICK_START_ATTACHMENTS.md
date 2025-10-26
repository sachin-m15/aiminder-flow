# Quick Start: Task Progress Attachments

## 🚀 Quick Implementation Steps

### 1. Apply Migration
```bash
supabase db push
```

### 2. Update Types
```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

### 3. Add to TaskDialog Component

#### Import Icons
```tsx
import { Upload, File, X, Download } from "lucide-react";
```

#### Add State
```tsx
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
const [uploadingFiles, setUploadingFiles] = useState(false);
```

#### File Selection Handler
```tsx
const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  const validFiles = files.filter(file => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`${file.name} exceeds 10MB limit`);
      return false;
    }
    return true;
  });
  setSelectedFiles(prev => [...prev, ...validFiles]);
};

const removeFile = (index: number) => {
  setSelectedFiles(prev => prev.filter((_, i) => i !== index));
};
```

#### Upload Function
```tsx
const uploadAttachments = async (taskUpdateId: string) => {
  if (selectedFiles.length === 0) return;
  
  setUploadingFiles(true);
  try {
    await Promise.all(selectedFiles.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${task.id}/${taskUpdateId}/${fileName}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      // Save metadata
      await supabase.from('task_attachments').insert({
        task_update_id: taskUpdateId,
        task_id: task.id,
        user_id: userId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
      });
    }));
    
    toast.success(`${selectedFiles.length} file(s) uploaded`);
    setSelectedFiles([]);
  } catch (error) {
    console.error('Upload error:', error);
    toast.error('Failed to upload files');
  } finally {
    setUploadingFiles(false);
  }
};
```

#### Update Progress Handler
```tsx
const handleUpdateProgress = async (data: TaskProgressFormData) => {
  setLoading(true);
  try {
    // Update task
    await supabase.from("tasks")
      .update({ progress: data.progress, status: data.progress === 100 ? "completed" : "ongoing" })
      .eq("id", task.id);

    // Create update entry
    const { data: insertedUpdate } = await supabase
      .from("task_updates")
      .insert({
        task_id: task.id,
        user_id: userId,
        update_text: data.updateText?.trim() || `Progress updated to ${data.progress}%`,
        progress: data.progress,
        hours_logged: data.hoursLogged || null,
      })
      .select()
      .single();

    // Upload attachments ONLY after successful update
    if (insertedUpdate && selectedFiles.length > 0) {
      await uploadAttachments(insertedUpdate.id);
    }

    toast.success("Task updated successfully");
    form.reset();
    onClose();
  } catch (error) {
    toast.error("Failed to update task");
  } finally {
    setLoading(false);
  }
};
```

#### UI Component (Add to form)
```tsx
{/* File Upload Section - Add before Submit button */}
<div className="space-y-2">
  <Label htmlFor="file-upload">Attach Files (Optional)</Label>
  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
    <Input
      id="file-upload"
      type="file"
      multiple
      onChange={handleFileSelect}
      className="hidden"
      accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
    />
    <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer">
      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
      <span className="text-sm text-muted-foreground">
        Click to upload (Max 10MB each)
      </span>
    </label>
  </div>
  
  {selectedFiles.length > 0 && (
    <div className="space-y-2">
      {selectedFiles.map((file, index) => (
        <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <File className="h-4 w-4" />
            <span className="text-sm truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              ({(file.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )}
</div>
```

### 4. Display Attachments in History

#### Update TaskUpdate Interface
```tsx
interface TaskUpdate {
  id: string;
  update_text: string;
  progress: number;
  hours_logged: number | null;
  created_at: string;
  profiles?: { full_name: string; } | null;
  attachments?: Array<{
    id: string;
    file_name: string;
    file_path: string;
    file_size: number;
  }>;
}
```

#### Load Attachments
```tsx
const loadTaskUpdates = async () => {
  // ... existing code to load updates and profiles ...
  
  // Load attachments
  const updateIds = updatesData?.map(u => u.id) || [];
  const { data: attachmentsData } = await supabase
    .from("task_attachments")
    .select("*")
    .in("task_update_id", updateIds);

  // Merge attachments
  const updatesWithProfiles = updatesData?.map(update => ({
    ...update,
    profiles: profilesData?.find(p => p.id === update.user_id) || null,
    attachments: attachmentsData?.filter(a => a.task_update_id === update.id) || [],
  })) || [];

  setTaskUpdates(updatesWithProfiles);
};
```

#### Download Handler
```tsx
const downloadFile = async (filePath: string, fileName: string) => {
  try {
    const { data, error } = await supabase.storage
      .from('task-attachments')
      .download(filePath);
    
    if (error) throw error;
    
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    toast.error('Failed to download file');
  }
};
```

#### Display in UI
```tsx
{taskUpdates.map((update) => (
  <div key={update.id} className="border-l-2 border-primary pl-4 pb-4">
    {/* Existing update display */}
    
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
            className="w-full justify-start text-xs"
          >
            <Download className="h-3 w-3 mr-2" />
            {attachment.file_name}
            <span className="ml-auto text-muted-foreground">
              ({(attachment.file_size / 1024).toFixed(1)} KB)
            </span>
          </Button>
        ))}
      </div>
    )}
  </div>
))}
```

## 📋 Supported File Types

- **Images**: JPG, PNG, GIF, WebP
- **Documents**: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX
- **Text**: TXT, CSV
- **Archives**: ZIP

## 🔒 Security

- ✅ 10MB file size limit per file
- ✅ Only authorized users can access files
- ✅ Files stored in private bucket
- ✅ Automatic cleanup when records deleted
- ✅ User-specific access controls

## 🧪 Testing

1. Select files before submitting progress
2. Verify files only upload after submit
3. Check attachments appear in history
4. Test download functionality
5. Verify file size validation
6. Test with different file types
7. Confirm admin can see all attachments

## 🎯 Key Points

- Files are **NOT** uploaded until progress is submitted
- Maximum **10MB per file**
- Multiple files can be attached to one update
- Files automatically deleted when update is deleted
- Only task participants can access files

## 📁 Storage Path

```
task-attachments/
  └── {task_id}/
      └── {task_update_id}/
          ├── timestamp_random.pdf
          └── timestamp_random.png
```
