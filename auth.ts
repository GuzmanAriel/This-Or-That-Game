import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  throw new Error('Invalid or missing NEXT_PUBLIC_SUPABASE_URL. Set it in .env.local to your Supabase URL (https://xyz.supabase.co).');
}
if (!supabaseKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Set it in .env.local to your Supabase anon key.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function loginWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}