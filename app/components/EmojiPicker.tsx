"use client"

import React, { useState, useId } from 'react'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'

type Props = {
  value: string | null
  onChange: (v: string | null) => void
  ariaLabel?: string
  ariaDescribedBy?: string
}

export default function EmojiPicker({ value, onChange, ariaLabel, ariaDescribedBy }: Props) {
  const [open, setOpen] = useState(false)
  const uid = useId()
  const popoverId = `emoji-picker-${uid}`

  return (
    <div className="relative inline-block" data-component="emoji-picker">
      <button
        type="button"
        onClick={() => setOpen(s => !s)}
        className="px-2 py-1 border rounded text-lg"
        aria-label={ariaLabel ?? value ?? 'Emoji picker'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-describedby={ariaDescribedBy}
      >
        {value ?? '🙂'}
      </button>
      {open && (
        <div id={popoverId} role="dialog" aria-modal="false" className="absolute z-20 mt-2 w-72 p-2 bg-white border rounded shadow">
          <div>
            <Picker data={data} onEmojiSelect={(e: any) => { onChange(e.native); setOpen(false) }} />
          </div>
          <div className="mt-2 text-xs text-center">
            <button type="button" onClick={() => { onChange(null); setOpen(false) }} className="text-red-600">Clear</button>
          </div>
        </div>
      )}
    </div>
  )
}
