"use client";

import { useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { format, differenceInMinutes } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useBaby } from "@/hooks/useBaby"; // 👈 1. 引入这个神器
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import {
  Droplets,
  Moon,
  ArrowLeft,
  Clock,
  Check,
  Baby,
  Sun,
  Utensils,
} from "lucide-react";

// --- 1. 定义严格的类型接口 ---

type ViewType = "menu" | "feeding" | "sleep" | "diaper";
type FeedType = "formula" | "breast";
type DiaperType = "wet" | "dirty" | "mixed";

interface DiaperOption {
  type: DiaperType;
  label: string;
  icon: string;
}

// 组件 Props 接口
interface FormLayoutProps {
  title: string;
  color: string; // Tailwind class string, e.g. "text-blue-900"
  onBack: () => void;
  children: ReactNode;
}

interface SaveButtonProps {
  loading: boolean;
  onClick: () => void;
  color: string; // Tailwind class string
}

export default function RecordPage() {
  const router = useRouter();

  // 👈 2. 使用 Hook 获取正确的宝宝信息
  const { baby, loading: babyLoading } = useBaby();

  const [view, setView] = useState<ViewType>("menu");
  const [loading, setLoading] = useState<boolean>(false);

  // --- 状态管理 ---
  const [startTime, setStartTime] = useState<string>(
    format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  );

  // 喂奶数据
  const [feedType, setFeedType] = useState<FeedType>("formula");
  const [amount, setAmount] = useState<number[]>([120]);

  // 睡觉数据
  const [endTime, setEndTime] = useState<string>(
    format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  );

  // 尿布数据
  const [diaperType, setDiaperType] = useState<DiaperType>("wet");

  // 在切换视图时重置时间
  const handleSwitchView = (newView: ViewType) => {
    const now = new Date();
    const timeStr = format(now, "yyyy-MM-dd'T'HH:mm");
    setStartTime(timeStr);
    setEndTime(timeStr);
    setView(newView);
  };

  // 计算时长
  const getSleepDuration = (): string => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diff = differenceInMinutes(end, start);

    if (diff < 0) return "时间设置有误";

    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}小时 ${m}分钟`;
  };

  // --- 保存逻辑 (🔥 核心修复) ---
  const handleSave = async () => {
    // 1. 检查宝宝信息是否存在
    if (!baby) {
      alert("未找到关联的宝宝，请先在设置页添加或加入家庭。");
      return;
    }

    setLoading(true);

    // 2. 构造 Payload
    let details: Record<string, string | number | null> = {};
    let finalEndTime: string | null = null;

    if (view === "feeding") {
      details = {
        sub_type: feedType,
        amount: feedType === "formula" ? amount[0] : null,
      };
    } else if (view === "diaper") {
      details = {
        sub_type: diaperType,
      };
    } else if (view === "sleep") {
      finalEndTime = new Date(endTime).toISOString();
      details = {
        duration_minutes: differenceInMinutes(
          new Date(endTime),
          new Date(startTime),
        ),
      };
    }

    // 3. 写入数据库 (带上正确的 baby.id)
    const { error } = await supabase.from("logs").insert({
      baby_id: baby.id, // 👈 这里的 baby.id 来自 useBaby Hook，绝对正确
      type: view,
      start_time: new Date(startTime).toISOString(),
      end_time: finalEndTime,
      details: details,
    });

    if (error) {
      alert("保存失败: " + error.message);
    } else {
      router.push("/");
      router.refresh();
    }
    setLoading(false);
  };

  // --- 尿布选项配置 ---
  const diaperOptions: DiaperOption[] = [
    { type: "wet", label: "嘘嘘", icon: "💧" },
    { type: "dirty", label: "便便", icon: "💩" },
    { type: "mixed", label: "混合", icon: "🤢" },
  ];

  // ================= 视图渲染 =================

  // 如果宝宝还在加载，或者是空的
  if (babyLoading)
    return (
      <div className="h-screen flex items-center justify-center">
        加载宝宝信息...
      </div>
    );

  if (!baby && !babyLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
        <p>还没有绑定宝宝，无法记录。</p>
        <Button onClick={() => router.push("/settings")}>去设置</Button>
      </div>
    );
  }

  // 1. 菜单视图
  if (view === "menu") {
    return (
      <main className="container mx-auto max-w-md p-6 min-h-screen flex flex-col justify-center gap-6 pb-24">
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-800">
          {/* 显示一下给谁记录，增加确定感 */}给 {baby?.name} 记一笔
        </h1>

        {/* 喂奶 */}
        <div
          onClick={() => handleSwitchView("feeding")}
          className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 shadow-sm active:scale-95 transition-transform cursor-pointer h-40"
        >
          <div className="bg-blue-500 text-white p-4 rounded-full shadow-lg">
            <Droplets size={32} />
          </div>
          <span className="font-bold text-blue-700 text-lg">喂奶 / 喝水</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 睡觉 */}
          <div
            onClick={() => handleSwitchView("sleep")}
            className="bg-purple-50 border-2 border-purple-100 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 shadow-sm active:scale-95 transition-transform cursor-pointer h-36"
          >
            <div className="bg-purple-500 text-white p-3 rounded-full">
              <Moon size={24} />
            </div>
            <span className="font-bold text-purple-700">睡觉</span>
          </div>
          {/* 尿布 */}
          <div
            onClick={() => handleSwitchView("diaper")}
            className="bg-orange-50 border-2 border-orange-100 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 shadow-sm active:scale-95 transition-transform cursor-pointer h-36"
          >
            <div className="bg-orange-500 text-white p-3 rounded-full">
              <Utensils size={24} className="rotate-90" />
            </div>
            <span className="font-bold text-orange-700">换尿布</span>
          </div>
        </div>

        <Button
          variant="ghost"
          className="mt-8 text-gray-400"
          onClick={() => router.back()}
        >
          取消
        </Button>
      </main>
    );
  }

  // 2. 喂奶表单
  if (view === "feeding") {
    return (
      <FormLayout
        title="记录喂奶"
        color="text-blue-900"
        onBack={() => setView("menu")}
      >
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-gray-500">
            <Clock size={16} /> 开始时间
          </Label>
          <Input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="bg-white text-lg font-medium"
          />
        </div>

        <div className="bg-gray-100 p-1 rounded-xl flex">
          <button
            onClick={() => setFeedType("formula")}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${feedType === "formula" ? "bg-white shadow text-blue-600" : "text-gray-400"}`}
          >
            🍼 配方奶
          </button>
          <button
            onClick={() => setFeedType("breast")}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${feedType === "breast" ? "bg-white shadow text-pink-600" : "text-gray-400"}`}
          >
            🤱 母乳亲喂
          </button>
        </div>

        {feedType === "formula" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-end">
              <Label className="text-gray-500">奶量</Label>
              <div className="text-3xl font-bold text-blue-600">
                {amount[0]}{" "}
                <span className="text-sm text-gray-400 font-normal">ml</span>
              </div>
            </div>
            <Slider
              value={amount}
              onValueChange={setAmount}
              max={300}
              step={10}
              className="py-4"
            />
            <div className="flex gap-2 justify-between">
              {[60, 90, 120, 150, 180].map((val) => (
                <button
                  key={val}
                  onClick={() => setAmount([val])}
                  className={`px-2 py-1 text-xs rounded-lg border ${amount[0] === val ? "bg-blue-100 border-blue-300 text-blue-700 font-bold" : "bg-white border-gray-200 text-gray-500"}`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        )}
        <SaveButton
          loading={loading}
          onClick={handleSave}
          color="bg-blue-600 hover:bg-blue-700"
        />
      </FormLayout>
    );
  }

  // 3. 睡觉表单
  if (view === "sleep") {
    return (
      <FormLayout
        title="记录睡眠"
        color="text-purple-900"
        onBack={() => setView("menu")}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-gray-500">
              <Moon size={16} /> 入睡时间
            </Label>
            <Input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="bg-white text-lg font-medium"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-gray-500">
              <Sun size={16} /> 醒来时间
            </Label>
            <Input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="bg-white text-lg font-medium"
            />
          </div>
          <div className="bg-purple-50 p-4 rounded-xl text-center">
            <p className="text-sm text-purple-600 mb-1">共睡眠时长</p>
            <p className="text-2xl font-bold text-purple-800">
              {getSleepDuration()}
            </p>
          </div>
        </div>
        <SaveButton
          loading={loading}
          onClick={handleSave}
          color="bg-purple-600 hover:bg-purple-700"
        />
      </FormLayout>
    );
  }

  // 4. 尿布表单
  if (view === "diaper") {
    return (
      <FormLayout
        title="记录换尿布"
        color="text-orange-900"
        onBack={() => setView("menu")}
      >
        <div className="space-y-4">
          <Label className="flex items-center gap-2 text-gray-500">
            <Clock size={16} /> 更换时间
          </Label>
          <Input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="bg-white text-lg font-medium"
          />
        </div>

        <Label className="text-gray-500 mt-4 block">观察情况</Label>
        <div className="grid grid-cols-3 gap-3">
          {diaperOptions.map((item) => (
            <div
              key={item.type}
              onClick={() => setDiaperType(item.type)}
              className={`
                        cursor-pointer flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 transition-all
                        ${
                          diaperType === item.type
                            ? "border-orange-500 bg-orange-50 text-orange-700 shadow-md"
                            : "border-gray-100 bg-white text-gray-400 hover:bg-gray-50"
                        }
                    `}
            >
              <span className="text-3xl">{item.icon}</span>
              <span className="font-bold text-sm">{item.label}</span>
            </div>
          ))}
        </div>
        <SaveButton
          loading={loading}
          onClick={handleSave}
          color="bg-orange-500 hover:bg-orange-600"
        />
      </FormLayout>
    );
  }

  return null;
}

// --- 通用组件 (Types Applied) ---
// (这部分保持不变)
function FormLayout({ title, color, onBack, children }: FormLayoutProps) {
  return (
    <main className="container mx-auto max-w-md p-6 min-h-screen bg-gray-50 pb-40">
      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <h2 className={`text-xl font-bold ${color}`}>{title}</h2>
        <div className="w-10"></div>
      </div>
      <Card className="p-6 space-y-6 shadow-md border-gray-100">
        {children}
      </Card>
    </main>
  );
}

function SaveButton({ loading, onClick, color }: SaveButtonProps) {
  return (
    <div className="fixed bottom-24 left-0 right-0 px-6 z-40">
      <Button
        size="lg"
        className={`w-full text-lg h-14 shadow-xl rounded-2xl ${color}`}
        onClick={onClick}
        disabled={loading}
      >
        {loading ? (
          "保存中..."
        ) : (
          <span className="flex items-center gap-2">
            <Check strokeWidth={3} size={20} /> 完成记录
          </span>
        )}
      </Button>
    </div>
  );
}
