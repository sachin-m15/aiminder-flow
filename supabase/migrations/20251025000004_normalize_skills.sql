-- ============================================================================
-- SKILLS NORMALIZATION MIGRATION
-- ============================================================================
-- Normalizes skills data by creating junction tables and migrating from array columns
-- This improves data integrity, query performance, and enables better skill management
-- ============================================================================

-- ============================================================================
-- CREATE JUNCTION TABLES
-- ============================================================================

-- Employee skills junction table
CREATE TABLE IF NOT EXISTS public.employee_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee_profiles(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, skill)
);

-- Task required skills junction table
CREATE TABLE IF NOT EXISTS public.task_required_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, skill)
);

-- ============================================================================
-- MIGRATE EXISTING DATA
-- ============================================================================

-- Migrate employee skills from array to junction table
INSERT INTO public.employee_skills (employee_id, skill)
SELECT 
  ep.id as employee_id,
  UNNEST(ep.skills) as skill
FROM public.employee_profiles ep
WHERE ep.skills IS NOT NULL AND array_length(ep.skills, 1) > 0;

-- Migrate task required skills from array to junction table
INSERT INTO public.task_required_skills (task_id, skill)
SELECT 
  t.id as task_id,
  UNNEST(t.required_skills) as skill
FROM public.tasks t
WHERE t.required_skills IS NOT NULL AND array_length(t.required_skills, 1) > 0;

-- ============================================================================
-- UPDATE FUNCTIONS FOR BACKWARD COMPATIBILITY
-- ============================================================================

-- Function to get employee skills as array (for backward compatibility)
CREATE OR REPLACE FUNCTION public.get_employee_skills(_employee_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(skill ORDER BY skill) 
  FROM public.employee_skills 
  WHERE employee_id = _employee_id;
$$;

-- Function to get task required skills as array (for backward compatibility)
CREATE OR REPLACE FUNCTION public.get_task_required_skills(_task_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(skill ORDER BY skill) 
  FROM public.task_required_skills 
  WHERE task_id = _task_id;
$$;

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for employee_skills
CREATE INDEX IF NOT EXISTS idx_employee_skills_employee_id ON public.employee_skills(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_skills_skill ON public.employee_skills(skill);
CREATE INDEX IF NOT EXISTS idx_employee_skills_employee_skill ON public.employee_skills(employee_id, skill);

-- Indexes for task_required_skills
CREATE INDEX IF NOT EXISTS idx_task_required_skills_task_id ON public.task_required_skills(task_id);
CREATE INDEX IF NOT EXISTS idx_task_required_skills_skill ON public.task_required_skills(skill);
CREATE INDEX IF NOT EXISTS idx_task_required_skills_task_skill ON public.task_required_skills(task_id, skill);

-- ============================================================================
-- UPDATE EXISTING FUNCTIONS TO USE NEW STRUCTURE
-- ============================================================================

-- Update make_user_employee function to use new skills structure
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
  emp_profile_id UUID;
  skill_item TEXT;
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

  -- Get employee profile ID
  SELECT id INTO emp_profile_id
  FROM public.employee_profiles
  WHERE user_id = target_user_id;

  -- Create or update employee profile (without skills)
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
    designation = user_designation
  RETURNING id INTO emp_profile_id;

  -- Clear existing skills and insert new ones
  DELETE FROM public.employee_skills WHERE employee_id = emp_profile_id;
  
  FOREACH skill_item IN ARRAY user_skills
  LOOP
    INSERT INTO public.employee_skills (employee_id, skill)
    VALUES (emp_profile_id, skill_item)
    ON CONFLICT (employee_id, skill) DO NOTHING;
  END LOOP;

  RETURN 'Success: User ' || user_email || ' is now an employee';
END;
$$;


-- ============================================================================
-- REMOVE ARRAY COLUMNS (AFVER DATA MIGRATION)
-- ============================================================================

-- Remove skills array column from employee_profiles
ALTER TABLE public.employee_profiles DROP COLUMN IF EXISTS skills;

-- Remove required_skills array column from tasks
ALTER TABLE public.tasks DROP COLUMN IF EXISTS required_skills;


-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

-- Create triggers for updated_at on new tables
CREATE TRIGGER update_employee_skills_updated_at BEFORE UPDATE ON public.employee_skills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_required_skills_updated_at BEFORE UPDATE ON public.task_required_skills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETION
-- ============================================================================

-- Log the completion of skills normalization migration
DO $$
BEGIN
  RAISE NOTICE 'Skills normalization migration completed successfully!';
  RAISE NOTICE 'Created: employee_skills and task_required_skills junction tables';
  RAISE NOTICE 'Migrated: % employee skills records', (SELECT COUNT(*) FROM public.employee_skills);
  RAISE NOTICE 'Migrated: % task required skills records', (SELECT COUNT(*) FROM public.task_required_skills);
  RAISE NOTICE 'Removed: skills array columns from employee_profiles and tasks';
  RAISE NOTICE 'Added: indexes and functions for new tables';
END $$;