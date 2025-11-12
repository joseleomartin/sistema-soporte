import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = 'https://yevbgutnuoivcuqnmrzi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldmJndXRudW9pdmN1cW5tcnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTI0NTQsImV4cCI6MjA3ODQ2ODQ1NH0.COkMSMvFvpCM2q9FC0fYukS-mCzLacqilH9q1aHAQR4';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
