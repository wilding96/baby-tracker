"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Divider } from "animal-island-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

type BoardMessage = {
  id: string;
  nickname: string;
  content: string;
  created_at: string;
};

const messageToneList = [
  { background: "#fff7dc", border: "#f0d992" },
  { background: "#eef8e8", border: "#cfe6bd" },
  { background: "#eef7ff", border: "#c9ddf2" },
  { background: "#fff0ec", border: "#efc8bb" },
];

export default function BoardPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [content, setContent] = useState("");
  const [messages, setMessages] = useState<BoardMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [babyId, setBabyId] = useState<string | null>(null);
  const [babyName, setBabyName] = useState("家庭");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const loadMessages = useCallback(async (currentBabyId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("message_board_messages")
      .select("id,nickname,content,created_at")
      .eq("baby_id", currentBabyId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("加载留言失败", error.message);
      setLoading(false);
      return;
    }

    setMessages((data || []) as BoardMessage[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      // 找到当前用户关联的家庭（宝宝）
      const { data: relation, error: relationError } = await supabase
        .from("baby_users")
        .select(
          `
          baby_id,
          babies (
            name
          )
        `,
        )
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (relationError) {
        console.error("加载家庭信息失败", relationError);
        setLoading(false);
        return;
      }

      const relationData = relation as {
        baby_id: string | null;
        babies: { name: string | null } | { name: string | null }[] | null;
      } | null;
      const babyRaw = relationData?.babies;
      const baby = Array.isArray(babyRaw) ? babyRaw[0] : babyRaw;
      const currentBabyId = relationData?.baby_id;

      if (!currentBabyId) {
        router.replace("/welcome");
        return;
      }

      setBabyId(currentBabyId);
      if (baby?.name) {
        setBabyName(baby.name);
      }
      await loadMessages(currentBabyId);
    };

    init();
  }, [router, loadMessages]);

  const handleSubmit = async () => {
    if (!content.trim()) {
      alert("请输入留言内容");
      return;
    }

    if (!babyId) {
      alert("未找到关联的家庭，请先创建或加入家庭。");
      return;
    }

    setSubmitting(true);
    const payload = {
      baby_id: babyId,
      nickname: nickname.trim() || "匿名用户",
      content: content.trim(),
    };

    const { data, error } = await supabase
      .from("message_board_messages")
      .insert(payload)
      .select("id,nickname,content,created_at")
      .single<BoardMessage>();

    if (error || !data) {
      alert(`留言失败：${error?.message || "请检查表结构和RLS策略"}`);
      setSubmitting(false);
      return;
    }

    setMessages((prev) => [data, ...prev]);
    setContent("");
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("message_board_messages")
      .delete()
      .eq("id", id);

    if (error) {
      alert(`删除失败：${error.message}`);
      return;
    }

    setMessages((prev) => prev.filter((msg) => msg.id !== id));
    setPendingDeleteId(null);
  };

  return (
    <main className="island-page min-h-screen pb-24">
      <div className="island-shell space-y-4">
        <header className="space-y-1">
          <p className="text-xs font-bold text-[#6fba2c]">Family Notes</p>
          <h1 className="text-2xl font-black text-[#725d42]">
            {babyName} 的家庭留言板
          </h1>
          <p className="text-sm text-[#9f927d]">
            只有本家庭的成员能看到这些留言。
          </p>
        </header>
        <Divider type="wave-yellow" />

        <Card className="island-card bg-[#fffdf5]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">写留言</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nickname">昵称（可选）</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="例如：妈妈"
                maxLength={20}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="content">留言内容</Label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-24 w-full rounded-3xl border-2 border-[#c4b89e] bg-[#f7f3df] px-4 py-3 text-sm text-[#725d42] shadow-[0_3px_#d4c9b4] outline-none"
                placeholder="写下想说的话..."
                maxLength={300}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full"
            >
              {submitting ? "提交中..." : "提交留言"}
            </Button>
          </CardContent>
        </Card>

        <Card className="island-card bg-[#fffdf5]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">最新留言</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-[#9f927d]">加载中...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-[#9f927d]">
                还没有留言，来写第一条吧。
              </p>
            ) : (
              <ul className="space-y-3">
                {messages.map((msg, index) => {
                  const tone = messageToneList[index % messageToneList.length];

                  return (
                    <li
                      key={msg.id}
                      className="rounded-3xl border-2 p-3 shadow-sm transition-transform hover:-translate-y-0.5"
                      style={{
                        backgroundColor: tone.background,
                        borderColor: tone.border,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#725d42]">
                          {msg.nickname || "匿名用户"}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-[#9f927d]">
                            {new Date(msg.created_at).toLocaleString("zh-CN")}
                          </p>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(msg.id)}
                            className="shrink-0 rounded-full p-1.5 text-[#a0936e] hover:bg-white/60 hover:text-red-500 transition-colors"
                            aria-label="删除留言"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-[#725d42] whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/">回首页</Link>
          </Button>
        </div>
      </div>

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>删除这条留言？</DialogTitle>
            <DialogDescription>
              删除后无法恢复，确定要删除吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteId(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                pendingDeleteId && handleDelete(pendingDeleteId)
              }
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
