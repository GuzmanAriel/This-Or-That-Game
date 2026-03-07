"use client"

import React from 'react'

type Props = {
  id?: string
  children?: React.ReactNode
  actions?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export default function QuestionCard({ id, children, actions, footer, className }: Props) {
  return (
    <div className={`rounded border p-3 question-card ${className ?? ''}`} data-component="question-card">
        {children}
        {actions ? <div className="mt-4">{actions}</div> : null}
      {footer ? <div className="mt-2 text-sm text-red-600">{footer}</div> : null}
    </div>
  )
}
