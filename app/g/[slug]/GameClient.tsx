"use client"

import React, { useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '../../../lib/supabase'
import type { Game, Question } from '../../../lib/types'
import QuestionCard from '../../components/QuestionCard'
import Modal from '../../components/Modal'

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

export default function GameClient({ params }: Props) {
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
  const [playerMatches, setPlayerMatches] = useState<any[] | null>(null)

  // answers state: map question_id -> { value: 'A'|'B'|'', loading, error, saved }
  const [answersState, setAnswersState] = useState<Record<string, { value: 'A' | 'B' | ''; loading: boolean; error?: string; saved?: boolean }>>({})
  // tiebreaker answer state (numeric/string guessed value)
  const [tiebreakerState, setTiebreakerState] = useState<{ value: string; loading: boolean; error?: string; saved?: boolean }>({ value: '', loading: false })
  const [submittingAll, setSubmittingAll] = useState(false)
  const [showSubmittedModal, setShowSubmittedModal] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  // validation / progress UI state
  const [validationSummary, setValidationSummary] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const errorSummaryRef = useRef<HTMLDivElement | null>(null)

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

  const hasTiebreaker = Boolean((game as any)?.tiebreaker_prompt) || (((game as any)?.tiebreaker_answer !== undefined) && (game as any)?.tiebreaker_answer !== null && String((game as any)?.tiebreaker_answer).trim() !== '')

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
    if (!first_name || !last_name) return alert('Please enter your first and last name')

    setPlayerLoading(true)
    try {
      // find players with the same exact name for this game
      const { data: found } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', game.id)
        .eq('first_name', first_name)
        .eq('last_name', last_name)

      if (found && (found as any[]).length >= 1) {
        // ask user to confirm which entry to use (or create new)
        setPlayerMatches(found as any[])
        setPlayerLoading(false)
        return
      }

      // No existing matches — create a new player
      const { data: inserted, error } = await supabase
        .from('players')
        .insert({ game_id: game.id, first_name, last_name })
        .select()
        .limit(1)
        .maybeSingle()
      if (error) throw error
      const pid = (inserted as any).id

      setPlayerId(pid)
      try { localStorage.setItem(`playerId:${game.id}`, pid) } catch (e) {}
    } catch (err: any) {
      console.error('join error', err)
      alert(err?.message || 'Failed to join')
    } finally {
      setPlayerLoading(false)
    }
  }

  function handleSelectPlayerFromMatches(pid: string) {
    if (!game) return
    setPlayerId(pid)
    try { localStorage.setItem(`playerId:${game.id}`, pid) } catch (e) {}
    setPlayerMatches(null)
  }

  async function handleCreateNewPlayerFromMatches() {
    if (!game) return
    // create new player even though name matches existing rows
    setPlayerLoading(true)
    try {
      const form = document.querySelector('form') as HTMLFormElement | null
      const f = form ? new FormData(form) : null
      const first_name = String(f?.get('first_name') || '').trim()
      const last_name = String(f?.get('last_name') || '').trim()
      const { data: inserted, error } = await supabase
        .from('players')
        .insert({ game_id: game.id, first_name, last_name })
        .select()
        .limit(1)
        .maybeSingle()
      if (error) throw error
      const pid = (inserted as any).id
      setPlayerId(pid)
      try { localStorage.setItem(`playerId:${game.id}`, pid) } catch (e) {}
      setPlayerMatches(null)
    } catch (err: any) {
      console.error('create new player error', err)
      alert(err?.message ?? 'Failed to create player')
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
    // Tiebreaker submission is handled by Submit All; keep function empty to avoid accidental usage.
  }

  async function handleSubmitAll(e?: React.FormEvent) {
    // called as form submit handler: prevent default
    try { e?.preventDefault?.() } catch (err) {}
    if (!game || !playerId) return
    if (!game.is_open) return alert('Submissions are closed for this game')
    // ensure all questions have a selected answer (we don't consider saved flag here)
    const missing = questions.filter(q => !(answersState[q.id]?.value))
    if (missing.length > 0) {
      // build validation errors map
      const errs: Record<string, string> = {}
      missing.forEach(q => { errs[q.id] = 'Please select an option.' })
      setValidationErrors(errs)
      setValidationSummary(`You still have ${missing.length} question${missing.length === 1 ? '' : 's'} left to answer.`)
      // Move focus to the error summary (rendered inside the form) after render
      try {
        setTimeout(() => {
          try { errorSummaryRef.current?.focus() } catch (e) {}
        }, 50)
      } catch (err) {}
      return
    }

    // if a tiebreaker prompt exists, ensure it's numeric (if not yet saved)
    if (game.tiebreaker_prompt && !tiebreakerState.saved) {
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
      if (game.tiebreaker_prompt && !tiebreakerState.saved) {
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
      if (game.tiebreaker_prompt) setTiebreakerState(prev => ({ ...prev, saved: true, loading: false }))
      try { localStorage.removeItem(`answersDraft:${game.id}:${playerId}`) } catch (e) {}
    } catch (err: any) {
      alert(err?.message ?? 'Submit failed')
    } finally {
      setSubmittingAll(false)
    }
  }

  // UI
  return (
    <div className="container mx-auto p-8 max-w-3xl" data-page="game">
      {showSubmittedModal && (
        <Modal ariaLabel="Answers submitted" onClose={() => setShowSubmittedModal(false)}>
          <div className="text-2xl font-bold text-green-700">Answers Submitted</div>
          <div className="mt-2 text-sm text-green-700">Thanks — your answers were submitted successfully.</div>
          <div className="mt-4">
            <button onClick={() => setShowSubmittedModal(false)} className="px-3 py-1 bg-green-600 text-white rounded-md">Close</button>
          </div>
        </Modal>
      )}
      <h2 className="text-5xl font-bold font-heading">Play: {game.title}</h2>
      <div className="mt-3 flex items-center justify-between">
        <div aria-live="polite" className="text-lg text-gray-700">{`${questions.filter(q => answersState[q.id]?.value).length} of ${questions.length} questions answered`}</div>
      </div>
      {/* Validation summary is rendered inside the form so we can move focus
          to it when validation fails. See form rendering below. */}
      {!playerId ? (
        <p className="mt-2 text-lg">Please enter your first and last name to start the game.</p>
      ) : (
        <div className="mt-3 text-2xl">
          <p>Answer {game?.option_a_emoji && <span aria-hidden="true">{game.option_a_emoji} </span>}{game?.option_a_label ?? 'Option A'} or {game?.option_b_emoji && <span aria-hidden="true">{game.option_b_emoji} </span>}{game?.option_b_label ?? 'Option B'} for each question.</p>
          <p className="mt-3">Each correct answer earns one point. The player with the most correct answers wins the game.</p>
          {game?.tiebreaker_prompt && (
            <div className="mt-3">
              <p className="font-medium">Tiebreaker: {game.tiebreaker_prompt}</p>
              <p className="mt-1">Enter a numeric guess. When players are tied, the player whose guess is closest to the correct answer wins the tie (exact answer is not shown).</p>
            </div>
          )}
        </div>
      )}

      {!game.is_open && (
        <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-red-700">
          <div className="font-semibold">Submissions are now closed</div>
          <div className="text-sm">This game is not accepting answers. You can still view the leaderboard.</div>
        </div>
      )}

      {/* If no playerId, show join form */}
      {!playerId ? (
        <section className="mt-6 max-w-md">
          {playerMatches && playerMatches.length > 0 ? (
            <div>
              <h3 className="text-xl font-bold">Multiple players found</h3>
              <p className="mt-2 text-sm text-gray-600">We found multiple players with that name for this game — choose the correct entry or create a new player.</p>
              <ul className="mt-4 space-y-2">
                {playerMatches.map((p) => (
                  <li key={p.id} className="flex items-center justify-between border rounded p-3">
                    <div>
                      <div className="font-medium">{p.first_name} {p.last_name}</div>
                      <div className="text-xs text-gray-500">Joined: {p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <button onClick={() => handleSelectPlayerFromMatches(p.id)} className="btn-primary">Continue</button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center space-x-2">
                <button onClick={handleCreateNewPlayerFromMatches} className="btn-primary">Create new player</button>
                <button onClick={() => setPlayerMatches(null)} className="btn-cancel">Cancel</button>
              </div>
            </div>
          ) : (
          <>
          <h3 className="text-xl font-bold">Join game</h3>
          <form onSubmit={handleJoin} className="mt-4 space-y-3">
            <div>
              <label className="block text-md font-semibold">First name</label>
              <input name="first_name" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
            </div>
            <div>
              <label className="block text-md font-semibold">Last name</label>
              <input name="last_name" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
            </div>
            <div>
              <button type="submit" className="btn-primary" disabled={playerLoading}>
                {playerLoading ? 'Joining…' : 'Start Game'}
              </button>
            </div>
          </form>

          <div className="mt-8 text-2xl">
            <h3 className="font-bold">Invite people to:</h3>
            <div className="mt-2">
              <code className="text-lg break-all">{siteUrl}/g/{game.slug}</code>
              <br/>
              <button
                onClick={async () => {
                  const url = `${siteUrl}/g/${game.slug}`
                  try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      await navigator.clipboard.writeText(url)
                    } else {
                      const ta = document.createElement('textarea')
                      ta.value = url
                      document.body.appendChild(ta)
                      ta.select()
                      document.execCommand('copy')
                      ta.remove()
                    }
                    setCopiedUrl(true)
                    setTimeout(() => setCopiedUrl(false), 2000)
                  } catch (e) {
                    console.error('Copy failed', e)
                    alert('Copy failed')
                  }
                }}
                className="btn-primary mt-3 block"
                aria-label="Copy game URL"
              >
                Copy URL
              </button>
              {copiedUrl && <span className="text-sm text-green-600">Copied!</span>}
            </div>
          </div>
          </>
          )}
        </section>
      ) : (
        // Player exists: show questions and answer inputs
        <section className="mt-8">
          <h3 className="text-2xl font-semibold">Questions</h3>
          <form onSubmit={handleSubmitAll}>
            {/* Error summary (focusable) shown when validationSummary is set */}
            {validationSummary && (
              <div
                id="error-summary"
                ref={errorSummaryRef}
                tabIndex={-1}
                className="mt-3 rounded-md bg-red-200 border border-red-200 p-3 text-red-800"
                role="group"
                aria-labelledby="error-summary-title"
              >
                <p id="error-summary-title" className="font-semibold">{`You still have ${questions.filter(q => !answersState[q.id]?.value).length} question${questions.filter(q => !answersState[q.id]?.value).length === 1 ? '' : 's'} left to answer.`}</p>
                <div className="mt-2">
                  <button
                    type="button"
                    className="underline text-sm"
                    onClick={() => {
                      const first = questions.find(q => !answersState[q.id]?.value)
                      if (!first) return
                      const el = document.getElementById(`question-container-${first.id}`)
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        try { ;(el as HTMLElement).focus() } catch (e) {}
                      }
                    }}
                  >
                    Go to first unanswered question
                  </button>
                </div>
              </div>
            )}
            <div className="mt-3 space-y-5">
            {questions.length === 0 && <div className="text-lg text-gray-600">No questions yet</div>}
                {questions.map((q) => {
                  const st = answersState[q.id] ?? { value: '', loading: false }
                  return (
                    <div key={q.id} id={`question-container-${q.id}`} tabIndex={-1}>
                    <QuestionCard key={q.id} id={q.id} footer={validationErrors[q.id] ? (<div id={`error-${q.id}`} className="text-sm text-red-600">{validationErrors[q.id]}</div>) : undefined}>
                        <fieldset className="border-0 p-0" role="radiogroup" aria-labelledby={`question-${q.id}`} aria-invalid={validationErrors[q.id] ? 'true' : undefined} aria-describedby={validationErrors[q.id] ? `error-${q.id}` : undefined}>
                          <legend id={`question-${q.id}`}>
                            <h4 className="text-lg font-bold">Question {q.order_index + 1}</h4>
                            <div className="text-lg font-medium">{q.prompt}</div>
                          </legend>
                          <div className="mt-3 flex items-center space-x-4">
                            <label className={`inline-flex items-center space-x-2 px-3 py-2 rounded-md border option-button ${st.value === 'A' ? 'selected' : ''}`}> 
                              <input
                                className="sr-only"
                                type="radio"
                                name={`q-${q.id}`}
                                value="A"
                                aria-labelledby={`question-${q.id} question-${q.id}-option-A`}
                                checked={st.value === 'A'}
                                disabled={!game.is_open}
                                aria-invalid={validationErrors[q.id] ? 'true' : undefined}
                                aria-describedby={validationErrors[q.id] ? `error-${q.id}` : undefined}
                                onChange={() => {
                                  setAnswersState(prev => ({ ...prev, [q.id]: { ...(prev[q.id] ?? { value: '' , loading: false}), value: 'A', saved: false } }))
                                  setValidationErrors(prev => {
                                    const next = { ...prev }
                                    delete next[q.id]
                                    if (Object.keys(next).length === 0) setValidationSummary(null)
                                    return next
                                  })
                                }}
                              />
                              <span id={`question-${q.id}-option-A`}>{game?.option_a_emoji && <span aria-hidden="true">{game.option_a_emoji} </span>}{game?.option_a_label ?? 'Option A'}</span>
                            </label>
                            <label className={`inline-flex items-center space-x-2 px-3 py-2 rounded-md border option-button ${st.value === 'B' ? 'selected' : ''}`}> 
                              <input
                                className="sr-only"
                                type="radio"
                                name={`q-${q.id}`}
                                value="B"
                                aria-labelledby={`question-${q.id} question-${q.id}-option-B`}
                                checked={st.value === 'B'}
                                disabled={!game.is_open}
                                aria-invalid={validationErrors[q.id] ? 'true' : undefined}
                                aria-describedby={validationErrors[q.id] ? `error-${q.id}` : undefined}
                                onChange={() => {
                                  setAnswersState(prev => ({ ...prev, [q.id]: { ...(prev[q.id] ?? { value: '' , loading: false}), value: 'B', saved: false } }))
                                  setValidationErrors(prev => {
                                    const next = { ...prev }
                                    delete next[q.id]
                                    if (Object.keys(next).length === 0) setValidationSummary(null)
                                    return next
                                  })
                                }}
                              />
                              <span id={`question-${q.id}-option-B`}>{game?.option_b_emoji && <span aria-hidden="true">{game.option_b_emoji} </span>}{game?.option_b_label ?? 'Option B'}</span>
                            </label>
                          </div>
                        </fieldset>
                    </QuestionCard>
                    </div>
                  )
                })}
            {game.tiebreaker_prompt && (
              <QuestionCard key="tiebreaker" id="tiebreaker" footer={tiebreakerState.error}>
                  <h4 id={`tiebreaker-${game.id}-label`} className="text-lg font-bold">Tiebreaker</h4>
                  <div id={`tiebreaker-${game.id}-prompt`} className="mt-1 font-medium text-lg">{game.tiebreaker_prompt}</div>
                  <div className="mt-3">
                    <input
                      type="number"
                      aria-labelledby={`tiebreaker-${game.id}-label tiebreaker-${game.id}-prompt`}
                      value={tiebreakerState.value}
                      onChange={(e) => setTiebreakerState(prev => ({ ...prev, value: e.target.value, saved: false }))}
                      className="block w-48 rounded-md border-gray-300 shadow-sm p-2"
                      disabled={tiebreakerState.saved || !game.is_open}
                      placeholder="Your guess"
                    />
                    {tiebreakerState.saved ? (
                      <div className="space-x-2">
                        <span className="text-green-600">Saved</span>
                        {game.is_open && (
                          <button
                            onClick={() => setTiebreakerState(prev => ({ ...prev, saved: false }))}
                            className="btn-primary text-sm"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    ) : (
                      game.is_open ? (
                        <div className="text-sm text-gray-600 mt-2">Will be submitted with "Submit All Answers"</div>
                      ) : (
                        <span className="text-sm text-gray-500">Submissions closed</span>
                      )
                    )}
                  </div>
              </QuestionCard>
            )}
            </div>

            <div className="mt-6 flex items-center space-x-4">
              {game.is_open && (
                <button
                  type="submit"
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
          </form>
        </section>
      )}
    </div>
  )
}
