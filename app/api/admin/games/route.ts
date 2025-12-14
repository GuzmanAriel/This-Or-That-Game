import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../lib/supabase'
import type { Game } from '../../../../lib/types'

export async function GET() {
  // Placeholder: return list of games for admin (not implemented)
  return NextResponse.json({ ok: true, games: [] })
}

export async function POST(request: Request) {
  const supabase = getSupabaseServiceClient()

  // Authenticate: expect Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader

  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Use supabase.auth.getUser() to validate token
  const { data: userData, error: userError } = await supabase.auth.getUser(token as any)
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  // Parse and validate body
  let body: any
  try {
    body = await request.json()
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, slug, tiebreaker_enabled, tiebreaker_answer, is_open, option_a_label, option_b_label, option_a_emoji, option_b_emoji, tiebreaker_prompt } = body || {}

  if (!title || typeof title !== 'string' || !slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'Missing required fields: title, slug' }, { status: 400 })
  }

  // require option labels
  if (!option_a_label || typeof option_a_label !== 'string' || !option_b_label || typeof option_b_label !== 'string') {
    return NextResponse.json({ error: 'Missing required fields: option_a_label, option_b_label' }, { status: 400 })
  }

  // if tiebreaker is enabled, require tiebreaker_answer
  if (tiebreaker_enabled && (tiebreaker_answer === undefined || tiebreaker_answer === null || String(tiebreaker_answer).trim() === '')) {
    return NextResponse.json({ error: 'Tiebreaker answer is required when tiebreaker_enabled is true' }, { status: 400 })
  }

  // ensure tiebreaker answer is numeric when provided
  if (tiebreaker_enabled) {
    const n = Number(tiebreaker_answer)
    if (!Number.isFinite(n) || String(tiebreaker_answer).trim() === '') {
      return NextResponse.json({ error: 'Tiebreaker answer must be a number' }, { status: 400 })
    }
  }

  // require tiebreaker prompt when enabled
  if (tiebreaker_enabled && (!tiebreaker_prompt || typeof tiebreaker_prompt !== 'string' || !tiebreaker_prompt.trim())) {
    return NextResponse.json({ error: 'Tiebreaker prompt is required when tiebreaker_enabled is true' }, { status: 400 })
  }

  // Normalize flags
  const tiebreakerEnabled = Boolean(tiebreaker_enabled)
  const openFlag = typeof is_open === 'boolean' ? is_open : true

  // Ensure slug uniqueness
  const { data: existing, error: existErr } = await supabase
    .from('games')
    .select('id')
    .eq('slug', slug)
    .limit(1)

  if (existErr) {
    return NextResponse.json({ error: 'Database error checking slug' }, { status: 500 })
  }

  if (existing && (existing as any[]).length > 0) {
    return NextResponse.json({ error: 'Slug already exists' }, { status: 409 })
  }

  // Prepare insert
  const insertPayload: Partial<Game> = {
    title,
    slug,
    is_open: openFlag,
    tiebreaker_enabled: tiebreakerEnabled,
    tiebreaker_answer: tiebreaker_answer ?? null,
    tiebreaker_prompt: tiebreaker_prompt ?? null,
    option_a_label: option_a_label ?? null,
    option_b_label: option_b_label ?? null,
    option_a_emoji: option_a_emoji ?? null,
    option_b_emoji: option_b_emoji ?? null,
    created_by: userData.user.id
  }

  const { data: inserted, error: insertErr } = await supabase.from('games').insert(insertPayload).select().single()
  if (insertErr) {
    // Return DB error message to help debugging (safe in dev).
    console.error('insertErr', insertErr)
    return NextResponse.json({ error: insertErr.message || 'Failed to create game', details: insertErr }, { status: 500 })
  }

  return NextResponse.json({ game: inserted })
}
