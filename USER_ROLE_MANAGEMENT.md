# User Role Management Guide

## Problem
When users sign up through the application, they only get a `profiles` entry. No `user_roles` or `employee_profiles` entries are created, causing issues with authentication and access control.

## Solution
I've created an enhanced migration that fixes this issue and provides helper functions for role management.

---

## 🔧 How to Apply the Fix

### Step 1: Apply the New Migration

```bash
cd e:\Projects\intern\Clone-Futura\aiminder-flow
supabase db push
```

Or manually run the migration file:
- Open Supabase Dashboard > SQL Editor
- Copy and paste the contents of `supabase/migrations/20251017000002_enhanced_user_creation.sql`
- Click "Run"

### Step 2: Test with a New Signup

After applying the migration, new users will automatically:
- ✅ Get a `profiles` entry
- ✅ Get a `user_roles` entry (default: employee)
- ✅ Get an `employee_profiles` entry (for employees)

---

## 👤 Making Users Admins

### Method 1: During User Creation (Recommended for First Admin)

**In Supabase Dashboard:**
1. Go to Authentication > Users
2. Click "Add User"
3. Enter:
   - Email: `admin@gmail.com` (or any email with @admin. domain)
   - Password: Your chosen password
4. Click "Create User"
5. The user will automatically be assigned admin role

### Method 2: Using SQL Function (Recommended for Existing Users)

**In Supabase Dashboard > SQL Editor:**

```sql
-- Make a user an admin
SELECT make_user_admin('user@example.com');
```

