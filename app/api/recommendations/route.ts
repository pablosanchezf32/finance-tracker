import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { TransactionWithAccount } from '@/lib/database.types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { transactions, income, month, year } = await req.json() as {
      transactions: TransactionWithAccount[]
      income: number | null
      month: number
      year: number
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 })
    }

    const totalExpenses = transactions.reduce((s: number, t: TransactionWithAccount) => s + t.amount, 0)

    // Build category summary
    const byCategory: Record<string, number> = {}
    for (const t of transactions) {
      const cat = t.category ?? 'Other'
      byCategory[cat] = (byCategory[cat] ?? 0) + t.amount
    }
    const categorySummary = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `- ${cat}: $${amt.toFixed(2)}`)
      .join('\n')

    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
    const savingsRate = income ? ((income - totalExpenses) / income * 100).toFixed(1) : null

    const prompt = `You are a personal finance advisor. Analyze the following spending data for ${monthName} and provide actionable recommendations.

## Financial Summary
${income ? `Monthly Income: $${income.toFixed(2)}` : 'Income: not provided'}
Total Expenses: $${totalExpenses.toFixed(2)}
${savingsRate ? `Savings Rate: ${savingsRate}%` : ''}

## Spending by Category
${categorySummary}

## Notable transactions (top 10 by amount)
${transactions
  .sort((a: TransactionWithAccount, b: TransactionWithAccount) => b.amount - a.amount)
  .slice(0, 10)
  .map((t: TransactionWithAccount) => `- ${t.merchant || t.description}: $${t.amount.toFixed(2)} (${t.category})`)
  .join('\n')}

Please provide:
1. **Spending Overview** — a brief honest assessment of the spending pattern
2. **Top Areas to Cut** — 3-5 specific, actionable recommendations with estimated savings
3. **What's Looking Good** — positive observations
4. **Monthly Goal** — one concrete financial goal for next month with a specific target amount

Be specific, realistic, and avoid generic advice. Reference the actual numbers from the data.`

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : ''

    // Save recommendation
    await supabase.from('ai_recommendations').insert({
      month,
      year,
      income: income ?? null,
      total_expenses: totalExpenses,
      content,
    })

    return NextResponse.json({ content })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal error' }, { status: 500 })
  }
}
