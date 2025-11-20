"use client"

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getSupabaseClient } from '../../../../lib/supabase'
import type { Game, Question } from '../../../../lib/types'

export default function AdminGamePage() {
  const params = useParams() as { slug?: string }
  const slug = params?.slug ?? ''
  const supabase = getSupabaseClient()

  const [loading, setLoading] = useState(true)
  const [game, setGame] = useState<Game | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [error, setError] = useState<string | null>(null)

  // new question form
  const [prompt, setPrompt] = useState('')
  const [correct, setCorrect] = useState<'mom' | 'dad'>('mom')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Manage Game</h1>
        <div className="mt-3 rounded border p-4">
          <div className="text-lg font-semibold">{game.title}</div>
          <div className="text-sm text-gray-600">Slug: {game.slug}</div>
          <div className="text-sm">Status: {game.is_open ? 'Open' : 'Closed'}</div>
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
          {questions.map((q) => (
            <li key={q.id} className="rounded border p-3">
              <div className="text-sm text-gray-500">#{q.order_index}</div>
              <div className="mt-1">{q.prompt}</div>
              <div className="mt-1 text-sm text-gray-700">Answer: {q.correct_answer}</div>
            </li>
          ))}
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
                <span className="text-sm">Mom</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="radio" name="correct" checked={correct === 'dad'} onChange={() => setCorrect('dad')} />
                <span className="text-sm">Dad</span>
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
