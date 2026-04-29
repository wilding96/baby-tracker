"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, isSameDay, startOfDay, subDays } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Divider } from "animal-island-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Moon } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface LogDetails {
  amount?: number;
  duration_minutes?: number;
  sub_type?: string;
}

interface LogRecord {
  id: string;
  type: "feeding" | "sleep" | "diaper";
  start_time: string;
  details: LogDetails | null;
}

interface DailyStat {
  date: string;
  fullDate: Date;
  amount: number;
  sleepHours: number;
  diaperCount: number;
  wetCount: number;
  dirtyCount: number;
  mixedCount: number;
}

export default function StatsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [chartData, setChartData] = useState<DailyStat[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = new Date();
        const sevenDaysAgo = subDays(startOfDay(today), 6);

        const initialStats: DailyStat[] = [];
        for (let i = 0; i < 7; i++) {
          const day = addDays(sevenDaysAgo, i);
          initialStats.push({
            date: format(day, "MM-dd"),
            fullDate: day,
            amount: 0,
            sleepHours: 0,
            diaperCount: 0,
            wetCount: 0,
            dirtyCount: 0,
            mixedCount: 0,
          });
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setChartData(initialStats);
          return;
        }

        const { data: relation, error: relationError } = await supabase
          .from("baby_users")
          .select("baby_id")
          .eq("user_id", user.id)
          .maybeSingle<{ baby_id: string }>();

        if (relationError) throw relationError;

        if (!relation?.baby_id) {
          setChartData(initialStats);
          return;
        }

        const { data: logs, error } = await supabase
          .from("logs")
          .select("*")
          .eq("baby_id", relation.baby_id)
          .gte("start_time", sevenDaysAgo.toISOString())
          .order("start_time", { ascending: true })
          .returns<LogRecord[]>();

        if (error) throw error;

        logs?.forEach((log) => {
          const logDate = new Date(log.start_time);
          const targetStat = initialStats.find((stat) =>
            isSameDay(stat.fullDate, logDate),
          );

          if (!targetStat) return;

          if (log.type === "feeding" && log.details?.amount) {
            targetStat.amount += log.details.amount;
            return;
          }

          if (log.type === "sleep" && log.details?.duration_minutes) {
            targetStat.sleepHours += log.details.duration_minutes / 60;
            return;
          }

          if (log.type === "diaper") {
            targetStat.diaperCount += 1;

            if (log.details?.sub_type === "wet") {
              targetStat.wetCount += 1;
            } else if (log.details?.sub_type === "dirty") {
              targetStat.dirtyCount += 1;
            } else if (log.details?.sub_type === "mixed") {
              targetStat.mixedCount += 1;
            }
          }
        });

        setChartData(
          initialStats.map((stat) => ({
            ...stat,
            sleepHours: Number(stat.sleepHours.toFixed(1)),
          })),
        );
      } catch (error) {
        console.error("统计数据加载失败:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const totalWet = chartData.reduce((sum, item) => sum + item.wetCount, 0);
  const totalDirty = chartData.reduce((sum, item) => sum + item.dirtyCount, 0);
  const totalMixed = chartData.reduce((sum, item) => sum + item.mixedCount, 0);

  return (
    <main className="island-page min-h-screen pb-20">
      <div className="island-shell space-y-4">
        <div className="mb-6 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft />
          </Button>
          <div>
            <p className="text-xs font-bold text-[#6fba2c]">Care Analytics</p>
            <h1 className="text-xl font-black text-[#725d42]">成长数据分析</h1>
          </div>
        </div>

        <Divider type="wave-yellow" />

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#6fba2c]" />
            <p className="text-sm text-[#9f927d]">正在分析数据...</p>
          </div>
        ) : (
          <Tabs defaultValue="feeding" className="w-full">
            <TabsList className="mb-4 grid w-full grid-cols-3 rounded-full bg-[#f0e8d8] p-1">
              <TabsTrigger value="feeding">🍼 奶量趋势</TabsTrigger>
              <TabsTrigger value="sleep">🌙 睡眠规律</TabsTrigger>
              <TabsTrigger value="diaper">💩 大小便</TabsTrigger>
            </TabsList>

            <TabsContent value="feeding" className="space-y-3">
              <Card className="island-card bg-[#fffdf5]">
                <CardHeader className="pb-1">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold text-[#725d42]">
                    <BarChart3 size={14} /> 近 7 天摄入总量 (ml)
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[260px] w-full pt-2.5">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#E8DCC8"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: "#9F927D" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#9F927D" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "#EEF6E7" }}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Bar
                        dataKey="amount"
                        fill="#8AC68A"
                        radius={[4, 4, 0, 0]}
                        barSize={20}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="island-soft-panel p-3 text-sm text-[#5a7f38]">
                💡 <strong>小贴士：</strong>
                平均每天摄入
                <span className="mx-1 text-lg font-bold">
                  {Math.round(
                    chartData.reduce((sum, item) => sum + item.amount, 0) / 7,
                  )}
                </span>
                ml。
              </div>
            </TabsContent>

            <TabsContent value="sleep" className="space-y-3">
              <Card className="island-card bg-[#fffdf5]">
                <CardHeader className="pb-1">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold text-[#725d42]">
                    <Moon size={14} /> 近 7 天睡眠总时长 (小时)
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[260px] w-full pt-2.5">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient
                          id="colorSleep"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#9A835A"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#9A835A"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#E8DCC8"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: "#9F927D" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#9F927D" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip contentStyle={{ borderRadius: "8px" }} />
                      <Area
                        type="monotone"
                        dataKey="sleepHours"
                        stroke="#9A835A"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorSleep)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="island-soft-panel p-3 text-sm text-[#725d42]">
                💡 <strong>小贴士：</strong>
                新生儿每天通常需要 14-17 小时睡眠，只要宝宝精神好，稍微少点也没关系。
              </div>
            </TabsContent>

            <TabsContent value="diaper" className="space-y-3">
              <Card className="island-card bg-[#fffdf5]">
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm font-bold text-[#725d42]">
                    近 7 天大小便记录
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[260px] w-full pt-2.5">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#E8DCC8"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: "#9F927D" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 12, fill: "#9F927D" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "#FFF4DA" }}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Bar
                        dataKey="wetCount"
                        name="尿尿"
                        stackId="diaper"
                        fill="#8AC68A"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="dirtyCount"
                        name="便便"
                        stackId="diaper"
                        fill="#F7CD67"
                      />
                      <Bar
                        dataKey="mixedCount"
                        name="混合"
                        stackId="diaper"
                        fill="#E59266"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="island-soft-panel p-2.5">
                  <p className="text-xs text-[#9f927d]">尿尿</p>
                  <p className="mt-0.5 text-lg font-black text-[#5a7f38]">
                    {totalWet}
                  </p>
                </div>
                <div className="island-soft-panel p-2.5">
                  <p className="text-xs text-[#9f927d]">便便</p>
                  <p className="mt-0.5 text-lg font-black text-[#8a5a13]">
                    {totalDirty}
                  </p>
                </div>
                <div className="island-soft-panel p-2.5">
                  <p className="text-xs text-[#9f927d]">混合</p>
                  <p className="mt-0.5 text-lg font-black text-[#c86f43]">
                    {totalMixed}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  );
}
