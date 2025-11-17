# AI Agent Task Deletion Problem - Debug Analysis

## Problem Summary
Users are experiencing issues when trying to delete tasks using the AI Agent. After investigating the codebase, I've identified several critical issues.

## Root Causes Identified

### 1. **Missing Task Deletion Tool in Main Server** 
- **File**: `server/api.js` (lines 148-157)
- **Issue**: The main server only includes the `listTasks` tool instead of all available tools from `getToolsForRole(role)`
- **Current Code**: 
  ```javascript
  // Create agent with proper tools
  const agent = createAgent({
    model: googleAI,
    tools: [listTasks], // ❌ Only includes listTasks tool
    systemPrompt: systemPrompts[role] || systemPrompts.employee,
    maxSteps: 5,
  });
  ```

### 2. **Missing Task Parameters in Delete Tool**
- **File**: `server_copy/tools/admin/tasks.js` (lines 638-707)
- **Issue**: The `deleteTask` tool only accepts `taskId` but doesn't require user confirmation
- **Current Schema**: 
  ```javascript
  export const deleteTask = tool(
    async ({ taskId }) => { /* ... */ },
    {
      name: "delete_task",
      schema: z.object({
        taskId: z.string().uuid().describe("The unique ID of the task to delete"),
      }),
    }
  );
  ```

### 3. **Configuration Mismatch**
- **Issue**: The `server/api.js` and `server_copy/api.js` have different configurations
- **Impact**: AI Agent may be using the wrong server endpoint or wrong tool registry

### 4. **Missing User Context in Server Tools**
- **File**: `server/api.js` (line 108)
- **Issue**: The `getAgent` function doesn't pass user context to tools like the working `server_copy/api.js` does

## Most Likely Issues (Ranked by Probability)

1. **Primary Issue**: Missing `deleteTask` tool in main server - The AI Agent simply doesn't have access to the delete functionality
2. **Secondary Issue**: Missing user context passing - Even if delete tool existed, it might fail authentication
3. **Tertiary Issue**: Incorrect tool schema - Missing confirmation parameter makes deletion unsafe

## Diagnostic Logging Added
The following debug logging has been prepared but needs to be applied:

```javascript
// Log available tools for debugging
console.log(`🤖 Available tools for ${role}:`, toolsArray.map(t => t.name || t));

// Add detailed logging in delete tool
console.log("🗑️ Delete Task Called:", { taskId, userId: req.user.id, role });
```

## Recommended Solutions

### Solution 1: Fix Main Server Tool Registration (CRITICAL)
Update `server/api.js` to include all tools from `getToolsForRole(role)`:

```javascript
// Get tools for the role and convert to array format
const toolsObject = getToolsForRole(role);
const toolsArray = Object.values(toolsObject);

// Log available tools for debugging
console.log(`🤖 Available tools for ${role}:`, toolsArray.map(t => t.name || t));

// Create agent with proper tools
const agent = createAgent({
  model: googleAI,
  tools: toolsArray, // ✅ Include all tools, not just listTasks
  systemPrompt: systemPrompts[role] || systemPrompts.employee,
  maxSteps: 5,
});
```

### Solution 2: Add User Context to Main Server (HIGH)
Update `getAgent` function to pass user context:

```javascript
function getAgent(role, userId = null) {
  // ... existing code ...
  
  // Create agent with proper tools
  const agent = createAgent({
    model: googleAI,
    tools: toolsArray,
    systemPrompt: finalSystemPrompt,
    maxSteps: 5,
  });
  
  // Store userId for later use
  agents.set(agentKey, { agent, userId });
  
  // ... rest of function
}
```

### Solution 3: Enhance Delete Tool Safety (MEDIUM)
Add confirmation parameter to delete tool in `server_copy/tools/admin/tasks.js`:

```javascript
export const deleteTask = tool(
  async ({ taskId, confirmed }) => {
    if (!confirmed) {
      throw new Error("Task deletion requires explicit confirmation");
    }
    // ... existing delete logic
  },
  {
    name: "delete_task",
    schema: z.object({
      taskId: z.string().uuid().describe("The unique ID of the task to delete"),
      confirmed: z.boolean().describe("Must be true to confirm deletion"),
    }),
  }
);
```

## Impact Assessment
- **Severity**: HIGH - Users cannot delete tasks through AI Agent
- **Affected Users**: All admin users trying to delete tasks
- **Business Impact**: Administrative tasks are blocked, reducing system usability

## Next Steps
1. Apply Solution 1 to restore task deletion functionality
2. Add diagnostic logging to track tool calls
3. Test task deletion flow end-to-end
4. Consider implementing Solution 3 for better safety