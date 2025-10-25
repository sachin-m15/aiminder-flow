-- ============================================================================
-- CORE APPLICATION SCHEMA MIGRATION
-- Consolidates all core application tables and functions (excluding chatbot)
-- This includes user management, tasks, payments, and employee profiles
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'employee');

-- Create task status enum
CREATE TYPE public.task_status AS ENUM ('pending', 'invited', 'accepted', 'ongoing', 'completed', 'rejected');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  contact TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create employee_profiles table for additional employee data
CREATE TABLE IF NOT EXISTS public.employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  skills TEXT[] NOT NULL DEFAULT '{}',
  availability BOOLEAN DEFAULT true,
  current_workload INTEGER DEFAULT 0,
  performance_score DECIMAL(3,2) DEFAULT 0.00,
  tasks_completed INTEGER DEFAULT 0,
  avg_completion_time INTERVAL,
  hourly_rate DECIMAL(10,2) DEFAULT 0,
  on_time_rate DECIMAL(5,2) DEFAULT 0,
  quality_score DECIMAL(5,2) DEFAULT 0,
  department TEXT,
  designation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status task_status DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  required_skills TEXT[] DEFAULT '{}',
  deadline TIMESTAMPTZ,
  progress INTEGER DEFAULT 0,
  estimated_hours DECIMAL(10,2),
  complexity_multiplier DECIMAL(5,2) DEFAULT 1.0,
  started_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create task_updates table
CREATE TABLE IF NOT EXISTS public.task_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  update_text TEXT NOT NULL,
  progress INTEGER,
  hours_logged DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  amount_manual DECIMAL(10,2),
  amount_ai_suggested DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Employee profiles indexes
CREATE INDEX IF NOT EXISTS idx_employee_profiles_department ON public.employee_profiles(department);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_designation ON public.employee_profiles(designation);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_availability ON public.employee_profiles(availability);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_skills ON public.employee_profiles USING GIN(skills);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks(deadline);

-- Task updates indexes
CREATE INDEX IF NOT EXISTS idx_task_updates_task_id ON public.task_updates(task_id);
CREATE INDEX IF NOT EXISTS idx_task_updates_user_id ON public.task_updates(user_id);

-- Invitations indexes
CREATE INDEX IF NOT EXISTS idx_invitations_to_user ON public.invitations(to_user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_from_user ON public.invitations(from_user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_task_id ON public.invitations(task_id);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_task ON public.payments(task_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Enhanced function to handle new user creation
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
    
    -- 3. Create employee profile for non-admin users (skills handled in junction table)
    INSERT INTO public.employee_profiles (
      user_id,
      availability,
      current_workload,
      performance_score,
      tasks_completed
    ) VALUES (
      NEW.id,
      true,  -- Available by default
      0,     -- No workload initially
      0.0,   -- No performance score yet
      0      -- No tasks completed
    );
  END IF;

  RETURN NEW;
END;
$$;


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
  
  -- Create or update employee profile (without skills - handled separately in junction table)
  INSERT INTO public.employee_profiles (
    user_id,
    department,
    designation,
    availability,
    current_workload,
    performance_score,
    tasks_completed
  ) VALUES (
    target_user_id,
    user_department,
    user_designation,
    true,
    0,
    0.0,
    0
  )
  ON CONFLICT (user_id) DO UPDATE SET
    department = user_department,
    designation = user_designation;
  
  RETURN 'Success: User ' || user_email || ' is now an employee';
END;
$$;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function to handle invitation response
CREATE OR REPLACE FUNCTION public.handle_invitation_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    UPDATE public.tasks
    SET status = 'ongoing', started_at = now()
    WHERE id = NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Create trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_enhanced();

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_profiles_updated_at BEFORE UPDATE ON public.employee_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for invitation response
CREATE TRIGGER on_invitation_response
  AFTER UPDATE ON public.invitations
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_invitation_response();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for employee_profiles
CREATE POLICY "Admins and staff can view all employee profiles" ON public.employee_profiles FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Employees can view own profile" ON public.employee_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Employees can update own profile" ON public.employee_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage employee profiles" ON public.employee_profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for tasks
CREATE POLICY "Admins and staff can view all tasks" ON public.tasks FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Employees can view assigned tasks" ON public.tasks FOR SELECT TO authenticated 
  USING (auth.uid() = assigned_to OR auth.uid() = created_by);
CREATE POLICY "Admins and staff can create tasks" ON public.tasks FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Admins and staff can update tasks" ON public.tasks FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Employees can update assigned tasks" ON public.tasks FOR UPDATE TO authenticated 
  USING (auth.uid() = assigned_to);

-- RLS Policies for task_updates
CREATE POLICY "Users can view task updates for accessible tasks" ON public.task_updates FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE id = task_id AND (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'staff') OR 
        auth.uid() = assigned_to OR 
        auth.uid() = created_by
      )
    )
  );
CREATE POLICY "Users can create task updates" ON public.task_updates FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for invitations
CREATE POLICY "Users can view their own invitations"
  ON public.invitations FOR SELECT
  USING (auth.uid() = to_user_id OR auth.uid() = from_user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins and staff can create invitations"
  ON public.invitations FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Invited users can update invitation status"
  ON public.invitations FOR UPDATE
  USING (auth.uid() = to_user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- RLS Policies for payments
CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins can manage payments"
  ON public.payments FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- ============================================================================
-- REALTIME CONFIGURATION
-- ============================================================================

-- Enable realtime for invitations and payments
ALTER PUBLICATION supabase_realtime ADD TABLE public.invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TYPE public.app_role IS 'Application roles: admin, staff, employee';
COMMENT ON TYPE public.task_status IS 'Task status flow: pending -> invited -> accepted -> ongoing -> completed or rejected';

COMMENT ON TABLE public.profiles IS 'Basic user profile information linked to auth.users';
COMMENT ON TABLE public.user_roles IS 'Role assignments for users, supporting multiple roles per user';
COMMENT ON TABLE public.employee_profiles IS 'Extended employee information including skills, performance metrics, and workload';
COMMENT ON TABLE public.tasks IS 'Core task management with assignment, status tracking, and progress monitoring';
COMMENT ON TABLE public.task_updates IS 'Progress updates and work logs for tasks';
COMMENT ON TABLE public.invitations IS 'Task invitation system for employee assignment workflow';
COMMENT ON TABLE public.payments IS 'Payment tracking with manual vs AI-suggested amounts';

COMMENT ON FUNCTION public.has_role IS 'Security helper to check if a user has a specific role';
COMMENT ON FUNCTION public.make_user_admin IS 'Utility function to promote any user to admin role';
COMMENT ON FUNCTION public.make_user_employee IS 'Utility function to assign employee role with optional profile data';

-- ============================================================================
-- MIGRATION COMPLETION
-- ============================================================================

-- Log the completion of core schema migration
DO $$
BEGIN
  RAISE NOTICE 'Core application schema migration completed successfully!';
  RAISE NOTICE 'Created: profiles, user_roles, employee_profiles, tasks, task_updates, invitations, payments';
  RAISE NOTICE 'Added: indexes, functions, triggers, RLS policies, and realtime configuration';
  RAISE NOTICE 'Core application features are now consolidated and organized';
END $$;