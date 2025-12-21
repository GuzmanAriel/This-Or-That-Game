"use client"

import React, { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'

export default function RootClient({ children }: { children: React.ReactNode }) {
  const [themeLoaded, setThemeLoaded] = useState(false)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // detect body dataset.theme changes
    try {
      const check = () => {
        const t = document.body?.dataset?.theme
        if (t && t !== 'default') {
          setThemeLoaded(true)
        }
      }
      check()
      const mo = new MutationObserver(() => check())
      if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] })
      const tmo = setTimeout(() => setThemeLoaded(true), 2000) // fallback
      return () => { mo.disconnect(); clearTimeout(tmo) }
    } catch (e) {
      setThemeLoaded(true)
    }
  }, [])

  useEffect(() => {
    // check supabase auth state to know when auth is ready
    let mounted = true
    const supabase = getSupabaseClient()
    ;(async () => {
      try {
        await supabase.auth.getUser()
      } catch (e) {
        // ignore
      }
      if (mounted) setAuthLoaded(true)
    })()
    const t = setTimeout(() => { if (mounted) setAuthLoaded(true) }, 3000)
    return () => { mounted = false; clearTimeout(t) }
  }, [])

  useEffect(() => {
    if (themeLoaded && authLoaded) {
      // give a tiny delay for UX smoothing then hide spinner
      const t = setTimeout(() => setVisible(false), 120)
      return () => clearTimeout(t)
    }
  }, [themeLoaded, authLoaded])

  return (
    <>
      {children}
      {visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
          <svg className="w-20 h-20 animate-spin text-gray-700" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
        </div>
      )}
    </>
  )
}