import { createClient, SupabaseClient } from '@supabase/supabase-js'

const clientUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const clientKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let _supabase: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!_supabase) {
    if (!clientUrl || !clientKey) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment'
      )
    }
    _supabase = createClient(clientUrl, clientKey)
  }
  return _supabase
}

export function getSupabaseServiceClient(): SupabaseClient {
  const serviceUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceUrl || !serviceKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment'
    )
  }

  return createClient(serviceUrl, serviceKey)
}
