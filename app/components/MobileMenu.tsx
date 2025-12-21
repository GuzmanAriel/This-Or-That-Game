"use client"

import React from 'react'

type Props = {
  open: boolean
  onClose: () => void
  user: any | null
  isAdmin: boolean
  playerGames: any[]
  adminGames: any[]
  submittedGames: any[]
  onSignOut: () => void
}

export default function MobileMenu({ open, onClose, user, isAdmin, playerGames, adminGames, submittedGames, onSignOut }: Props) {
  return (
    <div className={`mobile-menu ${open ? 'open' : ''}`} aria-hidden={!open}>
      <nav className="p-3 space-y-3">
        <a href="/" onClick={onClose} className="block font-semibold">Home</a>
        {isAdmin && <a href="/admin" onClick={onClose} className="block font-semibold">Admin</a>}

        {playerGames.length > 0 && (
          <div>
            <div className="font-medium">Player Games</div>
            <ul className="pl-3 mt-1 space-y-1">
              {playerGames.map((g) => (
                <li key={g.id}><a href={`/g/${g.slug}`} onClick={onClose} className="block">{g.title}</a></li>
              ))}
            </ul>
          </div>
        )}

        {adminGames.length > 0 && (
          <div>
            <div className="font-medium">Your Games</div>
            <ul className="pl-3 mt-1 space-y-1">
              {adminGames.map((g) => (
                <li key={g.id}><a href={`/g/${g.slug}`} onClick={onClose} className="block">{g.title}</a></li>
              ))}
            </ul>
          </div>
        )}

        {submittedGames.length > 0 && (
          <div>
            <div className="font-medium">Your Submissions</div>
            <ul className="pl-3 mt-1 space-y-1">
              {submittedGames.map((g) => (
                <li key={g.id}><a href={`/g/${g.slug}`} onClick={onClose} className="block">{g.title}</a></li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-2 border-t mt-2">
          {user ? (
            <button onClick={() => { onSignOut(); onClose(); }} className="block w-full text-left">Log out</button>
          ) : (
            <>
              <a href="/admin" onClick={onClose} className="block">Sign in / Admin</a>
              <a href="/signup" onClick={onClose} className="block">Sign up</a>
            </>
          )}
        </div>
      </nav>
    </div>
  )
}
