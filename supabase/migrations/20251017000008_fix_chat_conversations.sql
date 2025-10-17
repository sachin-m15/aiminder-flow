-- Fix chat_messages to properly isolate conversations per user
-- Each user should have their own separate conversation threads

-- Step 1: Create a function to generate a default conversation ID for each user
CREATE OR REPLACE FUNCTION public.get_user_default_conversation_id(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Return a deterministic UUID based on user_id for their default conversation
  -- This ensures each user has one default conversation
  RETURN uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, p_user_id::text);
END;
$$;

-- Step 2: Update existing messages to have a default conversation_id per user
UPDATE public.chat_messages
SET conversation_id = public.get_user_default_conversation_id(user_id)
WHERE conversation_id IS NULL;

-- Step 3: Make conversation_id NOT NULL now that all rows have values
ALTER TABLE public.chat_messages
ALTER COLUMN conversation_id SET NOT NULL;

-- Step 4: Set default for new messages
ALTER TABLE public.chat_messages
ALTER COLUMN conversation_id SET DEFAULT gen_random_uuid();

-- Step 5: Add index for efficient querying by user and conversation
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_conversation 
ON public.chat_messages(user_id, conversation_id, created_at);

-- Step 6: Add comment explaining the schema
COMMENT ON COLUMN public.chat_messages.conversation_id IS 
  'Unique identifier for a conversation thread. Each user can have multiple conversations. All messages in a conversation share the same conversation_id and user_id.';

COMMENT ON COLUMN public.chat_messages.user_id IS 
  'The user who owns this conversation. Both user messages and AI responses have the same user_id within a conversation.';

-- Step 7: Create a helper function to start a new conversation
CREATE OR REPLACE FUNCTION public.start_new_conversation(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
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

COMMENT ON FUNCTION public.start_new_conversation IS 
  'Creates a new conversation for a user and returns the conversation_id. Call this when starting a fresh chat session.';
