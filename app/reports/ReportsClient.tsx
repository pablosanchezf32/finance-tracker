'use client'

import Link from 'next/link'
import { TransactionWithAccount } from '@/lib/database.types'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const CHART_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16']

export default function ReportsClient({
  transactions,
  month,
  year,
}: {
  transactions: TransactionWithAccount[]
  month: number
  year: number
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

  // By day of month
  const byDay: Record<string, number> = {}
  for (const t of expenses) {
    const day = t.date.slice(8, 10)
    byDay[day] = (byDay[day] ?? 0) + t.amount
  }
  const dailyData = Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, amount]) => ({ day: parseInt(day), amount: parseFloat(amount.toFixed(2)) }))

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monthly Report</h1>
          <p className="text-gray-500 text-sm">{monthName}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/reports?month=${prevMonth}&year=${prevYear}`} className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100">←</Link>
          <Link href={`/reports?month=${nextMonth}&year=${nextYear}`} className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100">→</Link>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400">No transactions for this month.</p>
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

          {/* By account */}
          {accountData.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold mb-4">Spending by Account</h2>
              <div className="space-y-3">
                {accountData.map((acc) => (
                  <div key={acc.name} className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.color }} />
                    <span className="text-sm w-40 text-gray-700">{acc.name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${(acc.amount / totalExpenses) * 100}%`, backgroundColor: acc.color }} />
                    </div>
                    <span className="text-sm font-semibold w-20 text-right">${acc.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily spending */}
          {dailyData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold mb-4">Daily Spending</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
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
