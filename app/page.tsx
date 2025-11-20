import React from 'react'

export default function HomePage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold">Is It Mom or Dad?</h1>
      <p className="mt-4 text-gray-600">Welcome — admin and game routes are scaffolded.</p>
      <ul className="mt-6 space-y-2">
        <li>/admin — admin area (login + game management)</li>
        <li>/g/[slug] — play a game</li>
        <li>/g/[slug]/leaderboard — view leaderboard</li>
      </ul>
    </div>
  )
}
