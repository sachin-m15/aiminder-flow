// Server-side Supabase client
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config'; // Ensure dotenv is loaded

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

console.log('🔍 Environment check:', {
  hasSupabaseUrl: !!supabaseUrl,
  hasSupabaseKey: !!supabaseKey,
  nodeEnv: process.env.NODE_ENV
});

// For development/testing, fall back to anon key if service key is not available
const effectiveKey = supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodWVmdnVuZHFobGd1YXpubHppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTA4MjIsImV4cCI6MjA3NjEyNjgyMn0.rrj2KWU9eUWuFJvATPb-An7Ff94GicSLYgzX9lBCgC8';

if (!supabaseUrl) {
  throw new Error('Missing Supabase environment variable: SUPABASE_URL is required');
}

// Create Supabase client with service role key for server-side operations
export const supabase = createClient(supabaseUrl, effectiveKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});