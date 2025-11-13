import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (supabaseUrl?.toLowerCase().includes('bolt')) {
  throw new Error('Bolt Database is not supported. Use Supabase only.');
}

if (supabaseAnonKey?.toLowerCase().includes('bolt')) {
  throw new Error('Bolt Database is not supported. Use Supabase only.');
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
