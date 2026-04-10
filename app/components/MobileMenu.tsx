"use client"

import React, { useEffect, useRef, useState } from 'react'

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
  const [playerOpen, setPlayerOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [submittedOpen, setSubmittedOpen] = useState(false)

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

  useEffect(() => {
    const doc = document.documentElement
    const prevDocOverflow = doc.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    if (open) {
      doc.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
    } else {
      doc.style.overflow = prevDocOverflow
      document.body.style.overflow = prevBodyOverflow
    }
    return () => {
      doc.style.overflow = prevDocOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [open])

  return (
    <div
      ref={menuRef}
      id="mobile-menu"
      className={`mobile-menu ${open ? 'open' : ''} fixed left-0 right-0 overflow-auto z-50 bg-white`}
      style={{ height: 'calc(100dvh - 131px)'}}
      aria-hidden={!open}
      data-component="mobile-menu"
    >
      <nav className="p-6" aria-label="Mobile menu">
        <a href="/" onClick={onClose} className="block text-xl font-semibold">Home</a>
        {isAdmin && <a href="/admin" onClick={onClose} className="block text-xl font-semibold mt-6">Admin</a>}

        {playerGames.length > 0 && (
          <div>
            <button
              id="player-games-toggle"
              role="heading"
              aria-level={3}
              aria-controls="player-games-list"
              aria-expanded={playerOpen}
              onClick={() => setPlayerOpen((s) => !s)}
              className="font-bold text-xl mt-6 flex items-center justify-between w-full"
            >
              <span>Player Games</span>
              <span aria-hidden="true" className="ml-3">{playerOpen ? '▾' : '▸'}</span>
            </button>
            <ul id="player-games-list" role="region" aria-labelledby="player-games-toggle" className="pl-3 mt-3 space-y-2" hidden={!playerOpen}>
              {playerGames.map((g) => (
                <li key={g.id}><a href={`/g/${g.slug}`} onClick={onClose} className="block text-xl font-semibold mt-3">{g.title}</a></li>
              ))}
            </ul>
          </div>
        )}

        {adminGames.length > 0 && (
          <div>
            <button
              id="your-games-toggle"
              role="heading"
              aria-level={3}
              aria-controls="your-games-list"
              aria-expanded={adminOpen}
              onClick={() => setAdminOpen((s) => !s)}
              className="font-semibold text-xl mt-6 flex items-center justify-between w-full"
            >
              <span>Your Games</span>
              <span aria-hidden="true" className="ml-3">{adminOpen ? '▾' : '▸'}</span>
            </button>
            <ul id="your-games-list" role="region" aria-labelledby="your-games-toggle" className="pl-3 mt-3 space-y-1" hidden={!adminOpen}>
              {adminGames.map((g) => (
                <li key={g.id}><a href={`/g/${g.slug}`} onClick={onClose} className="block font-semibold text-xl mt-3">{g.title}</a></li>
              ))}
            </ul>
          </div>
        )}

        {submittedGames.length > 0 && (
          <div>
            <button
              id="submitted-games-toggle"
              role="heading"
              aria-level={3}
              aria-controls="submitted-games-list"
              aria-expanded={submittedOpen}
              onClick={() => setSubmittedOpen((s) => !s)}
              className="font-bold mt-6 flex items-center justify-between w-full"
            >
              <span>Your Submissions</span>
              <span aria-hidden="true" className="ml-3">{submittedOpen ? '▾' : '▸'}</span>
            </button>
            <ul id="submitted-games-list" role="region" aria-labelledby="submitted-games-toggle" className="pl-3 mt-3 space-y-1" hidden={!submittedOpen}>
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
