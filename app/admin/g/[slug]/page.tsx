"use client"

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getSupabaseClient } from '../../../../lib/supabase'
import type { Game, Question } from '../../../../lib/types'
import EmojiPicker from '../../../components/EmojiPicker'

export default function AdminGamePage() {
  const params = useParams() as { slug?: string }
  const slug = params?.slug ?? ''
  const supabase = getSupabaseClient()

  const [loading, setLoading] = useState(true)
  const [game, setGame] = useState<Game | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [error, setError] = useState<string | null>(null)

  // option labels for the game (editable by admin)
  const [optionA, setOptionA] = useState('')
  const [optionB, setOptionB] = useState('')
  const [optionAEmoji, setOptionAEmoji] = useState<string | null>(null)
  const [optionBEmoji, setOptionBEmoji] = useState<string | null>(null)
  const [savingLabels, setSavingLabels] = useState(false)
  const [tiebreakerEnabledLocal, setTiebreakerEnabledLocal] = useState(false)
  const [tiebreakerAnswerLocal, setTiebreakerAnswerLocal] = useState<number | ''>('')
  const [tiebreakerPrompt, setTiebreakerPrompt] = useState('')
  const [editingLabels, setEditingLabels] = useState(false)
  const [togglingOpen, setTogglingOpen] = useState(false)


  // new question form
  const [prompt, setPrompt] = useState('')
  const [correct, setCorrect] = useState<'mom' | 'dad'>('mom')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  // editing existing questions
  const [editing, setEditing] = useState<Record<string, { prompt: string; correct: 'mom' | 'dad'; saving: boolean; error?: string }>>({})

  useEffect(() => {
    if (!slug) return
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)

      const gResp = await supabase
        .from('games')
        .select('*')
        .eq('slug', slug)
        .limit(1)
        .maybeSingle()
      const gData = gResp.data as Game | null
      const gErr = gResp.error

      if (!mounted) return
      if (gErr) {
        setError('Failed to load game')
        setLoading(false)
        return
      }
      if (!gData) {
        setGame(null)
        setQuestions([])
        setLoading(false)
        return
      }

      setGame(gData)

      // initialize label inputs and tiebreaker fields from game
      setOptionA((gData as any).option_a_label ?? '')
      setOptionB((gData as any).option_b_label ?? '')
      setOptionAEmoji((gData as any).option_a_emoji ?? null)
      setOptionBEmoji((gData as any).option_b_emoji ?? null)
      setTiebreakerEnabledLocal(Boolean((gData as any).tiebreaker_enabled))
      setTiebreakerAnswerLocal((gData as any).tiebreaker_answer ?? '')
      setTiebreakerPrompt((gData as any).tiebreaker_prompt ?? '')

      const qResp = await supabase
        .from('questions')
        .select('*')
        .eq('game_id', gData.id)
        .order('order_index', { ascending: true })
      const qData = qResp.data as Question[] | null
      const qErr = qResp.error

      if (!mounted) return
      if (qErr) {
        setError('Failed to load questions')
        setQuestions([])
      } else {
        setQuestions(qData ?? [])
      }

      setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [slug, supabase])

  if (!slug) {
    return <div className="p-8">Missing slug</div>
  }

  if (loading) {
    return <div className="p-8">Loading…</div>
  }

  if (!game) {
    return <div className="p-8">Game not found</div>
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      // include current session token so server can verify admin identity
      const session = await supabase.auth.getSession()
      const token = session.data?.session?.access_token
      if (!token) {
        setFormError('Authentication required — please sign in')
        setSubmitting(false)
        return
      }

      const gameId = game!.id
      const res = await fetch(`/api/admin/games/${gameId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: prompt.trim(), correct_answer: correct })
      })
      const body = await res.json()
      if (!res.ok) {
        setFormError(body?.error || 'Failed to add question')
        setSubmitting(false)
        return
      }

      // refresh questions
      const qResp = await supabase
        .from('questions')
        .select('*')
        .eq('game_id', gameId)
        .order('order_index', { ascending: true })
      const qData = qResp.data as Question[] | null
      const qErr = qResp.error

      if (qErr) {
        setFormError('Question added but failed to reload list')
      } else {
        setQuestions(qData ?? [])
        setPrompt('')
        setCorrect('mom')
      }
    } catch (err: any) {
      setFormError(err?.message ?? 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveLabels(e: React.FormEvent) {
    e.preventDefault()
    if (!game) return
    setSavingLabels(true)
    try {
      // validate tiebreaker numeric when enabled
      if (tiebreakerEnabledLocal) {
        const raw = tiebreakerAnswerLocal
        if (raw === '' || !Number.isFinite(Number(raw))) {
          setError('Tiebreaker answer must be a number')
          setSavingLabels(false)
          return
        }
      }
      const updatePayload: any = {
        option_a_label: optionA || null,
        option_b_label: optionB || null,
        option_a_emoji: optionAEmoji ?? null,
        option_b_emoji: optionBEmoji ?? null,
        tiebreaker_enabled: Boolean(tiebreakerEnabledLocal),
        tiebreaker_prompt: tiebreakerPrompt || null,
        tiebreaker_answer: tiebreakerEnabledLocal ? (tiebreakerAnswerLocal === '' ? null : Number(tiebreakerAnswerLocal)) : null
      }

      const { data, error } = await supabase
        .from('games')
        .update(updatePayload)
        .eq('id', game.id)
        .select()
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (data) setGame(data as Game)
      // exit edit mode after successful save
      setEditingLabels(false)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save labels')
    } finally {
      setSavingLabels(false)
    }
  }

  async function handleToggleOpen() {
    if (!game) return
    setTogglingOpen(true)
    try {
      const { data, error } = await supabase
        .from('games')
        .update({ is_open: !game.is_open })
        .eq('id', game.id)
        .select()
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (data) setGame(data as Game)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update game status')
    } finally {
      setTogglingOpen(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Manage Game</h1>
        <div className="mt-3 rounded border p-4">
          <div className="text-lg font-semibold">{game.title}</div>
          <div className="text-sm text-gray-600">Slug: {game.slug}</div>
          <div className="text-sm">Status: {game.is_open ? 'Open' : 'Closed'}</div>
          {game.tiebreaker_enabled && game.tiebreaker_prompt && (
            <div className="mt-2 text-sm text-gray-700">
              <div className="font-medium">Tiebreaker</div>
              <div className="mt-1">{game.tiebreaker_prompt}</div>
            </div>
          )}
          <div className="mt-3">
            {!editingLabels ? (
              <div className="space-y-2">
                <div>
                  <div className="text-sm font-medium text-gray-700">Option A label</div>
                  <div className="mt-1 text-gray-900">{optionAEmoji ? optionAEmoji + ' ' : ''}{optionA || 'Option A'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Option B label</div>
                  <div className="mt-1 text-gray-900">{optionBEmoji ? optionBEmoji + ' ' : ''}{optionB || 'Option B'}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="text-sm text-indigo-600" onClick={() => setEditingLabels(true)}>Edit labels</button>
                  <button
                    className="text-sm text-red-600"
                    onClick={handleToggleOpen}
                    disabled={togglingOpen}
                  >
                    {togglingOpen ? (game.is_open ? 'Closing…' : 'Re-opening…') : (game.is_open ? 'Close submissions' : 'Re-open submissions')}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveLabels} className="space-y-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Option A label</label>
                  <div className="flex items-center space-x-2">
                    <input value={optionA} onChange={(e) => setOptionA(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    <EmojiPicker value={optionAEmoji} onChange={setOptionAEmoji} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Option B label</label>
                  <div className="flex items-center space-x-2">
                    <input value={optionB} onChange={(e) => setOptionB(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    <EmojiPicker value={optionBEmoji} onChange={setOptionBEmoji} />
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={tiebreakerEnabledLocal} onChange={(e) => setTiebreakerEnabledLocal(e.target.checked)} />
                    <span className="text-sm">Tiebreaker enabled</span>
                  </label>
                </div>
                {tiebreakerEnabledLocal && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tiebreaker question</label>
                      <input value={tiebreakerPrompt} onChange={(e) => setTiebreakerPrompt(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tiebreaker answer (number)</label>
                      <input type="number" value={tiebreakerAnswerLocal} onChange={(e) => setTiebreakerAnswerLocal(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 block w-40 rounded-md border-gray-300 shadow-sm" />
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <button type="submit" disabled={savingLabels} className="inline-flex items-center px-3 py-1 rounded bg-indigo-600 text-white">
                    {savingLabels ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" className="inline-flex items-center px-3 py-1 rounded border" onClick={() => {
                    // cancel edits: reset fields from `game` and exit edit mode
                    setOptionA((game as any)?.option_a_label ?? '')
                    setOptionB((game as any)?.option_b_label ?? '')
                      setOptionAEmoji((game as any)?.option_a_emoji ?? null)
                      setOptionBEmoji((game as any)?.option_b_emoji ?? null)
                    setTiebreakerEnabledLocal(Boolean((game as any)?.tiebreaker_enabled))
                    setTiebreakerPrompt((game as any)?.tiebreaker_prompt ?? '')
                    setTiebreakerAnswerLocal((game as any)?.tiebreaker_answer ?? '')
                    setEditingLabels(false)
                  }}>Cancel</button>
                </div>
              </form>
            )}
          </div>
          <div className="mt-2 space-x-3">
            <a className="text-indigo-600" href={`/g/${game.slug}`}>Player link</a>
            <a className="text-indigo-600" href={`/g/${game.slug}/leaderboard`}>Leaderboard</a>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-3">Questions</h2>

        <ul className="space-y-2">
          {questions.length === 0 && <li className="text-sm text-gray-600">No questions yet</li>}
          {questions.map((q) => {
            const e = editing[q.id]
            return (
              <li key={q.id} className="rounded border p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-gray-500">#{q.order_index}</div>
                    {!e ? (
                      <div className="mt-1">{q.prompt}</div>
                    ) : (
                      <div className="mt-1">
                        <input value={e.prompt} onChange={(ev) => setEditing(prev => ({ ...prev, [q.id]: { ...prev[q.id], prompt: ev.target.value } }))} className="block w-full rounded-md border-gray-300 shadow-sm" />
                      </div>
                    )}
                    {/* Show friendly label for the stored correct answer (maps 'mom'/'dad' to option labels) */}
                    {!e ? (
                      <div className="mt-1 text-sm text-gray-700">Answer: {q.correct_answer === 'mom' ? (optionAEmoji ? optionAEmoji + ' ' : '') + (optionA || 'Option A') : (q.correct_answer === 'dad' ? (optionBEmoji ? optionBEmoji + ' ' : '') + (optionB || 'Option B') : q.correct_answer)}</div>
                    ) : (
                      <div className="mt-2 flex items-center space-x-4">
                        <label className="flex items-center space-x-2">
                          <input type="radio" name={`edit-correct-${q.id}`} checked={e.correct === 'mom'} onChange={() => setEditing(prev => ({ ...prev, [q.id]: { ...prev[q.id], correct: 'mom' } }))} />
                            <span className="text-sm">{optionAEmoji ? optionAEmoji + ' ' : ''}{optionA || 'Option A'}</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="radio" name={`edit-correct-${q.id}`} checked={e.correct === 'dad'} onChange={() => setEditing(prev => ({ ...prev, [q.id]: { ...prev[q.id], correct: 'dad' } }))} />
                            <span className="text-sm">{optionBEmoji ? optionBEmoji + ' ' : ''}{optionB || 'Option B'}</span>
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 text-right">
                    {!e ? (
                      <button className="text-sm text-indigo-600 hover:underline" onClick={() => setEditing(prev => ({ ...prev, [q.id]: { prompt: q.prompt, correct: q.correct_answer === 'mom' ? 'mom' : 'dad', saving: false } }))}>Edit</button>
                    ) : (
                      <div className="space-x-2">
                        <button className="text-sm text-green-600" onClick={async () => {
                          // save edit
                          setEditing(prev => ({ ...prev, [q.id]: { ...(prev[q.id]), saving: true } }))
                          try {
                            const { error } = await supabase.from('questions').update({ prompt: e.prompt.trim(), correct_answer: e.correct }).eq('id', q.id)
                            if (error) throw error
                            // refresh questions
                            const qResp = await supabase.from('questions').select('*').eq('game_id', game!.id).order('order_index', { ascending: true })
                            setQuestions(qResp.data ?? [])
                            setEditing(prev => { const n = { ...prev }; delete n[q.id]; return n })
                          } catch (err: any) {
                            setEditing(prev => ({ ...prev, [q.id]: { ...(prev[q.id]), saving: false, error: err?.message ?? 'Save failed' } }))
                          }
                        }}>Save</button>
                        <button className="text-sm text-red-600" onClick={() => setEditing(prev => { const n = { ...prev }; delete n[q.id]; return n })}>Cancel</button>
                      </div>
                    )}
                  </div>
                </div>
                {e?.error && <div className="mt-2 text-sm text-red-600">{e.error}</div>}
              </li>
            )
          })}
        </ul>

        <form onSubmit={handleAddQuestion} className="mt-6 space-y-3">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">Prompt</label>
            <input id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700">Correct answer</div>
            <div className="mt-1 flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input type="radio" name="correct" checked={correct === 'mom'} onChange={() => setCorrect('mom')} />
                <span className="text-sm">{optionAEmoji ? optionAEmoji + ' ' : ''}{optionA || 'Option A'}</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="radio" name="correct" checked={correct === 'dad'} onChange={() => setCorrect('dad')} />
                <span className="text-sm">{optionBEmoji ? optionBEmoji + ' ' : ''}{optionB || 'Option B'}</span>
              </label>
            </div>
          </div>

          {formError && <div className="text-sm text-red-600">{formError}</div>}

          <div>
            <button type="submit" disabled={submitting} className="inline-flex items-center px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">
              {submitting ? 'Adding…' : 'Add question'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
