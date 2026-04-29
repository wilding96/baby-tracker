"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format, subDays, startOfDay, isSameDay, addDays } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Divider } from "animal-island-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Moon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

// --- 1. 类型定义 ---

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

// 图表数据点的结构
interface DailyStat {
  date: string; // 显示的日期 (如 "02-06")
  fullDate: Date; // 完整的日期对象 (用于比对)
  amount: number; // 奶量 (ml)
  sleepHours: number; // 睡眠 (小时)
  diaperCount: number; // 尿布 (次)
}

export default function StatsPage() {
  const router = useRouter();
  // 默认 loading 为 true，useEffect 里就不需要再 set(true) 了，避免报错
  const [loading, setLoading] = useState<boolean>(true);
  const [chartData, setChartData] = useState<DailyStat[]>([]);

  useEffect(() => {
    // 将逻辑完全封装在 effect 内部，避免外部依赖导致的重渲染问题
    const fetchStats = async () => {
      try {
        // 1. 确定时间范围：过去 7 天 (包含今天)
        const today = new Date();
        const sevenDaysAgo = subDays(startOfDay(today), 6);

        // 2. 初始化空数据 (确保每天都有数据，即使是0)
        const initialStats: DailyStat[] = [];
        for (let i = 0; i < 7; i++) {
          const d = addDays(sevenDaysAgo, i);
          initialStats.push({
            date: format(d, "MM-dd"), // X 轴格式
            fullDate: d,
            amount: 0,
            sleepHours: 0,
            diaperCount: 0,
          });
        }

        // 3. 获取当前用户与宝宝ID，避免跨宝宝统计
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

        // 4. 从数据库拉取当前宝宝数据
        const { data: logs, error } = await supabase
          .from("logs")
          .select("*")
          .eq("baby_id", relation.baby_id)
          .gte("start_time", sevenDaysAgo.toISOString())
          .order("start_time", { ascending: true })
          .returns<LogRecord[]>();

        if (error) throw error;

        if (logs) {
          // 4. 数据清洗与聚合
          logs.forEach((log) => {
            const logDate = new Date(log.start_time);

            // 找到这一天对应的数据桶
            const targetStat = initialStats.find((stat) =>
              isSameDay(stat.fullDate, logDate),
            );

            if (targetStat) {
              // A. 累加奶量
              if (log.type === "feeding" && log.details?.amount) {
                targetStat.amount += log.details.amount;
              }
              // B. 累加睡眠 (转成小时)
              else if (log.type === "sleep" && log.details?.duration_minutes) {
                targetStat.sleepHours += log.details.duration_minutes / 60;
              }
              // C. 累加尿布
              else if (log.type === "diaper") {
                targetStat.diaperCount += 1;
              }
            }
          });
        }

        // 5. 精度修正
        const finalData = initialStats.map((s) => ({
          ...s,
          sleepHours: Number(s.sleepHours.toFixed(1)),
        }));

        setChartData(finalData);
      } catch (error) {
        console.error("统计数据加载失败:", error);
      } finally {
        // 只有在这里才更新 loading，确保只渲染一次
        setLoading(false);
      }
    };

    fetchStats();
  }, []); // 空依赖数组，确保只运行一次

  return (
    <main className="island-page min-h-screen pb-20">
      <div className="island-shell space-y-4">
      {/* 顶部导航 */}
      <div className="flex items-center gap-2 mb-6">
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
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6fba2c]"></div>
          <p className="text-sm text-[#9f927d]">正在分析数据...</p>
        </div>
      ) : (
        <Tabs defaultValue="feeding" className="w-full">
          {/* 选项卡切换 */}
          <TabsList className="grid w-full grid-cols-2 mb-4 rounded-full bg-[#f0e8d8] p-1">
            <TabsTrigger value="feeding">🍼 奶量趋势</TabsTrigger>
            <TabsTrigger value="sleep">🌙 睡眠规律</TabsTrigger>
          </TabsList>

          {/* --- Tab 1: 奶量图表 --- */}
          <TabsContent value="feeding" className="space-y-4">
            <Card className="island-card bg-[#fffdf5]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#725d42] flex items-center gap-2">
                  <BarChart3 size={16} /> 近7天摄入总量 (ml)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] w-full pt-4">
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

            <div className="island-soft-panel p-4 text-sm text-[#5a7f38]">
              💡 <strong>小贴士：</strong>
              平均每天摄入
              <span className="font-bold mx-1 text-lg">
                {Math.round(chartData.reduce((a, b) => a + b.amount, 0) / 7)}
              </span>
              ml。
            </div>
          </TabsContent>

          {/* --- Tab 2: 睡眠图表 --- */}
          <TabsContent value="sleep" className="space-y-4">
            <Card className="island-card bg-[#fffdf5]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#725d42] flex items-center gap-2">
                  <Moon size={16} /> 近7天睡眠总时长 (小时)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] w-full pt-4">
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

            <div className="island-soft-panel p-4 text-sm text-[#725d42]">
              💡 <strong>小贴士：</strong>
              新生儿每天通常需要 14-17
              小时睡眠，只要宝宝精神好，稍微少点也没关系。
            </div>
          </TabsContent>
        </Tabs>
      )}
      </div>
    </main>
  );
}
