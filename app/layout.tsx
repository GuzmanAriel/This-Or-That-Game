import './globals.css'
import React from 'react'
import AuthBar from './components/AuthBar'

export const metadata = {
  title: 'Is It Mom or Dad?',
  description: 'Baby shower trivia — Is It Mom or Dad?'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthBar />
        <main className="min-h-screen bg-gray-50 text-gray-900">
          {children}
        </main>
      </body>
    </html>
  )
}
