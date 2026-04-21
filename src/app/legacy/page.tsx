"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  format,
  differenceInMinutes,
  startOfDay,
  differenceInDays,
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
  baby_id: string;
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

export default function LegacyHomePage() {
  const [babyName, setBabyName] = useState<string>("加载中...");
  const [babyBirthday, setBabyBirthday] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const [selectedLog, setSelectedLog] = useState<LogRecord | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editTime, setEditTime] = useState("");
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

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setBabyName("未登录");
          setLoading(false);
          return;
        }

        const { data: relation, error: relationError } = await supabase
          .from("baby_users")
          .select(
            `
            baby_id,
            babies (
              id,
              name,
              birthday
            )
          `,
          )
          .eq("user_id", user.id)
          .single();

        if (relationError || !relation || !relation.babies) {
          setBabyName("未绑定宝宝");
          setLoading(false);
          return;
        }

        const babyRaw = relation.babies as
          | { id: string; name: string; birthday: string | null }
          | { id: string; name: string; birthday: string | null }[]
          | null;
        const babyData = Array.isArray(babyRaw) ? babyRaw[0] : babyRaw;

        if (!babyData) {
          setBabyName("未绑定宝宝");
          setLoading(false);
          return;
        }

        setBabyName(babyData.name);
        setBabyBirthday(babyData.birthday);
        const babyId = babyData.id;

        const todayStart = startOfDay(new Date()).toISOString();
        const [{ data: lastFeed }, { data: todayLogs }] = await Promise.all([
          supabase
            .from("logs")
            .select("*")
            .eq("baby_id", babyId)
            .eq("type", "feeding")
            .order("start_time", { ascending: false })
            .limit(1)
            .maybeSingle<LogRecord>(),
          supabase
            .from("logs")
            .select("*")
            .eq("baby_id", babyId)
            .gte("start_time", todayStart)
            .order("start_time", { ascending: false })
            .returns<LogRecord[]>(),
        ]);

        const safeTodayLogs = todayLogs || [];

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

  const getBabyAgeText = () => {
    if (!babyBirthday) return "";
    const birthDate = new Date(babyBirthday);
    const today = new Date();
    const days = differenceInDays(today, birthDate);

    if (days < 0) return `预计还有 ${Math.abs(days)} 天出生`;
    if (days === 0) return "今天出生";
    return `第 ${days + 1} 天`;
  };

  const handleLogClick = (log: LogRecord) => {
    setSelectedLog(log);
    setEditTime(format(new Date(log.start_time), "yyyy-MM-dd'T'HH:mm"));
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedLog) return;
    if (!confirm("确定要删除这条记录吗？无法恢复。")) return;

    setActionLoading(true);
    const { error } = await supabase.from("logs").delete().eq("id", selectedLog.id);

    setActionLoading(false);
    setIsDialogOpen(false);

    if (error) alert("删除失败");
    else setRefreshKey((k) => k + 1);
  };

  const handleUpdate = async () => {
    if (!selectedLog) return;
    setActionLoading(true);

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

  if (!loading && babyName === "未绑定宝宝") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h2 className="text-xl font-bold mb-2">欢迎</h2>
        <p className="text-gray-500 mb-6">您还没有绑定任何宝宝档案。</p>
        <Link href="/settings/profile">
          <Button>去设置页创建或加入</Button>
        </Link>
      </div>
    );
  }

  return (
    <main className="container mx-auto max-w-md p-4 space-y-4 pb-24 min-h-screen">
      <header className="flex items-center justify-between py-1">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            {babyName}
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
          <Link href="/settings">
            <div className="h-10 w-10 rounded-full bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
              <Baby size={20} className="text-gray-400" />
            </div>
          </Link>
        </div>
      </header>

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
                <span className="ml-1 text-sm text-gray-600">{timeSince.unit}</span>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 mb-0.5">上次记录</p>
                <p className="text-sm font-medium text-gray-700">
                  {data.lastFeedTime ? format(new Date(data.lastFeedTime), "HH:mm") : "--:--"}
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
                  {Math.floor(data.todaySleepMinutes / 60)}h {data.todaySleepMinutes % 60}m
                </span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">共小睡 {data.todaySleepCount} 次</p>
            </CardContent>
          </Card>

          <Card className="bg-orange-50 border-orange-100 shadow-sm">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-orange-600 flex items-center gap-1.5">
                <span className="text-sm">尿布</span> 换尿布
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="mt-0.5">
                <span className="text-xl font-bold text-gray-800">{data.todayDiaperCount}</span>
                <span className="ml-1 text-xs text-gray-600">次</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5 flex gap-1">
                <span>{data.todayDiaperDetails.dirty}</span>
                <span>/</span>
                <span>{data.todayDiaperDetails.wet}</span>
                {data.todayDiaperDetails.mixed > 0 && (
                  <>
                    <span>/</span>
                    <span className="text-orange-700 font-bold">{data.todayDiaperDetails.mixed}</span>
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <Link href="/stats">
          <div className="group flex items-center justify-between bg-white border border-gray-200 p-3 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
            <div className="flex items-center gap-3">
              <div className="bg-gray-50 p-1.5 rounded-lg group-hover:bg-gray-100 transition-colors">
                <ChevronRight size={16} className="text-gray-500" />
              </div>
              <div>
                <p className="font-bold text-xs text-gray-800">查看成长统计</p>
                <p className="text-[10px] text-gray-400">分析生长曲线与规律</p>
              </div>
            </div>
            <div className="text-gray-300">
              <ChevronRight size={16} />
            </div>
          </div>
        </Link>
      </section>

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
    icon = <span className="text-sm">尿布</span>;
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
