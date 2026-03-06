"use client"

import React from 'react'

type LinkItem = {
  text: string
  href?: string
  onClick?: () => void
  style?: string
}

type CardProps = {
  id?: string | number
  title: React.ReactNode
  subtitle?: React.ReactNode
  text?: React.ReactNode
  links?: LinkItem[]
  className?: string
}

export default function Card({ id, title, subtitle, text, links = [], className = '' }: CardProps) {
  return (
    <li className={`rounded-md border p-3 ${className}`} data-component="card" key={id}>
      <div>
        <div className="font-medium">{title}</div>
        {subtitle && <div className="text-sm text-gray-500">{subtitle}</div>}
        {text && <div className="mt-3 text-sm text-gray-700">{text}</div>}
      </div>

      {links.length > 0 && (
        <div className="mt-3 flex items-center space-x-3">
          {links.map((l, i) => {
            const base = 'text-sm text-gray-700 hover:underline'
            const classes = `${base} ${l.style ?? ''}`.trim()
            if (l.href) {
              return (
                <a key={i} href={l.href} className={classes}>
                  {l.text}
                </a>
              )
            }
            return (
              <button key={i} type="button" onClick={l.onClick} className={classes}>
                {l.text}
              </button>
            )
          })}
        </div>
      )}
    </li>
  )
}
