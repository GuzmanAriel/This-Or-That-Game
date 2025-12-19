"use client"

import React, { useEffect, useState } from 'react'
import { getSupabaseClient } from '../../lib/supabase'

export default function AuthBar() {
  const supabase = getSupabaseClient()
  const [user, setUser] = useState<any | null>(null)

  // Menu data for admin-created games and games this user submitted to
  const [adminGames, setAdminGames] = useState<any[]>([])
  const [submittedGames, setSubmittedGames] = useState<any[]>([])
  const [loadingMenus, setLoadingMenus] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [subsOpen, setSubsOpen] = useState(false)
  const [playerGameIds, setPlayerGameIds] = useState<string[]>([])
  const [playerGames, setPlayerGames] = useState<any[]>([])
  const [playersOpen, setPlayersOpen] = useState(false)
  const [playerProfiles, setPlayerProfiles] = useState<Record<string, any>>({})

  useEffect(() => {
    let mounted = true
    async function check() {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      setUser(data.user ?? null)
    }
    check()
    const { data: listener } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setUser(session?.user ?? null)
    })
    return () => {
      mounted = false
      listener?.subscription?.unsubscribe()
    }
  }, [supabase])

  // When a user is available, load their admin games and submitted games
  useEffect(() => {
    if (!user) {
      setAdminGames([])
      setSubmittedGames([])
      // don't return here — keep playerGames available from localStorage
    }

    let mounted = true
    async function loadMenus() {
      setLoadingMenus(true)
      try {
        // admin games: games this user created
        const { data: a } = await supabase.from('games').select('*').eq('created_by', user.id).order('created_at', { ascending: false })
        if (!mounted) return
        setAdminGames((a as any) ?? [])
      } catch (err) {
        if (mounted) setAdminGames([])
      }

      try {
        // submissions tied to this user's email -> load related games
        const { data: subs } = await supabase.from('submissions').select('game_id').eq('email', user.email)
        if (!mounted) return
        const ids = Array.from(new Set(((subs as any[]) || []).map((s) => s.game_id).filter(Boolean)))
        if (ids.length > 0) {
          const { data: g } = await supabase.from('games').select('*').in('id', ids)
          if (!mounted) return
          setSubmittedGames((g as any) ?? [])
        } else {
          setSubmittedGames([])
        }
      } catch (err) {
        if (mounted) setSubmittedGames([])
      }

      if (mounted) setLoadingMenus(false)
    }

    loadMenus()
    return () => { mounted = false }
  }, [user, supabase])

  // Client-side: detect any player IDs stored in localStorage (keys like `playerId:${gameId}`)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const ids: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        if (key.startsWith('playerId:')) {
          const gid = key.split(':')[1]
          if (gid && !ids.includes(gid)) ids.push(gid)
        }
      }
      setPlayerGameIds(ids)
      if (ids.length === 0) {
        setPlayerGames([])
        return
      }

      // fetch game records for those ids
      let mounted = true
      ;(async () => {
        try {
          const { data } = await supabase.from('games').select('*').in('id', ids)
          if (!mounted) return
          const games = (data as any) ?? []
          setPlayerGames(games)

          // collect playerIds from localStorage keys `playerId:<gameId>` and fetch player profiles
          const pids: string[] = []
          for (const gid of ids) {
            try {
              const pid = localStorage.getItem(`playerId:${gid}`)
              if (pid && !pids.includes(pid)) pids.push(pid)
            } catch (e) {
              // ignore
            }
          }
          if (pids.length > 0) {
            try {
              const { data: players } = await supabase.from('players').select('*').in('id', pids)
              if (!mounted) return
              const map: Record<string, any> = {}
              ;(players as any[] || []).forEach((p) => { if (p && p.id) map[p.id] = p })
              setPlayerProfiles(map)
            } catch (e) {
              if (mounted) setPlayerProfiles({})
            }
          } else {
            setPlayerProfiles({})
          }
        } catch (err) {
          if (mounted) setPlayerGames([])
        }
      })()
      return () => { mounted = false }
    } catch (e) {
      setPlayerGameIds([])
      setPlayerGames([])
    }
  }, [supabase])

  // derive admin status: check app/user metadata OR whether they have created games
  const isAdmin = Boolean(
    (user && (user.app_metadata?.role === 'admin' || (Array.isArray(user.app_metadata?.roles) && user.app_metadata.roles.includes('admin')))) ||
    (adminGames && adminGames.length > 0)
  )

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <div className="w-full border-b bg-[linear-gradient(64deg,_#913572_0%,_#295875_100%)] text-white shadow-sm">
      <div className="container mx-auto px-3 py-5 flex items-center justify-between font-heading">
        {/* Brand / home link */}
        <div className="flex items-center space-x-4">
          <a href="/" className="text-2xl font-semibold tracking-widest">🎉 This OR That</a>
        </div>

        {/* Navigation / menus */}
        <div className="flex items-center space-x-4">
          <a href="/" className="text-lg font-bold tracking-wider hover:underline">Home</a>
          {isAdmin ? (
            <a href="/admin" className="text-lg font-bold tracking-wider hover:underline">Admin</a>
          ) : null}

          {/* Player games (from localStorage) - shown even when not signed in */}
          {playerGames.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setPlayersOpen((s) => !s)}
                className="text-lg font-bold tracking-wider hover:underline"
              >
                Player Games
              </button>
              {playersOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border rounded shadow z-10 p-2">
                  <div className="text-xs text-gray-500 mb-2">Games you're part of</div>
                  <ul className="space-y-2">
                    {playerGames.map((g) => (
                      <li key={g.id} className="flex items-center justify-between">
                        <a href={`/g/${g.slug}`} className="text-sm text-indigo-600">{g.title}</a>
                        <a href={`/g/${g.slug}/leaderboard`} className="text-xs text-gray-600 hover:underline">Leaderboard</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Admin-created games dropdown */}
          {adminGames.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setAdminOpen((s) => !s)}
                className="text-lg font-bold tracking-wider hover:underline"
              >
                Your Games
              </button>
              {adminOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white border rounded shadow z-10 p-2">
                  <div className="text-xs text-gray-500 mb-2">Created by you</div>
                  <ul className="space-y-2">
                    {adminGames.map((g) => (
                      <li key={g.id} className="flex items-center justify-between">
                        <a href={`/g/${g.slug}`} className="text-sm text-indigo-600">{g.title}</a>
                        <a href={`/admin/g/${g.slug}`} className="text-xs text-gray-600 hover:underline">Manage</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Submitted games dropdown */}
          {submittedGames.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setSubsOpen((s) => !s)}
                className="text-lg font-bold tracking-wider hover:underline"
              >
                Your Submissions
              </button>
              {subsOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white border rounded shadow z-10 p-2">
                  <div className="text-xs text-gray-500 mb-2">Games you've submitted to</div>
                  <ul className="space-y-2">
                    {submittedGames.map((g) => (
                      <li key={g.id} className="flex items-center justify-between">
                        <a href={`/g/${g.slug}`} className="text-sm text-indigo-600">{g.title}</a>
                        <a href={`/g/${g.slug}/leaderboard`} className="text-xs text-gray-600 hover:underline">Leaderboard</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center space-x-3">
            {user ? (
              <>
                <div className="text-lg font-bold tracking-wider">{user.email}</div>
                {!isAdmin && (
                  <a href="/signup" className="text-lg font-bold">Sign up</a>
                )}
                <button onClick={handleSignOut} className="text-lg font-bold">Log out</button>
              </>
            ) : (
              <>
                <a href="/admin" className="text-lg font-bold">Sign in / Admin</a>
                {!isAdmin && (
                  <a href="/signup" className="text-lg font-bold">Sign up</a>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
