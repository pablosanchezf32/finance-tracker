import { supabase } from '@/lib/supabase'
import ReportsClient from './ReportsClient'

type Period = 'month' | 'ytd' | '3m' | '6m'

function getDateRange(period: Period, month: number, year: number) {
  if (period === 'ytd') {
    return { from: `${year}-01-01`, to: `${year}-12-31` }
  }
  if (period === '3m') {
    const end = new Date(year, month - 1, 31)
    const start = new Date(end)
    start.setMonth(start.getMonth() - 2)
    start.setDate(1)
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
  }
  if (period === '6m') {
    const end = new Date(year, month - 1, 31)
    const start = new Date(end)
    start.setMonth(start.getMonth() - 5)
    start.setDate(1)
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
  }
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: `${year}-${String(month).padStart(2, '0')}-31`,
  }
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; period?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const month = parseInt(params.month ?? String(now.getMonth() + 1))
  const year = parseInt(params.year ?? String(now.getFullYear()))
  const period = (params.period ?? 'month') as Period

  const { from, to } = getDateRange(period, month, year)

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, accounts(name, color, type)')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })

  return <ReportsClient transactions={transactions ?? []} month={month} year={year} period={period} />
}
