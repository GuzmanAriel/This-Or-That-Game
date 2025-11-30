import React from 'react'
import { getSupabaseClient } from '../lib/supabase'

// Server component homepage. Uses Supabase server-side auth to determine session.
export default async function HomePage() {
  const supabase = getSupabaseClient()
  // Call server-side auth.getSession() to determine if a user is logged in.
  const { data } = await supabase.auth.getSession()
  const user = data?.session?.user ?? null
  // Fetch games the user created (admin view) and games they've submitted to (player view).
  let adminGames: any[] = []
  let submittedGames: any[] = []
  if (user) {
    try {
      const { data: a } = await supabase.from('games').select('*').eq('created_by', user.id).order('created_at', { ascending: false })
      adminGames = (a as any) ?? []
    } catch (e) {
      adminGames = []
    }

    try {
      // find submissions tied to this user's email, then load related games
      const { data: subs } = await supabase.from('submissions').select('game_id').eq('email', user.email)
      const ids = Array.from(new Set(((subs as any[]) || []).map((s) => s.game_id).filter(Boolean)))
      if (ids.length > 0) {
        const { data: g } = await supabase.from('games').select('*').in('id', ids)
        submittedGames = (g as any) ?? []
      }
    } catch (e) {
      submittedGames = []
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-12">
      {/* Hero section - shown to all users */}
      <header className="w-full max-w-3xl text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
          🎉 Welcome to This or That!
        </h1>
        <div className="mt-6 space-y-4 text-gray-700 text-base md:text-lg">
          <p>
            A fun, customizable guessing game for baby showers, weddings, parties, and more.
          </p>
          <p>
            Players answer funny or thoughtful questions by choosing between two options — for example “Mom or Dad?”, “Bride or Groom?”, “Coffee or Tea?”, and so on. Admins can create their own game, add questions, and share the link with players.
          </p>
        </div>
      </header>

      {/* Conditional content based on auth state */}
      <main className="w-full max-w-3xl mt-10">
        {user ? (
          // Logged-in view
          <section>
            <p className="text-sm text-gray-600">Logged in as {user.email}</p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <a
                href="/admin"
                className="block border rounded-lg p-6 hover:shadow-lg transition bg-white"
              >
                <h3 className="text-lg font-semibold">🔐 Admin Area</h3>
                <p className="mt-2 text-gray-600">Create and manage your games.</p>
              </a>

              <a
                href="/admin"
                className="block border rounded-lg p-6 hover:shadow-lg transition bg-white"
              >
                <h3 className="text-lg font-semibold">🏆 View Leaderboards</h3>
                <p className="mt-2 text-gray-600">Select a game to view its leaderboard.</p>
              </a>
            </div>
          </section>
        ) : (
          // Not logged-in view
          <section>
            <div className="mt-2 text-gray-600">
              <p className="text-sm">Not signed in? — choose your role below.</p>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-6 bg-white">
                <h3 className="text-lg font-semibold">👤 I'm an admin / host</h3>
                <p className="mt-2 text-gray-600">
                  Log in or sign up to create your own This or That game, add questions, and manage events.
                </p>
                <div className="mt-4">
                  <a
                    href="/admin"
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                  >
                    Go to Admin
                  </a>
                </div>
              </div>

              <div className="border rounded-lg p-6 bg-white">
                <h3 className="text-lg font-semibold">🎮 I'm a player</h3>
                <p className="mt-2 text-gray-600">
                  If your host shared a game link with you, open it in your browser to join the game. Game links look like:
                </p>
                <code className="block mt-3 bg-gray-100 px-3 py-2 rounded text-sm">/g/example-slug</code>
                <code className="block mt-3 bg-gray-100 px-3 py-2 rounded text-sm">/g/jack-and-jills-baby-shower</code>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
