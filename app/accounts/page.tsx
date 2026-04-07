import { supabase } from '@/lib/supabase'
import AccountsClient from './AccountsClient'

export default async function AccountsPage() {
  const { data: accounts } = await supabase.from('accounts').select('*').order('created_at')
  return <AccountsClient initialAccounts={accounts ?? []} />
}
