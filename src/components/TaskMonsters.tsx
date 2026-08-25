"use client";

interface Monster {
  key: string;
  icon: string;
  label: string;
  done: boolean;
}

/** 今日任务小怪兽：记了对应记录就算消灭一只 */
export default function TaskMonsters({
  feeding,
  sleep,
  diaper,
}: {
  feeding: boolean;
  sleep: boolean;
  diaper: boolean;
}) {
  const monsters: Monster[] = [
    { key: "feeding", icon: "🍼", label: "喂奶", done: feeding },
    { key: "sleep", icon: "😴", label: "睡眠", done: sleep },
    { key: "diaper", icon: "💩", label: "尿布", done: diaper },
  ];
  const doneCount = monsters.filter((m) => m.done).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-[#725d42]">今日小怪兽</p>
        <p className="text-xs text-[#9f927d]">
          已消灭 {doneCount}/{monsters.length}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {monsters.map((m) => (
          <div
            key={m.key}
            className={`rounded-2xl p-3 text-center transition-all ${
              m.done ? "bg-[#eef6e7] opacity-80" : "bg-[#fff7dc]"
            }`}
          >
            <p className={`text-3xl ${m.done ? "grayscale" : "animate-bounce"}`}>
              {m.done ? "✅" : m.icon}
            </p>
            <p className="mt-1 text-xs font-bold text-[#725d42]">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
