"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation"; // ✨ 新增: 路由跳转
import { supabase } from "@/lib/supabase";
import { Divider } from "animal-island-ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  Bell,
  Moon,
  LogOut,
  Shield,
  HelpCircle,
  FileText,
  Smartphone,
  Users, // ✨ 新增图标
  Copy, // ✨ 新增图标
  Check, // ✨ 新增图标
} from "lucide-react";
import Image from "next/image";
import avatar from "@/assets/images/avatar.png";
import { InstallPrompt } from "@/components/InstallPrompt";

export default function SettingsPage() {
  const router = useRouter();

  // 状态管理
  const [babyName, setBabyName] = useState("加载中...");
  const [inviteCode, setInviteCode] = useState("...");
  const [loading, setLoading] = useState(false); // 用于退出登录
  const [copied, setCopied] = useState(false); // 用于复制反馈
  const [notifications, setNotifications] = useState(true);
  // 新增控制安装弹窗的 state
  const [showInstall, setShowInstall] = useState(false);

  // ✨ 核心逻辑更新：获取宝宝信息 + 邀请码
  useEffect(() => {
    const getData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");

      // 级联查询：通过 baby_users 表找到 babies 表的 name 和 invite_code
      const { data } = await supabase
        .from("baby_users")
        .select(
          `
          babies (
            name,
            invite_code
          )
        `,
        )
        .eq("user_id", user.id)
        .single();

      if (data && data.babies) {
        // @ts-ignore
        setBabyName(data.babies.name || "未命名宝宝");
        // @ts-ignore
        setInviteCode(data.babies.invite_code || "无");
      }
    };
    getData();
  }, [router]);

  // ✨ 新增功能：复制邀请码
  const copyToClipboard = () => {
    if (!inviteCode || inviteCode === "...") return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ✨ 新增功能：退出登录
  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <main className="island-page min-h-screen pb-24">
      {/* 3. 把弹窗组件放在最下面 (不可见，只有触发时才显示) */}
      <InstallPrompt open={showInstall} onOpenChange={setShowInstall} />
      {/* 1. 顶部大标题 */}
      <div className="island-shell pt-14 pb-3">
        <p className="text-xs font-bold text-[#6fba2c]">Family Island</p>
        <h1 className="text-3xl font-black text-[#725d42]">设置</h1>
        <Divider type="wave-yellow" className="mt-4" />
      </div>

      {/* 2. 个人信息卡片 */}
      <div className="island-shell pt-0 mb-2">
        <Link href="/settings/profile">
          <div className="island-card bg-[#fffdf5] rounded-3xl p-4 flex items-center gap-4 active:scale-[0.98] transition-transform">
            <Avatar className="h-16 w-16 border-4 border-[#f7cd67] shadow-sm">
              <Image src={avatar} alt="宝宝头像" className="rounded-full" />
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-black text-[#725d42]">{babyName}</h2>
              <p className="text-sm text-[#9f927d]">点击编辑宝宝资料</p>
            </div>
            <div className="bg-[#f0e8d8] p-2 rounded-full">
              <ChevronRight size={20} className="text-[#9f927d]" />
            </div>
          </div>
        </Link>
      </div>

      {/* 3. 功能列表区域 */}
      <div className="island-shell space-y-6 pt-0">
        {/* ✨ 新增 Group: 家庭共享 (插入在这里最显眼) */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-[#6fba2c] ml-4 uppercase tracking-wider">
            家庭共享
          </h3>
          <div className="island-card bg-[#fffdf5] rounded-3xl overflow-hidden p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-[#dff0d5] p-2 rounded-2xl text-[#5a7f38]">
                <Users size={20} />
              </div>
              <div>
                <h4 className="font-bold text-[#725d42]">邀请家人</h4>
                <p className="text-xs text-[#9f927d]">让另一半同步记录数据</p>
              </div>
            </div>

            {/* 邀请码复制区 */}
            <div
              onClick={copyToClipboard}
              className="bg-[#faf8f2] border-2 border-[#e8dcc8] rounded-3xl p-3 flex items-center justify-between cursor-pointer active:bg-[#f0e8d8] transition-colors"
            >
              <div className="flex flex-col">
                <span className="text-[10px] text-[#9f927d] uppercase tracking-wider">
                  邀请码
                </span>
                <span className="text-xl font-mono font-black text-[#725d42] tracking-widest">
                  {inviteCode}
                </span>
              </div>
              <div className="text-[#9f927d]">
                {copied ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <span className="text-xs font-bold">已复制</span>
                    <Check size={18} />
                  </div>
                ) : (
                  <Copy size={18} />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Group 1: 常规设置 */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-[#6fba2c] ml-4 uppercase tracking-wider">
            通用
          </h3>
          <div className="island-card bg-[#fffdf5] rounded-3xl overflow-hidden divide-y divide-[#e8dcc8]">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="bg-[#ffe7b2] p-2 rounded-2xl text-[#8a5a13]">
                  <Bell size={20} />
                </div>
                <span className="font-bold text-[#725d42]">推送通知</span>
              </div>
              <Switch
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="bg-[#eef0e6] p-2 rounded-2xl text-[#725d42]">
                  <Moon size={20} />
                </div>
                <span className="font-bold text-[#725d42]">深色模式</span>
              </div>
              <Switch checked={false} />
            </div>

            <div
              className="flex items-center justify-between p-4 active:bg-[#faf8f2] cursor-pointer"
              onClick={() => setShowInstall(true)}
            >
              <div className="flex items-center gap-3">
                <div className="bg-[#dff0d5] p-2 rounded-2xl text-[#5a7f38]">
                  <Smartphone size={20} />
                </div>
                <span className="font-bold text-[#725d42]">
                  安装到桌面 (App)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#9f927d]">去添加</span>
                <ChevronRight size={18} className="text-[#c4b89e]" />
              </div>
            </div>
          </div>
        </section>

        {/* Group 2: 数据与支持 */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-[#6fba2c] ml-4 uppercase tracking-wider">
            数据与支持
          </h3>
          <div className="island-card bg-[#fffdf5] rounded-3xl overflow-hidden divide-y divide-[#e8dcc8]">
            <div className="flex items-center justify-between p-4 active:bg-[#faf8f2] cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="bg-[#dff0d5] p-2 rounded-2xl text-[#5a7f38]">
                  <FileText size={20} />
                </div>
                <span className="font-bold text-[#725d42]">
                  导出数据 (Excel)
                </span>
              </div>
              <ChevronRight size={18} className="text-[#c4b89e]" />
            </div>

            <div className="flex items-center justify-between p-4 active:bg-[#faf8f2] cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="bg-[#f0e8d8] p-2 rounded-2xl text-[#725d42]">
                  <HelpCircle size={20} />
                </div>
                <span className="font-bold text-[#725d42]">帮助与反馈</span>
              </div>
              <ChevronRight size={18} className="text-[#c4b89e]" />
            </div>

            <div className="flex items-center justify-between p-4 active:bg-[#faf8f2] cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="bg-[#f0e8d8] p-2 rounded-2xl text-[#725d42]">
                  <Shield size={20} />
                </div>
                <span className="font-bold text-[#725d42]">隐私政策</span>
              </div>
              <ChevronRight size={18} className="text-[#c4b89e]" />
            </div>
          </div>
        </section>

        {/* 退出登录按钮 (✨ 已绑定真实事件) */}
        <div className="pt-4">
          <Button
            variant="outline"
            onClick={handleLogout}
            disabled={loading}
            className="w-full text-red-500 hover:text-red-600 h-12 text-base font-bold"
          >
            <LogOut size={18} className="mr-2" />
            {loading ? "正在退出..." : "退出登录"}
          </Button>
          <p className="text-center text-xs text-[#9f927d] mt-4">
            Baby Tracker v1.0.0
          </p>
        </div>
      </div>
    </main>
  );
}
