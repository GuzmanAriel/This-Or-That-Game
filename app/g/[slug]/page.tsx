import GameClient from './GameClient'
import { getSupabaseServiceClient } from '../../../lib/supabase'

export const revalidate = 60 // seconds - cache metadata briefly

export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const supabase = getSupabaseServiceClient()
    const { data } = await supabase.from('games').select('title').eq('slug', params.slug).maybeSingle()
    const title = (data as { title?: string } | null)?.title ?? 'This or That Game'
    return { title: `${title} | Game` }
  } catch (e) {
    return { title: `This or That Game | Game` }
  }
}

export default function Page({ params }: { params: { slug: string } }) {
  return <GameClient params={params} />
}
