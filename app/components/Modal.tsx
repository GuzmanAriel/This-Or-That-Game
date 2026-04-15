"use client"

import React, { useEffect, useRef } from 'react'

type Props = {
  title?: string
  ariaLabel?: string
  onClose?: () => void
  children?: React.ReactNode
  className?: string
}

export default function Modal({ title, ariaLabel, onClose, children, className }: Props) {
  const contentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} />
      <div
        ref={contentRef}
        role={title ? 'dialog' : undefined}
        aria-modal="true"
        aria-label={title ? undefined : ariaLabel}
        aria-labelledby={title ? 'modal-title' : undefined}
        className={`${className ?? ''} relative bg-white rounded max-w-md w-full p-6 shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-start justify-between">
            <h3 id="modal-title" className="text-lg font-medium">{title}</h3>
            <button className="text-sm text-gray-600" onClick={() => onClose?.()}>Close</button>
          </div>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
