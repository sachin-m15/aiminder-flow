# 🔍 Edge Function Analysis & Enhancement Plan

**Date:** October 17, 2025  
**Function:** `supabase/functions/ai-chat/index.ts`  
**Current Status:** ⚠️ Partially Aligned - Needs Enhancement

---

## ✅ What's Currently Working

### 1. Basic Task Creation ✅
- Extracts task details from natural language
- Creates tasks in database
- Sends invitations to employees
- Stores chat messages

### 2. Employee Matching (Basic) ✅
- Calculates match scores based on:
  - Skill matching (50%)
  - Workload (30%)
  - Performance (20%)
- Returns top 3 employee recommendations
- Shows estimated costs

### 3. Conversation Flow ✅
- Maintains chat history
- Handles admin vs employee roles
- Detects task creation keywords
- Regular chat fallback

---

## ❌ What's Missing / Misaligned

### 1. Scoring Algorithm Mismatch ⚠️

**Current Edge Function:**
```typescript
Score = (skillMatch * 0.5) + (workload * 0.3) + (performance * 0.2)
```

**TaskAssignmentDialog (Frontend):**
```typescript
Score = (skillMatch * 0.4) + (workload * 0.3) + (performance * 0.2) + (availability * 0.1)
```

**Issue:** Different weighting percentages and missing availability component!

### 2. Missing Fields ⚠️
Edge function doesn't use:
- `department` field (added in schema)
- `designation` field (added in schema)
- `started_at` field for tasks
- `created_at` for proper sorting

### 3. No Department/Designation Filtering ❌
Frontend TaskAssignmentDialog loads:
```typescript
employee_profiles.select(`
  user_id,
  skills,
  department,        // ← Used in frontend
  designation,       // ← Used in frontend
  performance_score,
  current_workload,
  profiles!employee_profiles_user_id_fkey (full_name)
`)
```

But edge function doesn't include these fields in recommendations.

### 4. Missing Task Update Integration ❌
- No endpoint to log hours worked
- No endpoint to update task progress
- No endpoint to add task updates
- No real-time task monitoring

### 5. No Payment Calculation ❌
Edge function mentions payment estimates but doesn't implement:
- AI vs Actual payment comparison
- Complexity-based payment adjustments
- Performance-based bonuses

### 6. Missing Real-time Features ❌
- No webhook for task status changes
- No notification system
- No real-time progress updates

---

## 🎯 Required Enhancements

### Priority 1: Align Scoring Algorithm (HIGH)

**Change:**
```typescript
// OLD (Line 23-26)
return (skillMatch / Math.max(requiredSkills.length, 1)) * 0.5 + 
       workloadScore * 0.3 + 
       performanceScore * 0.2;

// NEW
const skillMatchPercent = (skillMatch / Math.max(requiredSkills.length, 1)) * 100;
const maxWorkload = 10; // Same as frontend
const workloadCapacity = Math.max(0, ((maxWorkload - (employee.current_workload || 0)) / maxWorkload) * 100);
const performancePercent = employee.performance_score || 0;
const availabilityPercent = (employee.current_workload || 0) < 3 ? 100 : 
                           (employee.current_workload || 0) < 5 ? 70 : 40;

return (skillMatchPercent * 0.40) + 
       (workloadCapacity * 0.30) + 
       (performancePercent * 0.20) + 
       (availabilityPercent * 0.10);
```

### Priority 2: Add Department & Designation (HIGH)

**Change Line 199-208:**
```typescript
const { data: employees } = await supabase
  .from("employee_profiles")
  .select(`
    user_id,
    skills,
    department,        // ADD
    designation,       // ADD
    availability,
    current_workload,
    performance_score,
    hourly_rate,
    on_time_rate,
    quality_score,
    profiles!employee_profiles_user_id_fkey(full_name, email)
  `)
  .eq("availability", true);
```

**Update Response (Line 220-230):**
```typescript
return `${idx + 1}. **${profile?.full_name || "Unknown"}**
   - ${emp.designation || "Employee"} • ${emp.department || "General"}  // ADD
   - Matched Skills: ${skillMatches.join(", ")}
   - Workload: ${emp.current_workload || 0} active tasks
   - Performance: ${Math.round(emp.quality_score || 0)}% quality
   - Match Score: ${Math.round(emp.matchScore)}%  // Now 0-100
   ${estimatedCost !== "N/A" ? `- Estimated Cost: $${estimatedCost}` : ""}`;
```

### Priority 3: Add Task Update Endpoints (MEDIUM)

