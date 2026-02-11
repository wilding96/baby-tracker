"use client";

import { useState } from "react";
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
  const [isSignUp, setIsSignUp] = useState(false); // 切换登录/注册模式

  const handleAuth = async () => {
    setLoading(true);
    if (isSignUp) {
      // 注册逻辑
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) alert(error.message);
      else alert("注册成功！请检查邮箱验证（如果开启了）或直接登录。");
    } else {
      // 登录逻辑
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        alert("登录失败: " + error.message);
      } else {
        router.refresh();
        router.push("/welcome"); // 登录后先去引导页检查状态
      }
    }
    setLoading(false);
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
            />
          </div>
          <div className="space-y-2">
            <Label>密码（6位以上）</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        {/* 注册背景是绿色，登录是蓝色 */}
        <Button
          className={`w-full ${isSignUp ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}`}
          onClick={handleAuth}
          disabled={loading}
        >
          {loading ? "处理中..." : isSignUp ? "注册账号" : "登 录"}
        </Button>

        <p
          className="text-center text-sm text-gray-500 cursor-pointer hover:underline"
          onClick={() => setIsSignUp(!isSignUp)}
        >
          {isSignUp ? "已有账号？去登录" : "没有账号？去注册"}
        </p>
      </div>
    </div>
  );
}
