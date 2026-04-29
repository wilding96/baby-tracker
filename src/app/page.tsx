"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  format,
  parseISO,
  differenceInCalendarDays,
  startOfDay,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { Divider, Modal } from "animal-island-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarClock,
  BarChart3,
  Syringe,
  Stethoscope,
  Sparkles,
  Trash2,
} from "lucide-react";

type GrowthEventType = "checkup" | "vaccine" | "milestone" | "custom";

interface GrowthEvent {
  id: string;
  title: string;
  date: string;
  type: GrowthEventType;
  notes: string;
  createdAt: string;
}

interface GrowthEventRow {
  id: string;
  title: string;
  event_date: string;
  type: GrowthEventType;
  notes: string | null;
  created_at: string;
}

const eventTypeMap: Record<
  GrowthEventType,
  {
    label: string;
    badgeClass: string;
    icon: typeof Stethoscope;
  }
> = {
  checkup: {
    label: "体检",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Stethoscope,
  },
  vaccine: {
    label: "疫苗",
    badgeClass: "bg-green-50 text-green-700 border-green-200",
    icon: Syringe,
  },
  milestone: {
    label: "大事件",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    icon: Sparkles,
  },
  custom: {
    label: "其他",
    badgeClass: "bg-gray-50 text-gray-700 border-gray-200",
    icon: CalendarClock,
  },
};

