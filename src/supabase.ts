import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl) {
    console.error('SUPABASE_URL is not defined. Please check your environment variables.')
}

if (!supabaseKey) {
    console.error('SUPABASE_ANON_KEY is not defined. Please check your environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)