# Testing Guide: Task Attachments Feature

## 🧪 How to Test the Feature

### Prerequisites
- ✅ Migration applied successfully
- ✅ Dev server running (`bun run dev`)
- ✅ User logged in as employee
- ✅ At least one task assigned to the user

---

## 📝 Test Scenarios

### Test 1: Upload Single File

**Steps:**
1. Login as an employee
2. Navigate to Dashboard
3. Click on a task with status "accepted" or "ongoing"
4. Scroll to "Update Progress" section
5. Set progress to any value (e.g., 75%)
6. Add hours worked (e.g., 2)
7. Write a progress note (e.g., "Completed API integration")
8. Click the "Attach Files" upload zone
9. Select a single PDF file (under 10MB)
10. Verify file appears in the selected files list
11. Click "Submit Update"

**Expected Results:**
- ✅ File shows in selected files list with correct name and size
- ✅ Submit button changes to "Uploading files..." during upload
- ✅ Success message: "Task updated successfully" and "1 file(s) uploaded"
- ✅ Dialog closes
- ✅ Task list refreshes

---

### Test 2: Upload Multiple Files

**Steps:**
1. Open a task dialog
2. Scroll to "Update Progress"
3. Fill in progress details
4. Click upload zone
5. Select multiple files (e.g., 2 images + 1 PDF)
6. Verify all files appear in the list
7. Submit update

**Expected Results:**
- ✅ All files show in selected list
- ✅ Total file count displayed
- ✅ Success message shows correct count (e.g., "3 file(s) uploaded")
- ✅ All files visible in task history

---

### Test 3: Remove File Before Upload

**Steps:**
1. Open task dialog
2. Select 3 files
3. Click the X button on the second file
4. Verify file is removed
5. Submit with remaining 2 files

**Expected Results:**
- ✅ File removed from list immediately
- ✅ File count updates
- ✅ Only 2 files uploaded
- ✅ Correct success message

---

### Test 4: File Size Validation

**Steps:**
1. Try to upload a file larger than 10MB
2. Observe the error message

**Expected Results:**
- ✅ Error toast: "[filename] exceeds 10MB limit"
- ✅ File not added to selected list
- ✅ Other valid files still selectable

---

### Test 5: View Attachments in History

**Steps:**
1. Open a task that has updates with attachments
2. Scroll to "Task History"
3. Find an update with attachments
4. Observe the attachments section

**Expected Results:**
- ✅ "📎 Attachments (n)" badge visible
- ✅ All files listed with names and sizes
- ✅ Download button visible for each file
- ✅ Delete button visible if you're the owner or admin

---

### Test 6: Download Attachment

**Steps:**
1. Find an update with attachments
2. Click the download icon (⬇️) on a file
3. Check your downloads folder

**Expected Results:**
- ✅ Success toast: "File downloaded successfully"
- ✅ File downloads to computer
- ✅ File opens correctly
- ✅ Filename matches original

---

### Test 7: Delete Attachment (Owner)

**Steps:**
1. Find YOUR update with attachments
2. Click the delete icon (🗑️) on a file
3. Confirm deletion

**Expected Results:**
- ✅ Success toast: "Attachment deleted"
- ✅ File removed from list
- ✅ Attachment count updates
- ✅ History refreshes

---

### Test 8: Delete Attachment (Admin)

**Steps:**
1. Login as admin
2. Open any task
3. Find any update with attachments
4. Click delete on any attachment

**Expected Results:**
- ✅ Admin can delete any attachment
- ✅ Success message shown
- ✅ File removed immediately

---

### Test 9: Permission Check (Non-Owner)

**Steps:**
1. Login as Employee A
2. Find an update created by Employee B
3. Try to find delete button

**Expected Results:**
- ✅ No delete button visible
- ✅ Download button still visible
- ✅ Can view and download files

---

### Test 10: Multiple File Types

**Steps:**
1. Upload files of different types in one update:
   - 1 PDF (.pdf)
   - 1 Image (.png)
   - 1 Excel (.xlsx)
   - 1 Word (.docx)
   - 1 Text (.txt)
2. Submit and view in history

**Expected Results:**
- ✅ All file types accepted
- ✅ All files upload successfully
- ✅ All files visible in history
- ✅ All files downloadable

---

### Test 11: Submit Without Files

**Steps:**
1. Fill progress update form
2. Don't select any files
3. Submit update

**Expected Results:**
- ✅ Update submits normally
- ✅ No errors shown
- ✅ Update visible in history without attachments section
- ✅ Success message shown

---

### Test 12: Cancel File Selection

**Steps:**
1. Select files
2. Close dialog without submitting
3. Reopen dialog

