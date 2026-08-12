import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/game/todo-monsters/manifest",
  title: "消灭小怪兽",
  description: "把待办变成怪兽，一只只消灭",
};

export default function TodoMonstersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
