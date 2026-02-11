// src/lib/supabase.ts
import { createBrowserClient } from "@supabase/ssr";

// ⚠️ 必须用 createBrowserClient，它会自动把 Session 写入 Cookies
// 如果你用的是普通的 createClient，Middleware 是读不到登录状态的！
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
