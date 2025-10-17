-- Add foreign key constraint for user_id in payments table
-- This allows Supabase to join profiles table when querying payments
ALTER TABLE public.payments
ADD CONSTRAINT payments_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;
