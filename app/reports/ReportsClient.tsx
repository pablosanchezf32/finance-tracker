'use client'

import Link from 'next/link'
import { TransactionWithAccount } from '@/lib/database.types'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const CHART_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16']

type Period = 'month' | 'ytd' | '3m' | '6m'

const PERIOD_LABELS: Record<Period, string> = {
  month: 'Month',
  ytd: 'Year to Date',
  '3m': '3 Months',
  '6m': '6 Months',
}

function getPeriodLabel(period: Period, month: number, year: number) {
  if (period === 'month') return new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  if (period === 'ytd') return `Year to Date ${year}`
  if (period === '3m') return `Last 3 Months`
  return `Last 6 Months`
}

export default function ReportsClient({
  transactions,
  month,
  year,
  period,
}: {
  transactions: TransactionWithAccount[]
  month: number
  year: number
  period: Period
}) {
  const expenses = transactions.filter((t) => !t.is_income && t.amount > 0 && t.category !== 'Payment / Credit')
  const incomeItems = transactions.filter((t) => (t.is_income || t.amount < 0) && t.category !== 'Payment / Credit')
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0)
  const totalIncome = incomeItems.reduce((s, t) => s + Math.abs(t.amount), 0)

  // By category
  const byCategory: Record<string, number> = {}
  for (const t of expenses) {
    const cat = t.category ?? 'Other'
    byCategory[cat] = (byCategory[cat] ?? 0) + t.amount
  }
  const categoryData = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))

  // By account
  const byAccount: Record<string, { name: string; color: string; amount: number }> = {}
  for (const t of expenses) {
    if (!t.accounts) continue
    if (!byAccount[t.account_id]) {
      byAccount[t.account_id] = { name: t.accounts.name, color: t.accounts.color, amount: 0 }
    }
    byAccount[t.account_id].amount += t.amount
  }
  const accountData = Object.values(byAccount).sort((a, b) => b.amount - a.amount)

  // By day (only for month view) or by month (for multi-month views)
  let timeData: { label: string; amount: number }[] = []
  if (period === 'month') {
    const byDay: Record<string, number> = {}
    for (const t of expenses) {
      const day = t.date.slice(8, 10)
      byDay[day] = (byDay[day] ?? 0) + t.amount
    }
    timeData = Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, amount]) => ({ label: day, amount: parseFloat(amount.toFixed(2)) }))
  } else {
    const byMonth: Record<string, number> = {}
    for (const t of expenses) {
      const key = t.date.slice(0, 7) // YYYY-MM
      byMonth[key] = (byMonth[key] ?? 0) + t.amount
    }
    timeData = Object.entries(byMonth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, amount]) => ({
        label: new Date(key + '-01').toLocaleString('default', { month: 'short', year: '2-digit' }),
        amount: parseFloat(amount.toFixed(2)),
      }))
  }

  // Opportunity cost calculations
  const avoidableExpenses = expenses.filter((t) => t.is_avoidable)
  const totalAvoidable = avoidableExpenses.reduce((s, t) => s + t.amount, 0)

  // Determine number of months in the selected period to compute monthly average
  const periodMonths = period === 'month' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : month
  const monthlyAvoidable = periodMonths > 0 ? totalAvoidable / periodMonths : 0

  // Future value of annuity: FV = PMT * [(1+r)^n - 1] / r
  // S&P 500 ~10-year average annual return: 12%
  const ANNUAL_RATE = 0.12
  const monthlyRate = Math.pow(1 + ANNUAL_RATE, 1 / 12) - 1
  function fvAnnuity(pmt: number, months: number) {
    return pmt * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate
  }
  const horizons = [
    { label: '1 year', months: 12 },
    { label: '5 years', months: 60 },
    { label: '10 years', months: 120 },
    { label: '20 years', months: 240 },
    { label: '30 years', months: 360 },
  ]

  // Avoidable breakdown by category
  const avoidableByCategory: Record<string, number> = {}
  for (const t of avoidableExpenses) {
    const cat = t.category ?? 'Other'
    avoidableByCategory[cat] = (avoidableByCategory[cat] ?? 0) + t.amount
  }
  const avoidableCategoryData = Object.entries(avoidableByCategory)
    .sort((a, b) => b[1] - a[1])

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  const label = getPeriodLabel(period, month, year)
  const periods: Period[] = ['month', 'ytd', '3m', '6m']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-gray-500 text-sm">{label}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            {periods.map((p) => (
              <Link
                key={p}
                href={`/reports?month=${month}&year=${year}&period=${p}`}
                className={`px-3 py-1.5 ${period === p ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                {PERIOD_LABELS[p]}
              </Link>
            ))}
          </div>
          {period === 'month' && (
            <div className="flex gap-1">
              <Link href={`/reports?month=${prevMonth}&year=${prevYear}&period=month`} className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100">←</Link>
              <Link href={`/reports?month=${nextMonth}&year=${nextYear}&period=month`} className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100">→</Link>
            </div>
          )}
          {period !== 'month' && (
            <div className="flex gap-1">
              <Link href={`/reports?month=${month}&year=${year - 1}&period=${period}`} className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100">←</Link>
              <Link href={`/reports?month=${month}&year=${year + 1}&period=${period}`} className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100">→</Link>
            </div>
          )}
        </div>
      </div>

      {/* Opportunity Cost */}
      {totalAvoidable > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-amber-900">Opportunity Cost</h2>
            <p className="text-sm text-amber-700 mt-0.5">
              Avoidable expenses you could be investing instead — projected at 12%/yr (S&P 500 ~10-year avg)
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="bg-white rounded-lg border border-amber-200 px-4 py-3 min-w-36">
              <p className="text-xs text-amber-600">Avoidable this period</p>
              <p className="text-xl font-bold text-amber-800 mt-0.5">${totalAvoidable.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg border border-amber-200 px-4 py-3 min-w-36">
              <p className="text-xs text-amber-600">Monthly average</p>
              <p className="text-xl font-bold text-amber-800 mt-0.5">${monthlyAvoidable.toFixed(2)}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-amber-800 mb-2 uppercase tracking-wide">
              If you invested ${monthlyAvoidable.toFixed(0)}/mo instead
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {horizons.map(({ label, months }) => (
                <div key={label} className="bg-white rounded-lg border border-amber-200 px-3 py-2.5 text-center">
                  <p className="text-xs text-amber-600">{label}</p>
                  <p className="text-sm font-bold text-amber-900 mt-0.5">
                    ${fvAnnuity(monthlyAvoidable, months).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {avoidableCategoryData.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-800 mb-2 uppercase tracking-wide">Avoidable by category</p>
              <div className="flex flex-wrap gap-2">
                {avoidableCategoryData.map(([cat, amount]) => (
                  <div key={cat} className="bg-white border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
                    <span className="text-sm text-amber-900 font-medium">{cat}</span>
                    <span className="text-sm text-amber-700">${amount.toFixed(2)}</span>
                    <span className="text-xs text-amber-500">({((amount / totalAvoidable) * 100).toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400">No transactions for this period.</p>
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
              <p className="text-sm text-gray-500">Transactions</p>
              <p className="text-2xl font-bold mt-1">{expenses.length}</p>
            </div>
          </div>

          {/* Spending by Account */}
          {accountData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold mb-4">Spending by Card / Account</h2>
              <div className="space-y-3">
                {accountData.map((acc) => {
                  const pct = totalExpenses > 0 ? (acc.amount / totalExpenses) * 100 : 0
                  return (
                    <div key={acc.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.color }} />
                          <span className="text-sm font-medium text-gray-700">{acc.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold">${acc.amount.toFixed(2)}</span>
                          <span className="text-xs text-gray-400 ml-1">({pct.toFixed(0)}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: acc.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Category breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold mb-4">Spending by Category</h2>
            <div className="grid grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => typeof v === 'number' ? `$${v.toFixed(2)}` : String(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 overflow-y-auto max-h-60">
                {categoryData.map(({ name, value }, i) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-sm text-gray-700">{name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold">${value.toFixed(2)}</span>
                      <span className="text-xs text-gray-400 ml-1">({((value / totalExpenses) * 100).toFixed(0)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Time chart */}
          {timeData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold mb-4">{period === 'month' ? 'Daily Spending' : 'Monthly Spending'}</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={timeData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: unknown) => typeof v === 'number' ? `$${v.toFixed(2)}` : String(v)} />
                  <Bar dataKey="amount" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
