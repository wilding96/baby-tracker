"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Baby, Sparkles, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // 监听登录状态
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        window.location.href = "/welcome";
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const handleAuth = async () => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (signUpError) {
        alert("注册失败: " + signUpError.message);
        setLoading(false);
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });
      if (signInError) alert("自动登录失败: " + signInError.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });
      if (error) {
        alert("登录失败: " + error.message);
        setLoading(false);
      }
    }
  };

  return (
    // 背景底色稍微调冷一点点 (gray-100)
    <div className="relative min-h-screen w-full flex items-center justify-center bg-gray-100 overflow-hidden">
      {/* ✨ 帅气的冷色调呼吸背景 */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        {/* 1. 左上：深蓝色 (代替紫色) */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob"></div>
        {/* 2. 右上：青色/湖蓝色 (代替黄色) - 增加科技感 */}
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob animation-delay-2000"></div>
        {/* 3. 左下：靛青色 (代替粉色) - 增加深邃感 */}
        <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob animation-delay-4000"></div>
      </div>

      {/* 🧊 毛玻璃卡片 (增加一点点边框清晰度) */}
      <div className="relative z-10 w-full max-w-sm px-4 animate-fade-in-up">
        <div className="bg-white/30 backdrop-blur-xl border border-white/60 shadow-2xl rounded-3xl p-8 space-y-6">
          {/* Logo 区域 (渐变色也同步调整为冷色) */}
          <div className="text-center space-y-2">
            <div className="bg-gradient-to-tr from-blue-600 to-cyan-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg text-white mb-4 transform transition-transform hover:scale-110 duration-300">
              {isSignUp ? <Sparkles size={32} /> : <Baby size={32} />}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {isSignUp ? "加入大家庭" : "欢迎回来"}
            </h1>
            <p className="text-gray-600 text-sm">
              {isSignUp ? "开始记录宝宝成长的每一刻" : "继续书写爱的篇章"}
            </p>
          </div>

          {/* 表单区域 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700 font-medium">邮箱</Label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                // 聚焦时的边框色改为冷蓝色
                className="bg-white/50 border-white/50 focus:bg-white focus:border-blue-500 transition-all h-11 rounded-xl backdrop-blur-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 font-medium">密码</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                className="bg-white/50 border-white/50 focus:bg-white focus:border-blue-500 transition-all h-11 rounded-xl backdrop-blur-sm"
              />
            </div>
          </div>

          {/* 按钮区域 */}
          <div className="space-y-4 pt-2">
            <Button
              // 按钮保持黑色，最酷
              className="w-full h-12 rounded-xl bg-gray-950 hover:bg-gray-800 text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] font-medium text-base"
              onClick={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  处理中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {isSignUp ? "立即注册" : "登 录"}
                  <ArrowRight size={18} className="opacity-70" />
                </span>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-400/30" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-transparent px-2 text-gray-500 backdrop-blur-sm rounded-md">
                  或者
                </span>
              </div>
            </div>

            <p
              className="text-center text-sm text-gray-600 cursor-pointer hover:text-blue-600 transition-colors select-none"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setLoading(false);
              }}
            >
              {isSignUp ? (
                // 下划线颜色统一改为冷色调
                <>
                  已有账号？{" "}
                  <span className="font-bold underline decoration-blue-400 decoration-2 underline-offset-2">
                    去登录
                  </span>
                </>
              ) : (
                <>
                  没有账号？{" "}
                  <span className="font-bold underline decoration-cyan-400 decoration-2 underline-offset-2">
                    注册一个
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* 底部版权 */}
        <p className="text-center text-gray-500/80 text-xs mt-8">
          © 2026 BabyTracker. Designed for Dylan.
        </p>
      </div>
    </div>
  );
}
