# Employee Support Chat Configuration

## Overview
Employee chat has been restricted to **support purposes only**, preventing employees from creating or managing tasks that are admin-only operations.

## Implementation Details

### 1. Role-Based System Prompts
The AI chat function now uses different system prompts based on user role:

#### **Employee System Prompt** (Support-Only)
- **Purpose**: Support and assistance with assigned tasks
- **Allowed Actions**:
  - View assigned task status and details
  - Update task progress
  - Accept or reject task invitations
  - Log hours worked
  - Ask questions about the task management system
  - Request technical support

- **Blocked Actions**:
  - Create or assign tasks (admin-only)
  - Access other employees' information
  - Make management decisions
  - Discuss payment/compensation details
  - Access company operations outside task management

#### **Admin System Prompt** (Full Capabilities)
- Task creation and assignment
- Employee matching and recommendations
- Task progress tracking
- Payment estimates
- Full task management operations

### 2. Proactive Task Creation Blocking

#### Detection Logic
```typescript
const taskKeywords = ["create task", "assign", "new task", "task for", "need someone", "find employee"];
const isEmployeeTryingTaskCreation = !isAdmin && taskKeywords.some(k => message.toLowerCase().includes(k));
```

#### Response to Blocked Attempts
If an employee tries to use task creation keywords, they receive:
- Clear explanation that task creation is admin-only
- List of what they CAN do (view tasks, update progress, etc.)
- Helpful redirection to available features

### 3. Implementation Location
**File**: `supabase/functions/ai-chat/index.ts`

**Changes**:
1. **Lines 415-461**: Conditional system prompt based on `userRole?.role`
2. **Lines 479-512**: Task creation detection and blocking logic
3. **Lines 481-483**: Enhanced detection flags including `isEmployeeTryingTaskCreation`

## User Experience

### Employee Attempts Task Creation
**User Input**: "Create a task for website redesign"

**AI Response**:
```
I understand you're interested in task creation, but as an employee, 
you don't have permission to create or assign tasks.

Only administrators can create and assign tasks.

What I can help you with:
- View your assigned tasks
- Update progress on your tasks
- Accept or reject task invitations
- Log hours worked
- Answer questions about your tasks

Would you like to check your current tasks or need help with something else?
```

### Employee Asks for Support
**User Input**: "How do I update my task progress?"

**AI Response** (Helpful Support):
```
To update your task progress, you can:
1. Use the "Update Progress" button on your task card
2. Enter the completion percentage (0-100%)
3. Optionally log hours worked
4. Add any notes about your progress

The task will automatically be marked as "completed" when you reach 100%.

Would you like me to show you your current tasks?
```

### Admin Creates Task
**User Input**: "Create a task for React developer"

**AI Response** (Normal Operation):
```
I've analyzed your requirements and found these top candidates:
[... employee suggestions ...]
```

## Testing Checklist

### ✅ Employee Role Testing
- [ ] Employee cannot trigger task creation flow
- [ ] Employee receives support-focused responses
- [ ] Employee can view their tasks
- [ ] Employee can update task progress
- [ ] Employee can accept/reject invitations
- [ ] Employee gets helpful redirection when trying admin actions

### ✅ Admin Role Testing
- [ ] Admin can create and assign tasks
- [ ] Admin receives employee suggestions
- [ ] Admin can access all task management features
- [ ] Admin system prompt is correct

### ✅ Edge Cases
- [ ] Employee with "staff" role (should have admin capabilities)
- [ ] Employee asking about tasks generally (support response)
- [ ] Employee asking about specific assigned task (support response)

## Deployment Steps

1. **Restart Edge Function**:
   ```bash
   # Stop current function (Ctrl+C)
   supabase functions serve ai-chat --env-file supabase/.env.local --no-verify-jwt
   ```

2. **Test Locally**:
   - Test with employee account
   - Test with admin account
   - Verify blocking works
   - Verify support responses are helpful

3. **Deploy to Production**:
   ```bash
   supabase functions deploy ai-chat
   ```

4. **Verify in Production**:
   - Test employee account cannot create tasks
   - Test admin account works normally
   - Check logs for any errors

## Benefits

1. **Security**: Prevents unauthorized task creation
2. **User Experience**: Clear guidance on what employees can do
3. **Role Separation**: Clean distinction between admin and employee capabilities
4. **Support Focus**: Employees get helpful, support-oriented responses
5. **Scalability**: Easy to extend with more role-based restrictions

## Future Enhancements

- Add "manager" role with limited admin capabilities
- Implement employee-to-employee chat for collaboration
- Add automated support responses for common questions
- Create support ticket system for complex issues
- Add analytics on employee support queries

---

**Status**: ✅ Implemented  
**Last Updated**: October 17, 2025  
**Next Review**: After production deployment and user feedback
