// ═══════════════════════════════════════════════════════════════════
// POP RAIDER — 预分配对象池：主循环内零分配
// ═══════════════════════════════════════════════════════════════════

export interface Pool<T> {
  items: T[];
  n: number;
  cap: number;
  /** 取一个空位；池满返回 null（宁可丢新对象，也不扩容） */
  spawn(): T | null;
  /** 交换删除第 i 个活跃项 */
  kill(i: number): void;
  clear(): void;
}

export function makePool<T>(cap: number, factory: () => T): Pool<T> {
  const items = new Array<T>(cap);
  for (let i = 0; i < cap; i++) items[i] = factory();
  return {
    items,
    n: 0,
    cap,
    spawn() {
      return this.n < this.cap ? this.items[this.n++] : null;
    },
    kill(i: number) {
      const last = --this.n;
      const tmp = this.items[i];
      this.items[i] = this.items[last];
      this.items[last] = tmp;
    },
    clear() {
      this.n = 0;
    },
  };
}