**New Action Handler:**
```typescript
if (action === "update_task_progress" && actionData) {
  const { taskId, progress, hoursLogged, updateText } = actionData;
  
  // Update task
  await supabase
    .from("tasks")
    .update({ 
      progress, 
      status: progress === 100 ? "completed" : "ongoing" 
    })
    .eq("id", taskId);

  // Add task update
  if (updateText || hoursLogged) {
    await supabase.from("task_updates").insert({
      task_id: taskId,
      user_id: userId,
      update_text: updateText || `Progress updated to ${progress}%`,
      progress,
      hours_logged: hoursLogged || null,
    });
  }

  const responseText = `✅ Task progress updated to ${progress}%`;
  await supabase.from("chat_messages").insert({
    user_id: userId,
    message: responseText,
    is_ai: true,
    task_id: taskId,
  });

  return new Response(JSON.stringify({ 
    response: responseText, 
    taskUpdated: true 
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

### Priority 4: Add Accept/Reject Task Endpoints (MEDIUM)

**New Action Handlers:**
```typescript
if (action === "accept_task" && actionData) {
  const { taskId } = actionData;
  
  await supabase
    .from("tasks")
    .update({ status: "accepted" })
    .eq("id", taskId)
    .eq("assigned_to", userId); // Security check

  const responseText = `✅ You've accepted the task!`;
  await supabase.from("chat_messages").insert({
    user_id: userId,
    message: responseText,
    is_ai: true,
    task_id: taskId,
  });

  return new Response(JSON.stringify({ 
    response: responseText, 
    taskAccepted: true 
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

if (action === "reject_task" && actionData) {
  const { taskId, reason } = actionData;
  
  await supabase
    .from("tasks")
    .update({ status: "rejected" })
    .eq("id", taskId)
    .eq("assigned_to", userId);

  const responseText = `Task rejected${reason ? `: ${reason}` : ""}`;
  await supabase.from("chat_messages").insert({
    user_id: userId,
    message: responseText,
    is_ai: true,
    task_id: taskId,
  });

  return new Response(JSON.stringify({ 
    response: responseText, 
    taskRejected: true 
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

### Priority 5: Add Task Status Query (LOW)

**New Action Handler:**
```typescript
if (action === "get_task_status" && actionData) {
  const { taskId } = actionData;
  
  const { data: task } = await supabase
    .from("tasks")
    .select(`
      *,
      profiles:assigned_to(full_name),
      task_updates(*)
    `)
    .eq("id", taskId)
    .single();

  if (task) {
    const updates = task.task_updates || [];
    const totalHours = updates.reduce((sum: number, u: any) => 
      sum + (u.hours_logged || 0), 0);

    const responseText = `📊 **Task Status:**
- Title: ${task.title}
- Status: ${task.status}
- Progress: ${task.progress}%
- Assigned to: ${task.profiles?.full_name || "Unassigned"}
- Total Hours: ${totalHours}h
- Updates: ${updates.length}`;

    return new Response(JSON.stringify({ 
      response: responseText, 
      taskData: task 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
```

### Priority 6: Enhanced Payment Calculation (LOW)

**Update create_task action:**
```typescript
if (action === "create_task" && actionData) {
  // Calculate AI-estimated payment
  const complexity = actionData.priority === "high" ? 1.5 : 
                    actionData.priority === "medium" ? 1.2 : 1.0;
  
  const estimatedPay = actionData.estimatedHours && actionData.hourlyRate
    ? actionData.estimatedHours * actionData.hourlyRate * complexity
    : null;

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title: actionData.title,
      description: actionData.description,
      created_by: userId,
      assigned_to: actionData.assignedTo,
      status: actionData.assignedTo ? "invited" : "pending",
      priority: actionData.priority || "medium",
      required_skills: actionData.skills || [],
      deadline: actionData.deadline,
      estimated_hours: actionData.estimatedHours,
      started_at: new Date().toISOString(),  // ADD
    })
    .select()
    .single();

  // Create payment record if assigned
  if (task && estimatedPay) {
    await supabase.from("payments").insert({
      task_id: task.id,
      employee_id: actionData.assignedTo,
      ai_estimated_pay: estimatedPay,
      status: "pending",
    });
  }

  // ... rest of the code
}
```

---

## 📊 Alignment Summary

| Feature | Frontend | Edge Function | Status |
|---------|----------|---------------|--------|
| Skill Matching | ✅ 40% weight | ⚠️ 50% weight | Misaligned |
| Workload Scoring | ✅ 30% weight | ✅ 30% weight | Aligned |
| Performance | ✅ 20% weight | ✅ 20% weight | Aligned |
| Availability | ✅ 10% weight | ❌ Missing | Missing |
| Department | ✅ Displayed | ❌ Not fetched | Missing |
| Designation | ✅ Displayed | ❌ Not fetched | Missing |
| Task Creation | ✅ Works | ✅ Works | Aligned |
| Task Updates | ✅ Frontend UI | ❌ No endpoint | Missing |
| Accept/Reject | ✅ Frontend UI | ❌ No endpoint | Missing |
| Hours Logging | ✅ Frontend UI | ❌ No endpoint | Missing |
| Payment Calc | ❌ Basic | ❌ Basic | Both need work |

---

## 🎯 Recommended Action Plan

### Phase 1: Critical Alignment (Do First)
1. ✅ Fix scoring algorithm weights
2. ✅ Add department & designation to employee query
3. ✅ Update employee recommendation display

**Estimated Time:** 30 minutes

### Phase 2: Task Management Endpoints (Do Second)
4. ✅ Add update_task_progress action
5. ✅ Add accept_task action
6. ✅ Add reject_task action
7. ✅ Add get_task_status action

**Estimated Time:** 1 hour

### Phase 3: Enhanced Features (Do Later)
8. ⏳ Improve payment calculations
9. ⏳ Add real-time webhooks
10. ⏳ Add notification system

**Estimated Time:** 2-3 hours

---

## 🚀 Benefits After Enhancement

1. **Consistent User Experience**
   - Same scoring algorithm everywhere
   - Same data displayed in chat and UI

2. **Full Chat Integration**
   - Users can update tasks via chat
   - Accept/reject tasks conversationally
   - Check task status naturally

3. **Better Recommendations**
   - More accurate scoring
   - Department/designation context
   - Availability consideration

4. **Complete Workflow**
   - Create → Assign → Accept → Update → Complete
   - All actions available via AI chat

---

## 📝 Next Steps

**Option A: Quick Fix (30 min)**
- Just align the scoring algorithm
- Add department/designation fields
- Deploy and test

**Option B: Full Enhancement (2 hours)**
- Implement all Priority 1-4 changes
- Add all task management endpoints
- Full feature parity with frontend

**Recommendation:** Start with **Option A** to fix critical misalignment, then do **Option B** when you have more time.

---

**Would you like me to implement these enhancements?**
