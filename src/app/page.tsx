"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // 需要先安装 card 组件
import { Button } from "@/components/ui/button";
import { ChevronRight, BarChart3, Droplets, Clock, Moon, Baby } from "lucide-react"; // 新增图标
import Link from "next/link"; // 别忘了引入 Link

export default function Home() {
  const [babyName, setBabyName] = useState("加载中...");
  const [birthday, setBirthday] = useState("加载中...");

  useEffect(() => {
    // 简单获取一下刚才存的那个宝宝名字
    const getBaby = async () => {
      const { data } = await supabase.from("babies").select("name, birthday").limit(1).single();
      if (data) {
        setBabyName(data.name);
        setBirthday(data.birthday);
      } else setBabyName("还未添加宝宝");
    };
    getBaby();
  }, []);

    // 计算宝宝年龄,超过当天用生日和当前时间计算天数，未超过则算预产期
  const calculateAge = (birthday: string) => {
    console.log(birthday, 'birthday');
    const birthDate = new Date(birthday);
    const today = new Date();
    const diffTime = today.getTime() - birthDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) {
      return `我今天${diffDays}天啦`;
    } else {
      // 去除负号
      const diffDays = Math.abs(Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      return `我还未出生，距离预产期大约还有${diffDays}天`;
    }
  };

  return (
    <main className="container mx-auto max-w-md p-4 space-y-6">
      {/* 头部欢迎区 */}
      <header className="flex items-center justify-between py-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">👋我叫{babyName}，{calculateAge(birthday)}</h1>
          <p className="text-sm text-gray-500">今天是 {new Date().toLocaleDateString()}</p>
        </div>
        <div className="h-10 w-10 rounded-full bg-gray-200">
             {/* 这里以后放头像 */}
             {/* <img src="/hero.png" alt="avatar" className="h-full w-full object-cover" /> */}
             {/* 先放个图标 */}
             <Baby size={40} className="text-gray-600" />
        </div>
      </header>

      {/* 2. 核心状态区 (1 + 2 布局) */}
      <section className="space-y-3">
        
        {/* 第一行：喂奶 (最重要，占满一行) */}
        <Card className="bg-blue-50 border-blue-100 shadow-sm relative overflow-hidden">
          <div className="absolute right-[-10px] top-[-15px] opacity-10">
            <Droplets size={80} className="text-blue-500" />
          </div>
          <CardHeader className="p-3 pb-1"> {/* 减小 Padding */}
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-blue-600 uppercase tracking-wider">
              <Clock size={14} /> 距离上次喂奶
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex items-baseline justify-between">
              <div>
                {/* 字体从 4xl 减小到 3xl */}
                <span className="text-3xl font-bold text-gray-800 tracking-tight">2.5</span>
                <span className="ml-1 text-sm text-gray-600">小时</span>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 mb-0.5">上次记录</p>
                <p className="text-sm font-medium text-gray-700">14:30 (120ml)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 第二行：睡眠 + 尿布 */}
        <div className="grid grid-cols-2 gap-3">
          
          <Card className="bg-purple-50 border-purple-100 shadow-sm">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-purple-600 flex items-center gap-1.5">
                <Moon size={14} /> 今日睡眠
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="mt-0.5">
                <span className="text-xl font-bold text-gray-800">4h 30m</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">共小睡 3 次</p>
            </CardContent>
          </Card>

          <Card className="bg-orange-50 border-orange-100 shadow-sm">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-orange-600 flex items-center gap-1.5">
                🧻 换尿布
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="mt-0.5">
                <span className="text-xl font-bold text-gray-800">6</span>
                <span className="ml-1 text-xs text-gray-600">次</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">3次 嘘嘘 / 3次 便便</p>
            </CardContent>
          </Card>

        </div>
      </section>

      {/* 3. 统计入口 (保持之前的样式) */}
      <section>
        <Link href="/stats">
          <div className="group flex items-center justify-between bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 p-2 rounded-lg group-hover:bg-gray-200 transition-colors">
                <ChevronRight size={20} className="text-gray-600" />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-800">查看完整统计</p>
                <p className="text-xs text-gray-500">分析生长曲线与规律</p>
              </div>
            </div>
          </div>
        </Link>
      </section>

      {/* 最近记录列表 (占位) */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-800">最近记录</h2>
        <div className="space-y-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 text-xl">🍼</div>
                        <div>
                            <p className="font-medium text-gray-900">喝奶 (配方奶)</p>
                            <p className="text-xs text-gray-500">14:30</p>
                        </div>
                    </div>
                    <span className="font-bold text-gray-700">150ml</span>
                </div>
            ))}
        </div>
      </section>
    </main>
  );
}