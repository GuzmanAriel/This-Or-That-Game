
"use client"

import React, { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '../../lib/supabaseClient'

export default function SignUpPage() {
  const supabase = useMemo(() => getSupabaseClient(), [])
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

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
    const emailTrim = email.trim()
    const pass = password

    if (!emailTrim) {
      if (isMounted.current) {
        setError('Please enter your email')
        setLoading(false)
      }
      return
    }

    if ((pass || '').length < 8) {
      if (isMounted.current) {
        setError('Password must be at least 8 characters')
        setLoading(false)
      }
      return
    }
    try {
      const { data, error } = await supabase.auth.signUp({ email: emailTrim, password: pass })
      if (!isMounted.current) return
      if (error) {
        if (isMounted.current) setError(error.message)
        return
      }
      // When email confirmations are enabled Supabase will send a confirmation link.
      // Show a friendly message and clear inputs.
      if (isMounted.current) {
        setMessage('Check your email for a confirmation link (if enabled). You can then sign in at /admin.')
        setEmail('')
        setPassword('')
      }
    } catch (err: any) {
      if (isMounted.current) setError(err?.message ?? 'Sign up failed')
    } finally {
      if (isMounted.current) setLoading(false)
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

        <div role="status" aria-live="polite" className="mt-2">
          {error ? <p className="text-sm text-red-600">{error}</p> : message ? <p className="text-sm text-green-600">{message}</p> : null}
        </div>

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
          Already have an account? <Link href="/admin">Sign in</Link>
        </p>
      </form>
    </div>
  )
}