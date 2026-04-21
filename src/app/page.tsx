"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO, differenceInCalendarDays, startOfDay } from "date-fns";
import { zhCN } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarClock,
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
  const [dialogOpen, setDialogOpen] = useState(false);

  const [eventType, setEventType] = useState<GrowthEventType>("checkup");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventNotes, setEventNotes] = useState("");

  useEffect(() => {
    const init = async () => {
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
    return events.filter((event) => new Date(event.date).getTime() >= today).length;
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
    <main className="relative container mx-auto max-w-md p-4 space-y-4 pb-24 min-h-screen overflow-hidden bg-gradient-to-b from-sky-50 via-gray-50 to-white">
      <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-cyan-200/35 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -left-12 h-36 w-36 rounded-full bg-blue-200/25 blur-3xl" />

      <header className="relative space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{babyName} 的成长记录</h1>
        <p className="text-xs text-gray-500">
          {format(new Date(), "yyyy年MM月dd日 EEEE", { locale: zhCN })}
        </p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] text-gray-600 border shadow-sm">
            共 {events.length} 条事件
          </span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] text-blue-700 border border-blue-100 shadow-sm">
            待进行 {upcomingCount} 条
          </span>
        </div>
      </header>

      <Card className="relative overflow-hidden border-0 bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg">
        <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-white/10 blur-2xl" />
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium opacity-90">下一个事件</CardTitle>
        </CardHeader>
        <CardContent>
          {nextEvent ? (
            <div className="space-y-2">
              <p className="text-lg font-bold">{nextEvent.title}</p>
              <p className="text-sm opacity-90">
                {format(parseISO(nextEvent.date), "MM月dd日")} ·
                {eventTypeMap[nextEvent.type].label}
              </p>
              <p className="text-xs opacity-90">
                {daysLeft === 0
                  ? "就在今天"
                  : daysLeft && daysLeft > 0
                    ? `还有 ${daysLeft} 天`
                    : "已过期，请更新计划"}
              </p>
            </div>
          ) : (
            <p className="text-sm opacity-90">暂无未来事件，点击下方中间“+”开始添加。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">成长时间线</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedDesc.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-500">
              暂无事件，先添加第一条体检/疫苗/大事件吧。
            </div>
          ) : (
            <div className="relative pl-4">
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gray-200" />
              <div className="space-y-4">
                {sortedDesc.map((event) => {
                  const typeMeta = eventTypeMap[event.type];
                  const Icon = typeMeta.icon;

                  return (
                    <div key={event.id} className="relative rounded-xl border bg-white p-3 shadow-sm">
                      <span className="absolute -left-[13px] top-4 h-3 w-3 rounded-full bg-blue-500" />

                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Icon size={14} className="text-gray-500" />
                            <p className="font-semibold text-sm text-gray-900">{event.title}</p>
                          </div>
                          <p className="text-xs text-gray-500">
                            {format(parseISO(event.date), "yyyy年MM月dd日")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(event.id)}
                          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                          aria-label="删除事件"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${typeMeta.badgeClass}`}>
                          {typeMeta.label}
                        </span>
                        {event.notes ? (
                          <p className="text-xs text-gray-500 line-clamp-1">备注：{event.notes}</p>
                        ) : (
                          <p className="text-xs text-gray-400">无备注</p>
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

      <section className="pt-1">
        <p className="mb-2 text-xs text-gray-500">原功能入口</p>
        <div className="rounded-2xl border bg-white/90 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">继续记录喂养数据</p>
              <p className="text-xs text-gray-500 mt-0.5">进入原有喂养记录流程</p>
            </div>
            <Button asChild className="h-10 px-4">
              <Link href="/record">去记录</Link>
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>新增成长事件</DialogTitle>
            <DialogDescription>记录体检、疫苗和宝宝成长大事件。</DialogDescription>
          </DialogHeader>

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
                onChange={(e) => setEventType(e.target.value as GrowthEventType)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
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
                className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="例如：身高68cm，体重8.3kg"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateEvent}>保存事件</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
