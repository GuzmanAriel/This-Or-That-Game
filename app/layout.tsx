import './globals.css'
import React from 'react'
import AuthBar from './components/AuthBar'
import RootClient from './RootClient'
import { inter, playfair, cormorant } from './fonts'

export const metadata = {
  title: 'Is It Mom or Dad?',
  description: 'Baby shower trivia — Is It Mom or Dad?'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} ${cormorant.variable}`}>
      <body data-theme="default" className="font-body">
        <AuthBar />
        <RootClient>
          <main className="min-h-screen text-gray-900 font-body relative">
            {children}
          </main>
        </RootClient>
      </body>
    </html>
  )
}
