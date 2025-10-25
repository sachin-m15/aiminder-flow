-- ============================================================================
-- CONSOLIDATED SAMPLE DATA MIGRATION
-- Includes sample users, employees, tasks, and chatbot conversations
-- This replaces the previous seed data migration with organized, modular data
-- ============================================================================

-- NOTE: This is for LOCAL DEVELOPMENT/TESTING purposes only
-- Creates users directly in auth.users table
-- In production, users should be created through the signup flow

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to seed sample data (can be run multiple times safely)
CREATE OR REPLACE FUNCTION public.seed_consolidated_sample_data()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id UUID;
  emp1_id UUID;
  emp2_id UUID;
  emp3_id UUID;
  emp4_id UUID;
  emp5_id UUID;
  task1_id UUID;
  task2_id UUID;
  task3_id UUID;
  task4_id UUID;
  admin_conversation_id UUID;
  emp1_conversation_id UUID;
  hashed_password TEXT;
BEGIN
  -- Generate UUIDs for new users
  admin_id := gen_random_uuid();
  emp1_id := gen_random_uuid();
  emp2_id := gen_random_uuid();
  emp3_id := gen_random_uuid();
  emp4_id := gen_random_uuid();
  emp5_id := gen_random_uuid();
  
  -- Generate unique conversation IDs for each user
  admin_conversation_id := gen_random_uuid();
  emp1_conversation_id := gen_random_uuid();

  -- Hash the password for admin (password: admin123)
  SELECT extensions.crypt('admin123', extensions.gen_salt('bf')) INTO hashed_password;

  -- ============================================================================
  -- CREATE ADMIN USER
  -- ============================================================================
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@aiminder.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      admin_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@aiminder.com',
      hashed_password,
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"full_name": "System Administrator"}',
      NOW(),
      NOW(),
      'authenticated',
      'authenticated'
    );

    -- Create identity for admin
    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      admin_id::text,
      admin_id,
      jsonb_build_object(
        'sub', admin_id::text,
        'email', 'admin@aiminder.com',
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      NOW(),
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Created admin user: admin@aiminder.com (password: admin123)';
  ELSE
    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@aiminder.com';
    RAISE NOTICE 'Admin user already exists';
  END IF;

  -- Hash password for employees (password: employee123)
  SELECT extensions.crypt('employee123', extensions.gen_salt('bf')) INTO hashed_password;

  -- ============================================================================
  -- CREATE EMPLOYEE 1: Sarah Johnson - Senior Full Stack Developer
  -- ============================================================================
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'sarah.johnson@aiminder.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      emp1_id,
      '00000000-0000-0000-0000-000000000000',
      'sarah.johnson@aiminder.com',
      hashed_password,
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"full_name": "Sarah Johnson"}',
      NOW(),
      NOW(),
      'authenticated',
      'authenticated'
    );

    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      emp1_id::text,
      emp1_id,
      jsonb_build_object(
        'sub', emp1_id::text,
        'email', 'sarah.johnson@aiminder.com',
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      NOW(),
      NOW(),
      NOW()
    );
  ELSE
    SELECT id INTO emp1_id FROM auth.users WHERE email = 'sarah.johnson@aiminder.com';
  END IF;

  -- ============================================================================
  -- CREATE EMPLOYEE 2: Mike Chen - UI/UX Designer
  -- ============================================================================
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'mike.chen@aiminder.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      emp2_id,
      '00000000-0000-0000-0000-000000000000',
      'mike.chen@aiminder.com',
      hashed_password,
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"full_name": "Mike Chen"}',
      NOW(),
      NOW(),
      'authenticated',
      'authenticated'
    );

    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      emp2_id::text,
      emp2_id,
      jsonb_build_object(
        'sub', emp2_id::text,
        'email', 'mike.chen@aiminder.com',
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      NOW(),
      NOW(),
      NOW()
    );
  ELSE
    SELECT id INTO emp2_id FROM auth.users WHERE email = 'mike.chen@aiminder.com';
  END IF;

  -- ============================================================================
  -- CREATE EMPLOYEE 3: Emma Davis - Marketing Manager
  -- ============================================================================
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'emma.davis@aiminder.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      emp3_id,
      '00000000-0000-0000-0000-000000000000',
      'emma.davis@aiminder.com',
      hashed_password,
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"full_name": "Emma Davis"}',
      NOW(),
      NOW(),
      'authenticated',
      'authenticated'
    );

    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      emp3_id::text,
      emp3_id,
      jsonb_build_object(
        'sub', emp3_id::text,
        'email', 'emma.davis@aiminder.com',
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      NOW(),
      NOW(),
      NOW()
    );
  ELSE
    SELECT id INTO emp3_id FROM auth.users WHERE email = 'emma.davis@aiminder.com';
  END IF;

  -- ============================================================================
  -- CREATE PROFILES AND ROLES
  -- ============================================================================

  -- Admin profile and role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.profiles (id, full_name, email, contact)
  VALUES (admin_id, 'System Administrator', 'admin@aiminder.com', '+1-555-0100')
  ON CONFLICT (id) DO UPDATE 
  SET full_name = 'System Administrator', email = 'admin@aiminder.com', contact = '+1-555-0100';

  -- Employee 1: Sarah Johnson
  INSERT INTO public.profiles (id, full_name, email, contact)
  VALUES (emp1_id, 'Sarah Johnson', 'sarah.johnson@aiminder.com', '+1-555-0101')
  ON CONFLICT (id) DO UPDATE 
  SET full_name = 'Sarah Johnson', email = 'sarah.johnson@aiminder.com', contact = '+1-555-0101';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (emp1_id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.employee_profiles (
    user_id, 
    skills, 
    department, 
    designation, 
    hourly_rate,
    availability, 
    current_workload, 
    performance_score, 
    tasks_completed,
    on_time_rate,
    quality_score
  ) VALUES (
    emp1_id,
    ARRAY['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'Docker'],
    'Engineering',
    'Senior Full Stack Developer',
    85.00,
    true,
    2,
    0.92,
    15,
    0.95,
    0.90
  ) ON CONFLICT (user_id) DO UPDATE SET
    skills = ARRAY['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'Docker'],
    department = 'Engineering',
    designation = 'Senior Full Stack Developer',
    hourly_rate = 85.00,
    performance_score = 0.92,
    tasks_completed = 15;

  -- Employee 2: Mike Chen
  INSERT INTO public.profiles (id, full_name, email, contact)
  VALUES (emp2_id, 'Mike Chen', 'mike.chen@aiminder.com', '+1-555-0102')
  ON CONFLICT (id) DO UPDATE 
  SET full_name = 'Mike Chen', email = 'mike.chen@aiminder.com', contact = '+1-555-0102';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (emp2_id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.employee_profiles (
    user_id, 
    skills, 
    department, 
    designation, 
    hourly_rate,
    availability, 
    current_workload, 
    performance_score, 
    tasks_completed,
    on_time_rate,
    quality_score
  ) VALUES (
    emp2_id,
    ARRAY['Figma', 'Adobe XD', 'Sketch', 'UI Design', 'UX Research', 'Prototyping'],
    'Design',
    'Senior UI/UX Designer',
    75.00,
    true,
    1,
    0.88,
    12,
    0.90,
    0.93
  ) ON CONFLICT (user_id) DO UPDATE SET
    skills = ARRAY['Figma', 'Adobe XD', 'Sketch', 'UI Design', 'UX Research', 'Prototyping'],
    department = 'Design',
    designation = 'Senior UI/UX Designer',
    hourly_rate = 75.00,
    performance_score = 0.88,
    tasks_completed = 12;

  -- Employee 3: Emma Davis
  INSERT INTO public.profiles (id, full_name, email, contact)
  VALUES (emp3_id, 'Emma Davis', 'emma.davis@aiminder.com', '+1-555-0103')
  ON CONFLICT (id) DO UPDATE 
  SET full_name = 'Emma Davis', email = 'emma.davis@aiminder.com', contact = '+1-555-0103';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (emp3_id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.employee_profiles (
    user_id, 
    skills, 
    department, 
    designation, 
    hourly_rate,
    availability, 
    current_workload, 
    performance_score, 
    tasks_completed,
    on_time_rate,
    quality_score
  ) VALUES (
    emp3_id,
    ARRAY['Digital Marketing', 'SEO', 'Content Strategy', 'Google Analytics', 'Social Media'],
    'Marketing',
    'Marketing Manager',
    70.00,
    true,
    3,
    0.85,
    10,
    0.88,
    0.87
  ) ON CONFLICT (user_id) DO UPDATE SET
    skills = ARRAY['Digital Marketing', 'SEO', 'Content Strategy', 'Google Analytics', 'Social Media'],
    department = 'Marketing',
    designation = 'Marketing Manager',
    hourly_rate = 70.00,
    performance_score = 0.85,
    tasks_completed = 10;

  -- ============================================================================
  -- CREATE SAMPLE TASKS
  -- ============================================================================

  -- Task 1: E-commerce Platform (Assigned to Sarah, Ongoing)
  INSERT INTO public.tasks (
    title,
    description,
    created_by,
    assigned_to,
    status,
    priority,
    required_skills,
    deadline,
    progress,
    estimated_hours,
    complexity_multiplier,
    started_at
  ) VALUES (
    'Build E-commerce Product Catalog',
    'Develop a comprehensive product catalog system with search, filters, and pagination. Includes admin panel for product management.',
    admin_id,
    emp1_id,
    'ongoing',
    'high',
    ARRAY['React', 'TypeScript', 'PostgreSQL'],
    NOW() + INTERVAL '14 days',
    65,
    80,
    1.3,
    NOW() - INTERVAL '10 days'
  ) ON CONFLICT DO NOTHING
  RETURNING id INTO task1_id;

  -- Task 2: Design System (Assigned to Mike, Ongoing)
  INSERT INTO public.tasks (
    title,
    description,
    created_by,
    assigned_to,
    status,
    priority,
    required_skills,
    deadline,
    progress,
    estimated_hours,
    complexity_multiplier,
    started_at
  ) VALUES (
    'Create Design System Components',
    'Design and document a comprehensive design system including colors, typography, components, and interaction patterns.',
    admin_id,
    emp2_id,
    'ongoing',
    'medium',
    ARRAY['Figma', 'UI Design', 'Documentation'],
    NOW() + INTERVAL '10 days',
    45,
    60,
    1.2,
    NOW() - INTERVAL '7 days'
  ) ON CONFLICT DO NOTHING
  RETURNING id INTO task2_id;

  -- ============================================================================
  -- CREATE TASK UPDATES
  -- ============================================================================

  IF task1_id IS NOT NULL THEN
    INSERT INTO public.task_updates (
      task_id,
      user_id,
      update_text,
      progress,
      hours_logged
    ) VALUES 
      (task1_id, emp1_id, 'Completed database schema and basic API endpoints', 30, 20),
      (task1_id, emp1_id, 'Implemented product listing and search functionality', 50, 25),
      (task1_id, emp1_id, 'Working on admin panel and pagination', 65, 15)
    ON CONFLICT DO NOTHING;
  END IF;

  IF task2_id IS NOT NULL THEN
    INSERT INTO public.task_updates (
      task_id,
      user_id,
      update_text,
      progress,
      hours_logged
    ) VALUES 
      (task2_id, emp2_id, 'Created color palette and typography system', 25, 15),
      (task2_id, emp2_id, 'Designed button and form components', 45, 12)
    ON CONFLICT DO NOTHING;
  END IF;

  -- ============================================================================
  -- CREATE CHATBOT CONVERSATIONS (ISOLATED PER USER)
  -- ============================================================================

  -- Admin's conversation (only visible to admin)
  INSERT INTO public.chat_messages (
    user_id,
    conversation_id,
    message,
    is_ai
  ) VALUES 
    (admin_id, admin_conversation_id, 'Hello! I need to create a task for a React developer', false),
    (admin_id, admin_conversation_id, 'I can help you create a task! What specific requirements do you have for the React developer?', true),
    (admin_id, admin_conversation_id, 'I need someone to build a product catalog with TypeScript', false)
  ON CONFLICT DO NOTHING;

  -- Sarah's conversation (only visible to Sarah - employee support)
  INSERT INTO public.chat_messages (
    user_id,
    conversation_id,
    message,
    is_ai
  ) VALUES 
    (emp1_id, emp1_conversation_id, 'How do I update my task progress?', false),
    (emp1_id, emp1_conversation_id, 'To update your task progress, you can use the "Update Progress" button on your task card. Enter the completion percentage (0-100%) and optionally log hours worked. Would you like me to show you your current tasks?', true)
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- CREATE SAMPLE PAYMENT
  -- ============================================================================

  IF task1_id IS NOT NULL THEN
    INSERT INTO public.payments (
      user_id,
      task_id,
      amount_manual,
      amount_ai_suggested,
      status
    ) VALUES (
      emp1_id,
      task1_id,
      5100.00,  -- Manual: 60 hours * $85/hr
      5508.00,  -- AI: 60 hours * $85/hr * 1.3 complexity * 0.92 performance
      'pending'
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN format('✅ Consolidated sample data seeded successfully!

CREATED ACCOUNTS:
-----------------
Admin:
  Email: admin@aiminder.com
  Password: admin123
  
Employees (all passwords: employee123):
  1. sarah.johnson@aiminder.com - Senior Full Stack Developer
  2. mike.chen@aiminder.com - Senior UI/UX Designer
  3. emma.davis@aiminder.com - Marketing Manager

CREATED DATA:
-------------
✓ 4 users (1 admin + 3 employees)
✓ 2 tasks with varying statuses
✓ Task updates and progress tracking
✓ ISOLATED chat conversations (admin and Sarah have separate conversations)
✓ Sample payment record
✓ Employee profiles with skills and performance metrics

SECURITY NOTES:
---------------
⚠ Each user has their own unique conversation_id
⚠ Chat messages are completely isolated per user
⚠ Admin cannot see employee chats, employees cannot see admin chats
⚠ This is for LOCAL DEVELOPMENT only - use proper signup in production');
END;
$$;

-- Run the seed function
SELECT public.seed_consolidated_sample_data();

-- Add helpful comments
COMMENT ON FUNCTION public.seed_consolidated_sample_data IS 
  'Seeds the database with consolidated sample data including users, tasks, and isolated chat conversations. Safe to run multiple times.';

-- Create a helper function to clear sample data if needed
CREATE OR REPLACE FUNCTION public.clear_consolidated_sample_data()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete in reverse order of dependencies
  DELETE FROM public.payments WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%@aiminder.com'
  );
  
  DELETE FROM public.chat_messages WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%@aiminder.com'
  );
  
  DELETE FROM public.task_updates WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%@aiminder.com'
  );
  
  DELETE FROM public.invitations WHERE to_user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%@aiminder.com'
  );
  
  DELETE FROM public.tasks WHERE created_by IN (
    SELECT id FROM auth.users WHERE email = 'admin@aiminder.com'
  );
  
  DELETE FROM public.employee_profiles WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%@aiminder.com'
  );
  
  DELETE FROM public.user_roles WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%@aiminder.com'
  );
  
  DELETE FROM public.profiles WHERE id IN (
    SELECT id FROM auth.users WHERE email LIKE '%@aiminder.com'
  );
  
  DELETE FROM auth.identities WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%@aiminder.com'
  );
  
  DELETE FROM auth.users WHERE email LIKE '%@aiminder.com';

  RETURN '✅ Consolidated sample data cleared successfully! All @aiminder.com users and related data removed.';
END;
$$;

COMMENT ON FUNCTION public.clear_consolidated_sample_data IS 
  'Clears all consolidated sample data from the database including auth.users. Use with caution!';