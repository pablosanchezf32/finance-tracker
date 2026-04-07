import { supabase } from '@/lib/supabase'
import UploadClient from './UploadClient'

export default async function UploadPage() {
  const { data: accounts } = await supabase.from('accounts').select('*').order('created_at')
  return <UploadClient accounts={accounts ?? []} />
}
