'use client'

import { useState } from 'react'
import { TransactionWithAccount, AiRecommendation } from '@/lib/database.types'
import Link from 'next/link'

export default function RecommendationsClient({
  transactions,
  pastRecommendation,
  month,
  year,
}: {
  transactions: TransactionWithAccount[]
  pastRecommendation: AiRecommendation | null
  month: number
  year: number
}) {
  const [income, setIncome] = useState('')
  const [loading, setLoading] = useState(false)
  const [recommendation, setRecommendation] = useState(pastRecommendation?.content ?? '')
  const [error, setError] = useState('')

  const expenses = transactions.filter((t) => !t.is_income && t.amount > 0)
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0)
  const detectedIncome = transactions.filter((t) => t.is_income || t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  async function handleGenerate() {
    if (expenses.length === 0) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: expenses,
          income: parseFloat(income) || detectedIncome || null,
          month,
          year,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRecommendation(data.content)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recommendations</h1>
          <p className="text-gray-500 text-sm">{monthName}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/recommendations?month=${prevMonth}&year=${prevYear}`} className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100">←</Link>
          <Link href={`/recommendations?month=${nextMonth}&year=${nextYear}`} className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100">→</Link>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 mb-4">No transactions for this month.</p>
          <Link href="/upload" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">Upload Statement</Link>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Expenses</p>
                <p className="text-xl font-bold text-red-600">${totalExpenses.toFixed(2)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Detected Income</p>
                <p className="text-xl font-bold text-green-600">${detectedIncome.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex items-end gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Income <span className="text-gray-400 font-normal">(override if needed)</span>
                </label>
                <input
                  type="number"
                  step="100"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder={detectedIncome > 0 ? `${detectedIncome.toFixed(2)} (detected)` : 'Enter monthly income...'}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-2"
              >
                {loading ? <><span className="animate-spin">⟳</span> Analyzing...</> : 'Generate Recommendations'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          {recommendation && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">AI Analysis & Recommendations</h2>
                {pastRecommendation && !loading && (
                  <span className="text-xs text-gray-400">Generated {new Date(pastRecommendation.created_at).toLocaleDateString()}</span>
                )}
              </div>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                {recommendation}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
