import { supabase } from '@/lib/supabase'
import ReportsClient from './ReportsClient'

export default async function ReportsPage({
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
    .order('date', { ascending: false })

  return <ReportsClient transactions={transactions ?? []} month={month} year={year} />
}
