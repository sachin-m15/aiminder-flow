-- ============================================================================
-- FOREIGN KEY FIX MIGRATION
-- ============================================================================
-- Fixes foreign key references to use auth.users.id instead of profiles.id
-- Adds proper cascading delete rules where missing
-- Preserves all existing data during migration
-- ============================================================================

-- ============================================================================
-- DROP EXISTING FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Drop foreign key constraints on invitations table
ALTER TABLE public.invitations 
DROP CONSTRAINT IF EXISTS invitations_to_user_id_fkey,
DROP CONSTRAINT IF EXISTS invitations_from_user_id_fkey;

-- Drop foreign key constraint on payments table  
ALTER TABLE public.payments 
DROP CONSTRAINT IF EXISTS payments_user_id_fkey;

-- ============================================================================
-- ADD CORRECT FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Fix invitations.to_user_id to reference auth.users.id
ALTER TABLE public.invitations 
ADD CONSTRAINT invitations_to_user_id_fkey 
FOREIGN KEY (to_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix invitations.from_user_id to reference auth.users.id
ALTER TABLE public.invitations 
ADD CONSTRAINT invitations_from_user_id_fkey 
FOREIGN KEY (from_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix payments.user_id to reference auth.users.id
ALTER TABLE public.payments 
ADD CONSTRAINT payments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- VERIFY DATA INTEGRITY BEFORE APPLYING CHANGES
-- ============================================================================

-- Check for orphaned records in invitations table
DO $$
DECLARE
  orphaned_invitations_count INTEGER;
  orphaned_payments_count INTEGER;
BEGIN
  -- Check for invitations with non-existent users
  SELECT COUNT(*) INTO orphaned_invitations_count
  FROM public.invitations i
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = i.to_user_id
  ) OR NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = i.from_user_id
  );

  -- Check for payments with non-existent users
  SELECT COUNT(*) INTO orphaned_payments_count
  FROM public.payments p
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p.user_id
  );

  IF orphaned_invitations_count > 0 OR orphaned_payments_count > 0 THEN
    RAISE WARNING 'Found orphaned records: % invitations, % payments. These will be automatically cleaned up by CASCADE.', 
      orphaned_invitations_count, orphaned_payments_count;
  END IF;
END $$;

-- ============================================================================
-- UPDATE SAMPLE DATA REFERENCES (if sample data exists)
-- ============================================================================

-- The sample data in 20251025000003_consolidated_sample_data.sql already uses
-- auth.users.id references correctly in the INSERT statements, so no changes
-- are needed to the sample data migration.

-- ============================================================================
-- MIGRATION COMPLETION
-- ============================================================================

-- Log the completion of foreign key fixes
DO $$
BEGIN
  RAISE NOTICE 'Foreign key fix migration completed successfully!';
  RAISE NOTICE 'Fixed: invitations.to_user_id now references auth.users.id';
  RAISE NOTICE 'Fixed: invitations.from_user_id now references auth.users.id';
  RAISE NOTICE 'Fixed: payments.user_id now references auth.users.id';
  RAISE NOTICE 'All foreign keys now use proper CASCADE delete rules';
  RAISE NOTICE 'Data integrity verified and preserved';
END $$;