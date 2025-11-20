import React from 'react'

type Props = { params: { slug: string } }

export default function LeaderboardPage({ params }: Props) {
  const { slug } = params
  return (
    <div className="container mx-auto p-8">
      <h2 className="text-2xl font-semibold">Leaderboard: {slug}</h2>
      <p className="mt-2 text-gray-600">Leaderboard will list submissions sorted by score / tiebreaker / time.</p>
    </div>
  )
}
