import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../../lib/supabaseService'

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    let supabase
    try {
      supabase = getSupabaseServiceClient()
    } catch (err: any) {
      console.error('Supabase service client error', err)
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const gameId = params.id
    if (!gameId) return NextResponse.json({ error: 'Missing game id' }, { status: 400 })

    // require auth token
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: userData, error: userErr } = await supabase.auth.getUser(token as any)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    // Ensure game exists and is owned by requester
    const { data: gameRow, error: gameErr } = await supabase.from('games').select('id, created_by').eq('id', gameId).limit(1).maybeSingle()
    if (gameErr) return NextResponse.json({ error: 'DB error checking game' }, { status: 500 })
    if (!gameRow) return NextResponse.json({ error: 'Game not found' }, { status: 404 })

    if (String(gameRow.created_by) !== String(userData.user.id)) {
      return NextResponse.json({ error: 'Forbidden: you do not own this game' }, { status: 403 })
    }

    // Delete related questions first, then delete game
    const { error: qErr } = await supabase.from('questions').delete().eq('game_id', gameId)
    if (qErr) {
      console.error('Failed to delete questions for game', qErr)
      return NextResponse.json({ error: 'Failed to delete questions' }, { status: 500 })
    }

    const { error: gDelErr } = await supabase.from('games').delete().eq('id', gameId)
    if (gDelErr) {
      console.error('Failed to delete game', gDelErr)
      return NextResponse.json({ error: 'Failed to delete game' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Unhandled error in DELETE /api/admin/games/[id]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
