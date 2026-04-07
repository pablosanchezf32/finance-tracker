'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Account } from '@/lib/database.types'
import { useRouter } from 'next/navigation'

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6']

export default function AccountsClient({ initialAccounts }: { initialAccounts: Account[] }) {
  const router = useRouter()
  const [accounts, setAccounts] = useState(initialAccounts)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'credit' as 'credit' | 'debit', last_four: '', color: COLORS[0] })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase.from('accounts').insert({
      name: form.name,
      type: form.type,
      last_four: form.last_four || null,
      color: form.color,
    }).select().single()
    if (!error && data) {
      setAccounts([...accounts, data as Account])
      setShowForm(false)
      setForm({ name: '', type: 'credit', last_four: '', color: COLORS[0] })
      router.refresh()
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this account and all its transactions?')) return
    await supabase.from('accounts').delete().eq('id', id)
    setAccounts(accounts.filter((a) => a.id !== id))
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
        >
          + Add Account
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold mb-4">New Account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Chase Sapphire"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'credit' | 'debit' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="credit">Credit Card</option>
                  <option value="debit">Debit / Bank</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last 4 digits (optional)</label>
                <input
                  value={form.last_four}
                  onChange={(e) => setForm({ ...form, last_four: e.target.value.slice(0, 4) })}
                  placeholder="1234"
                  maxLength={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Account'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400">No accounts yet. Add your first account above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {accounts.map((acc) => (
            <div key={acc.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                  <div>
                    <p className="font-semibold">{acc.name}</p>
                    <p className="text-sm text-gray-500 capitalize">
                      {acc.type === 'credit' ? 'Credit Card' : 'Debit / Bank'}
                      {acc.last_four && ` ••${acc.last_four}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(acc.id)}
                  className="text-gray-400 hover:text-red-500 text-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
