import { supabase } from '@/lib/supabase'
import TransactionsClient from './TransactionsClient'

export default async function TransactionsPage() {
  const { data: accounts } = await supabase.from('accounts').select('*').order('name')
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, accounts(name, color, type)')
    .order('date', { ascending: false })
    .limit(500)
  return <TransactionsClient accounts={accounts ?? []} initialTransactions={transactions ?? []} />
}
