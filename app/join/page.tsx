"use client"

import React, { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '../../lib/supabase'
import type { Game } from '../../lib/types'

export default function JoinPage() {
  const supabase = useMemo(() => getSupabaseClient(), [])
  const router = useRouter()

  const [code, setCode] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matches, setMatches] = useState<Player[] | null>(null)
  const [matchGame, setMatchGame] = useState<Game | null>(null)

  interface Player {
    id: string
    game_id: string
    first_name: string
    last_name?: string
    created_at?: string
  }

  const createPlayer = useCallback(async (gameId: string, fn: string, ln: string) => {
    const { data: inserted, error } = await supabase
      .from('players')
      .insert({ game_id: gameId, first_name: fn, last_name: ln })
      .select('id,game_id,first_name,last_name,created_at')
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!inserted) throw new Error('Failed to create player')
    return (inserted as any).id as string
  }, [supabase])

  const handleJoin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const slug = String(code || '').trim()
    const fn = String(firstName || '').trim()
    const ln = String(lastName || '').trim()
    if (!slug) return setError('Please enter a game code')
    if (!fn || !ln) return setError('Please enter your first and last name')

    setLoading(true)
    try {
      const { data: gData } = await supabase.from('games').select('id,slug,title,is_open,option_a_label,option_b_label,option_a_emoji,option_b_emoji,theme,tiebreaker_prompt,tiebreaker_answer,created_at').eq('slug', slug).limit(1).maybeSingle()
      if (!gData) {
        setError('Game not found for that code')
        return
      }

      const { data: found } = await supabase
        .from('players')
        .select('id,game_id,first_name,last_name,created_at')
        .eq('game_id', (gData as any).id)
        .eq('first_name', fn)
        .eq('last_name', ln)

      // If multiple matches, ask user to pick; if exactly one, reuse it; otherwise create a new player
      if (found && (found as any[]).length > 1) {
        setMatches(found as any[])
        setMatchGame(gData)
        return
      }

      let pid: string
      if (found && (found as any[]).length === 1) {
        pid = (found as any[])[0].id
      } else {
        pid = await createPlayer((gData as any).id, fn, ln)
      }

      try { localStorage.setItem(`playerId:${(gData as any).id}`, pid) } catch (e) {}
      router.push(`/g/${(gData as any).slug}`)
    } catch (err: any) {
      console.error('join error', err)
      setError(err?.message ?? 'Failed to join')
    } finally {
      setLoading(false)
    }
  }, [code, firstName, lastName, supabase, createPlayer, router])

  const handleSelectExisting = useCallback((playerId: string) => {
    if (!matchGame) return
    try { localStorage.setItem(`playerId:${matchGame.id}`, playerId) } catch (e) {}
    router.push(`/g/${matchGame.slug}`)
  }, [matchGame, router])

  const handleCreateNewForMatch = useCallback(async () => {
    if (!matchGame) return
    setLoading(true)
    try {
      const fn = String(firstName || '').trim()
      const ln = String(lastName || '').trim()
      const pid = await createPlayer(matchGame.id, fn, ln)
      try { localStorage.setItem(`playerId:${matchGame.id}`, pid) } catch (e) {}
      router.push(`/g/${matchGame.slug}`)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create player')
    } finally {
      setLoading(false)
    }
  }, [matchGame, firstName, lastName, createPlayer, router])

  return (
    <div className="container mx-auto p-8" data-page="join">
      <h2 className="text-2xl font-semibold">Join game</h2>
      <p className="mt-2 text-sm">Enter the game code and your name to join as a player.</p>
      {matches && matches.length > 0 ? (
        <div className="mt-6 max-w-md">
          <h3 className="text-xl font-bold">Player found</h3>
          <p className="mt-2 text-sm text-gray-600">We found a player with that name for this game. Continue as the existing player or create a new entry.</p>
          <ul className="mt-4 space-y-2">
            {matches.map((p) => (
              <li key={p.id} className="flex items-center justify-between border rounded p-3">
                <div>
                  <div className="font-medium">{p.first_name} {p.last_name}</div>
                  <div className="text-xs text-gray-500">Joined: {p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</div>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button onClick={() => handleSelectExisting(p.id)} className="btn-primary">Continue</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center space-x-2">
            <button onClick={handleCreateNewForMatch} className="btn-primary">Create new player</button>
            <button onClick={() => { setMatches(null); setMatchGame(null); }} className="btn-cancel">Cancel</button>
          </div>
        </div>
      ) : (
      <form onSubmit={handleJoin} className="mt-6 max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Game Code (slug)</label>
          <input
            name="code"
            autoComplete="off"
            autoFocus
            placeholder="e.g. test-game"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">The game code is the slug shown in the share URL (the last part after <span className="font-mono">/g/</span>).</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">First name</label>
          <input name="first_name" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" disabled={loading} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Last name</label>
          <input name="last_name" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" disabled={loading} />
        </div>

        {error && (
          <div role="alert" aria-live="assertive">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Joining…' : 'Join Game'}</button>
        </div>
      </form>
      )}
    </div>
  )
}
