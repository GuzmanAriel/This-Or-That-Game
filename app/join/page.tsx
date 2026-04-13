"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '../../lib/supabase'

export default function JoinPage() {
  const supabase = getSupabaseClient()
  const router = useRouter()

  const [code, setCode] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matches, setMatches] = useState<any[] | null>(null)
  const [matchGame, setMatchGame] = useState<any | null>(null)

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const slug = String(code || '').trim()
    const fn = String(firstName || '').trim()
    const ln = String(lastName || '').trim()
    if (!slug) return setError('Please enter a game code')
    if (!fn || !ln) return setError('Please enter your first and last name')

    setLoading(true)
    try {
      // find game by slug (game code maps to slug)
      const { data: gData } = await supabase.from('games').select('*').eq('slug', slug).limit(1).maybeSingle()
      if (!gData) {
        setError('Game not found for that code')
        return
      }

      // find existing players with exact same name for this game
      const { data: found } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', (gData as any).id)
        .eq('first_name', fn)
        .eq('last_name', ln)

      // if any matches, show confirmation / disambiguation so user can continue or create new
      if (found && (found as any[]).length >= 1) {
        setMatches(found as any[])
        setMatchGame(gData)
        return
      }

      let pid: string
      if (found && (found as any[]).length === 1) {
        pid = (found as any[])[0].id
      } else {
        const { data: inserted, error } = await supabase
          .from('players')
          .insert({ game_id: (gData as any).id, first_name: fn, last_name: ln })
          .select()
          .limit(1)
          .maybeSingle()
        if (error) throw error
        pid = (inserted as any).id
      }

      try { localStorage.setItem(`playerId:${(gData as any).id}`, pid) } catch (e) {}

      // redirect to game page (GameClient will pick up playerId from localStorage)
      router.push(`/g/${(gData as any).slug}`)
    } catch (err: any) {
      console.error('join error', err)
      setError(err?.message ?? 'Failed to join')
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectExisting(playerId: string) {
    if (!matchGame) return
    try { localStorage.setItem(`playerId:${matchGame.id}`, playerId) } catch (e) {}
    router.push(`/g/${matchGame.slug}`)
  }

  async function handleCreateNewForMatch() {
    if (!matchGame) return
    setLoading(true)
    try {
      const fn = String(firstName || '').trim()
      const ln = String(lastName || '').trim()
      const { data: inserted, error } = await supabase
        .from('players')
        .insert({ game_id: matchGame.id, first_name: fn, last_name: ln })
        .select()
        .limit(1)
        .maybeSingle()
      if (error) throw error
      const pid = (inserted as any).id
      try { localStorage.setItem(`playerId:${matchGame.id}`, pid) } catch (e) {}
      router.push(`/g/${matchGame.slug}`)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create player')
    } finally {
      setLoading(false)
    }
  }

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
          <input placeholder="e.g. test-game" value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
          <p className="mt-1 text-xs text-gray-500">The game code is the slug shown in the share URL (the last part after <span className="font-mono">/g/</span>).</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">First name</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Last name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Joining…' : 'Join Game'}</button>
        </div>
      </form>
      )}
    </div>
  )
}
