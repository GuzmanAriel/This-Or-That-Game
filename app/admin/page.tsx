"use client"

import React, { useEffect, useState } from 'react'
import EmojiPicker from '../components/EmojiPicker'
import { getSupabaseClient } from '../../lib/supabase'
import type { Game } from '../../lib/types'
import { loginWithEmail } from '../../auth';

export default function AdminPage() {
  const supabase = getSupabaseClient()

  const [checking, setChecking] = useState(true)
  const [user, setUser] = useState<any | null>(null)

  // auth form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // create game form
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [optionAEmoji, setOptionAEmoji] = useState<string | null>(null)
  const [optionBEmoji, setOptionBEmoji] = useState<string | null>(null)
  const [theme, setTheme] = useState<'default' | 'baby-autumn'>('default')
  const [tiebreakerEnabled, setTiebreakerEnabled] = useState(false)
  const [tiebreakerAnswer, setTiebreakerAnswer] = useState<number | ''>('')
  const [tiebreakerPrompt, setTiebreakerPrompt] = useState('')
  const [optionALabel, setOptionALabel] = useState('')
  const [optionBLabel, setOptionBLabel] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ slug: string } | null>(null)
  // list of games created by this admin
  const [games, setGames] = useState<Game[]>([])
  const [gamesLoading, setGamesLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    async function checkUser() {
      setChecking(true)
      const { data, error } = await supabase.auth.getUser()
      if (!mounted) return
      if (error) {
        setUser(null)
      } else {
        setUser(data.user ?? null)
      }
      setChecking(false)
    }
    checkUser()
    const { data: listener } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setUser(session?.user ?? null)
    })
    return () => {
      mounted = false
      listener?.subscription?.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    // fetch games when user becomes available
    if (!user) {
      setGames([])
      return
    }
    let mounted = true
    async function fetchGames() {
      setGamesLoading(true)
      const { data, error } = await supabase.from('games').select('*').eq('created_by', user.id).order('created_at', { ascending: false })
      if (!mounted) return
      if (error) {
        setGames([])
      } else {
        setGames((data as Game[]) ?? [])
      }
      setGamesLoading(false)
    }
    fetchGames()
    return () => { mounted = false }
  }, [user, supabase])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setAuthError(null)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setAuthError(error.message)
        return
      }
      setUser(data.user ?? null)
      setEmail('')
      setPassword('')
    } catch (err: any) {
      setAuthError(err?.message ?? 'Sign in failed')
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  async function handleCreateGame(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSuccess(null)

    if (!title.trim() || !slug.trim()) {
      setFormError('Title and slug are required')
      return
    }

    if (!optionALabel.trim() || !optionBLabel.trim()) {
      setFormError('Option A and Option B labels are required')
      return
    }

    if (tiebreakerEnabled && tiebreakerAnswer === '') {
      setFormError('Tiebreaker answer is required when tiebreaker is enabled')
      return
    }

    // ensure numeric tiebreaker answer
    if (tiebreakerEnabled && tiebreakerAnswer !== '' && !Number.isFinite(Number(tiebreakerAnswer))) {
      setFormError('Tiebreaker answer must be a number')
      return
    }

    if (tiebreakerEnabled && !tiebreakerPrompt.trim()) {
      setFormError('Tiebreaker question is required when tiebreaker is enabled')
      return
    }

    const payload: any = {
      title: title.trim(),
      slug: slug.trim().toLowerCase(),
      is_open: Boolean(isOpen),
      tiebreaker_enabled: Boolean(tiebreakerEnabled)
    }
    payload.theme = theme
    payload.option_a_label = optionALabel.trim()
    payload.option_b_label = optionBLabel.trim()
    payload.option_a_emoji = optionAEmoji ?? null
    payload.option_b_emoji = optionBEmoji ?? null
    if (tiebreakerEnabled) payload.tiebreaker_prompt = tiebreakerPrompt.trim()
    if (optionALabel.trim()) payload.option_a_label = optionALabel.trim()
    if (optionBLabel.trim()) payload.option_b_label = optionBLabel.trim()
    if (tiebreakerEnabled) {
      payload.tiebreaker_answer = tiebreakerAnswer === '' ? null : Number(tiebreakerAnswer)
    }

    try {
      // include access token for server to verify admin
      const session = await supabase.auth.getSession()
      const token = session.data?.session?.access_token

      const res = await fetch('/api/admin/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      })

      const result = await res.json()
      if (!res.ok) {
        setFormError(result?.error || 'Failed to create game')
        return
      }

      const created = result.game
      setSuccess({ slug: created.slug })
      setTitle('')
      setSlug('')
      setIsOpen(true)
      setOptionALabel('')
      setOptionBLabel('')
      setOptionAEmoji(null)
      setOptionBEmoji(null)
      setTheme('default')
      setTiebreakerPrompt('')
      setTiebreakerEnabled(false)
      setTiebreakerAnswer('')
      // refresh games list
      const { data: refreshed, error: refreshedErr } = await supabase.from('games').select('*').eq('created_by', created.created_by ?? user?.id).order('created_at', { ascending: false })
      if (!refreshedErr) setGames((refreshed as Game[]) ?? [])
    } catch (err: any) {
      setFormError(err?.message ?? 'Request failed')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const data = await loginWithEmail(email, password);
      setMessage('Login successful');
    } catch (err: any) {
      setMessage(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="container mx-auto px-8 pt-16 pb-8 max-w-lg">
        <h2 className="text-2xl font-semibold font-heading">Admin Login</h2>
        <p className="mt-4">Loading…</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-8 pt-16 pb-8 max-w-2xl">
      <h2 className="text-2xl font-semibold font-heading">Admin Login</h2>

      {!user ? (
        <form onSubmit={handleSignIn} className="mt-6 max-w-md">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
            />
          </div>
          <div className="mt-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
            />
          </div>
          {authError && <p className="mt-2 text-sm text-red-600">{authError}</p>}
          <div className="mt-6">
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Sign in
            </button>
          </div>

          {/* new: link to sign up page */}
          <p className="mt-4 text-sm">
            Don't have an account? <a href="/signup">Create one</a>
          </p>
        </form>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="text-sm">Logged in as <strong>{user.email}</strong></div>
            <button
              onClick={handleSignOut}
              className="text-sm text-red-600 hover:underline"
            >
              Log out
            </button>
          </div>

          <form onSubmit={handleCreateGame} className="max-w-lg space-y-4">
            <div className="rounded-md border p-3 bg-gray-50 text-sm text-gray-700">
              <div className="font-medium">Field guide</div>
              <div className="mt-2 space-y-1">
                <div>• <strong>Title</strong>: Display name shown to players and on leaderboards.</div>
                <div>• <strong>Slug</strong>: URL identifier used at <span className="font-mono">/g/[slug]</span>; use lowercase and hyphens.</div>
                <div>• <strong>Option A / Option B</strong>: The two choices players will pick between.</div>
                <div>• <strong>Open</strong>: When enabled players can submit responses; when disabled the game is closed to submissions.</div>
                <div>• <strong>Tiebreaker</strong>: Optional numeric question to break ties — provide a prompt and the correct number.</div>
              </div>
            </div>
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Title
              </label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Displayed on the public game page and leaderboards.</p>
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
                Slug
              </label>
              <input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Used in the URL <span className="font-mono">/g/[slug]</span>. Make it unique, lowercase, and URL-friendly (use hyphens).</p>
            </div>

            <div>
              <label htmlFor="theme" className="block text-sm font-medium text-gray-700">
                Theme
              </label>
              <select
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'default' | 'baby-autumn')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
              >
                <option value="default">Default</option>
                <option value="baby-autumn">Baby Autumn</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">Choose a visual theme for this game. "Baby Autumn" uses a warm display font.</p>
            </div>

            <div>
              <label htmlFor="optionA" className="block text-sm font-medium text-gray-700">Option A label</label>
              <div className="flex items-center space-x-2">
                <input id="optionA" value={optionALabel} onChange={(e) => setOptionALabel(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                <EmojiPicker value={optionAEmoji} onChange={setOptionAEmoji} />
              </div>
              <p className="mt-1 text-xs text-gray-500">Label shown as one of the two choices players pick (e.g. "Mom"). Optional emoji appears before the label.</p>
            </div>

            <div>
              <label htmlFor="optionB" className="block text-sm font-medium text-gray-700">Option B label</label>
              <div className="flex items-center space-x-2">
                <input id="optionB" value={optionBLabel} onChange={(e) => setOptionBLabel(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                <EmojiPicker value={optionBEmoji} onChange={setOptionBEmoji} />
              </div>
              <p className="mt-1 text-xs text-gray-500">Label shown as the second choice players pick (e.g. "Dad"). Optional emoji appears before the label.</p>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={isOpen}
                  onChange={(e) => setIsOpen(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Open</span>
              </label>
              <p className="mt-1 text-xs text-gray-500">When checked, players can submit answers to this game. Uncheck to close submissions.</p>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={tiebreakerEnabled}
                  onChange={(e) => setTiebreakerEnabled(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Tiebreaker enabled</span>
              </label>
              <p className="mt-1 text-xs text-gray-500">Enable an optional numeric tiebreaker question to rank guesses when players tie.</p>
            </div>

            {tiebreakerEnabled && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="tiebreakerPrompt" className="block text-sm font-medium text-gray-700">
                    Tiebreaker question
                  </label>
                  <input
                    id="tiebreakerPrompt"
                    type="text"
                    value={tiebreakerPrompt}
                    onChange={(e) => setTiebreakerPrompt(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Short prompt shown to players (e.g. "How many candies are in the jar?").</p>
                </div>
                <div>
                  <label htmlFor="tiebreaker" className="block text-sm font-medium text-gray-700">
                    Tiebreaker answer (number)
                  </label>
                  <input
                    id="tiebreaker"
                    type="number"
                    value={tiebreakerAnswer}
                    onChange={(e) => setTiebreakerAnswer(e.target.value === '' ? '' : Number(e.target.value))}
                    className="mt-1 block w-40 rounded-md border-gray-300 shadow-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">The numeric correct answer used to rank tiebreaker guesses (required if tiebreaker enabled).</p>
                </div>
              </div>
            )}

            {formError && <p className="text-sm text-red-600">{formError}</p>}
            {success && (
              <div className="rounded-md border p-3 bg-green-50 text-sm">
                Game created: <strong>{success.slug}</strong>
                <div className="mt-2">
                  <a href={`/g/${success.slug}`}>/g/{success.slug}</a>
                </div>
                <div>
                  <a href={`/g/${success.slug}/leaderboard`}>/g/{success.slug}/leaderboard</a>
                </div>
              </div>
            )}

            <div>
              <button type="submit" className="btn-primary">Create game</button>
            </div>
          </form>

          <div className="mt-6">
            <h3 className="text-lg font-medium">Your games</h3>
            {gamesLoading ? (
              <p className="mt-2">Loading games…</p>
            ) : games.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">You haven't created any games yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {games.map((g) => (
                  <li key={g.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <a href={`/g/${g.slug}`} className="font-medium">{g.title}</a>
                      <div className="text-sm text-gray-500">/{g.slug}</div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <a href={`/admin/g/${g.slug}`} className="text-sm text-gray-700 hover:underline">Manage</a>
                      <a href={`/g/${g.slug}/leaderboard`} className="text-sm text-gray-700 hover:underline">Leaderboard</a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {message && <p>{message}</p>}
    </div>
  )
}

