'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Account, CATEGORIES } from '@/lib/database.types'
import { useRouter } from 'next/navigation'

type ExtractedTransaction = {
  date: string
  description: string
  merchant: string
  amount: number
  category: string
  is_income: boolean
}

export default function UploadClient({ accounts }: { accounts: Account[] }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedAccount, setSelectedAccount] = useState('')
  const [statementYear, setStatementYear] = useState(new Date().getFullYear())
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedTransaction[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      const imageFiles: File[] = []
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) imageFiles.push(new File([file], `paste-${Date.now()}.png`, { type: file.type }))
        }
      }
      if (imageFiles.length > 0) handleFiles(imageFiles)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleFiles(newFiles: FileList | File[] | null) {
    if (!newFiles) return
    const arr = newFiles instanceof FileList ? Array.from(newFiles) : newFiles
    setFiles((prev) => [...prev, ...arr])
    arr.forEach((f) => {
      const reader = new FileReader()
      reader.onload = (e) => setPreviews((prev) => [...prev, e.target?.result as string])
      reader.readAsDataURL(f)
    })
  }

  async function handleExtract() {
    if (!selectedAccount || files.length === 0) return
    setExtracting(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('account_id', selectedAccount)
      formData.append('year', String(statementYear))
      files.forEach((f) => formData.append('images', f))

      const res = await fetch('/api/extract-transactions', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      setExtracted(data.transactions)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setExtracting(false)
    }
  }

  function updateRow(i: number, field: keyof ExtractedTransaction, value: string | number | boolean) {
    setExtracted((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  function removeRow(i: number) {
    setExtracted((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      // Check for duplicates: fetch existing transactions for this account
      const dates = extracted.map((t) => t.date)
      const minDate = dates.reduce((a, b) => a < b ? a : b)
      const maxDate = dates.reduce((a, b) => a > b ? a : b)
      const { data: existing } = await supabase
        .from('transactions')
        .select('date, description, amount')
        .eq('account_id', selectedAccount)
        .gte('date', minDate)
        .lte('date', maxDate)

      const existingKeys = new Set(
        (existing ?? []).map((t) => `${t.date}|${t.description}|${t.amount}`)
      )
      const deduped = extracted.filter(
        (t) => !existingKeys.has(`${t.date}|${t.description}|${t.amount}`)
      )

      if (deduped.length === 0) {
        setError('All transactions already exist — no new ones to save.')
        setSaving(false)
        return
      }

      if (deduped.length < extracted.length) {
        const skipped = extracted.length - deduped.length
        setError(`${skipped} duplicate(s) skipped. Saving ${deduped.length} new transaction(s).`)
      }

      // Upload images to storage
      const uploadIds: string[] = []
      for (const file of files) {
        const path = `${selectedAccount}/${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage.from('statements').upload(path, file)
        if (!uploadError) {
          const { data: uploadRecord } = await supabase.from('statement_uploads').insert({
            account_id: selectedAccount,
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            image_url: path,
          }).select().single()
          if (uploadRecord) uploadIds.push(uploadRecord.id)
        }
      }

      const uploadId = uploadIds[0] ?? null

      const { error: txError } = await supabase.from('transactions').insert(
        deduped.map((t) => ({
          account_id: selectedAccount,
          date: t.date,
          description: t.description,
          merchant: t.merchant || null,
          amount: t.amount,
          category: t.category,
          is_income: t.is_income,
          statement_upload_id: uploadId,
        }))
      )
      if (txError) throw new Error(txError.message)

      setDone(true)
      setTimeout(() => router.push('/transactions'), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-400 mb-4">You need to create an account before uploading statements.</p>
        <a href="/accounts" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
          Go to Accounts
        </a>
      </div>
    )
  }

  if (done) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-green-600 font-semibold text-lg">Transactions saved!</p>
        <p className="text-gray-400 text-sm mt-1">Redirecting to transactions...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Upload Statement</h1>

      {/* Step 1: Account + file */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold">1. Select account & upload screenshots</h2>

        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            >
              <option value="">Select account...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.last_four ? ` ••${a.last_four}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statement Year</label>
            <select
              value={statementYear}
              onChange={(e) => setStatementYear(parseInt(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {[2023, 2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        >
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <p className="text-gray-500 text-sm">Drag & drop screenshots here, or <span className="text-indigo-600 font-medium">click to browse</span></p>
          <p className="text-gray-400 text-xs mt-1">PNG, JPG — you can upload multiple pages</p>
        </div>

        {previews.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            {previews.map((src, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`page ${i + 1}`} className="w-32 h-24 object-cover rounded-lg border border-gray-200" />
                <button
                  onClick={() => { setFiles((p) => p.filter((_, idx) => idx !== i)); setPreviews((p) => p.filter((_, idx) => idx !== i)) }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100"
                >×</button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleExtract}
          disabled={!selectedAccount || files.length === 0 || extracting}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-2"
        >
          {extracting ? (
            <><span className="animate-spin">⟳</span> Extracting transactions...</>
          ) : (
            'Extract Transactions with AI'
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Step 2: Review */}
      {extracted.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold">2. Review & confirm ({extracted.length} transactions found)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500 text-xs uppercase">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Merchant</th>
                  <th className="pb-2 pr-3">Description</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3">Amount</th>
                  <th className="pb-2 pr-3">Income?</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {extracted.map((t, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3">
                      <input
                        type="date"
                        value={t.date}
                        onChange={(e) => updateRow(i, 'date', e.target.value)}
                        className="border border-gray-200 rounded px-2 py-1 text-xs w-32"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        value={t.merchant}
                        onChange={(e) => updateRow(i, 'merchant', e.target.value)}
                        className="border border-gray-200 rounded px-2 py-1 text-xs w-32"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        value={t.description}
                        onChange={(e) => updateRow(i, 'description', e.target.value)}
                        className="border border-gray-200 rounded px-2 py-1 text-xs w-40"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={t.category}
                        onChange={(e) => updateRow(i, 'category', e.target.value)}
                        className="border border-gray-200 rounded px-2 py-1 text-xs"
                      >
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        step="0.01"
                        value={t.amount}
                        onChange={(e) => updateRow(i, 'amount', parseFloat(e.target.value))}
                        className="border border-gray-200 rounded px-2 py-1 text-xs w-24"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={t.is_income}
                        onChange={(e) => updateRow(i, 'is_income', e.target.checked)}
                      />
                    </td>
                    <td className="py-2">
                      <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-40"
          >
            {saving ? 'Saving...' : `Save ${extracted.length} Transactions`}
          </button>
        </div>
      )}
    </div>
  )
}
