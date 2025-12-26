import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../../../lib/supabaseService'

type ReqBody = {
  prompt?: string
  correct_answer?: 'mom' | 'dad' | string
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  let supabase
  try {
    supabase = getSupabaseServiceClient()
  } catch (err: any) {
    console.error('Supabase service client error', err)
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const gameId = params.id
  if (!gameId) return NextResponse.json({ error: 'Missing game id' }, { status: 400 })

  const { data, error } = await supabase.from('questions').select('*').eq('game_id', gameId).order('order_index', { ascending: true })
  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
  return NextResponse.json({ questions: data })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let supabase
  try {
    supabase = getSupabaseServiceClient()
  } catch (err: any) {
    console.error('Supabase service client error', err)
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }
  const gameId = params.id
  if (!gameId) return NextResponse.json({ error: 'Missing game id' }, { status: 400 })

  // require auth token to ensure caller is authenticated (dev safeguard)
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { data: userData, error: userErr } = await supabase.auth.getUser(token as any)
  if (userErr || !userData?.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  let body: ReqBody
  try {
    body = await request.json()
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { prompt, correct_answer } = body
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
  }
  if (!correct_answer || (correct_answer !== 'mom' && correct_answer !== 'dad')) {
    return NextResponse.json({ error: 'Invalid correct_answer, must be "mom" or "dad"' }, { status: 400 })
  }

  // Ensure game exists
  const { data: gameRow, error: gameErr } = await supabase.from('games').select('id').eq('id', gameId).limit(1).maybeSingle()
  if (gameErr) return NextResponse.json({ error: 'DB error checking game' }, { status: 500 })
  if (!gameRow) return NextResponse.json({ error: 'Game not found' }, { status: 404 })

  // compute next order_index
  let maxRow: any = null
  let maxErr: any = null
  try {
    const resp = await supabase.rpc('max_order_index_for_game', { gid: gameId })
    maxRow = resp.data
    maxErr = resp.error
  } catch (e) {
    maxRow = null
    maxErr = e
  }

  let nextIndex = 0
  if (!maxErr && maxRow && typeof (maxRow as any).max === 'number') {
    nextIndex = ((maxRow as any).max ?? -1) + 1
  } else {
    // fallback: query max directly
    const { data: rows, error: rowsErr } = await supabase.from('questions').select('order_index').eq('game_id', gameId).order('order_index', { ascending: false }).limit(1)
    if (!rowsErr && rows && rows.length > 0) {
      nextIndex = (rows[0] as any).order_index + 1
    } else {
      nextIndex = 0
    }
  }

  const insertPayload = {
    game_id: gameId,
    prompt: prompt.trim(),
    correct_answer,
    order_index: nextIndex
  }

  const { data: inserted, error: insertErr } = await supabase.from('questions').insert(insertPayload).select().single()
  if (insertErr) return NextResponse.json({ error: 'Failed to insert question' }, { status: 500 })

  return NextResponse.json({ question: inserted }, { status: 201 })
}
