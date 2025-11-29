"use client"

import React, { useEffect, useState } from 'react'
import { getSupabaseClient } from '../../../lib/supabase'
import type { Game, Question } from '../../../lib/types'

// Player / Answer types used locally in the UI
interface Player {
  id: string
  game_id: string
  first_name: string
  last_name?: string
}

interface AnswerRecord {
  id?: string
  game_id: string
  player_id: string
  question_id?: string | null
  answer_text: string
}

type Props = { params: { slug: string } }

export default function GamePage({ params }: Props) {
  const { slug } = params
  const supabase = getSupabaseClient()

  const [loading, setLoading] = useState(true)
  const [game, setGame] = useState<Game | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  // player state: stored in memory and persisted to localStorage so refresh keeps session
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerLoading, setPlayerLoading] = useState(false)

  // answers state: map question_id -> { value: 'A'|'B'|'', loading, error, saved }
  const [answersState, setAnswersState] = useState<Record<string, { value: 'A' | 'B' | ''; loading: boolean; error?: string; saved?: boolean }>>({})
  // tiebreaker answer state (numeric/string guessed value)
  const [tiebreakerState, setTiebreakerState] = useState<{ value: string; loading: boolean; error?: string; saved?: boolean }>({ value: '', loading: false })

  // check for existing player id in localStorage for this game
  useEffect(() => {
    if (!game) return
    try {
      const key = `playerId:${game.id}`
      const stored = localStorage.getItem(key)
      if (stored) setPlayerId(stored)
    } catch (e) {
      // ignore localStorage errors
    }
  }, [game])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      const { data: gData } = await supabase.from('games').select('*').eq('slug', slug).limit(1).maybeSingle()
      if (!mounted) return
      if (!gData) {
        setGame(null)
        setQuestions([])
        setLoading(false)
        return
      }
      setGame(gData as Game)
      const { data: qData } = await supabase.from('questions').select('*').eq('game_id', (gData as any).id).order('order_index', { ascending: true })
      if (!mounted) return
      setQuestions((qData as any) ?? [])
      // initialize answers state map
      const map: Record<string, { value: 'A' | 'B' | ''; loading: boolean }> = {}
      ;((qData as any) ?? []).forEach((q: Question) => {
        map[q.id] = { value: '', loading: false }
      })
      setAnswersState(map)
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [slug, supabase])

  if (loading) return <div className="p-8">Loading…</div>
  if (!game) return <div className="p-8">Game not found</div>

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!game) return
    const form = e.target as HTMLFormElement
    const f = new FormData(form)
    const first_name = String(f.get('first_name') || '').trim()
    const last_name = String(f.get('last_name') || '').trim()
    if (!first_name) return alert('Please enter your first name')

    setPlayerLoading(true)
    try {
      // try to find an existing player for this game with same names
      const { data: existing } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', game.id)
        .eq('first_name', first_name)
        .eq('last_name', last_name)
        .limit(1)
        .maybeSingle()

      let pid: string
      if (existing) {
        pid = (existing as any).id
      } else {
        const { data: inserted, error } = await supabase
          .from('players')
          .insert({ game_id: game.id, first_name, last_name })
          .select()
          .limit(1)
          .maybeSingle()
        if (error) throw error
        pid = (inserted as any).id
      }

      setPlayerId(pid)
      try { localStorage.setItem(`playerId:${game.id}`, pid) } catch (e) {}
    } catch (err: any) {
      console.error('join error', err)
      alert(err?.message || 'Failed to join')
    } finally {
      setPlayerLoading(false)
    }
  }

  async function handleAnswerSubmit(questionId: string) {
    if (!game || !playerId) return
    const state = answersState[questionId]
    if (!state || state.value === '') return alert('Please select an answer')

    // set loading for this question
    setAnswersState(prev => ({ ...prev, [questionId]: { ...prev[questionId], loading: true, error: undefined } }))
    try {
      const payload: AnswerRecord = {
        game_id: game.id,
        player_id: playerId,
        question_id: questionId,
        answer_text: state.value as string
      }
      const { error } = await supabase.from('answers').insert(payload)
      if (error) throw error
      setAnswersState(prev => ({ ...prev, [questionId]: { ...prev[questionId], loading: false, saved: true } }))
    } catch (err: any) {
      setAnswersState(prev => ({ ...prev, [questionId]: { ...prev[questionId], loading: false, error: err?.message ?? 'Submit failed' } }))
    }
  }

  async function handleTiebreakerSubmit() {
    if (!game || !playerId) return
    if (!game.tiebreaker_enabled) return
    const val = tiebreakerState.value?.trim()
    if (!val) return alert('Please enter your tiebreaker answer')

    // only allow numeric answers
    if (!/^-?\d+(?:\.\d+)?$/.test(val)) {
      return alert('Tiebreaker answer must be a number')
    }

    setTiebreakerState(prev => ({ ...prev, loading: true, error: undefined }))
    try {
      const payload = {
        game_id: game.id,
        player_id: playerId,
        question_id: null,
        answer_text: val
      }
      const { error } = await supabase.from('answers').insert(payload)
      if (error) throw error
      setTiebreakerState(prev => ({ ...prev, loading: false, saved: true }))
    } catch (err: any) {
      setTiebreakerState(prev => ({ ...prev, loading: false, error: err?.message ?? 'Submit failed' }))
    }
  }

  // UI
  return (
    <div className="container mx-auto p-8">
      <h2 className="text-2xl font-semibold">Play: {game.title}</h2>
      <p className="mt-2 text-gray-600">Invite people to: <code className="text-sm">/g/{game.slug}</code></p>

      {/* If no playerId, show join form */}
      {!playerId ? (
        <section className="mt-6 max-w-md">
          <h3 className="text-lg font-medium">Join game</h3>
          <form onSubmit={handleJoin} className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium">First name</label>
              <input name="first_name" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium">Last name</label>
              <input name="last_name" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
            <div>
              <button type="submit" className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md" disabled={playerLoading}>
                {playerLoading ? 'Joining…' : 'Start Game'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        // Player exists: show questions and answer inputs
        <section className="mt-6">
          <h3 className="text-lg font-semibold">Questions</h3>
          <ul className="mt-3 space-y-3">
            {questions.length === 0 && <li className="text-sm text-gray-600">No questions yet</li>}
            {questions.map((q) => {
              const st = answersState[q.id] ?? { value: '', loading: false }
              return (
                <li key={q.id} className="rounded border p-3">
                  <div className="text-sm text-gray-500">#{q.order_index}</div>
                  <div className="mt-1 font-medium">{q.prompt}</div>
                  <div className="mt-3 flex items-center space-x-2">
                    <div className="flex items-center space-x-4">
                      {/* Use game's option labels dynamically; store values as 'A'/'B' */}
                      <label className="inline-flex items-center space-x-2">
                        <input
                          type="radio"
                          name={`answer-${q.id}`}
                          value="A"
                          checked={st.value === 'A'}
                          onChange={() => setAnswersState(prev => ({ ...prev, [q.id]: { ...(prev[q.id] ?? { value: '' }), value: 'A' } }))}
                          disabled={st.saved}
                        />
                        <span>{game?.option_a_label ?? 'Option A'}</span>
                      </label>
                      <label className="inline-flex items-center space-x-2">
                        <input
                          type="radio"
                          name={`answer-${q.id}`}
                          value="B"
                          checked={st.value === 'B'}
                          onChange={() => setAnswersState(prev => ({ ...prev, [q.id]: { ...(prev[q.id] ?? { value: '' }), value: 'B' } }))}
                          disabled={st.saved}
                        />
                        <span>{game?.option_b_label ?? 'Option B'}</span>
                      </label>
                    </div>
                    <button
                      onClick={() => handleAnswerSubmit(q.id)}
                      className="px-3 py-1 bg-indigo-600 text-white rounded-md"
                      disabled={st.loading || st.saved}
                    >
                      {st.loading ? 'Saving…' : st.saved ? 'Saved' : 'Submit'}
                    </button>
                  </div>
                  {st.error && <div className="mt-2 text-sm text-red-600">{st.error}</div>}
                </li>
              )
            })}
            {game.tiebreaker_enabled && game.tiebreaker_prompt && (
              <li key="tiebreaker" className="rounded border p-3">
                <div className="text-sm font-medium">Tiebreaker</div>
                <div className="mt-1 text-sm">{game.tiebreaker_prompt}</div>
                <div className="mt-3 flex items-center space-x-2">
                  <input
                    type="number"
                    value={tiebreakerState.value}
                    onChange={(e) => setTiebreakerState(prev => ({ ...prev, value: e.target.value }))}
                    className="block w-48 rounded-md border-gray-300 shadow-sm"
                    disabled={tiebreakerState.saved}
                    placeholder="Your guess"
                  />
                  <button
                    onClick={() => handleTiebreakerSubmit()}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-md"
                    disabled={tiebreakerState.loading || tiebreakerState.saved}
                  >
                    {tiebreakerState.loading ? 'Saving…' : tiebreakerState.saved ? 'Saved' : 'Submit'}
                  </button>
                </div>
                {tiebreakerState.error && <div className="mt-2 text-sm text-red-600">{tiebreakerState.error}</div>}
              </li>
            )}
          </ul>

          {questions.length > 0 && (
            <div className="mt-6">
              <a href={`/g/${game.slug}/leaderboard`} className="text-indigo-600">View Leaderboard</a>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
