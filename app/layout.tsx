import './globals.css'
import React from 'react'
import AuthBar from './components/AuthBar'
import RootClient from './RootClient'
import { inter, playfair, cormorant } from './fonts'

export const metadata = {
  title: 'This or That Game',
  description: 'Customizable two-option guessing game'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} ${cormorant.variable}`}>
      <body data-theme="default" className="font-body">
        <a href="#main-content" className="z-50 absolute top-6 px-3 py-2 text-sm transform -translate-y-12 focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:relative focus:top-0">Skip to main content</a>
        <AuthBar />
        <RootClient>
          <main id="main-content" role="main" className="min-h-screen text-gray-900 font-body relative">
            {children}
          </main>
        </RootClient>
      </body>
    </html>
  )
}
