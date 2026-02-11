"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Baby } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // 🟢 核心改动 1: 增加一个监听器
  // 当 Supabase 的状态真的变成 "SIGNED_IN" 时，它会自动触发这里
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        console.log("✅ 登录成功，正在硬跳转...");
        // ✅ 改用这个 (强制浏览器刷新，100% 带上 Cookie)
        window.location.href = "/welcome";
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async () => {
    setLoading(true);

    if (isSignUp) {
      // 注册流程
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        alert("注册失败: " + error.message);
        setLoading(false);
      } else {
        // 注册成功后，如果关了 Confirm Email，Supabase 通常会自动登录
        // 我们不需要手动 router.push，上面的 useEffect 会监听到 SIGNED_IN 并自动跳转
        console.log("注册操作完成，等待状态变更...");
      }
    } else {
      // 登录流程
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        alert("登录失败: " + error.message);
        setLoading(false);
      } else {
        // 同理，不需要手动跳转，交给 useEffect
        console.log("登录操作完成，等待状态变更...");
      }
    }
    // 注意：这里不要 setLoading(false)，防止用户重复点击，跳转后页面销毁自然就不转圈了
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-blue-50">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-blue-600">
            <Baby size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">宝宝成长记录</h1>
          <p className="text-gray-500 text-sm">记录宝宝成长的每一刻</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>邮箱</Label>
            <Input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label>密码</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="current-password"
            />
          </div>
        </div>

        <Button
          className={
            isSignUp
              ? "w-full bg-green-600 hover:bg-green-700"
              : "w-full bg-blue-600 hover:bg-blue-700"
          }
          onClick={handleAuth}
          disabled={loading}
        >
          {loading ? "处理中..." : isSignUp ? "注册账号" : "登 录"}
        </Button>

        <p
          className="text-center text-sm text-gray-500 cursor-pointer hover:underline"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setLoading(false);
          }}
        >
          {isSignUp ? "已有账号？去登录" : "没有账号？去注册"}
        </p>
      </div>
    </div>
  );
}
