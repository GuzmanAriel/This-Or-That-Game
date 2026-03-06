import LeaderboardClient from './LeaderboardClient'
import { getSupabaseServiceClient } from '../../../../lib/supabase'

export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const supabase = getSupabaseServiceClient()
    const { data } = await supabase.from('games').select('title').eq('slug', params.slug).limit(1).maybeSingle()
    const left = (data as any)?.title ?? 'This or That Game'
    return { title: `${left} | Leaderboard` }
  } catch (e) {
    return { title: `This or That Game | Leaderboard` }
  }
}

export default function Page({ params }: { params: { slug: string } }) {
  return <LeaderboardClient params={params} />
}

