import { createClient} from '@supabase/supabase-js'

// 读取环境变量
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 创建并导出客户端实例
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
