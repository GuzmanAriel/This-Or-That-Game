"use client"

import React, { useEffect, useState } from 'react'
import { getSupabaseClient } from '../../../../lib/supabase'

type Props = { params: { slug: string } }

export default function LeaderboardPage({ params }: Props) {
  const { slug } = params
  const supabase = getSupabaseClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playersMap, setPlayersMap] = useState<Record<string, any>>({})
  const [scores, setScores] = useState<Array<{ player_id: string; first_name?: string; last_name?: string; score: number }>>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  // playerAnswers: map player_id -> map key(question_id|'tiebreaker') -> answer record (latest)
  const [playerAnswers, setPlayerAnswers] = useState<Record<string, Record<string, any>>>({})
  const [questionsMap, setQuestionsMap] = useState<Record<string, any>>({})
  const [gameOptionA, setGameOptionA] = useState<string | null>(null)
  const [gameOptionB, setGameOptionB] = useState<string | null>(null)
  const [gameTiebreakerAnswer, setGameTiebreakerAnswer] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // fetch game, players, questions, answers and current user
        const { data: gData, error: gErr } = await supabase.from('games').select('id,created_by,option_a_label,option_b_label,tiebreaker_answer,theme').eq('slug', slug).limit(1).maybeSingle()
        if (gErr) throw gErr
        if (!gData) {
          setError('Game not found')
          setLoading(false)
          return
        }
        const gameId = (gData as any).id
        const createdBy = (gData as any).created_by
        setGameOptionA((gData as any).option_a_label ?? null)
        setGameOptionB((gData as any).option_b_label ?? null)
        setGameTiebreakerAnswer((gData as any).tiebreaker_answer ?? null)
        // apply theme for this page
        try { document.body.dataset.theme = (gData as any).theme ?? 'default' } catch (e) {}

        const [{ data: pData }, { data: qData }, { data: aData }, userResp] = await Promise.all([
          supabase.from('players').select('*').eq('game_id', gameId),
          supabase.from('questions').select('*').eq('game_id', gameId),
          supabase.from('answers').select('*').eq('game_id', gameId).order('created_at', { ascending: true }),
          supabase.auth.getUser()
        ])

        if (!mounted) return

        const pMap: Record<string, any> = {}
        ;((pData as any) ?? []).forEach((p: any) => { pMap[p.id] = p })
        setPlayersMap(pMap)

        const qMap: Record<string, any> = {}
        ;((qData as any) ?? []).forEach((q: any) => { qMap[q.id] = q })
        setQuestionsMap(qMap)

        // keep only the latest answer per question (or tiebreaker) per player
        const latestByPlayer: Record<string, Record<string, any>> = {}
        ;((aData as any) ?? []).forEach((a: any) => {
          const pid = a.player_id || 'unknown'
          const key = a.question_id ?? 'tiebreaker'
          latestByPlayer[pid] = latestByPlayer[pid] ?? {}
          const existing = latestByPlayer[pid][key]
          if (!existing) {
            latestByPlayer[pid][key] = a
          } else {
            // pick the one with later created_at (or later id fallback)
            const existingTime = existing.created_at ? new Date(existing.created_at).getTime() : 0
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
            if (aTime >= existingTime) latestByPlayer[pid][key] = a
          }
        })
        setPlayerAnswers(latestByPlayer)

        // compute scores: only question answers count (question_id != null). map correct 'mom' -> 'A', 'dad' -> 'B'
        const scoresArr: Array<{ player_id: string; first_name?: string; last_name?: string; score: number }> = []
        for (const pid of Object.keys(latestByPlayer)) {
          const answersMapPerPlayer = latestByPlayer[pid]
          let score = 0
          for (const qid of Object.keys(qMap)) {
            const submitted = answersMapPerPlayer[qid]
            if (!submitted) continue
            const q = qMap[qid]
            const expected = q.correct_answer === 'mom' ? 'A' : q.correct_answer === 'dad' ? 'B' : q.correct_answer
            if (String(submitted.answer_text) === String(expected)) score += 1
          }
          const p = pMap[pid]
          scoresArr.push({ player_id: pid, first_name: p?.first_name, last_name: p?.last_name, score })
        }

        // also include players with zero answers
        ;((pData as any) ?? []).forEach((p: any) => {
          if (!scoresArr.find(s => s.player_id === p.id)) scoresArr.push({ player_id: p.id, first_name: p.first_name, last_name: p.last_name, score: 0 })
        })

        // sort desc
        scoresArr.sort((a, b) => b.score - a.score)
        setScores(scoresArr)

        // is admin if current user id matches created_by
        const user = (userResp as any)?.data?.user
        setIsAdmin(Boolean(user && user.id === createdBy))
      } catch (err: any) {
        console.error(err)
        if (!mounted) return
        setError(err?.message ?? 'Failed to load leaderboard')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false; try { document.body.dataset.theme = 'default' } catch (e) {} }
  }, [slug, supabase])

  if (loading) return <div className="p-8">Loading…</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>

  return (
    <div className="container mx-auto p-8">
      <h2 className="text-2xl font-semibold">Leaderboard: {slug}</h2>
      {scores.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">No submissions yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {scores.map(s => (
            <li key={s.player_id} className="rounded border p-3 flex items-center justify-between">
              <div>{s.first_name ?? 'Player'} {s.last_name ?? ''}</div>
              <div className="font-medium">{s.score}</div>
              {isAdmin && (
                <button className="ml-4 text-sm" onClick={() => setSelectedPlayer(s.player_id)}>View</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-xl w-full p-6">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-medium">Submission</h3>
              <button className="text-sm text-gray-600" onClick={() => setSelectedPlayer(null)}>Close</button>
            </div>
            <div className="mt-4">
              <div className="font-medium">{playersMap[selectedPlayer]?.first_name} {playersMap[selectedPlayer]?.last_name}</div>
              <ul className="mt-3 space-y-2 text-sm">
                {/* header row */}
                <li className="flex items-center justify-between text-sm font-semibold">
                  <div className="w-1/2"></div>
                  <div className="w-1/6 text-center">Answer</div>
                  <div className="w-1/6 text-center">Submission</div>
                  <div className="w-1/12"></div>
                </li>

                {Object.values(questionsMap).sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)).map((q: any, idx: number) => {
                  const answersMapPerPlayer = (playerAnswers[selectedPlayer] ?? {}) as Record<string, any>
                  const submitted = answersMapPerPlayer[q.id]?.answer_text ? String(answersMapPerPlayer[q.id].answer_text) : ''
                  const expectedLetter = q.correct_answer === 'mom' ? 'A' : q.correct_answer === 'dad' ? 'B' : String(q.correct_answer)
                  const expectedLabel = expectedLetter === 'A' ? (gameOptionA ?? 'Option A') : (gameOptionB ?? 'Option B')
                  const submittedLabel = submitted === 'A' ? (gameOptionA ?? 'Option A') : submitted === 'B' ? (gameOptionB ?? 'Option B') : submitted
                  const correct = submitted !== '' && String(submitted) === String(expectedLetter)
                  return (
                    <li key={q.id || idx} className="flex items-center justify-between">
                      <div className="w-1/2">{q.prompt}</div>
                      <div className="w-1/6 text-sm text-gray-700">{expectedLabel}</div>
                      <div className="w-1/6 text-sm font-medium">{submittedLabel}</div>
                      <div className="w-1/12">{correct ? <span className="text-green-600">✓</span> : <span className="text-red-600">✕</span>}</div>
                    </li>
                  )
                })}

                {/* show tiebreaker if present */}
                {(() => {
                  const answersMapPerPlayer = (playerAnswers[selectedPlayer] ?? {}) as Record<string, any>
                  const t = answersMapPerPlayer['tiebreaker']
                  if (!t) return null
                  const submitted = (t.answer_text || '').toString().trim()
                  const expected = gameTiebreakerAnswer !== null && gameTiebreakerAnswer !== undefined ? String(gameTiebreakerAnswer) : null
                  const correct = expected !== null && submitted !== '' && Number(submitted) === Number(expected)
                  return (
                    <li className="mt-3">
                      <div className="font-medium">Tiebreaker</div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <div className="">Expected: {expected ?? '—'}</div>
                        <div className="font-medium">Submitted: {submitted}</div>
                        <div>{correct ? <span className="text-green-600">✓</span> : <span className="text-red-600">✕</span>}</div>
                      </div>
                    </li>
                  )
                })()}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
