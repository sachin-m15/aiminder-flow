-- ============================================================================
-- CHATBOT SCHEMA MIGRATION
-- Consolidates all chatbot-related tables, functions, and configurations
-- This isolates the chatbot feature for independent development and deployment
-- ============================================================================

-- ============================================================================
-- CHATBOT TABLES
-- ============================================================================

-- Create chat_messages table for storing all chat interactions
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_ai BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CHATBOT INDEXES
-- ============================================================================

-- Index for efficient querying by user and conversation
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_conversation 
ON public.chat_messages(user_id, conversation_id, created_at);

-- Index for conversation queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation 
ON public.chat_messages(conversation_id);

-- Index for task-specific conversations
CREATE INDEX IF NOT EXISTS idx_chat_messages_task 
ON public.chat_messages(task_id) WHERE task_id IS NOT NULL;

-- ============================================================================
-- CHATBOT FUNCTIONS
-- ============================================================================

-- Function to generate a deterministic conversation ID for each user
CREATE OR REPLACE FUNCTION public.get_user_default_conversation_id(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  -- Return a deterministic UUID based on user_id for their default conversation
  -- This ensures each user has one default conversation
  RETURN uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, p_user_id::text);
END;
$$;

-- Function to start a new conversation
CREATE OR REPLACE FUNCTION public.start_new_conversation(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  v_conversation_id := gen_random_uuid();
  
  -- Insert a system message to mark the start of conversation
  INSERT INTO public.chat_messages (user_id, conversation_id, message, is_ai, metadata)
  VALUES (
    p_user_id,
    v_conversation_id,
    'Conversation started',
    true,
    jsonb_build_object('type', 'system', 'action', 'conversation_start')
  );
  
  RETURN v_conversation_id;
END;
$$;

-- Function to get conversation history for a user
CREATE OR REPLACE FUNCTION public.get_conversation_history(
  p_user_id UUID,
  p_conversation_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  message TEXT,
  is_ai BOOLEAN,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    cm.conversation_id,
    cm.message,
    cm.is_ai,
    cm.metadata,
    cm.created_at
  FROM public.chat_messages cm
  WHERE cm.user_id = p_user_id
    AND (p_conversation_id IS NULL OR cm.conversation_id = p_conversation_id)
  ORDER BY cm.created_at ASC
  LIMIT p_limit;
END;
$$;

-- Function to get all conversations for a user
CREATE OR REPLACE FUNCTION public.get_user_conversations(p_user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  message_count BIGINT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.conversation_id,
    COUNT(*) as message_count,
    cm.message as last_message,
    cm.created_at as last_message_at
  FROM public.chat_messages cm
  INNER JOIN (
    SELECT conversation_id, MAX(created_at) as max_created_at
    FROM public.chat_messages
    WHERE user_id = p_user_id
    GROUP BY conversation_id
  ) latest ON cm.conversation_id = latest.conversation_id AND cm.created_at = latest.max_created_at
  WHERE cm.user_id = p_user_id
  GROUP BY cm.conversation_id, cm.message, cm.created_at
  ORDER BY cm.created_at DESC;
END;
$$;

-- ============================================================================
-- CHATBOT ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on chat_messages table
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_messages
-- Users can only see their own messages
CREATE POLICY "Users can view own chat messages" ON public.chat_messages 
FOR SELECT TO authenticated 
USING (auth.uid() = user_id);

-- Users can insert their own messages
CREATE POLICY "Users can insert own chat messages" ON public.chat_messages 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own messages (for corrections if needed)
CREATE POLICY "Users can update own chat messages" ON public.chat_messages 
FOR UPDATE TO authenticated 
USING (auth.uid() = user_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete own chat messages" ON public.chat_messages 
FOR DELETE TO authenticated 
USING (auth.uid() = user_id);

-- ============================================================================
-- CHATBOT REALTIME CONFIGURATION
-- ============================================================================

-- Enable Supabase Realtime for chat_messages table
-- This allows the frontend to receive live updates when new messages are added
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- ============================================================================
-- CHATBOT TRIGGERS
-- ============================================================================

-- Function to update conversation metadata when messages are added
CREATE OR REPLACE FUNCTION public.update_conversation_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- This trigger can be used to update conversation-level statistics
  -- For now, it's a placeholder for future enhancements
  RETURN NEW;
END;
$$;

-- Create trigger for conversation metadata updates
CREATE TRIGGER chat_messages_update_conversation_metadata
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_metadata();

-- ============================================================================
-- CHATBOT VIEWS
-- ============================================================================

-- View for conversation summaries
CREATE OR REPLACE VIEW public.conversation_summaries AS
SELECT 
  conversation_id,
  user_id,
  COUNT(*) as total_messages,
  COUNT(CASE WHEN is_ai = false THEN 1 END) as user_messages,
  COUNT(CASE WHEN is_ai = true THEN 1 END) as ai_messages,
  MIN(created_at) as conversation_started,
  MAX(created_at) as last_activity,
  CASE 
    WHEN MAX(created_at) > NOW() - INTERVAL '1 hour' THEN 'active'
    WHEN MAX(created_at) > NOW() - INTERVAL '24 hours' THEN 'recent'
    ELSE 'inactive'
  END as status
FROM public.chat_messages
GROUP BY conversation_id, user_id;

-- View for chat analytics
CREATE OR REPLACE VIEW public.chat_analytics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  user_id,
  COUNT(*) as messages_sent,
  COUNT(CASE WHEN is_ai = false THEN 1 END) as user_messages,
  COUNT(CASE WHEN is_ai = true THEN 1 END) as ai_responses,
  AVG(LENGTH(message)) as avg_message_length
FROM public.chat_messages
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), user_id
ORDER BY date DESC;

-- ============================================================================
-- CHATBOT COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.chat_messages IS 'Stores all chat interactions between users and AI assistant, with conversation isolation per user';

COMMENT ON COLUMN public.chat_messages.conversation_id IS 'Unique identifier for a conversation thread. Each user can have multiple conversations. All messages in a conversation share the same conversation_id.';

COMMENT ON COLUMN public.chat_messages.user_id IS 'The user who owns this conversation. Both user messages and AI responses have the same user_id within a conversation.';

COMMENT ON COLUMN public.chat_messages.task_id IS 'Optional link to a task for task-specific conversations. NULL for general chat.';

COMMENT ON COLUMN public.chat_messages.is_ai IS 'Distinguishes between user messages (false) and AI responses (true).';

COMMENT ON COLUMN public.chat_messages.metadata IS 'Stores additional data like task suggestions, employee matches, or system events.';

COMMENT ON FUNCTION public.get_user_default_conversation_id IS 'Generates a deterministic UUID for each user based on their user_id. Ensures consistent default conversation IDs.';

COMMENT ON FUNCTION public.start_new_conversation IS 'Creates a new conversation for a user and returns the conversation_id. Inserts a system message to mark the conversation start.';

COMMENT ON FUNCTION public.get_conversation_history IS 'Retrieves paginated conversation history for a specific user and conversation.';

COMMENT ON FUNCTION public.get_user_conversations IS 'Lists all conversations for a user with summary information.';

COMMENT ON VIEW public.conversation_summaries IS 'Provides summary statistics for each conversation including message counts and activity status.';

COMMENT ON VIEW public.chat_analytics IS 'Provides analytics data for chat usage including message counts and engagement metrics.';

-- ============================================================================
-- CHATBOT MIGRATION COMPLETION
-- ============================================================================

-- Log the completion of chatbot schema migration
DO $$
BEGIN
  RAISE NOTICE 'Chatbot schema migration completed successfully!';
  RAISE NOTICE 'Created: chat_messages table, indexes, functions, RLS policies, views, and realtime configuration';
  RAISE NOTICE 'Chatbot feature is now isolated and ready for independent development';
END $$;