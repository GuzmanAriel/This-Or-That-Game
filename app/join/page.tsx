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

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const slug = String(code || '').trim()
    const fn = String(firstName || '').trim()
    const ln = String(lastName || '').trim()
    if (!slug) return setError('Please enter a game code')
    if (!fn) return setError('Please enter your first name')

    setLoading(true)
    try {
      // find game by slug (game code maps to slug)
      const { data: gData } = await supabase.from('games').select('*').eq('slug', slug).limit(1).maybeSingle()
      if (!gData) {
        setError('Game not found for that code')
        return
      }

      // find existing player by name for this game, or create
      const { data: existing } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', (gData as any).id)
        .eq('first_name', fn)
        .eq('last_name', ln)
        .limit(1)
        .maybeSingle()

      let pid: string
      if (existing) {
        pid = (existing as any).id
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

  return (
    <div className="container mx-auto p-8" data-page="join">
      <h2 className="text-2xl font-semibold">Join game</h2>
      <p className="mt-2 text-sm">Enter the game code and your name to join as a player.</p>

      <form onSubmit={handleJoin} className="mt-6 max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Game Code (slug)</label>
          <input placeholder="e.g. test-game" value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
          <p className="mt-1 text-xs text-gray-500">The game code is the slug shown in the share URL (the last part after <span className="font-mono">/g/</span>).</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">First name</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Last name (optional)</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Joining…' : 'Join Game'}</button>
        </div>
      </form>
    </div>
  )
}
