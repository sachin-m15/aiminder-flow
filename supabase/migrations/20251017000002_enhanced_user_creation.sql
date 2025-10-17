-- Enhanced user creation function that properly sets up new users
-- This replaces the basic handle_new_user() function

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create enhanced function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user_enhanced()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  is_admin_email BOOLEAN;
BEGIN
  user_email := NEW.email;
  
  -- Check if this is an admin email
  is_admin_email := user_email = 'admin@gmail.com' OR user_email LIKE '%@admin.%';
  
  -- 1. Create profile entry
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  
  -- 2. Assign role based on email
  IF is_admin_email THEN
    -- Assign admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    -- Default to employee role for all other users
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employee');
    
    -- 3. Create employee profile for non-admin users
    INSERT INTO public.employee_profiles (
      user_id,
      skills,
      availability,
      current_workload,
      performance_score,
      tasks_completed
    ) VALUES (
      NEW.id,
      '{}',  -- Empty skills array, to be filled later
      true,  -- Available by default
      0,     -- No workload initially
      0.0,   -- No performance score yet
      0      -- No tasks completed
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create new trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_enhanced();

-- Function to manually make a user an admin
CREATE OR REPLACE FUNCTION public.make_user_admin(user_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Find user by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email
  LIMIT 1;
  
  IF target_user_id IS NULL THEN
    RETURN 'Error: User not found with email ' || user_email;
  END IF;
  
  -- Remove existing employee role if exists
  DELETE FROM public.user_roles
  WHERE user_id = target_user_id AND role = 'employee';
  
  -- Add admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Remove employee profile if exists (admins don't need employee profiles)
  DELETE FROM public.employee_profiles
  WHERE user_id = target_user_id;
  
  RETURN 'Success: User ' || user_email || ' is now an admin';
END;
$$;

-- Function to make a user an employee
CREATE OR REPLACE FUNCTION public.make_user_employee(
  user_email TEXT,
  user_skills TEXT[] DEFAULT '{}',
  user_department TEXT DEFAULT NULL,
  user_designation TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Find user by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email
  LIMIT 1;
  
  IF target_user_id IS NULL THEN
    RETURN 'Error: User not found with email ' || user_email;
  END IF;
  
  -- Remove admin role if exists
  DELETE FROM public.user_roles
  WHERE user_id = target_user_id AND role = 'admin';
  
  -- Add employee role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Create or update employee profile
  INSERT INTO public.employee_profiles (
    user_id,
    skills,
    department,
    designation,
    availability,
    current_workload,
    performance_score,
    tasks_completed
  ) VALUES (
    target_user_id,
    user_skills,
    user_department,
    user_designation,
    true,
    0,
    0.0,
    0
  )
  ON CONFLICT (user_id) DO UPDATE SET
    skills = user_skills,
    department = user_department,
    designation = user_designation;
  
  RETURN 'Success: User ' || user_email || ' is now an employee';
END;
$$;

COMMENT ON FUNCTION public.make_user_admin IS 
  'Convert any user to admin role. Usage: SELECT make_user_admin(''user@example.com'')';

COMMENT ON FUNCTION public.make_user_employee IS 
  'Convert any user to employee role with optional profile data. Usage: SELECT make_user_employee(''user@example.com'', ARRAY[''React'', ''TypeScript''], ''Engineering'', ''Senior Developer'')';
