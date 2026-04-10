"use client"

import React, { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  user: any | null
  isAdmin: boolean
  playerGames: any[]
  adminGames: any[]
  submittedGames: any[]
  onSignOut: () => void
  focusOnOpen?: boolean
}

export default function MobileMenu({ open, onClose, user, isAdmin, playerGames, adminGames, submittedGames, onSignOut, focusOnOpen }: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open || !focusOnOpen) return
    const root = menuRef.current
    if (!root) return
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const first = root.querySelector<HTMLElement>(selector)
    if (first) {
      first.focus()
    }
  }, [open, focusOnOpen])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  return (
    <div ref={menuRef} id="mobile-menu" className={`mobile-menu ${open ? 'open' : ''}`} aria-hidden={!open} data-component="mobile-menu">
      <nav className="p-6">
        <a href="/" onClick={onClose} className="block text-xl font-semibold">Home</a>
        {isAdmin && <a href="/admin" onClick={onClose} className="block text-xl font-semibold mt-6">Admin</a>}

        {playerGames.length > 0 && (
          <div>
            <div className="font-bold text-xl mt-6">Player Games</div>
            <ul className="pl-3 mt-3 space-y-2">
              {playerGames.map((g) => (
                <li key={g.id}><a href={`/g/${g.slug}`} onClick={onClose} className="block text-xl font-semibold mt-3">{g.title}</a></li>
              ))}
            </ul>
          </div>
        )}

        {adminGames.length > 0 && (
          <div>
            <div className="font-semibold text-xl mt-6">Your Games</div>
            <ul className="pl-3 mt-3 space-y-1">
              {adminGames.map((g) => (
                <li key={g.id}><a href={`/g/${g.slug}`} onClick={onClose} className="block font-semibold text-xl mt-3">{g.title}</a></li>
              ))}
            </ul>
          </div>
        )}

        {submittedGames.length > 0 && (
          <div>
            <div className="font-bold">Your Submissions</div>
            <ul className="pl-3 mt-3 space-y-1">
              {submittedGames.map((g) => (
                <li key={g.id}><a href={`/g/${g.slug}`} onClick={onClose} className="block font-bold">{g.title}</a></li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-2 border-t mt-6">
          {user ? (
            <button onClick={() => { onSignOut(); onClose(); }} className="block w-full text-left font-semibold text-xl">Log out</button>
          ) : (
            <>
              <a href="/admin" onClick={onClose} className="block font-semibold text-xl">Sign in / Admin</a>
              <a href="/signup" onClick={onClose} className="block font-semibold text-xl">Sign up</a>
            </>
          )}
        </div>
      </nav>
    </div>
  )
}
