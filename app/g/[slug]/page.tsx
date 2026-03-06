import GameClient from './GameClient'
import { getSupabaseServiceClient } from '../../../lib/supabase'

export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const supabase = getSupabaseServiceClient()
    const { data } = await supabase.from('games').select('title').eq('slug', params.slug).limit(1).maybeSingle()
    const left = (data as any)?.title ?? 'This or That Game'
    return { title: `${left} | Game` }
  } catch (e) {
    return { title: `This or That Game | Game` }
  }
}

export default function Page({ params }: { params: { slug: string } }) {
  return <GameClient params={params} />
}