export default function Home() {
  const [babyName, setBabyName] = useState("宝宝");
  const [babyId, setBabyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<GrowthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [eventType, setEventType] = useState<GrowthEventType>("checkup");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventNotes, setEventNotes] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setEvents([]);
          return;
        }

        setUserId(user.id);

        const { data: relationData, error: relationError } = await supabase
          .from("baby_users")
          .select(
            `
            babies (
              id,
              name
            )
          `,
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (relationError) {
          console.error("加载宝宝信息失败", relationError);
          setEvents([]);
          return;
        }

        const babyRaw = relationData?.babies as
          | { id: string; name: string }
          | { id: string; name: string }[]
          | null;
        const baby = Array.isArray(babyRaw) ? babyRaw[0] : babyRaw;

        if (!baby?.id) {
          setEvents([]);
          return;
        }

        setBabyId(baby.id);
        setBabyName(baby.name);

        const { data: rows, error: eventsError } = await supabase
          .from("growth_events")
          .select("id,title,event_date,type,notes,created_at")
          .eq("baby_id", baby.id)
          .order("event_date", { ascending: false })
          .order("created_at", { ascending: false });

        if (eventsError) {
          console.error("加载成长事件失败", eventsError);
          setEvents([]);
          return;
        }

        const normalizedRows = (rows || []) as GrowthEventRow[];

        setEvents(
          normalizedRows.map((row) => ({
            id: row.id,
            title: row.title,
            date: row.event_date,
            type: row.type,
            notes: row.notes || "",
            createdAt: row.created_at,
          })),
        );
      } catch (error) {
        console.error("初始化成长事件失败", error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const shouldOpen = sessionStorage.getItem("openGrowthEvent") === "1";
    if (shouldOpen) {
      sessionStorage.removeItem("openGrowthEvent");
      requestAnimationFrame(() => setDialogOpen(true));
    }

    const openHandler = () => setDialogOpen(true);
    window.addEventListener("open-growth-event", openHandler);

    return () => {
      window.removeEventListener("open-growth-event", openHandler);
    };
  }, []);

  const sortedDesc = useMemo(
    () =>
      [...events].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [events],
  );

  const nextEvent = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const upcoming = events
      .filter((event) => new Date(event.date).getTime() >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return upcoming[0] || null;
  }, [events]);

  const daysLeft = nextEvent
    ? differenceInCalendarDays(parseISO(nextEvent.date), startOfDay(new Date()))
    : null;

  const upcomingCount = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    return events.filter((event) => new Date(event.date).getTime() >= today)
      .length;
  }, [events]);

  const resetForm = () => {
    setEventType("checkup");
    setEventTitle("");
    setEventDate("");
    setEventNotes("");
  };

  const handleCreateEvent = async () => {
    if (!eventTitle.trim() || !eventDate) {
      alert("请填写事件标题和日期");
      return;
    }

    if (!babyId || !userId) {
      alert("请先绑定宝宝后再记录事件");
      return;
    }

    const payload = {
      baby_id: babyId,
      title: eventTitle.trim(),
      event_date: eventDate,
      type: eventType,
      notes: eventNotes.trim() || null,
      created_by: userId,
    };

    const { data, error } = await supabase
      .from("growth_events")
      .insert(payload)
      .select("id,title,event_date,type,notes,created_at")
      .single<GrowthEventRow>();

    if (error || !data) {
      alert(`保存失败：${error?.message || "请检查表结构"}`);
      return;
    }

    const event: GrowthEvent = {
      id: data.id,
      title: data.title,
      date: data.event_date,
      type: data.type,
      notes: data.notes || "",
      createdAt: data.created_at,
    };

    setEvents((prev) => [event, ...prev]);
    setDialogOpen(false);
    resetForm();
  };

  const handleDeleteEvent = async (id: string) => {
    const { error } = await supabase
      .from("growth_events")
      .delete()
      .eq("id", id)
      .eq("baby_id", babyId || "");

    if (error) {
      alert(`删除失败：${error.message}`);
      return;
    }

    setEvents((prev) => prev.filter((event) => event.id !== id));
  };

  return (
    <main className="island-page relative min-h-screen overflow-hidden pb-24">
      <div className="island-shell space-y-4">
        <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-[#f7cd67]/30 blur-3xl" />
        <div className="pointer-events-none absolute top-40 -left-12 h-36 w-36 rounded-full bg-[#8ac68a]/25 blur-3xl" />

        <header className="relative space-y-1">
          <p className="text-xs font-bold text-[#6fba2c]">Baby Island</p>
          <h1 className="text-2xl font-black text-[#725d42] tracking-tight">
            {babyName} 的成长记录
          </h1>
          <p className="text-xs text-[#9f927d]" suppressHydrationWarning>
            {format(new Date(), "yyyy年MM月dd日 EEEE", { locale: zhCN })}
          </p>
          <div className="mt-3 flex gap-2">
            <span className="rounded-full bg-[#fffdf5]/90 px-3 py-1 text-[11px] text-[#725d42] border border-[#e8dcc8] shadow-sm">
              共 {events.length} 条事件
            </span>
            <span className="rounded-full bg-[#eef6e7] px-3 py-1 text-[11px] text-[#5a7f38] border border-[#d9e8c9] shadow-sm">
              待进行 {upcomingCount} 条
            </span>
          </div>
        </header>

        <Card className="island-card relative overflow-hidden bg-[#f7cd67] text-[#725d42]">
          <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-white/20 blur-2xl" />
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-black opacity-90">
              下一个事件
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 pt-1">
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-2/3 rounded-full bg-white/45" />
                <div className="h-3 w-24 rounded-full bg-white/35" />
                <div className="h-2 w-16 rounded-full bg-white/30" />
              </div>
            ) : nextEvent ? (
              <div className="space-y-1">
                <p className="text-sm font-bold leading-snug">
                  {nextEvent.title}
                </p>
                <p className="text-xs opacity-90">
                  {format(parseISO(nextEvent.date), "MM月d日")} ·{" "}
                  {eventTypeMap[nextEvent.type].label}
                </p>
                <p className="text-[10px] opacity-90">
                  {daysLeft === 0
                    ? "就在今天"
                    : daysLeft && daysLeft > 0
                      ? `还有 ${daysLeft} 天`
                      : "已过期，请更新计划"}
                </p>
              </div>
            ) : (
              <p className="text-xs opacity-90">
                暂无未来事件，点击下方中间 + 开始添加。
              </p>
            )}
          </CardContent>
        </Card>

        <Divider type="wave-yellow" />

        <Card className="island-card bg-[#fffdf5]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#725d42] flex items-center gap-2">
              <Sparkles size={14} className="text-[#f7cd67]" />
              成长时间线
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedDesc.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-[#d4c9b4] bg-[#faf8f2] p-6 text-center text-sm text-[#9f927d]">
                暂无事件，先添加第一条体检/疫苗/大事件吧。
              </div>
            ) : (
              <div className="relative">
                {/* 使用更美观的虚线连接 */}
                <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#8ac68a] via-[#8ac68a]/50 to-transparent" />
                <div className="space-y-3">
                  {sortedDesc.map((event) => {
                    const typeMeta = eventTypeMap[event.type];
                    const Icon = typeMeta.icon;

                    return (
                      <div
                        key={event.id}
                        className="relative pl-10 rounded-xl border border-[#e8dcc8] bg-[#fffdf5] p-3.5 shadow-sm hover:shadow-md transition-all"
                      >
                        {/* 连接线 */}
                        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#8ac68a] via-[#8ac68a]/30 to-transparent" />

                        {/* 更精致的时间节点 */}
                        <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                          <div className="h-8 w-8 rounded-full border-2 border-[#8ac68a] bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
                            <Icon
                              size={14}
                              className="text-[#8ac68a] m-auto mt-1.5"
                            />
                          </div>
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1.5">
                            <p className="font-semibold text-[#725d42] text-sm leading-tight">
                              {event.title}
                            </p>
                            <p className="text-xs text-[#9f927d]">
                              {format(parseISO(event.date), "yyyy年M月d日")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(event.id)}
                            className="shrink-0 rounded-full p-1.5 text-[#a0936e] hover:bg-[#f0e8d8] hover:text-red-500 transition-colors"
                            aria-label="删除事件"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="mt-2 flex flex-wrap items-start gap-2">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-all"
                            style={{
                              backgroundColor: typeMeta.badgeClass.includes(
                                "blue",
                              )
                                ? "#eff6ff"
                                : typeMeta.badgeClass.includes("green")
                                  ? "#f0fdf4"
                                  : typeMeta.badgeClass.includes("purple")
                                    ? "#faf5ff"
                                    : "#f9fafb",
                              borderColor: typeMeta.badgeClass.includes("blue")
                                ? "#bfdbfe"
                                : typeMeta.badgeClass.includes("green")
                                  ? "#bbf7d0"
                                  : typeMeta.badgeClass.includes("purple")
                                    ? "#e9d5ff"
                                    : "#e5e7eb",
                              color: typeMeta.badgeClass.includes("blue")
                                ? "#1e40af"
                                : typeMeta.badgeClass.includes("green")
                                  ? "#166534"
                                  : typeMeta.badgeClass.includes("purple")
                                    ? "#7c3aed"
                                    : "#6b7280",
                            }}
                          >
                            {typeMeta.label}
                          </span>
                          {event.notes && (
                            <p className="flex-1 min-w-0 text-xs text-[#9f927d] leading-relaxed">
                              {event.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <section className="pt-1 space-y-2">
          <p className="text-xs text-[#9f927d]">快捷入口</p>

          <div className="island-soft-panel p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#725d42]">
                  继续记录喂养数据
                </p>
                <p className="text-xs text-[#9f927d] mt-0.5">
                  进入原有喂养记录流程
                </p>
              </div>
              <Button asChild className="h-10 px-4">
                <Link href="/record">去记录</Link>
              </Button>
            </div>
          </div>

          <div className="island-soft-panel p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#dff0d5] p-2 text-[#5a7f38]">
                  <BarChart3 size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#725d42]">
                    喂养情况总览
                  </p>
                  <p className="text-xs text-[#9f927d] mt-0.5">
                    查看奶量和睡眠趋势
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="h-10 px-4">
                <Link href="/stats">看总览</Link>
              </Button>
            </div>
          </div>

          <div className="island-soft-panel p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#725d42]">留言板</p>
                <p className="text-xs text-[#9f927d] mt-0.5">
                  给家人留句话，记录当下心情
                </p>
              </div>
              <Button asChild variant="outline" className="h-10 px-4">
                <Link href="/board">去留言</Link>
              </Button>
            </div>
          </div>
        </section>

        <Modal
          open={dialogOpen}
          title="新增成长事件"
          width="min(92vw, 380px)"
          typewriter={false}
          onClose={() => setDialogOpen(false)}
          footer={
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleCreateEvent}
              >
                保存事件
              </Button>
            </div>
          }
        >
          <div className="mb-3 text-sm text-[#9f927d]">
            记录体检、疫苗和宝宝成长大事件。
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-title">事件标题</Label>
              <Input
                id="event-title"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="例如：6月龄体检"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-date">日期</Label>
              <Input
                id="event-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-type">事件类型</Label>
              <select
                id="event-type"
                value={eventType}
                onChange={(e) =>
                  setEventType(e.target.value as GrowthEventType)
                }
                className="flex h-10 w-full rounded-full border-2 border-[#c4b89e] bg-[#f7f3df] px-4 py-1 text-sm text-[#725d42] shadow-[0_3px_#d4c9b4] outline-none"
              >
                <option value="checkup">体检</option>
                <option value="vaccine">疫苗</option>
                <option value="milestone">大事件</option>
                <option value="custom">其他</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-notes">备注</Label>
              <textarea
                id="event-notes"
                value={eventNotes}
                onChange={(e) => setEventNotes(e.target.value)}
                className="min-h-20 w-full rounded-3xl border-2 border-[#c4b89e] bg-[#f7f3df] px-4 py-3 text-sm text-[#725d42] shadow-[0_3px_#d4c9b4] outline-none"
                placeholder="例如：身高68cm，体重8.3kg"
              />
            </div>
          </div>
        </Modal>
      </div>
    </main>
  );
}
