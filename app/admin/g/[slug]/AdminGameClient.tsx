"use client"

import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { getSupabaseClient } from '../../../../lib/supabase'
import type { Game, Question } from '../../../../lib/types'
import EmojiPicker from '../../../components/EmojiPicker'
import QuestionCard from '../../../components/QuestionCard'

export default function AdminGameClient() {
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
  
  const [tiebreakerAnswerLocal, setTiebreakerAnswerLocal] = useState<number | ''>('')
  const [tiebreakerPrompt, setTiebreakerPrompt] = useState('')
  const [tiebreakerError, setTiebreakerError] = useState<string | null>(null)
  const [tiebreakerPromptInvalid, setTiebreakerPromptInvalid] = useState(false)
  const [tiebreakerAnswerInvalid, setTiebreakerAnswerInvalid] = useState(false)
  const [editingLabels, setEditingLabels] = useState(false)
  const [tiebreakerEditing, setTiebreakerEditing] = useState(false)

  const [togglingOpen, setTogglingOpen] = useState(false)

  const optionARef = useRef<HTMLInputElement | null>(null)
  const optionBRef = useRef<HTMLInputElement | null>(null)
  const editButtonRef = useRef<HTMLButtonElement | null>(null)
  const editInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const editButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [focusReturnId, setFocusReturnId] = useState<string | null>(null)
  const tiebreakerPromptRef = useRef<HTMLInputElement | null>(null)
  const tiebreakerAnswerRef = useRef<HTMLInputElement | null>(null)


  // new question form
  const [prompt, setPrompt] = useState('')
  const [correct, setCorrect] = useState<'A' | 'B'>('A')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  // editing existing questions
  const [editing, setEditing] = useState<Record<string, { prompt: string; correct: 'A' | 'B'; saving: boolean; error?: string }>>({})

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
      // tiebreaker presence is derived from prompt/answer fields
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
    if (editingLabels) {
      // focus the first input when entering edit mode
      optionARef.current?.focus()
    } else {
      // return focus to the edit button when leaving edit mode
      editButtonRef.current?.focus()
    }
  }, [editingLabels])

  // When entering edit mode for a question we attempt to focus its prompt input.
  // Also provide a reliable focus-return mechanism: when `focusReturnId` is set
  // we'll wait for the next animation frame and focus the corresponding Edit button.
  useEffect(() => {
    // focus newest edit input (best-effort)
    const ids = Object.keys(editing)
    if (ids.length > 0) {
      const last = ids[ids.length - 1]
      requestAnimationFrame(() => {
        try { editInputRefs.current[last]?.focus() } catch (e) {}
      })
    }
  }, [editing])

  useEffect(() => {
    if (!focusReturnId) return
    requestAnimationFrame(() => {
      try { editButtonRefs.current[focusReturnId ?? '']?.focus() } catch (e) {}
      setFocusReturnId(null)
    })
  }, [focusReturnId])

  useEffect(() => {
    if (!tiebreakerEditing) return
    requestAnimationFrame(() => {
      try { tiebreakerPromptRef.current?.focus() } catch (e) {}
    })
  }, [tiebreakerEditing])

  // when an input is invalid, we'll programmatically focus it; handled in save flow

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

  const hasTiebreaker = Boolean((game as any)?.tiebreaker_prompt) || (((game as any)?.tiebreaker_answer !== undefined) && (game as any)?.tiebreaker_answer !== null && String((game as any)?.tiebreaker_answer).trim() !== '')

  if (checkingUser) return <div className="p-8">Checking auth…</div>
  if (!user) {
    return (
      <div className="container mx-auto p-8">
        <h2 className="text-xl font-semibold">Admin — Sign in required</h2>
        <p className="mt-4">You must be signed in as an admin to manage this game.</p>
        <div className="mt-4">
          <a className="font-semibold hover:underline" href="/admin">Go to Admin sign-in</a>
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
        const list = qData ?? []
        setQuestions(list)
        // try to identify the newly-added question to return focus to it
        const trimmed = prompt.trim()
        const added = list.find(q => q.prompt === trimmed) ?? (list.length ? list[list.length - 1] : null)
        if (added?.id) {
          setFocusReturnId(String(added.id))
        }
        setStatusMessage('Question added')
        setTimeout(() => setStatusMessage(null), 3000)
        setPrompt('')
        setCorrect('A')
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
      // validate tiebreaker numeric when provided
      if (tiebreakerAnswerLocal !== '' && !Number.isFinite(Number(tiebreakerAnswerLocal))) {
        setError('Tiebreaker answer must be a number')
        setSavingLabels(false)
        return
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
    setTiebreakerError(null)
    try {
      const promptTrimmed = (tiebreakerPrompt ?? '').toString().trim()
      const answerEmpty = tiebreakerAnswerLocal === '' || tiebreakerAnswerLocal === null

      // require both fields for saving a tiebreaker; disallow saving with missing pieces
      if (promptTrimmed === '' && answerEmpty) {
        setTiebreakerPromptInvalid(true)
        setTiebreakerAnswerInvalid(true)
        setTiebreakerError('Please enter a tiebreaker question and answer, or cancel')
        requestAnimationFrame(() => { try { tiebreakerPromptRef.current?.focus() } catch (e) {} })
        setSavingLabels(false)
        return
      }
      if (promptTrimmed !== '' && answerEmpty) {
        setTiebreakerPromptInvalid(false)
        setTiebreakerAnswerInvalid(true)
        setTiebreakerError('Please provide a numeric tiebreaker answer')
        requestAnimationFrame(() => { try { tiebreakerAnswerRef.current?.focus() } catch (e) {} })
        setSavingLabels(false)
        return
      }
      if (promptTrimmed === '' && !answerEmpty) {
        setTiebreakerPromptInvalid(true)
        setTiebreakerAnswerInvalid(false)
        setTiebreakerError('Please provide a tiebreaker question')
        requestAnimationFrame(() => { try { tiebreakerPromptRef.current?.focus() } catch (e) {} })
        setSavingLabels(false)
        return
      }

      if (!answerEmpty && !Number.isFinite(Number(tiebreakerAnswerLocal))) {
        setTiebreakerPromptInvalid(false)
        setTiebreakerAnswerInvalid(true)
        setTiebreakerError('Tiebreaker answer must be a number')
        requestAnimationFrame(() => { try { tiebreakerAnswerRef.current?.focus() } catch (e) {} })
        setSavingLabels(false)
        return
      }
      const updatePayload: any = {
        tiebreaker_prompt: tiebreakerPrompt || null,
        tiebreaker_answer: tiebreakerAnswerLocal === '' ? null : (Number.isFinite(Number(tiebreakerAnswerLocal)) ? Number(tiebreakerAnswerLocal) : null)
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
      setFocusReturnId('tiebreaker')
    } catch (err: any) {
      setTiebreakerError(err?.message ?? 'Failed to save tiebreaker')
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

  const fullUrl = (() => {
    try {
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
      return siteUrl ? `${siteUrl}/g/${game?.slug}` : (typeof window !== 'undefined' ? `${window.location.origin}/g/${game?.slug}` : `/g/${game?.slug}`)
    } catch (e) {
      return `/g/${game?.slug}`
    }
  })()

  return (
    <div className="container mx-auto px-8 pt-16 pb-8" data-page="admin-manage">
      <div className="mt-6 flex flex-col md:flex-row md:items-start md:space-x-12">
        <div className="mb-6 md:w-1/2">
          <h1 className="text-3xl font-bold">Manage Game</h1>
          <div className="mt-3 rounded border p-4">
            <div className="mt-4">
              <div>
                <div className="text-2xl font-semibold mb-2">{game.title}</div>
                <div className={`text-lg font-semibold mb-2 ${game.is_open ? 'text-green-600' : 'text-red-600'}`}>Status: {game.is_open ? 'Open' : 'Closed'}</div>
              
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
                        <button ref={editButtonRef} aria-expanded={editingLabels} aria-controls="labelsForm" className="text-lg text-indigo-600 hover:underline" aria-label="Edit Question Option Labels" onClick={() => setEditingLabels(true)}>Edit labels</button>
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
                    <form id="labelsForm" onSubmit={handleSaveLabels} className="space-y-2" aria-busy={savingLabels}>
                      <div>
                        <label htmlFor="optionA" className="block text-md font-semibold">Edit Option A label</label>
                        <div className="flex items-center space-x-2">
                          <input id="optionA" name="optionA" ref={optionARef} value={optionA} onChange={(e) => setOptionA(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" aria-describedby="optionAHelp" />
                          <EmojiPicker value={optionAEmoji} onChange={setOptionAEmoji} ariaLabel="Choose emoji for Option A" ariaDescribedBy="optionAHelp" />
                        </div>
                        <p id="optionAHelp" className="text-xs text-gray-500">Optional emoji appears before the label.</p>
                      </div>
                      <div>
                        <label htmlFor="optionB" className="block text-md font-semibold">Edit Option B label</label>
                        <div className="flex items-center space-x-2">
                          <input id="optionB" name="optionB" ref={optionBRef} value={optionB} onChange={(e) => setOptionB(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" aria-describedby="optionBHelp" />
                          <EmojiPicker value={optionBEmoji} onChange={setOptionBEmoji} ariaLabel="Choose emoji for Option B" ariaDescribedBy="optionBHelp" />
                        </div>
                        <p id="optionBHelp" className="text-xs text-gray-500">Optional emoji appears before the label.</p>
                      </div>
                      {/* Tiebreaker is edited inline under Questions */}
                      <div className="flex items-center space-x-2">
                        <button type="submit" disabled={savingLabels} className="btn-primary" aria-disabled={savingLabels} aria-label="Save Option Labels">
                          {savingLabels ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" className="btn-cancel" onClick={() => {
                          // cancel edits: reset fields from `game` and exit edit mode
                          setOptionA((game as any)?.option_a_label ?? '')
                          setOptionB((game as any)?.option_b_label ?? '')
                            setOptionAEmoji((game as any)?.option_a_emoji ?? null)
                            setOptionBEmoji((game as any)?.option_b_emoji ?? null)
                          // no-op: tiebreaker presence derived from prompt/answer
                          setTiebreakerPrompt((game as any)?.tiebreaker_prompt ?? '')
                          setTiebreakerAnswerLocal((game as any)?.tiebreaker_answer ?? '')
                          setEditingLabels(false)
                        }}>Cancel</button>
                      </div>
                    </form>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button onClick={handleCopyUrl} className="btn-primary" aria-label="Copy Game URL">Copy URL</button>
                    <a className="btn-primary" href={`/g/${game.slug}`} aria-label="Go to Game">Game</a>
                    <a className="btn-primary" href={`/g/${game.slug}/leaderboard`} aria-label="Go to Leaderboard">Leaderboard</a>
                    {copiedUrl && <span className="ml-2 text-sm text-green-600">Copied!</span>}
                  </div>
              </div>

              <div className="text-center mt-6">
                {/* QR code suitable for printing; SITE URL is read from NEXT_PUBLIC_SITE_URL. Uses local qrcode to create a data URI. */}
                <div>
                  {qrDataUrl ? (
                    <div className="qr-printable">
                      <div className="print-only text-center mb-4">
                        <div className="text-3xl mb-3 font-semibold">{game.title}</div>
                        <div className="text-lg break-all">{fullUrl}</div>
                      </div>
                      <img src={qrDataUrl} alt="QR code" />
                    </div>
                  ) : (
                    <div className="h-40 w-40 mx-auto bg-gray-100 flex items-center justify-center qr-printable">QR</div>
                  )}
                  <div className="mt-2 text-sm break-all">{qrDataUrl ? undefined : `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/g/${game.slug}`}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button onClick={() => window.print()} className="btn-primary">Print QR Code</button>
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
                        Download QR Code
                      </button>
                    ) : (
                      <button disabled className="btn-primary opacity-50 cursor-not-allowed">Download</button>
                    )}
                    
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="md:w-1/2">
          <h2 className="text-3xl font-bold mb-3">Questions</h2>

          <div className="space-y-2">
            {questions.length === 0 && <div className="text-sm text-gray-600">No questions yet</div>}
            {questions.map((q) => {
              const e = editing[q.id]
              return (
                <QuestionCard key={q.id} id={q.id} footer={e?.error} actions={!e ? (
                  <button ref={(el) => { editButtonRefs.current[q.id] = el }} aria-label={`Edit Question ${q.order_index + 1}`} className="text-sm btn-primary hover:underline" onClick={() => {
                    setEditing(prev => ({ ...prev, [q.id]: { prompt: q.prompt, correct: q.correct_answer === 'A' ? 'A' : 'B', saving: false } }))
                    setTimeout(() => editInputRefs.current[q.id]?.focus(), 0)
                  }}>Edit</button>
                ) : (
                  <div className="space-x-2">
                    <button aria-label={`Save edits for Question ${q.order_index + 1}`} className="px-3 py-1 btn-primary" onClick={async () => {
                      setEditing(prev => ({ ...prev, [q.id]: { ...(prev[q.id]), saving: true } }))
                      try {
                        const { error } = await supabase.from('questions').update({ prompt: e.prompt.trim(), correct_answer: e.correct }).eq('id', q.id)
                        if (error) throw error
                        const qResp = await supabase.from('questions').select('*').eq('game_id', game!.id).order('order_index', { ascending: true })
                        setQuestions(qResp.data ?? [])
                        setEditing(prev => { const n = { ...prev }; delete n[q.id]; return n })
                        setFocusReturnId(String(q.id))
                      } catch (err: any) {
                        setEditing(prev => ({ ...prev, [q.id]: { ...(prev[q.id]), saving: false, error: err?.message ?? 'Save failed' } }))
                      }
                    }}>Save</button>
                    <button aria-label={`Cancel editing for Question ${q.order_index + 1}`} className="btn-cancel" onClick={() => {
                      setEditing(prev => { const n = { ...prev }; delete n[q.id]; return n })
                      setFocusReturnId(String(q.id))
                    }}>Cancel</button>
                  </div>
                )}>
                  <div>
                    <h4 className="text-lg font-bold">Question {q.order_index + 1}</h4>
                    {!e ? (
                      <div className="mt-1 font-medium text-lg">{q.prompt}</div>
                    ) : (
                      <div className="mt-1">
                        <label htmlFor={`prompt-${q.id}`} className="sr-only">Question {q.order_index + 1} prompt</label>
                        <input id={`prompt-${q.id}`} ref={(el) => { editInputRefs.current[q.id] = el }} value={e.prompt} onChange={(ev) => setEditing(prev => ({ ...prev, [q.id]: { ...prev[q.id], prompt: ev.target.value } }))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
                      </div>
                    )}
                    {/* Show friendly label for the stored correct answer (maps stored value to option labels) */}
                    {!e ? (
                      <div className="mt-1 font-medium text-lg">Answer: {q.correct_answer === 'A' ? (optionAEmoji ? optionAEmoji + ' ' : '') + (optionA || 'Option A') : q.correct_answer === 'B' ? (optionBEmoji ? optionBEmoji + ' ' : '') + (optionB || 'Option B') : q.correct_answer}</div>
                    ) : (
                      <fieldset className="mt-2">
                        <legend className="sr-only">Correct answer for question {q.order_index + 1}</legend>
                        <div className="mt-2 flex items-center space-x-4" role="radiogroup" aria-labelledby={`question-${q.id}` }>
                          <label className={`inline-flex items-center space-x-2 px-3 py-2 rounded-md border option-button ${e.correct === 'A' ? 'selected' : ''}`}>
                            <input
                              className="sr-only"
                              type="radio"
                              id={`correctA-${q.id}`}
                              name={`correct-${q.id}`}
                              value="A"
                              checked={e.correct === 'A'}
                              onChange={() => setEditing(prev => ({ ...prev, [q.id]: { ...prev[q.id], correct: 'A' } }))}
                            />
                            <span>{optionAEmoji ? optionAEmoji + ' ' : ''}{optionA || 'Option A'}</span>
                          </label>
                          <label className={`inline-flex items-center space-x-2 px-3 py-2 rounded-md border option-button ${e.correct === 'B' ? 'selected' : ''}`}>
                            <input
                              className="sr-only"
                              type="radio"
                              id={`correctB-${q.id}`}
                              name={`correct-${q.id}`}
                              value="B"
                              checked={e.correct === 'B'}
                              onChange={() => setEditing(prev => ({ ...prev, [q.id]: { ...prev[q.id], correct: 'B' } }))}
                            />
                            <span>{optionBEmoji ? optionBEmoji + ' ' : ''}{optionB || 'Option B'}</span>
                          </label>
                        </div>
                      </fieldset>
                    )}
                  </div>
                </QuestionCard>
              )
            })}
            <QuestionCard key="tiebreaker" id="tiebreaker" actions={!tiebreakerEditing ? (
              <div className="space-x-2">
                {!hasTiebreaker ? (
                  <button ref={(el) => { editButtonRefs.current['tiebreaker'] = el }} aria-label="Add Tiebreaker" className="btn-primary" onClick={() => { setTiebreakerPrompt(''); setTiebreakerAnswerLocal(''); setTiebreakerEditing(true) }}>Add tiebreaker</button>
                ) : (
                  <button ref={(el) => { editButtonRefs.current['tiebreaker'] = el }} aria-label="Edit Tiebreaker" className="btn-primary" onClick={() => setTiebreakerEditing(true)}>Edit</button>
                )}
              </div>
            ) : null}>
              {!tiebreakerEditing ? (
                <div>
                  <div>
                    <h4 className="text-lg font-bold">Tiebreaker</h4>
                    {hasTiebreaker ? (
                      <>
                        <div className="mt-1 font-medium text-lg">{game.tiebreaker_prompt || 'No prompt set'}</div>
                        {typeof (game as any).tiebreaker_answer !== 'undefined' && (game as any).tiebreaker_answer !== null && (
                          <div className="mt-1 text-sm text-gray-600">Answer (admin): {(game as any).tiebreaker_answer}</div>
                        )}
                      </>
                    ) : (
                      <div className="mt-1 font-medium text-lg text-gray-600">No tiebreaker configured</div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="space-y-3">
                    {/* Tiebreaker enabled flag removed — presence is derived from prompt/answer */}
                    <div>
                      <label htmlFor="tiebreakerPrompt" className="block text-md font-semibold">Tiebreaker question</label>
                      <input id="tiebreakerPrompt" ref={tiebreakerPromptRef} value={tiebreakerPrompt} onChange={(e) => { setTiebreakerPrompt(e.target.value); setTiebreakerError(null); setTiebreakerPromptInvalid(false) }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSaveTiebreaker() } }} aria-describedby={tiebreakerError ? 'tiebreakerError' : undefined} aria-invalid={tiebreakerPromptInvalid ? true : undefined} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
                    </div>
                    <div>
                      <label htmlFor="tiebreakerAnswer" className="block text-md font-semibold">Tiebreaker answer (number)</label>
                      <input id="tiebreakerAnswer" ref={tiebreakerAnswerRef} type="number" value={tiebreakerAnswerLocal as any} onChange={(e) => { setTiebreakerAnswerLocal(e.target.value === '' ? '' : Number(e.target.value)); setTiebreakerError(null); setTiebreakerAnswerInvalid(false) }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSaveTiebreaker() } }} aria-describedby={tiebreakerError ? 'tiebreakerError' : undefined} aria-invalid={tiebreakerAnswerInvalid ? true : undefined} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
                    </div>
                    <div className="mt-2 space-x-2">
                      <button type="button" className="px-3 py-1 btn-primary" onClick={async () => { await handleSaveTiebreaker() }}>Save</button>
                      <button type="button" className="btn-cancel" onClick={() => {
                        // cancel edits: restore from `game`
                        setTiebreakerPrompt((game as any)?.tiebreaker_prompt ?? '')
                        setTiebreakerAnswerLocal((game as any)?.tiebreaker_answer ?? '')
                        setTiebreakerEditing(false)
                        setFocusReturnId('tiebreaker')
                      }}>Cancel</button>
                    </div>
                    {tiebreakerError && (
                      <div id="tiebreakerError" role="alert" aria-atomic="true" className="text-sm text-red-600">
                        {tiebreakerError}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </QuestionCard>
          </div>

          <form onSubmit={handleAddQuestion} className="mt-6 space-y-3" aria-describedby={formError ? 'addQuestionError' : undefined}>
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">Question</label>
              <input id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
            </div>

            <div>
              <fieldset>
                <legend className="text-sm font-medium text-gray-700">Correct answer</legend>
                <div className="mt-1 flex items-center space-x-4" role="radiogroup" aria-labelledby="addQuestionCorrect">
                  <label className={`inline-flex items-center space-x-2 px-3 py-2 rounded-md border option-button ${correct === 'A' ? 'selected' : ''}`}>
                    <input className="sr-only" type="radio" name="correct" value="A" checked={correct === 'A'} onChange={() => setCorrect('A')} />
                    <span>{optionAEmoji ? optionAEmoji + ' ' : ''}{optionA || 'Option A'}</span>
                  </label>
                  <label className={`inline-flex items-center space-x-2 px-3 py-2 rounded-md border option-button ${correct === 'B' ? 'selected' : ''}`}>
                    <input className="sr-only" type="radio" name="correct" value="B" checked={correct === 'B'} onChange={() => setCorrect('B')} />
                    <span>{optionBEmoji ? optionBEmoji + ' ' : ''}{optionB || 'Option B'}</span>
                  </label>
                </div>
              </fieldset>
            </div>

            {formError && <div id="addQuestionError" className="text-sm text-red-600">{formError}</div>}

            <div id="adminStatus" role="status" aria-live="polite" className="sr-only">{statusMessage}</div>

            <div>
              <button type="submit" disabled={submitting} aria-disabled={submitting} className="btn-primary mt-4">
                {submitting ? 'Adding…' : 'Add question'}
              </button>
            </div>
          </form>
        </section>

      </div>
      
    </div>
  )
}
