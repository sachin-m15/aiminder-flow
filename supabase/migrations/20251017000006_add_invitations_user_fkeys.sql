-- Add foreign key constraints for invitations table
-- This allows Supabase to join profiles table when querying invitations

ALTER TABLE public.invitations
ADD CONSTRAINT invitations_to_user_id_fkey 
FOREIGN KEY (to_user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

ALTER TABLE public.invitations
ADD CONSTRAINT invitations_from_user_id_fkey 
FOREIGN KEY (from_user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;
