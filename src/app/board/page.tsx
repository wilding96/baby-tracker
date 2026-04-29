"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Divider } from "animal-island-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BoardMessage = {
  id: string;
  nickname: string;
  content: string;
  created_at: string;
};

export default function BoardPage() {
  const [nickname, setNickname] = useState("");
  const [content, setContent] = useState("");
  const [messages, setMessages] = useState<BoardMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("message_board_messages")
      .select("id,nickname,content,created_at")
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
    const timer = window.setTimeout(() => {
      void loadMessages();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadMessages]);

  const handleSubmit = async () => {
    if (!content.trim()) {
      alert("请输入留言内容");
      return;
    }

    setSubmitting(true);
    const payload = {
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

  return (
    <main className="island-page min-h-screen pb-24">
      <div className="island-shell space-y-4">
        <header className="space-y-1">
          <p className="text-xs font-bold text-[#6fba2c]">Family Notes</p>
          <h1 className="text-2xl font-black text-[#725d42]">留言板</h1>
          <p className="text-sm text-[#9f927d]">给家人留句话，大家都能看到。</p>
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
                {messages.map((msg) => (
                  <li
                    key={msg.id}
                    className="rounded-3xl border-2 border-[#e8dcc8] bg-[#fffdf5] p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#725d42]">
                        {msg.nickname || "匿名用户"}
                      </p>
                      <p className="text-xs text-[#9f927d]">
                        {new Date(msg.created_at).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-[#725d42] whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/">回首页</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/login">去登录</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
