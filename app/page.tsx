import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { TransactionWithAccount } from '@/lib/database.types'

async function getDashboardData(month: number, year: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = `${year}-${String(month).padStart(2, '0')}-31`

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, accounts(name, color, type)')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })

  const { data: accounts } = await supabase.from('accounts').select('*')

  return {
    transactions: (transactions as TransactionWithAccount[]) ?? [],
    accounts: accounts ?? [],
  }
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const month = parseInt(params.month ?? String(now.getMonth() + 1))
  const year = parseInt(params.year ?? String(now.getFullYear()))

  const { transactions, accounts } = await getDashboardData(month, year)

  const expenses = transactions.filter((t) => !t.is_income && t.amount > 0 && t.category !== 'Payment / Credit')
  const incomeItems = transactions.filter((t) => (t.is_income || t.amount < 0) && t.category !== 'Payment / Credit')
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0)
  const totalIncome = incomeItems.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const byCategory: Record<string, number> = {}
  for (const t of expenses) {
    const cat = t.category ?? 'Other'
    byCategory[cat] = (byCategory[cat] ?? 0) + t.amount
  }
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 text-sm">{monthName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/?month=${prevMonth}&year=${prevYear}`} className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100">←</Link>
          <Link href={`/?month=${nextMonth}&year=${nextYear}`} className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100">→</Link>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 mb-4">No transactions for this month.</p>
          <Link href="/upload" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
            Upload Statement
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600 mt-1">${totalExpenses.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Total Income</p>
              <p className="text-2xl font-bold text-green-600 mt-1">${totalIncome.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Net</p>
              <p className={`text-2xl font-bold mt-1 ${totalIncome - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${(totalIncome - totalExpenses).toFixed(2)}
              </p>
            </div>
          </div>

          {accounts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold mb-3">By Account</h2>
              <div className="grid grid-cols-2 gap-3">
                {accounts.map((acc) => {
                  const accTotal = expenses.filter((t) => t.account_id === acc.id).reduce((s, t) => s + t.amount, 0)
                  return (
                    <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.color }} />
                        <span className="text-sm font-medium">{acc.name}</span>
                        {acc.last_four && <span className="text-xs text-gray-400">••{acc.last_four}</span>}
                      </div>
                      <span className="text-sm font-semibold text-red-600">${accTotal.toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {topCategories.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold mb-3">Top Spending Categories</h2>
              <div className="space-y-2">
                {topCategories.map(([cat, amount]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-40 truncate">{cat}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.min(100, (amount / totalExpenses) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-medium w-20 text-right">${amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Recent Transactions</h2>
              <Link href="/transactions" className="text-sm text-indigo-600 hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-gray-100">
              {transactions.slice(0, 8).map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.accounts?.color }} />
                    <div>
                      <p className="text-sm font-medium">{t.merchant || t.description}</p>
                      <p className="text-xs text-gray-400">{t.date} · {t.accounts?.name} · {t.category}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${t.amount < 0 || t.is_income ? 'text-green-600' : 'text-red-600'}`}>
                    {t.amount < 0 ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
