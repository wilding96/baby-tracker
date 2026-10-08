// ═══════════════════════════════════════════════════════════════════
// POP3D — 对象池
// 目标：游戏循环内零分配、零 GC（§4.4）。实体一律走这里，禁止每帧 new。
// ═══════════════════════════════════════════════════════════════════

import type { SlotSet } from "./types";

export interface Pool<T> {
  acquire(): T;
  release(item: T): void;
  readonly size: number;
}

export function createPool<T>(factory: () => T, reset?: (item: T) => void): Pool<T> {
  const free: T[] = [];
  return {
    acquire() {
      const item = free.pop();
      if (item !== undefined) return item;
      return factory();
    },
    release(item: T) {
      reset?.(item);
      free.push(item);
    },
    get size() {
      return free.length;
    },
  };
}

/**
 * 下标槽位池：实体预先分配在定长数组里，靠空闲下标栈复用。
 * 循环内只做 pop/push，不产生新对象。
 */
export function createSlots(capacity: number): SlotSet {
  const alive = new Uint8Array(capacity);
  const free: number[] = [];
  for (let i = capacity - 1; i >= 0; i -= 1) free.push(i);

  return {
    capacity,
    alive,
    acquire(): number {
      const index = free.pop();
      if (index === undefined) return -1;
      alive[index] = 1;
      return index;
    },
    release(index: number): void {
      if (index < 0 || index >= capacity || alive[index] === 0) return;
      alive[index] = 0;
      free.push(index);
    },
    get freeCount(): number {
      return free.length;
    },
  };
}
