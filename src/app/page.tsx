"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  format,
  parseISO,
  differenceInCalendarDays,
  startOfDay,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { Divider, Modal, Time } from "animal-island-ui";
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
  const router = useRouter();
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
          router.replace("/login");
          return;
        }

        setUserId(user.id);

        const { data: relationData, error: relationError } = await supabase
          .from("baby_users")
          .select(
            `
            baby_id,
            babies (
              id,
              name
            )
          `,
          )
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (relationError) {
          console.error("加载宝宝信息失败", relationError);
          setEvents([]);
          return;
        }

        const relation = relationData as
          | {
              baby_id: string | null;
              babies:
                | { id: string; name: string }
                | { id: string; name: string }[]
                | null;
            }
          | null;
        const babyRaw = relation?.babies;
        const baby = Array.isArray(babyRaw) ? babyRaw[0] : babyRaw;
        const currentBabyId = relation?.baby_id || baby?.id;

        if (!currentBabyId) {
          router.replace("/welcome");
          return;
        }

        setBabyId(currentBabyId);
        if (baby?.name) {
          setBabyName(baby.name);
        }

        const { data: rows, error: eventsError } = await supabase
          .from("growth_events")
          .select("id,title,event_date,type,notes,created_at")
          .eq("baby_id", currentBabyId)
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
  }, [router]);

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

        <header className="relative space-y-1 pr-28">
          {/* <div className="absolute right-0 top-0 origin-top-right scale-[0.55]">
            <Time />
          </div> */}
          <p className="text-xs font-bold text-[#6fba2c]">Baby Tracker</p>
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

        <Card
          color="app-yellow"
          className="island-card relative overflow-hidden text-[#725d42]"
        >
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/25" />
          <div className="absolute -bottom-10 left-8 h-20 w-20 rounded-full bg-[#fff7dc]/45" />
          <CardHeader className="relative z-10 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-black text-[#725d42]">
              <CalendarClock size={14} className="text-[#9a6a1f]" />
              下一个事件
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 pb-4 pt-0">
            {loading ? (
              <div className="animate-pulse space-y-2 rounded-3xl bg-white/40 p-3">
                <div className="h-4 w-2/3 rounded-full bg-white/55" />
                <div className="h-3 w-24 rounded-full bg-white/45" />
                <div className="h-2 w-16 rounded-full bg-white/40" />
              </div>
            ) : nextEvent ? (
              <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-3xl bg-white/45 p-3 ring-1 ring-white/45">
                <div className="min-w-0 space-y-2">
                  <div className="space-y-1">
                    <p className="truncate text-sm font-black leading-snug text-[#725d42]">
                      {nextEvent.title}
                    </p>
                    <p className="text-xs font-semibold text-[#8a7358]">
                      {format(parseISO(nextEvent.date), "MM月d日")} ·{" "}
                      {eventTypeMap[nextEvent.type].label}
                    </p>
                  </div>
                  <p className="inline-flex rounded-full bg-[#fff7dc] px-2.5 py-1 text-[11px] font-bold text-[#9a6a1f] ring-1 ring-[#efd28a]">
                    {daysLeft === 0
                      ? "今天就要完成啦"
                      : daysLeft !== null && daysLeft > 0
                        ? `距离计划还有 ${daysLeft} 天`
                        : "已过期，请更新计划"}
                  </p>
                </div>

                <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-[1.75rem] bg-[#fffdf5] text-center shadow-[0_6px_0_rgba(154,106,31,0.18)] ring-2 ring-white/70">
                  {daysLeft === 0 ? (
                    <span className="text-xl font-black text-[#d07044]">
                      今天
                    </span>
                  ) : daysLeft !== null && daysLeft > 0 ? (
                    <>
                      <span className="text-3xl font-black leading-none text-[#d07044]">
                        {daysLeft}
                      </span>
                      <span className="mt-1 text-[11px] font-black tracking-widest text-[#9a6a1f]">
                        DAYS
                      </span>
                    </>
                  ) : (
                    <span className="text-lg font-black text-[#d07044]">
                      待更新
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="rounded-3xl bg-white/45 p-3 text-xs font-semibold text-[#8a7358] ring-1 ring-white/45">
                暂无未来事件，点击下方中间 + 开始添加。
              </p>
            )}
          </CardContent>
        </Card>

        <Divider type="wave-yellow" />

        <Card color="app-green" className="island-card text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white flex items-center gap-2 drop-shadow-sm">
              <Sparkles size={14} className="text-white/90" />
              成长时间线
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1">
            {sortedDesc.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-white/55 bg-white/70 p-6 text-center text-sm font-semibold text-[#725d42]">
                暂无事件，先添加第一条体检/疫苗/大事件吧。
              </div>
            ) : (
              <div className="space-y-4">
                {sortedDesc.map((event, index) => {
                  const typeMeta = eventTypeMap[event.type];
                  const Icon = typeMeta.icon;
                  const isFirst = index === 0;
                  const isLast = index === sortedDesc.length - 1;

                  return (
                    <div
                      key={event.id}
                      className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3"
                    >
                      <div className="relative flex justify-center">
                        {!isFirst && (
                          <div className="absolute -top-4 left-1/2 h-[calc(1rem+1.875rem)] -translate-x-1/2 border-l-2 border-dashed border-white/70" />
                        )}
                        {!isLast && (
                          <div className="absolute left-1/2 top-[1.875rem] -bottom-4 -translate-x-1/2 border-l-2 border-dashed border-white/70" />
                        )}
                        <div className="relative z-10 mt-3 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#f7cd67] bg-[#fff7dc] text-[#9a6a1f] shadow-[0_4px_10px_rgba(247,205,103,0.34)] ring-4 ring-white/70">
                          <Icon size={15} />
                        </div>
                      </div>

                      <div className="relative rounded-2xl border border-[#e8dcc8] bg-[#fffdf5] p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(114,93,66,0.1)]">
                        <div className="absolute left-0 top-[1.875rem] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-l border-[#e8dcc8] bg-[#fffdf5]" />

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
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <section className="pt-1 space-y-2">
          <p className="text-xs text-[#9f927d]">快捷入口</p>

          <Card color="app-blue" className="island-card p-3 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white drop-shadow-sm">
                  继续记录喂养数据
                </p>
                <p className="text-xs text-white/85 mt-0.5">
                  进入原有喂养记录流程
                </p>
              </div>
              <Button
                asChild
                className="h-10 border-white/70 bg-white/90 px-4 text-[#5c6fca] shadow-[0_5px_rgba(80,96,180,0.45)] hover:border-white hover:bg-white hover:text-[#4f63c6]"
              >
                <Link href="/record">去记录</Link>
              </Button>
            </div>
          </Card>

          <Card color="app-teal" className="island-card p-3 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/25 p-2 text-white shadow-sm ring-1 ring-white/35">
                  <BarChart3 size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white drop-shadow-sm">
                    喂养情况总览
                  </p>
                  <p className="text-xs text-white/85 mt-0.5">
                    查看奶量和睡眠趋势
                  </p>
                </div>
              </div>
              <Button
                asChild
                variant="outline"
                className="h-10 border-white/70 bg-white/90 px-4 text-[#2f8f78] shadow-[0_5px_rgba(57,145,123,0.45)] hover:border-white hover:bg-white hover:text-[#247b67]"
              >
                <Link href="/stats">看总览</Link>
              </Button>
            </div>
          </Card>

          <Card color="warm-peach-pink" className="island-card p-3 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white drop-shadow-sm">
                  留言板
                </p>
                <p className="text-xs text-white/85 mt-0.5">
                  给家人留句话，记录当下心情
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                className="h-10 border-white/70 bg-white/90 px-4 text-[#b75f45] shadow-[0_5px_rgba(171,88,62,0.45)] hover:border-white hover:bg-white hover:text-[#9f4d35]"
              >
                <Link href="/board">去留言</Link>
              </Button>
            </div>
          </Card>
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