**Expected Results:**
- ✅ Selected files cleared
- ✅ No files uploaded
- ✅ No orphaned files in storage

---

### Test 13: Network Error Handling

**Steps:**
1. Open browser DevTools
2. Go to Network tab
3. Enable "Offline" mode
4. Try to upload files

**Expected Results:**
- ✅ Error message displayed
- ✅ No partial uploads
- ✅ User can retry

---

### Test 14: Large Number of Files

**Steps:**
1. Select 10 small files (under 1MB each)
2. Submit update

**Expected Results:**
- ✅ All files upload successfully
- ✅ Progress shown during upload
- ✅ All files visible in history
- ✅ No performance issues

---

### Test 15: File Name with Special Characters

**Steps:**
1. Upload a file named: "Project Report (Final) - v2.1.pdf"
2. Submit and download

**Expected Results:**
- ✅ File uploads successfully
- ✅ Original filename preserved
- ✅ File downloads with correct name
- ✅ No encoding issues

---

## 🎯 Edge Cases to Test

### Edge Case 1: Exactly 10MB File
- Upload a file that's exactly 10,485,760 bytes
- Should upload successfully

### Edge Case 2: 10MB + 1 Byte
- Upload a file that's 10,485,761 bytes
- Should show error message

### Edge Case 3: Empty File
- Try to upload a 0-byte file
- Observe behavior

### Edge Case 4: File Type Not in Allow List
- Try to upload .exe or .bat file
- Should be rejected by file input

### Edge Case 5: Same File Twice
- Select same file twice in one update
- Both should upload as separate entries

---

## 🔒 Security Tests

### Security Test 1: Access Control
**Steps:**
1. Get file path from one task
2. Try to access it from another user's account
3. Verify RLS blocks access

**Expected Results:**
- ✅ 403 Forbidden or 404 Not Found
- ✅ File not accessible

### Security Test 2: Direct Storage URL
**Steps:**
1. Try to access storage bucket URL directly
2. Without authentication token

**Expected Results:**
- ✅ Access denied
- ✅ File not publicly accessible

### Security Test 3: SQL Injection
**Steps:**
1. Upload file named: `test'); DROP TABLE task_attachments; --`
2. Verify no SQL injection

**Expected Results:**
- ✅ Filename handled safely
- ✅ No database corruption

---

## 📊 Performance Tests

### Performance Test 1: Upload Speed
- Upload a 9MB file
- Time should be reasonable (<30s on normal connection)

### Performance Test 2: Download Speed
- Download a large file
- Should stream efficiently

### Performance Test 3: Multiple Concurrent Uploads
- Upload 5 files simultaneously
- All should complete successfully

### Performance Test 4: History Load Time
- Task with 20 updates, each with 5 attachments
- History should load in <3 seconds

---

## 🐛 Known Issues to Watch For

### Issue 1: Browser File Size Limit
- Some browsers might have issues with very large files
- Monitor browser console for errors

### Issue 2: Mobile Upload
- File picker might behave differently on mobile
- Test on actual mobile devices

### Issue 3: Slow Network
- Long uploads might timeout
- Consider adding timeout handling

---

## ✅ Acceptance Criteria Checklist

- [ ] Employee can select files before submitting
- [ ] Multiple files can be selected
- [ ] File size validation works (10MB limit)
- [ ] Files can be removed before upload
- [ ] Files upload only on submit
- [ ] Upload progress shown to user
- [ ] Success/error messages display
- [ ] Attachments appear in task history
- [ ] File count badge shows correctly
- [ ] Files can be downloaded
- [ ] Download preserves original filename
- [ ] Delete works for owners and admins
- [ ] Delete blocked for non-owners
- [ ] RLS policies enforced
- [ ] No orphaned files created
- [ ] Responsive on mobile devices
- [ ] Accessible via keyboard
- [ ] Works in all major browsers

---

## 📱 Browser Compatibility

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## 🎉 Success Criteria

**Feature is ready when:**
1. All test scenarios pass ✅
2. No console errors ✅
3. Performance is acceptable ✅
4. Security tests pass ✅
5. Works across browsers ✅
6. Mobile responsive ✅
7. Accessibility compliant ✅
8. User feedback is positive ✅

---

## 🐛 Reporting Issues

If you find a bug, report with:
1. Steps to reproduce
2. Expected vs actual behavior
3. Screenshots/videos
4. Browser and version
5. Console errors (if any)

---

## 💡 Tips for Testing

1. **Clear cache** between tests
2. **Check browser console** for errors
3. **Test with different file types**
4. **Verify in Supabase dashboard** that files are stored correctly
5. **Test with slow network** to see loading states
6. **Use different user roles** to test permissions

---

Happy Testing! 🚀