This will:
- Remove employee role
- Add admin role
- Delete employee profile (admins don't need this)

### Method 3: Manual SQL Insert

```sql
-- Find the user's ID
SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- Insert admin role
INSERT INTO public.user_roles (user_id, role)
VALUES ('user-id-here', 'admin');

-- Remove employee role if exists
DELETE FROM public.user_roles
WHERE user_id = 'user-id-here' AND role = 'employee';
```

---

## 🔄 Converting Between Roles

### Make User an Admin

```sql
SELECT make_user_admin('user@example.com');
-- Returns: "Success: User user@example.com is now an admin"
```

### Make User an Employee

```sql
-- Basic (no profile data)
SELECT make_user_employee('user@example.com');

-- With full profile
SELECT make_user_employee(
  'user@example.com',
  ARRAY['React', 'TypeScript', 'Node.js'],  -- Skills
  'Engineering',                             -- Department
  'Senior Developer'                         -- Designation
);
-- Returns: "Success: User user@example.com is now an employee"
```

---

## 🧪 Testing the Setup

### 1. Check Current User Roles

```sql
SELECT 
  u.email,
  u.id,
  ur.role,
  p.full_name
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC;
```

### 2. Check Employee Profiles

```sql
SELECT 
  p.email,
  p.full_name,
  ep.department,
  ep.designation,
  ep.skills,
  ep.current_workload
FROM public.employee_profiles ep
JOIN public.profiles p ON ep.user_id = p.id
ORDER BY p.full_name;
```

### 3. Verify Admin Access

```sql
SELECT 
  u.email,
  ur.role
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin';
```

---

## 📋 Current System Behavior

### New Signup (After Migration)

When a user signs up through the app:

1. **Email is `admin@gmail.com` or contains `@admin.`**
   - ✅ Creates `profiles` entry
   - ✅ Assigns `admin` role
   - ❌ No `employee_profiles` entry (admins don't need this)

2. **Any other email**
   - ✅ Creates `profiles` entry
   - ✅ Assigns `employee` role
   - ✅ Creates `employee_profiles` entry with defaults:
     - Skills: [] (empty)
     - Availability: true
     - Current Workload: 0
     - Performance Score: 0
     - Tasks Completed: 0

### Admin Users Can Then:
- Add more details to employee profiles through the UI
- View the admin dashboard
- Assign tasks
- Manage employees

### Employee Users Can:
- View employee dashboard
- Receive task assignments
- Update their own profile

---

## 🔐 Setting Up Your First Admin

### Option A: Create Fresh Admin (Recommended)

1. **Delete existing user if needed:**
   ```sql
   -- In Supabase Dashboard > Authentication > Users
   -- Find and delete the user manually, OR:
   DELETE FROM auth.users WHERE email = 'admin@gmail.com';
   ```

2. **Create new admin user:**
   - In Supabase Dashboard > Authentication > Users
   - Click "Add User"
   - Email: `admin@gmail.com`
   - Password: `123456` (or your preferred password)
   - Auto Confirm User: ✅ (check this box)
   - Click "Create User"

3. **Verify admin role:**
   ```sql
   SELECT email, role FROM auth.users u
   JOIN user_roles ur ON u.id = ur.user_id
   WHERE email = 'admin@gmail.com';
   ```

### Option B: Convert Existing User to Admin

If you already have a user account:

```sql
SELECT make_user_admin('your-existing-email@example.com');
```

---

## 🛠️ Troubleshooting

### Issue: User can't access admin dashboard

**Solution:**
```sql
-- Check their role
SELECT u.email, ur.role
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'user@example.com';

-- If no role or wrong role, fix it:
SELECT make_user_admin('user@example.com');
```

### Issue: Employee can't see their dashboard

**Solution:**
```sql
-- Check if employee profile exists
SELECT ep.*
FROM employee_profiles ep
JOIN auth.users u ON ep.user_id = u.id
WHERE u.email = 'employee@example.com';

-- If missing, create it:
SELECT make_user_employee(
  'employee@example.com',
  ARRAY['Skill1', 'Skill2'],
  'Department Name',
  'Job Title'
);
```

### Issue: User has both admin and employee roles

**Solution:**
```sql
-- Choose one:

-- Keep as admin
SELECT make_user_admin('user@example.com');

-- OR keep as employee
SELECT make_user_employee('user@example.com');
```

---

## 📊 Quick Reference

### Role Types

| Role | Access Level | Has Employee Profile? |
|------|-------------|----------------------|
| `admin` | Full system access | ❌ No |
| `staff` | Can assist admin | ✅ Yes (optional) |
| `employee` | Limited to own tasks | ✅ Yes (required) |

### Helper Functions

| Function | Purpose | Example |
|----------|---------|---------|
| `make_user_admin(email)` | Convert to admin | `SELECT make_user_admin('user@example.com')` |
| `make_user_employee(email, skills, dept, title)` | Convert to employee | `SELECT make_user_employee('user@example.com', ARRAY['React'], 'Engineering', 'Developer')` |

---

## 🚀 Next Steps

1. **Apply the migration**
   ```bash
   supabase db push
   ```

2. **Create your admin user**
   - Use Supabase Dashboard or
   - Use SQL function on existing user

3. **Test the system**
   - Try signing up a new employee
   - Check they can access employee dashboard
   - Verify admin can see admin dashboard

4. **Update employee profiles**
   - Use the Admin UI to add skills, departments, etc.
   - Or use the `make_user_employee()` function

---

## 💡 Pro Tips

1. **Use email patterns for auto-admin**
   - Any email with `@admin.` domain becomes admin automatically
   - Example: `john@admin.company.com` → Admin
   - Example: `john@company.com` → Employee

2. **Bulk role assignment**
   ```sql
   -- Make multiple users employees
   SELECT make_user_employee('user1@example.com');
   SELECT make_user_employee('user2@example.com');
   SELECT make_user_employee('user3@example.com');
   ```

3. **Check all roles at once**
   ```sql
   SELECT 
     u.email,
     COALESCE(ur.role, 'NO ROLE') as role,
     CASE 
       WHEN ep.user_id IS NOT NULL THEN 'Has Profile'
       ELSE 'No Profile'
     END as employee_profile_status
   FROM auth.users u
   LEFT JOIN user_roles ur ON u.id = ur.user_id
   LEFT JOIN employee_profiles ep ON u.id = ep.user_id
   ORDER BY u.created_at DESC;
   ```

---

**Last Updated:** October 17, 2025  
**Migration Version:** 20251017000002
