import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // 1. 获取所有 Cookie
        getAll() {
          return request.cookies.getAll();
        },
        // 2. 批量设置/删除 Cookie (这是新版的核心改动)
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // --- 这里的逻辑保持不变 ---
  console.log("Middleware running on:", request.nextUrl.pathname);
  // 1. 获取用户信息 (这会刷新 Session)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log("User status:", user ? "Logged In" : "Guest");
  // 2. 路由保护逻辑
  // 如果用户未登录，且访问的不是登录页或注册相关的页，强制跳回 /login
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 3. 如果已登录，但访问的是登录页，踢回首页
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  // 匹配所有路径，除了静态资源和图片
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
