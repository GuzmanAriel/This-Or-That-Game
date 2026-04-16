
"use client"

import React, { useState, useMemo } from 'react'
import { getSupabaseClient } from '../../lib/supabaseClient'

export default function SignUpPage() {
  const supabase = useMemo(() => getSupabaseClient(), [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
        return
      }
      // When email confirmations are enabled Supabase will send a confirmation link.
      // Show a friendly message and clear inputs.
      setMessage('Check your email for a confirmation link (if enabled). You can then sign in at /admin.')
      setEmail('')
      setPassword('')
    } catch (err: any) {
      setError(err?.message ?? 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-8" data-page="signup">
      <h2 className="text-2xl font-semibold">Sign up</h2>

      <form onSubmit={handleSignUp} className="mt-6 max-w-md" data-component="signup-form">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
          />
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-2 text-sm text-green-600">{message}</p>}

        <div className="mt-6">
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Signing up…' : 'Sign up'}
          </button>
        </div>

        <p className="mt-4 text-sm">
          Already have an account? <a href="/admin">Sign in</a>
        </p>
      </form>
    </div>
  )
}