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

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : '')

  const [loading, setLoading] = useState(true)
  const [game, setGame] = useState<Game | null>(null)
  // Public questions must NOT include the correct answer field
  type PublicQuestion = Omit<Question, 'correct_answer'>
  const [questions, setQuestions] = useState<PublicQuestion[]>([])
  // player state: stored in memory and persisted to localStorage so refresh keeps session
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerLoading, setPlayerLoading] = useState(false)

  // answers state: map question_id -> { value: 'A'|'B'|'', loading, error, saved }
  const [answersState, setAnswersState] = useState<Record<string, { value: 'A' | 'B' | ''; loading: boolean; error?: string; saved?: boolean }>>({})
  // tiebreaker answer state (numeric/string guessed value)
  const [tiebreakerState, setTiebreakerState] = useState<{ value: string; loading: boolean; error?: string; saved?: boolean }>({ value: '', loading: false })
  const [submittingAll, setSubmittingAll] = useState(false)
  const [showSubmittedModal, setShowSubmittedModal] = useState(false)

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
      // apply theme for this game
      try {
        const t = (gData as any).theme ?? 'default'
        document.body.dataset.theme = t
      } catch (e) {}
      // Select only the public fields to avoid leaking correct answers
      const { data: qData } = await supabase.from('questions').select('id, prompt, order_index, game_id').eq('game_id', (gData as any).id).order('order_index', { ascending: true })
      if (!mounted) return
      setQuestions((qData as any) ?? [])
      // initialize answers state map
          const map: Record<string, { value: 'A' | 'B' | ''; loading: boolean; saved?: boolean }> = {}
          ;((qData as any) ?? []).forEach((q: Question) => {
            map[q.id] = { value: '', loading: false, saved: false }
          })
      setAnswersState(map)
      setLoading(false)
    }
    load()
    return () => { mounted = false; try { document.body.dataset.theme = 'default' } catch (e) {} }
  }, [slug, supabase])

      // Restore saved answers from DB and any local draft for this player
      useEffect(() => {
        if (!game || !playerId || questions.length === 0) return
        const gid = game.id
        let mounted = true
        async function restore() {
          // restore draft first (so user edits aren't lost)
          try {
            const draftKey = `answersDraft:${gid}:${playerId}`
            const raw = localStorage.getItem(draftKey)
            if (raw) {
              const parsed = JSON.parse(raw)
              // apply parsed answers as unsaved values
              setAnswersState(prev => {
                const next = { ...prev }
                for (const q of questions) {
                  const v = parsed?.answers?.[q.id]
                  if (v !== undefined) next[q.id] = { ...(next[q.id] ?? { value: '', loading: false }), value: v, saved: false }
                }
                return next
              })
              if (parsed?.tiebreaker !== undefined) {
                setTiebreakerState(prev => ({ ...prev, value: String(parsed.tiebreaker), saved: false }))
              }
            }
          } catch (e) {
            // ignore localStorage parse errors
          }

          // then fetch latest saved answers from the DB and merge (DB saved answers should be treated as saved)
          try {
            const { data } = await supabase
              .from('answers')
              .select('*')
              .eq('game_id', gid)
              .eq('player_id', playerId)
              .order('created_at', { ascending: false })

            if (!mounted || !data) return

            // build map of latest per question_id (including tiebreaker where question_id == null)
            const seen = new Set<string>()
            const latestPerQ: Record<string, any> = {}
            let latestTiebreaker: string | undefined
            for (const a of (data as any[])) {
              if (a.question_id === null) {
                if (latestTiebreaker === undefined) latestTiebreaker = a.answer_text
                continue
              }
              const qid = a.question_id
              if (!seen.has(qid)) {
                seen.add(qid)
                latestPerQ[qid] = a
              }
            }

            setAnswersState(prev => {
              const next: any = { ...prev }
              for (const q of questions) {
                const saved = latestPerQ[q.id]
                // prefer unsaved draft in `prev` (if user has edited and not saved), otherwise apply saved DB value
                if (prev[q.id] && prev[q.id].value && !prev[q.id].saved) {
                  // keep draft value
                  next[q.id] = { ...prev[q.id], loading: false }
                } else if (saved) {
                  next[q.id] = { ...(next[q.id] ?? { value: '', loading: false }), value: saved.answer_text as any, saved: true, loading: false }
                } else {
                  next[q.id] = { ...(next[q.id] ?? { value: '', loading: false }), loading: false }
                }
              }
              return next
            })

            if (latestTiebreaker !== undefined) {
              setTiebreakerState(prev => {
                if (prev.value && !prev.saved) return prev // keep draft
                return { ...prev, value: latestTiebreaker, saved: true, loading: false }
              })
            }
          } catch (err) {
            console.error('restore answers error', err)
          }
        }

        restore()
        return () => { mounted = false }
      }, [game, playerId, questions, supabase])

      // persist drafts to localStorage whenever answers/tiebreaker change
      useEffect(() => {
        if (!game || !playerId) return
        const gid = game.id
        try {
          const draftKey = `answersDraft:${gid}:${playerId}`
          const payload: any = { answers: {}, tiebreaker: tiebreakerState.value }
          for (const q of questions) {
            const st = answersState[q.id]
            if (st) payload.answers[q.id] = st.value
          }
          localStorage.setItem(draftKey, JSON.stringify(payload))
        } catch (e) {
          // ignore
        }
      }, [answersState, tiebreakerState, game, playerId, questions])

  if (loading) return <div className="p-8">Loading…</div>
  if (!game) return <div className="p-8">Game not found</div>

  // If game is closed, show friendly closed message and leaderboard link only
  if (!game.is_open) {
    return (
      <div className="container mx-auto p-8">
        <h2 className="text-2xl font-semibold">{game.title}</h2>
        <div className="mt-4 rounded-md bg-yellow-50 border border-yellow-200 p-4 text-yellow-800">
          <div className="font-semibold">This game is closed</div>
          <div className="mt-2">Submissions are no longer accepted. You can still view the leaderboard below.</div>
        </div>
        <div className="mt-6">
          <a href={`/g/${game.slug}/leaderboard`}>View Leaderboard</a>
        </div>
      </div>
    )
  }

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
    if (!game.is_open) return alert('Submissions are closed for this game')
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
      try { localStorage.removeItem(`answersDraft:${game.id}:${playerId}`) } catch (e) {}
    } catch (err: any) {
      setAnswersState(prev => ({ ...prev, [questionId]: { ...prev[questionId], loading: false, error: err?.message ?? 'Submit failed' } }))
    }
  }

  async function handleTiebreakerSubmit() {
    if (!game || !playerId) return
    if (!game.is_open) return alert('Submissions are closed for this game')
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
      try { localStorage.removeItem(`answersDraft:${game.id}:${playerId}`) } catch (e) {}
    } catch (err: any) {
      setTiebreakerState(prev => ({ ...prev, loading: false, error: err?.message ?? 'Submit failed' }))
    }
  }

  async function handleSubmitAll() {
    if (!game || !playerId) return
    if (!game.is_open) return alert('Submissions are closed for this game')
    // ensure all non-saved questions have a selected answer
    const missing = questions.filter(q => !(answersState[q.id]?.saved) && !(answersState[q.id]?.value))
    if (missing.length > 0) {
      return alert('Please answer all questions before submitting')
    }

    // if tiebreaker enabled, ensure it's numeric (if not yet saved)
    if (game.tiebreaker_enabled && game.tiebreaker_prompt && !tiebreakerState.saved) {
      const val = (tiebreakerState.value || '').toString().trim()
      if (!val) return alert('Please enter your tiebreaker answer')
      if (!/^-?\d+(?:\.\d+)?$/.test(val)) return alert('Tiebreaker answer must be a number')
    }

    setSubmittingAll(true)
    try {
      const payloads: any[] = []
      for (const q of questions) {
        const st = answersState[q.id]
        if (!st) continue
        // skip if already saved
        if (st.saved) continue
        payloads.push({ game_id: game.id, player_id: playerId, question_id: q.id, answer_text: st.value })
      }
      if (game.tiebreaker_enabled && game.tiebreaker_prompt && !tiebreakerState.saved) {
        payloads.push({ game_id: game.id, player_id: playerId, question_id: null, answer_text: (tiebreakerState.value || '').toString().trim() })
      }

      if (payloads.length === 0) {
        setSubmittingAll(false)
        return alert('Nothing to submit')
      }

      const { error } = await supabase.from('answers').insert(payloads)
      if (error) throw error

      // show a brief success modal
      try {
        setShowSubmittedModal(true)
        setTimeout(() => setShowSubmittedModal(false), 5000)
      } catch (e) {}

      // mark saved
      const newAnswersState = { ...answersState }
      for (const q of questions) {
        if (newAnswersState[q.id]) newAnswersState[q.id] = { ...newAnswersState[q.id], saved: true, loading: false }
      }
      setAnswersState(newAnswersState)
      if (game.tiebreaker_enabled && game.tiebreaker_prompt) setTiebreakerState(prev => ({ ...prev, saved: true, loading: false }))
      try { localStorage.removeItem(`answersDraft:${game.id}:${playerId}`) } catch (e) {}
    } catch (err: any) {
      alert(err?.message ?? 'Submit failed')
    } finally {
      setSubmittingAll(false)
    }
  }

  // UI
  return (
    <div className="container mx-auto p-8 max-w-3xl">
      {showSubmittedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setShowSubmittedModal(false)} />
          <div role="dialog" aria-modal="true" className="relative bg-white rounded-lg p-6 shadow-lg w-80 text-center text-green-700">
            <div className="text-2xl font-bold">Answers Submitted</div>
            <div className="mt-2 text-sm">Thanks — your answers were submitted successfully.</div>
            <div className="mt-4">
              <button onClick={() => setShowSubmittedModal(false)} className="px-3 py-1 bg-green-600 text-white rounded-md">Close</button>
            </div>
          </div>
        </div>
      )}
      <h2 className="text-5xl font-bold font-heading">Play: {game.title}</h2>
      {!playerId ? (
        <p className="mt-2 text-gray-600">Please enter your first and last name to start the game.</p>
      ) : (
        <div className="mt-3 text-gray-600 text-2xl">
          <p>Answer {game?.option_a_emoji ? game.option_a_emoji + ' ' : ''}{game?.option_a_label ?? 'Option A'} or {game?.option_b_emoji ? game.option_b_emoji + ' ' : ''}{game?.option_b_label ?? 'Option B'} for each question.</p>
          <p className="mt-3">Each correct answer earns one point. The player with the most correct answers wins the game.</p>
          {game?.tiebreaker_enabled && game?.tiebreaker_prompt && (
            <div className="mt-3">
              <p className="font-medium">Tiebreaker: {game.tiebreaker_prompt}</p>
              <p className="mt-1">Enter a numeric guess. When players are tied, the player whose guess is closest to the correct answer wins the tie (exact answer is not shown).</p>
            </div>
          )}
        </div>
      )}
      <p className="mt-5 text-gray-600 text-2xl"><b>Invite people to:</b> <br/><code className="text-2xl">{siteUrl}/g/{game.slug}</code></p>

      {!game.is_open && (
        <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-red-700">
          <div className="font-semibold">Submissions are now closed</div>
          <div className="text-sm">This game is not accepting answers. You can still view the leaderboard.</div>
        </div>
      )}

      {/* If no playerId, show join form */}
      {!playerId ? (
        <section className="mt-6 max-w-md">
          <h3 className="text-xl font-medium">Join game</h3>
          <form onSubmit={handleJoin} className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium">First name</label>
              <input name="first_name" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium">Last name</label>
              <input name="last_name" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
            </div>
            <div>
              <button type="submit" className="btn-primary" disabled={playerLoading}>
                {playerLoading ? 'Joining…' : 'Start Game'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        // Player exists: show questions and answer inputs
        <section className="mt-8">
          <h3 className="text-2xl font-semibold">Questions</h3>
          <ul className="mt-3 space-y-5">
            {questions.length === 0 && <li className="text-lg text-gray-600">No questions yet</li>}
                {questions.map((q) => {
              const st = answersState[q.id] ?? { value: '', loading: false }
              return (
                <li key={q.id} className="rounded px-5 py-8 question-card">
                  <h4 className="text-lg font-bold">Question {q.order_index + 1}</h4>
                  <div className="mt-1 font-medium text-lg">{q.prompt}</div>
                  <div className="mt-3 flex items-center space-x-2">
                    <div className="flex items-center space-x-4">
                      {/* Use game's option labels dynamically; store values as 'A'/'B' */}
                      <button
                        type="button"
                        onClick={() => setAnswersState(prev => ({ ...prev, [q.id]: { ...(prev[q.id] ?? { value: '' , loading: false}), value: 'A', saved: false } }))}
                        disabled={st.saved || !game.is_open}
                        aria-pressed={st.value === 'A'}
                        className={`inline-flex items-center space-x-2 px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-offset-1 option-button ${st.value === 'A' ? 'selected' : ''}`}
                      >
                        <span>{game?.option_a_emoji ? game.option_a_emoji + ' ' : ''}{game?.option_a_label ?? 'Option A'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnswersState(prev => ({ ...prev, [q.id]: { ...(prev[q.id] ?? { value: '' , loading: false}), value: 'B', saved: false } }))}
                        disabled={st.saved || !game.is_open}
                        aria-pressed={st.value === 'B'}
                        className={`inline-flex items-center space-x-2 px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-offset-1 option-button ${st.value === 'B' ? 'selected' : ''}`}
                      >
                        <span>{game?.option_b_emoji ? game.option_b_emoji + ' ' : ''}{game?.option_b_label ?? 'Option B'}</span>
                      </button>
                    </div>
                    <div className="px-3 py-1 rounded-md text-sm">
                      {st.saved ? (
                        <div className="flex items-center space-x-2">
                          <span className="text-green-600">Saved</span>
                          {game.is_open && (
                            <button
                              onClick={() => setAnswersState(prev => ({ ...prev, [q.id]: { ...(prev[q.id] ?? { value: '', loading: false }), saved: false } }))}
                              className="text-sm px-2 py-1 bg-yellow-400 text-black rounded-md"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600">Not saved</span>
                      )}
                    </div>
                  </div>
                  {st.error && <div className="mt-2 text-sm text-red-600">{st.error}</div>}
                </li>
              )
            })}
            {game.tiebreaker_enabled && game.tiebreaker_prompt && (
              <li key="tiebreaker" className="rounded px-5 py-8 question-card">
                <h4 className="text-lg font-bold">Tiebreaker</h4>
                <div className="mt-1 font-medium text-lg">{game.tiebreaker_prompt}</div>
                <div className="mt-3 flex items-center space-x-2">
                  <input
                    type="number"
                    value={tiebreakerState.value}
                    onChange={(e) => setTiebreakerState(prev => ({ ...prev, value: e.target.value, saved: false }))}
                    className="block w-48 rounded-md border-gray-300 shadow-sm"
                    disabled={tiebreakerState.saved || !game.is_open}
                    placeholder="Your guess"
                  />
                  {tiebreakerState.saved ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-green-600">Saved</span>
                      {game.is_open && (
                        <button
                          onClick={() => setTiebreakerState(prev => ({ ...prev, saved: false }))}
                          className="text-sm px-2 py-1 bg-yellow-400 text-black rounded-md"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  ) : (
                    (game.is_open ? (
                      <button
                        onClick={() => handleTiebreakerSubmit()}
                        className="px-3 py-1 bg-indigo-600 text-white rounded-md"
                        disabled={tiebreakerState.loading}
                      >
                        {tiebreakerState.loading ? 'Saving…' : 'Submit'}
                      </button>
                    ) : (
                      <span className="text-sm text-gray-500">Submissions closed</span>
                    ))
                  )}
                </div>
                {tiebreakerState.error && <div className="mt-2 text-sm text-red-600">{tiebreakerState.error}</div>}
              </li>
            )}
          </ul>

            <div className="mt-6 flex items-center space-x-4">
              {game.is_open && (
                <button
                  onClick={() => handleSubmitAll()}
                  className="btn-primary"
                  disabled={submittingAll}
                >
                  {submittingAll ? 'Submitting…' : 'Submit All Answers'}
                </button>
              )}

              {questions.length > 0 && (
                <a href={`/g/${game.slug}/leaderboard`} className="btn-secondary">View Leaderboard</a>
              )}
            </div>
        </section>
      )}
    </div>
  )
}
