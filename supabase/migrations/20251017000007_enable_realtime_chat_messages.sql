-- Enable Supabase Realtime for chat_messages table
-- This allows the frontend to receive live updates when new messages are added

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
