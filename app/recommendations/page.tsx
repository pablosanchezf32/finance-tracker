import { supabase } from '@/lib/supabase'
import RecommendationsClient from './RecommendationsClient'

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const month = parseInt(params.month ?? String(now.getMonth() + 1))
  const year = parseInt(params.year ?? String(now.getFullYear()))

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = `${year}-${String(month).padStart(2, '0')}-31`

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, accounts(name, color, type)')
    .gte('date', from)
    .lte('date', to)

  const { data: pastRecs } = await supabase
    .from('ai_recommendations')
    .select('*')
    .eq('month', month)
    .eq('year', year)
    .order('created_at', { ascending: false })
    .limit(1)

  return (
    <RecommendationsClient
      transactions={transactions ?? []}
      pastRecommendation={pastRecs?.[0] ?? null}
      month={month}
      year={year}
    />
  )
}
