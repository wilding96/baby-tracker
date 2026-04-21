"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label"; // 确保你有这个组件，或者用普通的 label 标签
import { UserPlus, Baby, Calendar, Smile, Heart } from "lucide-react";

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState<"check" | "choice" | "create" | "join">(
    "check",
  );

  // 表单状态
  const [babyName, setBabyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [birthday, setBirthday] = useState(""); // 格式 YYYY-MM-DD
  const [gender, setGender] = useState<"male" | "female" | "other" | null>(
    null,
  );

  const [loading, setLoading] = useState(false);

  // 1. 检查状态 (保持不变)
  useEffect(() => {
    const checkUserStatus = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");

      const { data: relations } = await supabase
        .from("baby_users")
        .select("baby_id")
        .eq("user_id", user.id)
        .limit(1);
      if (relations && relations.length > 0) {
        router.replace("/");
      } else {
        setStep("choice");
      }
    };
    checkUserStatus();
  }, [router]);

  // A. 创建宝宝逻辑 (更新)
  const handleCreateBaby = async () => {
    if (!babyName) return alert("起个名字呗");
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // 1. 插入宝宝表 (带上生日和性别)
    // 注意：如果是空字符串，不要传进去，传 null 或者 undefined
    const { data: baby, error: babyError } = await supabase
      .from("babies")
      .insert({
        name: babyName,
        birthday: birthday || null, // 如果没填就是 null
        gender: gender || null, // 如果没选就是 null
      })
      .select()
      .single();

    if (babyError || !baby) {
      alert("创建失败: " + babyError?.message);
      setLoading(false);
      return;
    }

    // 2. 插入关系表
    const { error: relError } = await supabase.from("baby_users").insert({
      user_id: user.id,
      baby_id: baby.id,
      role: "owner",
    });

    if (relError) {
      alert("关联失败: " + relError.message);
    } else {
      // 成功后强制刷新跳转
      window.location.href = "/";
    }
    setLoading(false);
  };

  // B. 加入家庭逻辑 (保持不变)
  const handleJoinFamily = async () => {
    if (!inviteCode) return alert("请输入邀请码");
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: baby, error: findError } = await supabase
      .from("babies")
      .select("id")
      .eq("invite_code", inviteCode)
      .single();

    if (findError || !baby) {
      alert("邀请码无效");
      setLoading(false);
      return;
    }

    const { error: joinError } = await supabase.from("baby_users").insert({
      user_id: user.id,
      baby_id: baby.id,
      role: "member",
    });

    if (joinError) {
      alert("加入失败: " + joinError.message);
    } else {
      window.location.href = "/";
    }
    setLoading(false);
  };

  if (step === "check")
    return (
      <div className="h-screen flex items-center justify-center">加载中...</div>
    );

  return (
    <main className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
      {/* 步骤 1: 选择入口 (保持不变) */}
      {step === "choice" && (
        <div className="w-full max-w-sm space-y-6 animate-in fade-in zoom-in">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              欢迎来到 Baby Tracker
            </h1>
            <p className="text-gray-500 mt-2">请选择开始方式</p>
          </div>
          <Card
            onClick={() => setStep("create")}
            className="p-6 cursor-pointer hover:border-blue-500 transition-all active:scale-95 flex items-center gap-4"
          >
            <div className="bg-blue-100 p-3 rounded-full text-blue-600">
              <Baby size={24} />
            </div>
            <div>
              <h3 className="font-bold">我是创建者</h3>
              <p className="text-xs text-gray-500">新建一个宝宝档案</p>
            </div>
          </Card>
          <Card
            onClick={() => setStep("join")}
            className="p-6 cursor-pointer hover:border-green-500 transition-all active:scale-95 flex items-center gap-4"
          >
            <div className="bg-green-100 p-3 rounded-full text-green-600">
              <UserPlus size={24} />
            </div>
            <div>
              <h3 className="font-bold">我是被邀请的</h3>
              <p className="text-xs text-gray-500">输入家人的邀请码加入</p>
            </div>
          </Card>
        </div>
      )}

      {/* 步骤 2: 创建表单 (🔥 更新这里) */}
      {step === "create" && (
        <div className="w-full max-w-sm space-y-5 bg-white p-6 rounded-2xl shadow-sm">
          <div className="text-center">
            <h2 className="text-xl font-bold">创建宝宝档案</h2>
            <p className="text-sm text-gray-400">完善一下基本信息吧</p>
          </div>

          {/* 1. 名字 */}
          <div className="space-y-2">
            <Label>
              宝宝小名 <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="例如：小宝"
              value={babyName}
              onChange={(e) => setBabyName(e.target.value)}
            />
          </div>

          {/* 2. 生日/预产期 */}
          <div className="space-y-2">
            <Label>生日或预产期 (选填)</Label>
            <div className="relative">
              <Input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="pl-10 w-76" // 给图标留位置
              />
              <Calendar
                className="absolute left-3 top-2.5 text-gray-400"
                size={18}
              />
            </div>
            <p className="text-xs text-gray-400">
              我们将据此计算宝宝月龄或孕周
            </p>
          </div>

          {/* 3. 性别选择 */}
          <div className="space-y-2">
            <Label>性别 (选填)</Label>
            <div className="flex gap-4">
              <div
                onClick={() => setGender("male")}
                className={`flex-1 p-3 rounded-xl border-2 cursor-pointer flex flex-col items-center gap-2 transition-all ${gender === "male" ? "border-blue-500 bg-blue-50 text-blue-600" : "border-gray-100 hover:bg-gray-50"}`}
              >
                <Smile size={24} />
                <span className="text-sm font-medium">男宝</span>
              </div>

              <div
                onClick={() => setGender("female")}
                className={`flex-1 p-3 rounded-xl border-2 cursor-pointer flex flex-col items-center gap-2 transition-all ${gender === "female" ? "border-pink-500 bg-pink-50 text-pink-600" : "border-gray-100 hover:bg-gray-50"}`}
              >
                <Heart size={24} />
                <span className="text-sm font-medium">女宝</span>
              </div>
            </div>
          </div>

          <Button
            className="w-full mt-4"
            onClick={handleCreateBaby}
            disabled={loading}
          >
            {loading ? "创建中..." : "完成创建"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setStep("choice")}
          >
            返回
          </Button>
        </div>
      )}

      {/* 步骤 3: 加入表单 (保持不变) */}
      {step === "join" && (
        <div className="w-full max-w-sm space-y-4 bg-white p-6 rounded-2xl shadow-sm">
          <h2 className="text-xl font-bold text-center">输入 6 位邀请码</h2>
          <Input
            placeholder="例如：X7Z9P2"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="text-center text-lg h-12 tracking-widest uppercase"
            maxLength={7}
          />
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={handleJoinFamily}
            disabled={loading}
          >
            {loading ? "验证中..." : "加入家庭"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setStep("choice")}
          >
            返回
          </Button>
        </div>
      )}
    </main>
  );
}
