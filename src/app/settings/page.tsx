"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  User,
  Baby,
  ChevronRight,
  Bell,
  Moon,
  LogOut,
  Shield,
  HelpCircle,
  FileText,
  Smartphone,
} from "lucide-react";
import Image from "next/image";
import avatar from "@/assets/images/avatar.png";

export default function SettingsPage() {
  const [babyName, setBabyName] = useState("加载中...");

  // 模拟一些开关状态
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    const getBaby = async () => {
      const { data } = await supabase
        .from("babies")
        .select("name")
        .limit(1)
        .single();
      if (data) setBabyName(data.name);
    };
    getBaby();
  }, []);

  return (
    <main className="min-h-screen bg-[#F2F2F7] pb-24">
      {/* 1. 顶部大标题 (仿 iOS 风格) */}
      <div className="pt-14 pb-6 px-6">
        <h1 className="text-3xl font-bold text-gray-900">设置</h1>
      </div>

      {/* 2. 个人信息卡片 (Profile Card) */}
      <div className="px-4 mb-6">
        <Link href="/settings/profile">
          <div className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm active:scale-[0.98] transition-transform">
            <Avatar className="h-16 w-16 border-2 border-white shadow-sm">
              <AvatarImage src="/hero.png" />{" "}
              {/* 这里可以用你的 hero 图片或者留空 */}
              <Image src={avatar} alt="宝宝头像" className="rounded-full" />
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{babyName}</h2>
              <p className="text-sm text-gray-500">点击编辑宝宝资料</p>
            </div>
            <div className="bg-gray-50 p-2 rounded-full">
              <ChevronRight size={20} className="text-gray-400" />
            </div>
          </div>
        </Link>
      </div>

      {/* 3. 功能列表区域 */}
      <div className="space-y-6 px-4">
        {/* Group 1: 常规设置 */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 ml-4 uppercase tracking-wider">
            通用
          </h3>
          <div className="bg-white rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
            {/* 这里的 Switch 只是 UI 展示，暂时不接功能 */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                  <Bell size={20} />
                </div>
                <span className="font-medium text-gray-700">推送通知</span>
              </div>
              <Switch
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                  <Moon size={20} />
                </div>
                <span className="font-medium text-gray-700">深色模式</span>
              </div>
              <Switch checked={false} />
            </div>

            <div className="flex items-center justify-between p-4 active:bg-gray-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                  <Smartphone size={20} />
                </div>
                <span className="font-medium text-gray-700">桌面小组件</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">去添加</span>
                <ChevronRight size={18} className="text-gray-300" />
              </div>
            </div>
          </div>
        </section>

        {/* Group 2: 数据与支持 */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 ml-4 uppercase tracking-wider">
            数据与支持
          </h3>
          <div className="bg-white rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
            <div className="flex items-center justify-between p-4 active:bg-gray-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg text-green-600">
                  <FileText size={20} />
                </div>
                <span className="font-medium text-gray-700">
                  导出数据 (Excel)
                </span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </div>

            <div className="flex items-center justify-between p-4 active:bg-gray-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-lg text-gray-600">
                  <HelpCircle size={20} />
                </div>
                <span className="font-medium text-gray-700">帮助与反馈</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </div>

            <div className="flex items-center justify-between p-4 active:bg-gray-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-lg text-gray-600">
                  <Shield size={20} />
                </div>
                <span className="font-medium text-gray-700">隐私政策</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </div>
          </div>
        </section>

        {/* 退出登录按钮 */}
        <div className="pt-4">
          <Button
            variant="outline"
            className="w-full bg-white text-red-500 hover:text-red-600 hover:bg-red-50 border-none shadow-sm h-12 rounded-xl text-base font-medium"
          >
            <LogOut size={18} className="mr-2" /> 退出登录
          </Button>
          <p className="text-center text-xs text-gray-400 mt-4">
            Baby Tracker v1.0.0
          </p>
        </div>
      </div>
    </main>
  );
}
