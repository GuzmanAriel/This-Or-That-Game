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
  // admin auth
  const [checkingUser, setCheckingUser] = useState(true)
  const [user, setUser] = useState<any | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)

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
  const [tiebreakerEditing, setTiebreakerEditing] = useState(false)

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
      try {
        const t = (gData as any).theme ?? 'default'
        document.body.dataset.theme = t
      } catch (e) {}

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
    return () => { mounted = false; try { document.body.dataset.theme = 'default' } catch (e) {} }
  }, [slug, supabase])

  useEffect(() => {
    let mounted = true
    async function checkAuth() {
      try {
        const { data } = await supabase.auth.getUser()
        if (!mounted) return
        setUser(data.user ?? null)
      } catch (err) {
        if (!mounted) return
        setUser(null)
      } finally {
        if (mounted) setCheckingUser(false)
      }
    }
    checkAuth()
    return () => { mounted = false }
  }, [supabase])

  useEffect(() => {
    // generate QR data URL for the public play link using the local `qrcode` package
    let mounted = true
    async function gen() {
      if (!game?.slug) return
      try {
        const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
        const target = siteUrl ? `${siteUrl}/g/${game.slug}` : `${window.location.origin}/g/${game.slug}`
        const mod = await import('qrcode')
        const dataUrl = await mod.toDataURL(target, { width: 400 })
        if (!mounted) return
        setQrDataUrl(dataUrl)
      } catch (err) {
        console.error('Failed to generate QR', err)
        if (mounted) setQrDataUrl(null)
      }
    }
    gen()
    return () => { mounted = false }
  }, [game?.slug])

  if (!slug) {
    return <div className="p-8">Missing slug</div>
  }

  if (loading) {
    return <div className="p-8">Loading…</div>
  }

  if (!game) {
    return <div className="p-8">Game not found</div>
  }

  if (checkingUser) return <div className="p-8">Checking auth…</div>
  if (!user) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-semibold">Admin — Sign in required</h2>
        <p className="mt-4">You must be signed in as an admin to manage this game.</p>
        <div className="mt-4">
          <a href="/admin">Go to Admin sign-in</a>
        </div>
      </div>
    )
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
        // tiebreaker fields managed separately in Questions list
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

  async function handleSaveTiebreaker() {
    if (!game) return
    setSavingLabels(true)
    try {
      if (tiebreakerEnabledLocal) {
        const raw = tiebreakerAnswerLocal
        if (raw === '' || !Number.isFinite(Number(raw))) {
          setError('Tiebreaker answer must be a number')
          setSavingLabels(false)
          return
        }
      }
      const updatePayload: any = {
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
      setTiebreakerEditing(false)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save tiebreaker')
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

  async function handleCopyUrl() {
    if (!game) return
    try {
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
      const target = siteUrl ? `${siteUrl}/g/${game.slug}` : `${window.location.origin}/g/${game.slug}`
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(target)
      } else {
        const ta = document.createElement('textarea')
        ta.value = target
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch (e) {
      console.error('Copy failed', e)
    }
  }

  return (
    <div className="container mx-auto px-8 pt-16 pb-8">
      <div className="mt-6 flex flex-col md:flex-row md:items-start md:space-x-12">
        <div className="mb-6 md:w-1/2">
          <h1 className="text-3xl font-bold">Manage Game</h1>
          <div className="mt-3 rounded border p-4">
            <div className="mt-4">
              <div>
                <div className="text-2xl font-semibold mb-2">{game.title}</div>
                <div className={`text-lg font-semibold mb-2 ${game.is_open ? 'text-green-600' : 'text-red-600'}`}>Status: {game.is_open ? 'Open' : 'Closed'}</div>
                <div className="text-md font-semibold">Public play link:</div>
                <div className="mb-3"><a href={`/g/${game.slug}`}>{`/g/${game.slug}`}</a></div>
                <div className="mt-2 text-md font-semibold">Leaderboard</div>
                <div className="mt-1 text-md"><a href={`/g/${game.slug}/leaderboard`}>{`/g/${game.slug}/leaderboard`}</a></div>
              
                <div className="mt-4">
                  {!editingLabels ? (
                    <div className="space-y-2">
                      <div>
                        <div className="text-md font-semibold">Option A label</div>
                        <div className="mt-1 text-gray-900">{optionAEmoji ? optionAEmoji + ' ' : ''}{optionA || 'Option A'}</div>
                      </div>
                      <div>
                        <div className="text-md font-semibold">Option B label</div>
                        <div className="mt-1 text-gray-900">{optionBEmoji ? optionBEmoji + ' ' : ''}{optionB || 'Option B'}</div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <button className="text-lg text-indigo-600 hover:underline" onClick={() => setEditingLabels(true)}>Edit labels</button>
                        <button
                          className="text-lg text-red-600"
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
                        <label className="block text-md font-semibold">Option A label</label>
                        <div className="flex items-center space-x-2">
                          <input value={optionA} onChange={(e) => setOptionA(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
                          <EmojiPicker value={optionAEmoji} onChange={setOptionAEmoji} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-md font-semibold">Option B label</label>
                        <div className="flex items-center space-x-2">
                          <input value={optionB} onChange={(e) => setOptionB(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
                          <EmojiPicker value={optionBEmoji} onChange={setOptionBEmoji} />
                        </div>
                      </div>
                      {/* Tiebreaker is edited inline under Questions */}
                      <div className="flex items-center space-x-2">
                        <button type="submit" disabled={savingLabels} className="btn-primary">
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
                <div className="mt-5 space-x-3">
                  <a className="btn-primary" href={`/g/${game.slug}`}>Player link</a>
                  <a className="btn-primary" href={`/g/${game.slug}/leaderboard`}>Leaderboard</a>
                </div>
              </div>

              <div className="text-center mt-6">
                {/* QR code suitable for printing; SITE URL is read from NEXT_PUBLIC_SITE_URL. Uses local qrcode to create a data URI. */}
                <div>
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR code" className="mx-auto" />
                  ) : (
                    <div className="h-40 w-40 mx-auto bg-gray-100 flex items-center justify-center">QR</div>
                  )}
                  <div className="mt-2 text-sm break-all">{qrDataUrl ? undefined : `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/g/${game.slug}`}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button onClick={() => window.print()} className="btn-primary">Print</button>
                    <button onClick={handleCopyUrl} className="btn-primary">Copy URL</button>
                    {qrDataUrl ? (
                      <button
                        onClick={() => {
                          try {
                            const link = document.createElement('a')
                            link.href = qrDataUrl
                            link.download = `${game?.slug ?? 'qr'}-qr.png`
                            document.body.appendChild(link)
                            link.click()
                            link.remove()
                          } catch (e) {
                            console.error('Download failed', e)
                          }
                        }}
                        className="btn-primary"
                      >
                        Download
                      </button>
                    ) : (
                      <button disabled className="btn-primary opacity-50 cursor-not-allowed">Download</button>
                    )}
                    {copiedUrl && <span className="ml-2 text-sm text-green-600">Copied!</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="md:w-1/2">
          <h2 className="text-3xl font-bold mb-3">Questions</h2>

          <ul className="space-y-2">
            {questions.length === 0 && <li className="text-sm text-gray-600">No questions yet</li>}
            {questions.map((q) => {
              const e = editing[q.id]
              return (
                <li key={q.id} className="rounded border p-3 question-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-lg font-bold">Question {q.order_index}</h4>
                      {!e ? (
                        <div className="mt-1 font-medium text-lg">{q.prompt}</div>
                      ) : (
                        <div className="mt-1">
                          <input value={e.prompt} onChange={(ev) => setEditing(prev => ({ ...prev, [q.id]: { ...prev[q.id], prompt: ev.target.value } }))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
                        </div>
                      )}
                      {/* Show friendly label for the stored correct answer (maps 'mom'/'dad' to option labels) */}
                      {!e ? (
                        <div className="mt-1 font-medium text-lg">Answer: {q.correct_answer === 'mom' ? (optionAEmoji ? optionAEmoji + ' ' : '') + (optionA || 'Option A') : (q.correct_answer === 'dad' ? (optionBEmoji ? optionBEmoji + ' ' : '') + (optionB || 'Option B') : q.correct_answer)}</div>
                      ) : (
                        <div className="mt-2 flex items-center space-x-4">
                          <button
                            type="button"
                            onClick={() => setEditing(prev => ({ ...prev, [q.id]: { ...prev[q.id], correct: 'mom' } }))}
                            className={`inline-flex items-center space-x-2 px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-offset-1 option-button ${e.correct === 'mom' ? 'selected' : ''}`}
                          >
                            <span>{optionAEmoji ? optionAEmoji + ' ' : ''}{optionA || 'Option A'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(prev => ({ ...prev, [q.id]: { ...prev[q.id], correct: 'dad' } }))}
                            className={`inline-flex items-center space-x-2 px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-offset-1 option-button ${e.correct === 'dad' ? 'selected' : ''}`}
                          >
                            <span>{optionBEmoji ? optionBEmoji + ' ' : ''}{optionB || 'Option B'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      {!e ? (
                        <button className="text-sm btn-primary hover:underline" onClick={() => setEditing(prev => ({ ...prev, [q.id]: { prompt: q.prompt, correct: q.correct_answer === 'mom' ? 'mom' : 'dad', saving: false } }))}>Edit</button>
                      ) : (
                        <div className="space-x-2">
                          <button className="text-sm text-green-600" onClick={async () => {
                            // save edit
                            setEditing(prev => ({ ...prev, [q.id]: { ...(prev[q.id]), saving: true } }))
                            try {
                              const { error } = await supabase.from('questions').update({ prompt: e.prompt.trim(), correct_answer: e.correct }).eq('id', q.id)
                              if (error) throw error
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
            {game.tiebreaker_enabled !== undefined && (
              <li key="tiebreaker" className="rounded border p-3 question-card">
                {!tiebreakerEditing ? (
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-lg font-bold">Tiebreaker</h4>
                      <div className="mt-1 font-medium text-lg">{game.tiebreaker_prompt || 'No prompt set'}</div>
                      {typeof (game as any).tiebreaker_answer !== 'undefined' && (game as any).tiebreaker_answer !== null && (
                        <div className="mt-1 text-sm text-gray-600">Answer (admin): {(game as any).tiebreaker_answer}</div>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <div className="space-x-2">
                        <button className="btn-primary" onClick={() => setTiebreakerEditing(true)}>Edit</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={tiebreakerEnabledLocal} onChange={(e) => setTiebreakerEnabledLocal(e.target.checked)} />
                          <span className="text-md font-semibold">Tiebreaker enabled</span>
                        </label>
                      </div>
                      <div>
                        <label className="block text-md font-semibold">Tiebreaker question</label>
                        <input value={tiebreakerPrompt} onChange={(e) => setTiebreakerPrompt(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
                      </div>
                      <div>
                        <label className="block text-md font-semibold">Tiebreaker answer (number)</label>
                        <input type="number" value={tiebreakerAnswerLocal as any} onChange={(e) => setTiebreakerAnswerLocal(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
                      </div>
                      <div className="mt-2 space-x-2">
                        <button className="px-3 py-1 btn-primary" onClick={async () => { await handleSaveTiebreaker() }}>Save</button>
                        <button className="px-3 py-1 inline-flex items-center rounded border" onClick={() => {
                          // cancel edits: restore from `game`
                          setTiebreakerEnabledLocal(Boolean((game as any)?.tiebreaker_enabled))
                          setTiebreakerPrompt((game as any)?.tiebreaker_prompt ?? '')
                          setTiebreakerAnswerLocal((game as any)?.tiebreaker_answer ?? '')
                          setTiebreakerEditing(false)
                        }}>Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            )}
          </ul>

          <form onSubmit={handleAddQuestion} className="mt-6 space-y-3">
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">Prompt</label>
              <input id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
            </div>

            <div>
              <div className="text-sm font-medium text-gray-700">Correct answer</div>
              <div className="mt-1 flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => setCorrect('mom')}
                  className={`inline-flex items-center space-x-2 px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-offset-1 option-button ${correct === 'mom' ? 'selected' : ''}`}
                >
                  <span>{optionAEmoji ? optionAEmoji + ' ' : ''}{optionA || 'Option A'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCorrect('dad')}
                  className={`inline-flex items-center space-x-2 px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-offset-1 option-button ${correct === 'dad' ? 'selected' : ''}`}
                >
                  <span>{optionBEmoji ? optionBEmoji + ' ' : ''}{optionB || 'Option B'}</span>
                </button>
              </div>
            </div>

            {formError && <div className="text-sm text-red-600">{formError}</div>}

            <div>
              <button type="submit" disabled={submitting} className="btn-primary mt-4">
                {submitting ? 'Adding…' : 'Add question'}
              </button>
            </div>
          </form>
        </section>

      </div>
      
    </div>
  )
}
