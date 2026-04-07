import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { CATEGORIES } from '@/lib/database.types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const images = formData.getAll('images') as File[]
    const year = formData.get('year') ? parseInt(formData.get('year') as string) : new Date().getFullYear()

    if (images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }

    // Convert images to base64
    const imageContents: Anthropic.ImageBlockParam[] = await Promise.all(
      images.map(async (file) => {
        const buffer = await file.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64,
          },
        }
      })
    )

    const categoriesList = CATEGORIES.join(', ')

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16000,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: `Extract all transactions from this bank/credit card statement screenshot.

For each transaction, return:
- date: ISO format (YYYY-MM-DD). This statement is from the year ${year} — use that year for all dates unless the statement clearly shows a different year.
- description: full original text from statement
- merchant: cleaned merchant name (e.g. "Starbucks" not "STARBUCKS #1234 CA")
- amount: positive number for purchases/expenses, negative for credits/payments/refunds
- category: one of: ${categoriesList}
- is_income: true only for salary deposits, payroll, bank transfers IN, tax refunds. False for everything else including payments/credits to the card.

Skip: header rows, balance summaries, account info, anything that's not a transaction.

Respond with ONLY valid JSON in this exact format:
{
  "transactions": [
    {
      "date": "2024-03-04",
      "description": "GLOBAL HUB CAF CAFEQPS EVANSTON IL",
      "merchant": "Global Hub Cafe",
      "amount": 12.15,
      "category": "Food & Dining",
      "is_income": false
    }
  ]
}`,
            },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
    }

    let parsed
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      // Response was truncated — extract all complete transaction objects
      const partial = jsonMatch[0]
      const txMatches = partial.match(/\{[^{}]*"date"[^{}]*\}/g) ?? []
      const transactions = txMatches.flatMap((chunk) => {
        try { return [JSON.parse(chunk)] } catch { return [] }
      })
      if (transactions.length === 0) {
        return NextResponse.json({ error: 'AI response was truncated and could not be recovered. Try uploading fewer images at once.' }, { status: 500 })
      }
      parsed = { transactions }
    }
    return NextResponse.json(parsed)
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal error' }, { status: 500 })
  }
}
