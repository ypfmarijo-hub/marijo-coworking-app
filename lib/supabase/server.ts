import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Supabase credentials
const SUPABASE_URL = 'https://coxfxtcpoyssejhnyqyt.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNveGZ4dGNwb3lzc2VqaG55cXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDUwNDcsImV4cCI6MjA4ODk4MTA0N30.oeBHxvM7Vosi9zpjEyQFlYzOfa5HD7LpfIlmwqTxfMQ'

export function createClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
