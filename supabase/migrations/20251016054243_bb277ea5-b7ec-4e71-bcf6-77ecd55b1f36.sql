-- Add missing columns to employee_profiles
ALTER TABLE public.employee_profiles
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS on_time_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quality_score DECIMAL(5,2) DEFAULT 0;

-- Add estimated_hours and complexity columns to tasks
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS complexity_multiplier DECIMAL(5,2) DEFAULT 1.0;

-- Create invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL,
  from_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- RLS policies for invitations
CREATE POLICY "Users can view their own invitations"
  ON public.invitations FOR SELECT
  USING (auth.uid() = to_user_id OR auth.uid() = from_user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins and staff can create invitations"
  ON public.invitations FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Invited users can update invitation status"
  ON public.invitations FOR UPDATE
  USING (auth.uid() = to_user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  amount_manual DECIMAL(10,2),
  amount_ai_suggested DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for payments
CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins can manage payments"
  ON public.payments FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Add hours_logged to task_updates
ALTER TABLE public.task_updates
ADD COLUMN IF NOT EXISTS hours_logged DECIMAL(10,2);

-- Add conversation_id to chat_messages for grouping
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS conversation_id UUID;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_invitations_to_user ON public.invitations(to_user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id);

-- Add trigger for invitations to update task status
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

CREATE TRIGGER on_invitation_response
  AFTER UPDATE ON public.invitations
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_invitation_response();

-- Enable realtime for invitations
ALTER PUBLICATION supabase_realtime ADD TABLE public.invitations;