import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  // Placeholder: validate payload, score server-side, save submission
  // Business logic will be implemented later.
  const { slug } = params
  return NextResponse.json({ ok: true, message: `Received submission for ${slug}` })
}
