"use client"

import React, { useEffect, useState } from 'react'
import { getSupabaseClient } from '../../../lib/supabase'
import type { Game, Question } from '../../../lib/types'

type Props = { params: { slug: string } }

export default function GamePage({ params }: Props) {
  const { slug } = params
  const supabase = getSupabaseClient()

  const [loading, setLoading] = useState(true)
  const [game, setGame] = useState<Game | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])

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
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [slug, supabase])

  if (loading) return <div className="p-8">Loading…</div>
  if (!game) return <div className="p-8">Game not found</div>

  return (
    <div className="container mx-auto p-8">
      <h2 className="text-2xl font-semibold">Play: {game.title}</h2>
      <p className="mt-2 text-gray-600">Slug: {game.slug}</p>

      <section className="mt-6">
        <h3 className="text-lg font-semibold">Questions</h3>
        <ul className="mt-3 space-y-3">
          {questions.length === 0 && <li className="text-sm text-gray-600">No questions yet</li>}
          {questions.map((q) => (
            <li key={q.id} className="rounded border p-3">
              <div className="text-sm text-gray-500">#{q.order_index}</div>
              <div className="mt-1">{q.prompt}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
