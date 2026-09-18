// ═══════════════════════════════════════════════════════════════════
// RAIDEN — generic object pool (reuses objects to avoid GC churn)
// ═══════════════════════════════════════════════════════════════════

export class Pool<T extends { alive: boolean }> {
  items: T[] = [];
  private factory: () => T;
  private freeList: number[] = [];
  private indexMap = new Map<T, number>();

  constructor(factory: () => T) {
    this.factory = factory;
  }

  get(): T {
    if (this.freeList.length > 0) {
      const idx = this.freeList.pop()!;
      const item = this.items[idx];
      item.alive = true;
      this.indexMap.set(item, idx);
      return item;
    }
    const n = this.factory();
    n.alive = true;
    const idx = this.items.length;
    this.items.push(n);
    this.indexMap.set(n, idx);
    return n;
  }

  release(item: T) {
    if (item.alive) {
      item.alive = false;
      const idx = this.indexMap.get(item);
      if (idx !== undefined) {
        this.freeList.push(idx);
        this.indexMap.delete(item);
      }
    }
  }

  forEachActive(callback: (item: T) => void) {
    for (const item of this.items) {
      if (item.alive) callback(item);
    }
  }

  releaseAll() {
    for (const item of this.items) item.alive = false;
  }
}
