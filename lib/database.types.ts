export type Account = {
  id: string
  name: string
  type: 'credit' | 'debit'
  last_four: string | null
  color: string
  created_at: string
}

export type Transaction = {
  id: string
  account_id: string
  date: string
  description: string
  merchant: string | null
  amount: number
  category: string | null
  is_income: boolean
  statement_upload_id: string | null
  created_at: string
}

export type StatementUpload = {
  id: string
  account_id: string
  month: number
  year: number
  image_url: string | null
  created_at: string
}

export type AiRecommendation = {
  id: string
  month: number
  year: number
  income: number | null
  total_expenses: number
  content: string
  created_at: string
}

export type TransactionWithAccount = Transaction & {
  accounts: Pick<Account, 'name' | 'color' | 'type'>
}

export const CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Travel',
  'Shopping',
  'Entertainment',
  'Health & Medical',
  'Rent',
  'Utilities',
  'Subscriptions',
  'Education',
  'Personal Care',
  'Income',
  'Payment / Credit',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: Account
        Insert: { id?: string; name: string; type: 'credit' | 'debit'; last_four?: string | null; color?: string; created_at?: string }
        Update: Partial<Account>
        Relationships: []
      }
      transactions: {
        Row: Transaction
        Insert: { id?: string; account_id: string; date: string; description: string; merchant?: string | null; amount: number; category?: string | null; is_income?: boolean; statement_upload_id?: string | null; created_at?: string }
        Update: Partial<Transaction>
        Relationships: []
      }
      statement_uploads: {
        Row: StatementUpload
        Insert: { id?: string; account_id: string; month: number; year: number; image_url?: string | null; created_at?: string }
        Update: Partial<StatementUpload>
        Relationships: []
      }
      ai_recommendations: {
        Row: AiRecommendation
        Insert: { id?: string; month: number; year: number; income?: number | null; total_expenses: number; content: string; created_at?: string }
        Update: Partial<AiRecommendation>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
