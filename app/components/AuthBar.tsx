"use client"

import React, { useEffect, useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '../../lib/supabaseClient'
import MobileMenu from './MobileMenu'

export default function AuthBar() {
  const supabase = useMemo(() => getSupabaseClient(), [])
  const [user, setUser] = useState<any | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement | null>(null)
  const openedByKeyboard = useRef(false)

  // Menu data for admin-created games and games this user submitted to
  const [adminGames, setAdminGames] = useState<any[]>([])
  const [submittedGames, setSubmittedGames] = useState<any[]>([])
  const [loadingMenus, setLoadingMenus] = useState(false)
  
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
    <div className="w-full border-b authbar shadow-sm relative" data-component="authbar">
      <div className="container mx-auto px-3 py-5 flex flex-wrap items-center justify-between font-heading">
        <a href="#main-content" className="w-full mb-2 p-2 z-50 absolute top-2 text-md transform -translate-y-12 focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:relative focus:top-0">Skip to main content</a>
        {/* Brand / home link */}
          <div className="flex items-center space-x-4">
          <Link href="/" className="text-2xl font-semibold tracking-widest">🎉 This OR That</Link>
        </div>

        {/* Navigation / menus */}
          <div className="flex items-center space-x-6 desktop-nav">
            <Link href="/" className="text-md font-bold tracking-wider hover:underline">Home</Link>
            {isAdmin ? (
              <Link href="/admin" className="text-md font-bold tracking-wider hover:underline">Admin</Link>
            ) : null}

          {/* Player games (from localStorage) - shown even when not signed in */}
          {playerGames.length > 0 && (
            <div className="relative">
              <button className="text-md font-bold tracking-wider hover:underline">Player Games</button>
              <div className="absolute right-0 top-full mt-0 w-64 bg-white border rounded shadow z-10 p-4 submenu">
                <div className="text-md mb-2 font-bold text-gray-500">Games you're part of</div>
                <ul className="space-y-2">
                  {playerGames.map((g) => (
                    <li key={g.id} className="flex items-center justify-between">
                        <Link href={`/g/${g.slug}`} className="text-sm font-semibold">{g.title}</Link>
                      </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Admin-created games dropdown */}
          {adminGames.length > 0 && (
            <div className="relative">
              <button className="text-md font-bold tracking-wider hover:underline">Your Games</button>
              <div className="absolute right-0 top-full mt-0 w-60 bg-white border rounded shadow z-10 p-2 submenu">
                <div className="text-md mb-2 font-bold text-gray-500">Created by you</div>
                <ul className="space-y-2">
                  {adminGames.map((g) => (
                      <li key={g.id} className="flex items-center justify-between">
                      <Link href={`/g/${g.slug}`} className="text-sm font-semibold">{g.title}</Link>
                      <Link href={`/admin/g/${g.slug}`} className="text-xs text-gray-600 hover:underline">Manage</Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Submitted games dropdown */}
          {submittedGames.length > 0 && (
            <div className="relative">
              <button className="text-md font-bold tracking-wider hover:underline">Your Submissions</button>
              <div className="absolute right-0 top-full mt-0 w-60 bg-white border rounded shadow z-10 p-2 submenu">
                <div className="text-xs text-gray-500 mb-2">Games you've submitted to</div>
                <ul className="space-y-2">
                  {submittedGames.map((g) => (
                      <li key={g.id} className="flex items-center justify-between">
                      <Link href={`/g/${g.slug}`} className="text-sm">{g.title}</Link>
                      <Link href={`/g/${g.slug}/leaderboard`} className="text-xs text-gray-600 hover:underline">Leaderboard</Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-3">
            {user ? (
              <>
                {!isAdmin && (
                  <Link href="/signup" className="text-lg font-bold">Sign up</Link>
                )}
                <button onClick={handleSignOut} className="text-lg font-bold">Log out</button>
              </>
            ) : (
              <>
                <Link href="/admin" className="text-lg font-bold">Sign in / Admin</Link>
                {!isAdmin && (
                  <Link href="/signup" className="text-lg font-bold">Sign up</Link>
                )}
              </>
            )}
          </div>
         
        </div>
         <button
            ref={toggleRef}
            onClick={() => { openedByKeyboard.current = false; setMobileOpen((s) => !s) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                openedByKeyboard.current = true
                setMobileOpen((s) => !s)
                e.preventDefault()
              }
            }}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label="Toggle navigation"
            className="mobile-toggle p-2 rounded"
          >
            {mobileOpen ? (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
          <MobileMenu
            open={mobileOpen}
            onClose={() => {
              setMobileOpen(false)
              // return focus to the toggle button when menu closes
              try { toggleRef.current?.focus() } catch (e) {}
              openedByKeyboard.current = false
            }}
            focusOnOpen={openedByKeyboard.current}
            user={user}
            isAdmin={isAdmin}
            playerGames={playerGames}
            adminGames={adminGames}
            submittedGames={submittedGames}
            onSignOut={handleSignOut}
          />
      </div>
    </div>
  )
}
