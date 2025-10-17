-- Add department and designation to employee_profiles
ALTER TABLE public.employee_profiles
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS designation TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employee_profiles_department ON public.employee_profiles(department);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_designation ON public.employee_profiles(designation);

-- Add started_at column to tasks if not exists
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

-- Update types to include common departments
COMMENT ON COLUMN public.employee_profiles.department IS 'Department like Development, Design, Marketing, HR, etc.';
COMMENT ON COLUMN public.employee_profiles.designation IS 'Job title like Senior Developer, UI Designer, HR Manager, etc.';
