# Zustand State Management Architecture

## Overview
This document outlines the Zustand state management implementation for the Aiminder Flow application, replacing prop drilling and optimizing component re-renders.

## Store Architecture

### 1. Authentication Store (`authStore.ts`)
**Purpose**: Manage user authentication state and roles
**Persistence**: Local storage with partial persistence
**State Structure**:
```typescript
{
  user: User | null;
  userRole: string | null;
  loading: boolean;
}
```

**Key Actions**:
- `setUser()`: Set authenticated user
- `setUserRole()`: Set user role (admin/employee)
- `logout()`: Clear authentication state
- `checkAuth()`: Verify authentication status

**Optimized Selectors**:
- `useUser()`: Get current user
- `useUserRole()`: Get user role
- `useAuthLoading()`: Get loading state
- `useAuthActions()`: Get all auth actions

---

### 2. Notification Store (`notificationStore.ts`)
**Purpose**: Manage real-time notifications and unread counts
**State Structure**:
```typescript
{
  notifications: Notification[];
  unreadCount: number;
}
```

**Key Actions**:
- `addNotification()`: Add new notification
- `markAsRead()`: Mark notification as read
- `markAllAsRead()`: Mark all notifications as read
- `subscribeToRealtimeUpdates()`: Subscribe to Supabase real-time updates

**Real-time Events**:
- Task assignments and updates
- Payment status changes

**Optimized Selectors**:
- `useNotifications()`: Get notifications array
- `useUnreadCount()`: Get unread count
- `useNotificationActions()`: Get all notification actions

---

### 3. UI Store (`uiStore.ts`)
**Purpose**: Manage UI preferences and component states
**Persistence**: Local storage with partial persistence
**State Structure**:
```typescript
{
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  activeView: string;
  searchQuery: string;
  refreshTrigger: number;
  statusFilter: string;
  priorityFilter: string;
  sortBy: string;
}
```

**Key Actions**:
- `setTheme()`: Set color theme
- `toggleSidebar()`: Toggle sidebar visibility
- `setSearchQuery()`: Set search filter
- `setStatusFilter()`: Set task status filter
- `setPriorityFilter()`: Set priority filter
- `setSortBy()`: Set sorting criteria

**Computed Values**:
- `isDarkMode()`: Determine if dark mode is active

**Optimized Selectors**:
- `useTheme()`: Get current theme
- `useSidebarState()`: Get sidebar state
- `useActiveView()`: Get active view
- `useSearchQuery()`: Get search query
- `useFilters()`: Get all filter states
- `useUIActions()`: Get all UI actions

---

### 4. Task Store (`taskStore.ts`)
**Purpose**: Manage task data and operations
**State Structure**:
```typescript
{
  tasks: Task[];
  selectedTask: Task | null;
  loading: boolean;
  error: string | null;
}
```

**Key Actions**:
- `loadTasks()`: Load tasks from Supabase
- `setSelectedTask()`: Set currently selected task
- `acceptTask()`: Accept a task invitation
- `rejectTask()`: Reject a task invitation
- `updateTaskProgress()`: Update task progress
- `subscribeToTaskUpdates()`: Subscribe to real-time task updates

**Computed Values**:
- `getFilteredTasks()`: Filter and sort tasks based on UI state

**Optimized Selectors**:
- `useTasks()`: Get tasks array
- `useSelectedTask()`: Get selected task
- `useTaskLoading()`: Get loading state
- `useTaskError()`: Get error state
- `useTaskActions()`: Get all task actions

---

### 5. Payment Store (`paymentStore.ts`)
**Purpose**: Manage payment data and approval workflows
**State Structure**:
```typescript
{
  payments: Payment[];
  selectedPayment: Payment | null;
  loading: { [key: string]: boolean };
  searchQuery: string;
  statusFilter: string;
  activeTab: string;
  showApprovalDialog: boolean;
  approvalAction: "approve" | "reject" | null;
  showAmountEdit: string | null;
}
```

**Key Actions**:
- `loadPayments()`: Load payments from Supabase
- `approvePayment()`: Approve a payment
- `markAsPaid()`: Mark payment as paid
- `updateManualAmount()`: Update manual payment amount
- `subscribeToPaymentUpdates()`: Subscribe to real-time payment updates

**Computed Values**:
- `getFilteredPayments()`: Filter payments based on UI state
- `getPaymentStats()`: Calculate payment statistics
- `calculateDifference()`: Calculate AI vs manual amount difference

**Optimized Selectors**:
- `usePayments()`: Get payments array
- `useSelectedPayment()`: Get selected payment
- `usePaymentLoading()`: Get loading states
- `usePaymentSearchQuery()`: Get search query
- `usePaymentActions()`: Get all payment actions

---

## Performance Optimizations

### 1. Shallow Comparison
All selectors use Zustand's shallow comparison to prevent unnecessary re-renders:
```typescript
// Only re-renders when specific state changes
const tasks = useTaskStore(state => state.tasks);
```

### 2. Action Grouping
Related actions are grouped together to minimize store access:
```typescript
const { loadTasks, acceptTask, rejectTask } = useTaskActions();
```

### 3. Computed Values
Expensive computations are memoized within stores:
```typescript
getFilteredTasks: (filters) => {
  // Filtering and sorting logic
  return computedResult;
}
```

### 4. Real-time Subscriptions
Stores handle real-time updates internally, reducing component complexity.

---

## Component Integration

### Refactored Components:
1. **Dashboard** - Uses auth and UI stores
2. **AdminDashboard** - Uses task and payment stores  
3. **EmployeeDashboard** - Uses task and notification stores
4. **PaymentManagement** - Uses payment store
5. **TaskList** - Uses task and UI stores

### Before vs After:
**Before (Prop Drilling)**:
```typescript
<Dashboard 
  user={user} 
  userRole={userRole} 
  tasks={tasks} 
  onTaskUpdate={handleTaskUpdate}
  // ... many more props
/>
```

**After (Zustand)**:
```typescript
<Dashboard />
// Components access stores directly via selectors
const { user, userRole } = useAuthStore();
const tasks = useTasks();
```

---

## Benefits Achieved

1. **Eliminated Prop Drilling**: No more deep prop passing through component hierarchies
2. **Reduced Re-renders**: Optimized selectors prevent unnecessary component updates
3. **Centralized State**: Single source of truth for each domain
4. **Type Safety**: Full TypeScript support with proper interfaces
5. **Persistence**: User preferences persist across sessions
6. **Real-time Updates**: Built-in Supabase real-time integration
7. **Testability**: Stores can be tested independently from components

---

## File Structure
```
src/stores/
├── authStore.ts          # Authentication state
├── notificationStore.ts  # Notifications and alerts
├── uiStore.ts           # UI preferences and filters
├── taskStore.ts         # Task management
└── paymentStore.ts      # Payment processing
```

This architecture provides a scalable, performant foundation for the Aiminder Flow application with optimized state management and excellent developer experience.