"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Divider, Modal } from "animal-island-ui";
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
  const [errorMsg, setErrorMsg] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");

  const handleCloseError = () => {
    if (registeredEmail) {
      setIsSignUp(false);
      setEmail(registeredEmail);
      setRegisteredEmail("");
    }
    setErrorMsg("");
  };

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
        const msg = signUpError.message;
        if (msg.includes("already registered")) {
          setRegisteredEmail(cleanEmail);
          setErrorMsg("该邮箱已注册，点击「直接登录」切换到登录页");
        } else if (msg.includes("weak password")) {
          setErrorMsg("密码强度不够，至少6位字符");
        } else {
          setErrorMsg("注册失败: " + msg);
        }
        setLoading(false);
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });
      if (signInError) {
        const msg = signInError.message;
        if (msg.includes("Email not confirmed")) {
          setErrorMsg("邮箱未验证，请先查收验证邮件");
        } else if (msg.includes("Invalid login credentials")) {
          setErrorMsg("邮箱或密码不正确");
        } else {
          setErrorMsg("登录失败: " + msg);
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });
      if (error) {
        const msg = error.message;
        if (msg.includes("Email not confirmed")) {
          setErrorMsg("邮箱未验证，请先查收验证邮件");
        } else if (msg.includes("Invalid login credentials")) {
          setErrorMsg("邮箱或密码不正确");
        } else {
          setErrorMsg("登录失败: " + msg);
        }
        setLoading(false);
      }
    }
  };

  return (
    <div className="island-page relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      <div className="relative z-10 w-full max-w-sm px-4 animate-fade-in-up">
        <div className="island-card bg-[#fffdf5]/95 rounded-3xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="bg-[#f7cd67] w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-lg text-[#725d42] mb-4 transform transition-transform hover:scale-110 duration-300 border-2 border-[#d4c9b4]">
              {isSignUp ? <Sparkles size={32} /> : <Baby size={32} />}
            </div>
            <p className="text-xs font-bold text-[#6fba2c]">Baby Tracker</p>
            <h1 className="text-2xl font-black text-[#725d42] tracking-tight">
              {isSignUp ? "加入大家庭" : "欢迎回来"}
            </h1>
            <p className="text-[#9f927d] text-sm">
              {isSignUp ? "开始记录宝宝成长的每一刻" : "继续书写爱的篇章"}
            </p>
          </div>
          <Divider type="wave-yellow" />

          {/* 表单区域 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#725d42] font-bold">邮箱</Label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#725d42] font-bold">密码</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                className="h-11"
              />
            </div>
          </div>

          {/* 按钮区域 */}
          <div className="space-y-4 pt-2">
            <Button
              className="w-full h-12 text-base"
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

            <Button asChild variant="outline" className="w-full h-11 border-[#8ac68a] bg-[#eef6e7] text-[#5a7f38] hover:bg-[#e0f0d4] hover:text-[#4a6f2a]">
              <Link href="/discover">不登录，先逛逛 👀</Link>
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[#d4c9b4]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#fffdf5] px-2 text-[#9f927d] rounded-md">
                  或者
                </span>
              </div>
            </div>

            <p
              className="text-center text-sm text-[#725d42] cursor-pointer hover:text-[#6fba2c] transition-colors select-none"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setLoading(false);
              }}
            >
              {isSignUp ? (
                // 下划线颜色统一改为冷色调
                <>
                  已有账号？{" "}
                  <span className="font-bold underline decoration-[#8ac68a] decoration-2 underline-offset-2">
                    去登录
                  </span>
                </>
              ) : (
                <>
                  没有账号？{" "}
                  <span className="font-bold underline decoration-[#f7cd67] decoration-2 underline-offset-2">
                    注册一个
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* 错误提示弹窗 */}
        <Modal
          open={!!errorMsg}
          title=""
          width="min(80vw, 320px)"
          typewriter={false}
          onClose={handleCloseError}
          footer={
            <div className="flex w-full">
              <Button
                type="button"
                className="flex-1"
                onClick={handleCloseError}
              >
                {registeredEmail ? "直接登录" : "知道了"}
              </Button>
            </div>
          }
        >
          <div className="text-center py-2 text-sm text-[#725d42]">
            {errorMsg}
          </div>
        </Modal>

        {/* 底部版权 */}
        <p className="text-center text-[#9f927d] text-xs mt-8">
          © 2026 BabyTracker. Designed for Dylan.
        </p>
      </div>
    </div>
  );
}
