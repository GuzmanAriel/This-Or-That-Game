"use client"

import React, { useEffect, useState } from 'react'
import { getSupabaseClient } from '../../lib/supabase'

export default function AuthBar() {
  const supabase = getSupabaseClient()
  const [user, setUser] = useState<any | null>(null)

  useEffect(() => {
    let mounted = true
    async function check() {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      setUser(data.user ?? null)
    }
    check()
    const { data: listener } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setUser(session?.user ?? null)
    })
    return () => {
      mounted = false
      listener?.subscription?.unsubscribe()
    }
  }, [supabase])

  if (!user) return null

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <div className="w-full border-b bg-white">
      <div className="container mx-auto p-3 flex justify-end items-center space-x-4">
        <div className="text-sm text-gray-700">Logged in as <strong>{user.email}</strong></div>
        <button onClick={handleSignOut} className="text-sm text-red-600">Log out</button>
      </div>
    </div>
  )
}
