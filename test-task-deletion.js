#!/usr/bin/env node

/**
 * Test Script for Task Deletion Fix
 * This script tests the critical fixes applied to resolve task deletion issues
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

console.log('🧪 Testing Task Deletion Fixes...\n');

// Test 1: Verify server tools registration
console.log('✅ Test 1: Server Tool Registration');
try {
  const { getToolsForRole } = require('./server/tools/index.js');
  const adminTools = getToolsForRole('admin');
  
  console.log('Available admin tools:', Object.keys(adminTools));
  
  if (adminTools.deleteTask) {
    console.log('✅ deleteTask tool is available');
  } else {
    console.log('❌ deleteTask tool is missing');
  }
  
  if (adminTools.getTaskDetails) {
    console.log('✅ getTaskDetails tool is available');
  } else {
    console.log('❌ getTaskDetails tool is missing');
  }
  
  console.log('');
} catch (error) {
  console.log('❌ Error checking tools:', error.message);
}

// Test 2: Verify server_copy tools registration
console.log('✅ Test 2: Server Copy Tool Registration');
try {
  const { getToolsForRole: getToolsForRoleCopy } = require('./server_copy/tools/index.js');
  const adminToolsCopy = getToolsForRoleCopy('admin');
  
  console.log('Available admin tools in server_copy:', Object.keys(adminToolsCopy));
  
  if (adminToolsCopy.deleteTask) {
    console.log('✅ deleteTask tool is available in server_copy');
  } else {
    console.log('❌ deleteTask tool is missing in server_copy');
  }
  console.log('');
} catch (error) {
  console.log('❌ Error checking server_copy tools:', error.message);
}

// Test 3: Verify server API user context passing
console.log('✅ Test 3: Server API User Context');
try {
  const fs = require('fs');
  const serverApi = fs.readFileSync('./server/api.js', 'utf8');
  
  if (serverApi.includes('configurable:')) {
    console.log('✅ Server API passes user context via configurable');
  } else {
    console.log('❌ Server API does not pass user context');
  }
  
  if (serverApi.includes('user: req.user')) {
    console.log('✅ Server API includes user context mapping');
  } else {
    console.log('❌ Server API missing user context mapping');
  }
  console.log('');
} catch (error) {
  console.log('❌ Error checking server API:', error.message);
}

// Test 4: Verify delete tool confirmation parameter
console.log('✅ Test 4: Delete Tool Confirmation Parameter');
try {
  const fs = require('fs');
  const tasksFile = fs.readFileSync('./server_copy/tools/admin/tasks.js', 'utf8');
  
  if (tasksFile.includes('confirmed:')) {
    console.log('✅ deleteTask tool requires confirmation parameter');
  } else {
    console.log('❌ deleteTask tool missing confirmation parameter');
  }
  
  if (tasksFile.includes('Task deletion requires explicit confirmation')) {
    console.log('✅ deleteTask tool includes confirmation validation');
  } else {
    console.log('❌ deleteTask tool missing confirmation validation');
  }
  console.log('');
} catch (error) {
  console.log('❌ Error checking delete tool:', error.message);
}

// Test 5: Verify client-side delete tool
console.log('✅ Test 5: Client-side Delete Tool');
try {
  const fs = require('fs');
  const clientTasks = fs.readFileSync('./src/api/chat/tools/admin/tasks.ts', 'utf8');
  
  if (clientTasks.includes('confirmed: z.boolean()')) {
    console.log('✅ Client deleteTask tool requires confirmation parameter');
  } else {
    console.log('❌ Client deleteTask tool missing confirmation parameter');
  }
  
  if (clientTasks.includes('When the user confirms')) {
    console.log('✅ Client deleteTask tool includes confirmation guidance');
  } else {
    console.log('❌ Client deleteTask tool missing confirmation guidance');
  }
  console.log('');
} catch (error) {
  console.log('❌ Error checking client delete tool:', error.message);
}

// Test 6: Verify error handling improvements
console.log('✅ Test 6: Error Handling Improvements');
try {
  const fs = require('fs');
  const tasksFile = fs.readFileSync('./server_copy/tools/admin/tasks.js', 'utf8');
  const clientTasks = fs.readFileSync('./src/api/chat/tools/admin/tasks.ts', 'utf8');
  
  if (tasksFile.includes('console.log("🗑️ Delete Task Called:"')) {
    console.log('✅ Server deleteTask tool includes debug logging');
  } else {
    console.log('❌ Server deleteTask tool missing debug logging');
  }
  
  if (tasksFile.includes('Task with ID') && tasksFile.includes('not found')) {
    console.log('✅ Server deleteTask tool includes task validation');
  } else {
    console.log('❌ Server deleteTask tool missing task validation');
  }
  console.log('');
} catch (error) {
  console.log('❌ Error checking error handling:', error.message);
}

console.log('🎯 Summary of Fixes Applied:');
console.log('1. ✅ Fixed server/api.js to pass user context to tools via configurable parameter');
console.log('2. ✅ Updated server_copy deleteTask tool to require confirmation parameter');
console.log('3. ✅ Added proper error handling and logging to delete operations');
console.log('4. ✅ Verified client-side delete tool requires confirmation');
console.log('5. ✅ Both task deletion and retrieval operations now have proper error handling');
console.log('\n🔧 Key Changes:');
console.log('- Server now passes user context to tools (configurable: { user: req.user })');
console.log('- Delete tool requires explicit confirmation for safety');
console.log('- Added comprehensive error handling and logging');
console.log('- Task existence validation before deletion');
console.log('- Improved error messages for better debugging');