"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  format,
  differenceInMinutes,
  startOfDay,
  differenceInDays,
  addDays,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronRight,
  Droplets,
  Clock,
  Moon,
  Baby,
  RefreshCw,
  Trash2,
  Pencil,
} from "lucide-react";

// --- 类型定义 ---
interface LogDetails {
  sub_type?: string;
  amount?: number;
  duration_minutes?: number;
}

interface LogRecord {
  id: string;
  type: "feeding" | "sleep" | "diaper";
  start_time: string;
  end_time: string | null;
  details: LogDetails | null;
  created_at: string;
}

interface DashboardData {
  lastFeedTime: string | null;
  lastFeedAmount: number | null;
  todaySleepMinutes: number;
  todaySleepCount: number;
  todayDiaperCount: number;
  todayDiaperDetails: { wet: number; dirty: number; mixed: number };
  recentLogs: LogRecord[];
}

interface DiaperStats {
  wet: number;
  dirty: number;
  mixed: number;
}

export default function Home() {
  const [babyName, setBabyName] = useState<string>("加载中...");
  const [babyBirthday, setBabyBirthday] = useState<string | null>(null); // 新增：存生日
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // --- 编辑/删除相关的状态 ---
  const [selectedLog, setSelectedLog] = useState<LogRecord | null>(null); // 当前选中的记录
  const [isDialogOpen, setIsDialogOpen] = useState(false); // 对话框开关
  const [editTime, setEditTime] = useState(""); // 编辑时间用的临时状态
  const [actionLoading, setActionLoading] = useState(false);

  const [data, setData] = useState<DashboardData>({
    lastFeedTime: null,
    lastFeedAmount: null,
    todaySleepMinutes: 0,
    todaySleepCount: 0,
    todayDiaperCount: 0,
    todayDiaperDetails: { wet: 0, dirty: 0, mixed: 0 },
    recentLogs: [],
  });

  // --- 核心数据获取 ---
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // 1. 获取宝宝名字和生日
        const { data: baby } = await supabase
          .from("babies")
          .select("name, birthday") // 多查一个 birthday
          .limit(1)
          .single<{ name: string; birthday: string }>();

        if (baby) {
          setBabyName(baby.name);
          setBabyBirthday(baby.birthday);
        }

        // 2. 获取最近一次喂奶
        const { data: lastFeed } = await supabase
          .from("logs")
          .select("*")
          .eq("type", "feeding")
          .order("start_time", { ascending: false })
          .limit(1)
          .single<LogRecord>();

        // 3. 获取今天记录
        const todayStart = startOfDay(new Date()).toISOString();
        const { data: todayLogs } = await supabase
          .from("logs")
          .select("*")
          .gte("start_time", todayStart)
          .order("start_time", { ascending: false })
          .returns<LogRecord[]>();

        const safeTodayLogs = todayLogs || [];

        // 统计逻辑
        const sleepLogs = safeTodayLogs.filter((l) => l.type === "sleep");
        const totalSleepMinutes = sleepLogs.reduce(
          (acc, log) => acc + (log.details?.duration_minutes || 0),
          0,
        );

        const diaperLogs = safeTodayLogs.filter((l) => l.type === "diaper");
        const diaperStats: DiaperStats = { wet: 0, dirty: 0, mixed: 0 };
        diaperLogs.forEach((log) => {
          const type = log.details?.sub_type as keyof DiaperStats;
          if (type && diaperStats[type] !== undefined) diaperStats[type]++;
        });

        setData({
          lastFeedTime: lastFeed?.start_time || null,
          lastFeedAmount: lastFeed?.details?.amount || null,
          todaySleepMinutes: totalSleepMinutes,
          todaySleepCount: sleepLogs.length,
          todayDiaperCount: diaperLogs.length,
          todayDiaperDetails: diaperStats,
          recentLogs: safeTodayLogs,
        });
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [refreshKey]);

  // --- 功能函数 ---

  // 1. 计算宝宝天数
  const getBabyAgeText = () => {
    if (!babyBirthday) return "";
    const birthDate = new Date(babyBirthday);
    const today = new Date();
    const days = differenceInDays(today, birthDate);

    // 如果是未来 (预产期)
    if (days < 0) {
      return `预计还有 ${Math.abs(days)} 天出生`;
    }
    // 如果是今天
    if (days === 0) {
      return "今天出生 🎉";
    }
    // 已经出生
    return `第 ${days + 1} 天`; // 出生当天算第1天
  };

  // 2. 打开编辑窗口
  const handleLogClick = (log: LogRecord) => {
    setSelectedLog(log);
    // 把记录的时间格式化好填入输入框，方便修改
    // input type="datetime-local" 需要 yyyy-MM-ddThh:mm 格式
    setEditTime(format(new Date(log.start_time), "yyyy-MM-dd'T'HH:mm"));
    setIsDialogOpen(true);
  };

  // 3. 执行删除
  const handleDelete = async () => {
    if (!selectedLog) return;
    if (!confirm("确定要删除这条记录吗？无法恢复哦。")) return;

    setActionLoading(true);
    const { error } = await supabase
      .from("logs")
      .delete()
      .eq("id", selectedLog.id);
    setActionLoading(false);
    setIsDialogOpen(false);

    if (error) alert("删除失败");
    else setRefreshKey((k) => k + 1); // 刷新列表
  };

  // 4. 执行更新 (只允许改时间，改类型太复杂建议删了重记)
  const handleUpdate = async () => {
    if (!selectedLog) return;
    setActionLoading(true);

    // 如果是睡觉，还需要重新计算时长，这里简化处理，只改开始时间
    // 真实的更新逻辑可能很复杂，MVP阶段建议只提供“修改开始时间”
    const { error } = await supabase
      .from("logs")
      .update({ start_time: new Date(editTime).toISOString() })
      .eq("id", selectedLog.id);

    setActionLoading(false);
    setIsDialogOpen(false);

    if (error) alert("更新失败");
    else setRefreshKey((k) => k + 1);
  };

  const timeSince = (() => {
    if (!data.lastFeedTime) return { val: "--", unit: "无记录" };
    const m = differenceInMinutes(new Date(), new Date(data.lastFeedTime));
    return m < 60
      ? { val: m, unit: "分钟" }
      : { val: (m / 60).toFixed(1), unit: "小时" };
  })();

  return (
    <main className="container mx-auto max-w-md p-4 space-y-4 pb-24 min-h-screen">
      {/* Header: 显示天数 */}
      <header className="flex items-center justify-between py-1">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            👋 {babyName}
            {/* ✨ 修正1: 显示天数徽标 */}
            {babyBirthday && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-normal border border-yellow-200">
                {getBabyAgeText()}
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {format(new Date(), "yyyy年MM月dd日 EEEE", { locale: zhCN })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
          <Link href="/settings/profile">
            <div className="h-10 w-10 rounded-full bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center">
              <Baby size={20} className="text-gray-400" />
            </div>
          </Link>
        </div>
      </header>

      {/* 核心卡片 */}
      <section className="space-y-3">
        <Card className="bg-blue-50 border-blue-100 shadow-sm relative overflow-hidden">
          <div className="absolute right-[-10px] top-[-15px] opacity-10">
            <Droplets size={80} className="text-blue-500" />
          </div>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-blue-600 uppercase tracking-wider">
              <Clock size={14} /> 距离上次喂奶
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-bold text-gray-800 tracking-tight">
                  {timeSince.val}
                </span>
                <span className="ml-1 text-sm text-gray-600">
                  {timeSince.unit}
                </span>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 mb-0.5">上次记录</p>
                <p className="text-sm font-medium text-gray-700">
                  {data.lastFeedTime
                    ? format(new Date(data.lastFeedTime), "HH:mm")
                    : "--:--"}
                  {data.lastFeedAmount ? ` (${data.lastFeedAmount}ml)` : ""}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-purple-50 border-purple-100 shadow-sm">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-purple-600 flex items-center gap-1.5">
                <Moon size={14} /> 今日睡眠
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="mt-0.5">
                <span className="text-xl font-bold text-gray-800">
                  {Math.floor(data.todaySleepMinutes / 60)}h{" "}
                  {data.todaySleepMinutes % 60}m
                </span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">
                共小睡 {data.todaySleepCount} 次
              </p>
            </CardContent>
          </Card>

          <Card className="bg-orange-50 border-orange-100 shadow-sm">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-orange-600 flex items-center gap-1.5">
                <span className="text-sm">🧻</span> 换尿布
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="mt-0.5">
                <span className="text-xl font-bold text-gray-800">
                  {data.todayDiaperCount}
                </span>
                <span className="ml-1 text-xs text-gray-600">次</span>
              </div>
              {/* ✨ 修正2: 加上混合(Mixed)的显示 */}
              <p className="text-[10px] text-gray-500 mt-0.5 flex gap-1">
                <span>{data.todayDiaperDetails.dirty}💩</span>
                <span>/</span>
                <span>{data.todayDiaperDetails.wet}💧</span>
                {data.todayDiaperDetails.mixed > 0 && (
                  <>
                    <span>/</span>
                    <span className="text-orange-700 font-bold">
                      {data.todayDiaperDetails.mixed}🤢
                    </span>
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 成长统计 */}
      <section>
        <Link href="/stats">
          <div className="group flex items-center justify-between bg-white border border-gray-200 p-3 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
            <div className="flex items-center gap-3">
              <div className="bg-gray-50 p-1.5 rounded-lg group-hover:bg-gray-100 transition-colors">
                {/* 这里的 BarChart 图标记得从 lucide-react 引入，或者直接用 ChevronRight 也行 */}
                <ChevronRight size={16} className="text-gray-500" />
              </div>
              <div>
                <p className="font-bold text-xs text-gray-800">查看成长统计</p>
                <p className="text-[10px] text-gray-400">分析生长曲线与规律</p>
              </div>
            </div>
            {/* 右边加个小图标装饰 */}
            <div className="text-gray-300">
              <ChevronRight size={16} />
            </div>
          </div>
        </Link>
      </section>
      {/* 成长统计 */}

      {/* 列表 */}
      <section>
        <h2 className="mb-2 text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
          今日记录 (点击管理)
        </h2>
        <div className="space-y-2.5">
          {data.recentLogs.map((log) => (
            <div
              key={log.id}
              onClick={() => handleLogClick(log)}
              className="cursor-pointer active:opacity-60 transition-opacity"
            >
              <LogItem log={log} />
            </div>
          ))}
          {data.recentLogs.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm border border-dashed rounded-xl">
              今天暂无记录
            </div>
          )}
        </div>
      </section>

      {/* ✨ 修正3: 编辑/删除 弹窗 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle>管理记录</DialogTitle>
            <DialogDescription>你可以修改时间或删除这条记录</DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>开始时间</Label>
              <Input
                type="datetime-local"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={handleUpdate}
              disabled={actionLoading}
              className="w-full bg-black text-white"
            >
              {actionLoading ? (
                "保存中..."
              ) : (
                <>
                  <Pencil size={16} className="mr-2" /> 保存修改
                </>
              )}
            </Button>

            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={actionLoading}
              className="w-full bg-red-50 text-red-600 hover:bg-red-100 border-none shadow-none"
            >
              <Trash2 size={16} className="mr-2" /> 删除此记录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

// LogItem 组件保持不变，为了节省篇幅我简化了展示，直接用你之前的即可
function LogItem({ log }: { log: LogRecord }) {
  const timeStr = format(new Date(log.start_time), "HH:mm");
  let icon, title, desc, colorClass;

  if (log.type === "feeding") {
    const isFormula = log.details?.sub_type === "formula";
    icon = <Droplets size={16} />;
    colorClass = "bg-blue-100 text-blue-600";
    title = isFormula ? "配方奶" : "母乳";
    desc = isFormula ? `${log.details?.amount}ml` : "亲喂";
  } else if (log.type === "diaper") {
    const subType = log.details?.sub_type || "wet";
    const map: Record<string, string> = {
      wet: "嘘嘘",
      dirty: "便便",
      mixed: "混合",
    };
    icon = <span className="text-sm">🧻</span>;
    colorClass = "bg-orange-100 text-orange-600";
    title = "换尿布";
    desc = map[subType];
  } else {
    const duration = log.details?.duration_minutes || 0;
    icon = <Moon size={16} />;
    colorClass = "bg-purple-100 text-purple-600";
    title = "睡觉";
    desc = `${Math.floor(duration / 60)}h ${duration % 60}m`;
  }

  return (
    <div className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full ${colorClass}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-[10px] text-gray-500">{timeStr}</p>
        </div>
      </div>
      <span className="font-bold text-sm text-gray-700">{desc}</span>
    </div>
  );
}
