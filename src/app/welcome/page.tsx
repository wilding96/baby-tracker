"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { UserPlus, Baby } from "lucide-react";

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState<"check" | "choice" | "create" | "join">(
    "check",
  );
  const [babyName, setBabyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  // 1. 检查当前用户是否已经有关联宝宝
  useEffect(() => {
    const checkUserStatus = async () => {
      // 查 baby_users 表看有没有记录
      const { data: relations } = await supabase
        .from("baby_users")
        .select("baby_id")
        .limit(1);

      if (relations && relations.length > 0) {
        // 如果有，说明已经是家庭成员了，直接去首页
        router.replace("/");
      } else {
        // 如果没有，显示选择界面
        setStep("choice");
      }
    };
    checkUserStatus();
  }, [router]);

  // A. 创建宝宝逻辑
  const handleCreateBaby = async () => {
    if (!babyName) return alert("请输入宝宝名字");
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // 1. 插入宝宝表 (invite_code 会由数据库默认值自动生成)
    const { data: baby, error: babyError } = await supabase
      .from("babies")
      .insert({ name: babyName })
      .select()
      .single();

    if (babyError || !baby) {
      alert("创建失败: " + babyError?.message);
      setLoading(false);
      return;
    }

    // 2. 插入关系表 (把自己设为 owner)
    const { error: relError } = await supabase.from("baby_users").insert({
      user_id: user.id,
      baby_id: baby.id,
      role: "owner",
    });

    if (relError) {
      alert("关联失败: " + relError.message);
    } else {
      router.replace("/"); // 成功，去首页
    }
    setLoading(false);
  };

  // B. 加入家庭逻辑
  const handleJoinFamily = async () => {
    if (!inviteCode) return alert("请输入邀请码");
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // 1. 根据邀请码找宝宝
    const { data: baby, error: findError } = await supabase
      .from("babies")
      .select("id")
      .eq("invite_code", inviteCode) // 假设数据库字段叫 invite_code
      .single();

    if (findError || !baby) {
      alert("邀请码无效，请检查");
      setLoading(false);
      return;
    }

    // 2. 插入关系表 (设为 member)
    const { error: joinError } = await supabase.from("baby_users").insert({
      user_id: user.id,
      baby_id: baby.id,
      role: "member",
    });

    if (joinError) {
      // 如果已经加入了，可能会报唯一约束错误
      alert("加入失败: " + joinError.message);
    } else {
      alert("加入成功！");
      router.replace("/");
    }
    setLoading(false);
  };

  if (step === "check")
    return (
      <div className="h-screen flex items-center justify-center">
        加载用户信息...
      </div>
    );

  return (
    <main className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
      {/* 步骤 1: 选择入口 */}
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

      {/* 步骤 2: 创建表单 */}
      {step === "create" && (
        <div className="w-full max-w-sm space-y-4">
          <h2 className="text-xl font-bold text-center">给宝宝起个名字</h2>
          <Input
            placeholder="例如：毛豆"
            value={babyName}
            onChange={(e) => setBabyName(e.target.value)}
            className="text-center text-lg h-12"
          />
          <Button
            className="w-full"
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

      {/* 步骤 3: 加入表单 */}
      {step === "join" && (
        <div className="w-full max-w-sm space-y-4">
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
