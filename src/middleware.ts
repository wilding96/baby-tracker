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

  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname.startsWith("/login");
  const isAuthRoute = pathname.startsWith("/auth");
  const isBoardRoute = pathname.startsWith("/board");
  const isWelcomeRoute = pathname.startsWith("/welcome");
  const needsFamily =
    pathname === "/" ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/record") ||
    pathname.startsWith("/stats") ||
    pathname.startsWith("/legacy");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isLoginRoute && !isAuthRoute && !isBoardRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const getHasFamily = async () => {
    if (!user) return false;

    const { data, error } = await supabase
      .from("baby_users")
      .select("baby_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle<{ baby_id: string | null }>();

    if (error) {
      console.error("检查家庭关联失败", error);
      return true;
    }

    return Boolean(data?.baby_id);
  };

  if (user && isLoginRoute) {
    return NextResponse.redirect(
      new URL((await getHasFamily()) ? "/" : "/welcome", request.url),
    );
  }

  if (user && isWelcomeRoute) {
    if (await getHasFamily()) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return response;
  }

  if (user && needsFamily && !(await getHasFamily())) {
    return NextResponse.redirect(new URL("/welcome", request.url));
  }

  return response;
}

export const config = {
  // 匹配所有路径，除了静态资源和图片
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
