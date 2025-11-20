import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

function parseEnv(path) {
  const text = fs.readFileSync(path, 'utf8')
  const lines = text.split(/\r?\n/)
  const out = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const k = trimmed.slice(0, eq)
    const v = trimmed.slice(eq + 1)
    out[k] = v
  }
  return out
}

async function main() {
  const env = parseEnv(new URL('../.env.local', import.meta.url).pathname)
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
  const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required env vars in .env.local')
    process.exit(1)
  }

  const adminEmail = `dev-admin+${Date.now()}@example.com`
  const adminPassword = 'Test1234!'

  console.log('Using Supabase URL:', SUPABASE_URL)

  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  console.log('Creating temporary admin user:', adminEmail)
  const createRes = await svc.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true
  })
  console.log('create user result:', createRes.error ? createRes.error : 'ok')

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  console.log('Signing in as admin user')
  const sign = await anon.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
  if (sign.error) {
    console.error('Sign-in error:', sign.error)
    process.exit(1)
  }
  const token = sign.data.session?.access_token
  console.log('Got access token:', !!token)

  console.log('Calling /api/admin/games to create a test game')
  const res = await fetch('http://localhost:3000/api/admin/games', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ title: 'Test Game', slug: `test-game-${Date.now()}`, is_open: true })
  })
  const body = await res.text()
  console.log('Response status:', res.status)
  console.log('Response body:', body)

  // cleanup: delete the created user using admin
  try {
    if (createRes.data?.user?.id) {
      await svc.auth.admin.deleteUser(createRes.data.user.id)
      console.log('Deleted temporary user')
    }
  } catch (e) {
    console.warn('Failed to delete temp user:', e)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
