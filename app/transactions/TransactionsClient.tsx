'use client'

import { useState } from 'react'
import { Account, TransactionWithAccount, CATEGORIES } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

type EditState = {
  merchant: string
  description: string
  category: string
  amount: string
  date: string
  is_income: boolean
}

export default function TransactionsClient({
  accounts,
  initialTransactions,
}: {
  accounts: Account[]
  initialTransactions: TransactionWithAccount[]
}) {
  const [transactions, setTransactions] = useState(initialTransactions)
  const [filterAccount, setFilterAccount] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = transactions.filter((t) => {
    if (filterAccount && t.account_id !== filterAccount) return false
    if (filterCategory && t.category !== filterCategory) return false
    if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !(t.merchant ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalExpenses = filtered.filter((t) => !t.is_income && t.amount > 0 && t.category !== 'Payment / Credit').reduce((s, t) => s + t.amount, 0)
  const totalIncome = filtered.filter((t) => (t.is_income || t.amount < 0) && t.category !== 'Payment / Credit').reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalPayments = filtered.filter((t) => t.category === 'Payment / Credit').reduce((s, t) => s + Math.abs(t.amount), 0)

  function startEdit(t: TransactionWithAccount) {
    setEditingId(t.id)
    setEditState({
      merchant: t.merchant ?? '',
      description: t.description,
      category: t.category ?? '',
      amount: String(Math.abs(t.amount)),
      date: t.date,
      is_income: t.is_income,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditState(null)
  }

  async function saveEdit(t: TransactionWithAccount) {
    if (!editState) return
    setSaving(true)
    const amount = parseFloat(editState.amount)
    const updates = {
      merchant: editState.merchant || null,
      description: editState.description,
      category: editState.category,
      amount: t.amount < 0 ? -Math.abs(amount) : Math.abs(amount),
      date: editState.date,
      is_income: editState.is_income,
    }
    const { error } = await supabase.from('transactions').update(updates).eq('id', t.id)
    if (!error) {
      setTransactions((prev) => prev.map((tx) => tx.id === t.id ? { ...tx, ...updates } : tx))
      setEditingId(null)
      setEditState(null)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this transaction?')) return
    await supabase.from('transactions').delete().eq('id', id)
    setTransactions((prev) => prev.filter((t) => t.id !== id))
  }

  async function handleRemoveDuplicates() {
    const seen = new Map<string, string>()
    const toDelete: string[] = []
    const sorted = [...transactions].sort((a, b) => a.created_at.localeCompare(b.created_at))
    for (const t of sorted) {
      const key = `${t.account_id}|${t.date}|${t.description}|${t.amount}`
      if (seen.has(key)) {
        toDelete.push(t.id)
      } else {
        seen.set(key, t.id)
      }
    }
    if (toDelete.length === 0) {
      alert('No duplicates found.')
      return
    }
    if (!confirm(`Found ${toDelete.length} duplicate(s). Delete them?`)) return
    await supabase.from('transactions').delete().in('id', toDelete)
    setTransactions((prev) => prev.filter((t) => !toDelete.includes(t.id)))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <button onClick={handleRemoveDuplicates} className="text-xs text-gray-400 hover:text-red-500 underline">
          Remove duplicates
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Merchant or description..."
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Account</label>
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {(filterAccount || filterCategory || search) && (
          <button
            onClick={() => { setFilterAccount(''); setFilterCategory(''); setSearch('') }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
        <div className="ml-auto flex gap-4 text-sm">
          <span className="text-red-600 font-medium">Expenses: ${totalExpenses.toFixed(2)}</span>
          <span className="text-green-600 font-medium">Income: ${totalIncome.toFixed(2)}</span>
          {totalPayments > 0 && <span className="text-blue-600 font-medium">Payments: ${totalPayments.toFixed(2)}</span>}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400">No transactions found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Merchant</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((t) => {
                const isEditing = editingId === t.id
                return isEditing && editState ? (
                  <tr key={t.id} className="bg-indigo-50">
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={editState.date}
                        onChange={(e) => setEditState({ ...editState, date: e.target.value })}
                        className="border border-gray-300 rounded px-2 py-1 text-xs w-32"
                      />
                    </td>
                    <td className="px-4 py-2 space-y-1">
                      <input
                        value={editState.merchant}
                        onChange={(e) => setEditState({ ...editState, merchant: e.target.value })}
                        placeholder="Merchant"
                        className="border border-gray-300 rounded px-2 py-1 text-xs w-full"
                      />
                      <input
                        value={editState.description}
                        onChange={(e) => setEditState({ ...editState, description: e.target.value })}
                        placeholder="Description"
                        className="border border-gray-300 rounded px-2 py-1 text-xs w-full text-gray-500"
                      />
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.accounts?.color }} />
                        {t.accounts?.name}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="space-y-1">
                        <select
                          value={editState.category}
                          onChange={(e) => setEditState({ ...editState, category: e.target.value })}
                          className="border border-gray-300 rounded px-2 py-1 text-xs w-full"
                        >
                          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editState.is_income}
                            onChange={(e) => setEditState({ ...editState, is_income: e.target.checked })}
                          />
                          Mark as income
                        </label>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={editState.amount}
                        onChange={(e) => setEditState({ ...editState, amount: e.target.value })}
                        className="border border-gray-300 rounded px-2 py-1 text-xs w-24 text-right"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(t)}
                          disabled={saving}
                          className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1 rounded disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button onClick={cancelEdit} className="text-xs text-gray-500 hover:text-gray-700">
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => startEdit(t)}>
                    <td className="px-4 py-3 text-gray-600">{t.date}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{t.merchant || t.description}</p>
                      {t.merchant && <p className="text-xs text-gray-400 truncate max-w-xs">{t.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.accounts?.color }} />
                        <span className="text-gray-600">{t.accounts?.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">{t.category}</span>
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${t.category === 'Payment / Credit' ? 'text-blue-600' : t.amount < 0 || t.is_income ? 'text-green-600' : 'text-red-600'}`}>
                      {t.amount < 0 ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleDelete(t.id)} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
