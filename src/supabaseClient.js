import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qrhjrkratuwfkljcvavu.supabase.co'
const supabaseKey = 'sb_publishable_sPZsPdOvXkvsBpIYjqrxeg_bSk4IKX2'

export const supabase = createClient(supabaseUrl, supabaseKey)