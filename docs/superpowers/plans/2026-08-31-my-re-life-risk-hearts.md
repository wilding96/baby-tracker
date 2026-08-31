# 我的反差妹妹：风险选择与生命值系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「我的反差妹妹」从 power/fame 数值系统改为 5 格连续爱心生命条，选择可安全、冒险或回血，血量归零后再冒险即 Game Over。

**Architecture:** 保留现有 `scenes` 剧情数据不变，新增一个纯函数模块 `hearts.ts` 承载血量判定；页面运行时把旧的 `RawScene` 映射为新的 `Scene`，用 `safe/risky/bonus` 替代 `power/fame`，并把右上角统计区改成连续爱心进度条。

**Tech Stack:** Next.js App Router、React、TypeScript、原生 DOM、CSS。

---

### Task 1: 新增生命值纯函数与测试

**Files:**
- Create: `src/app/game/my-re-life/hearts.ts`
- Create: `tests/my-re-life-hearts.test.mjs`

- [ ] **Step 1: 写失败测试**

创建 `tests/my-re-life-hearts.test.mjs`：

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOutcome, MAX_HEARTS } from "../src/app/game/my-re-life/hearts.ts";

test("risky reduces hearts by one", () => {
  assert.deepEqual(applyOutcome(5, "risky"), { hearts: 4, gameOver: false });
});

test("risky at zero triggers game over", () => {
  assert.deepEqual(applyOutcome(0, "risky"), { hearts: 0, gameOver: true });
});

test("bonus never exceeds max hearts", () => {
  assert.equal(applyOutcome(MAX_HEARTS, "bonus").hearts, MAX_HEARTS);
});

test("safe keeps hearts unchanged", () => {
  assert.deepEqual(applyOutcome(3, "safe"), { hearts: 3, gameOver: false });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/my-re-life-hearts.test.mjs`
Expected: FAIL，因为 `hearts.ts` 尚不存在。

- [ ] **Step 3: 实现最小模块**

创建 `src/app/game/my-re-life/hearts.ts`：

```ts
export type ChoiceOutcome = "safe" | "risky" | "bonus";

export const MAX_HEARTS = 5;

export interface HeartResult {
  hearts: number;
  gameOver: boolean;
}

export function applyOutcome(hearts: number, outcome: ChoiceOutcome): HeartResult {
  if (outcome === "risky") {
    if (hearts <= 0) {
      return { hearts: 0, gameOver: true };
    }
    return { hearts: hearts - 1, gameOver: false };
  }

  if (outcome === "bonus") {
    return { hearts: Math.min(MAX_HEARTS, hearts + 1), gameOver: false };
  }

  return { hearts, gameOver: false };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/my-re-life-hearts.test.mjs`
Expected: PASS，4 个测试全部通过。

- [ ] **Step 5: 提交**

```bash
git add src/app/game/my-re-life/hearts.ts tests/my-re-life-hearts.test.mjs
git commit -m "test: add hearts outcome logic"
```

---

### Task 2: 更新类型、状态与场景映射

**Files:**
- Modify: `src/app/game/my-re-life/page.tsx`

- [ ] **Step 1: 替换接口与状态定义**

在 `"use client";` 和 `import` 之后加入：

```ts
import { applyOutcome, type ChoiceOutcome, MAX_HEARTS } from "./hearts";
```

把现有 `GameState`、`Choice`、`Scene` 定义替换为：

```ts
interface GameState {
  player: string;
  hearts: number;
  sceneId: string;
  dialogueIndex: number;
  loop: number;
  loopStartSceneId: string;
  memories: string[];
}

interface Choice {
  text: string;
  nextSceneId: string;
  requiresMemory?: string;
  gainMemory?: string;
  outcome: ChoiceOutcome;
}

interface LegacyChoice {
  text: string;
  power: number;
  fame: number;
  nextSceneId: string;
  requiresMemory?: string;
  requiresPower?: number;
  requiresFame?: number;
  gainMemory?: string;
}

interface Scene {
  id: string;
  title: string;
  image?: string;
  imageStops?: { at: number; image?: string; background?: "gray" | "black" }[];
  dialogue: string[];
  choices?: Choice[];
  isEnding?: boolean;
  endingType?: "god" | "pride" | "small" | "coward";
  onLoop?: boolean;
}

interface RawScene {
  id: string;
  title: string;
  image?: string;
  imageStops?: { at: number; image?: string; background?: "gray" | "black" }[];
  dialogue: string[];
  choices?: LegacyChoice[];
  isEnding?: boolean;
  endingType?: "god" | "pride" | "small" | "coward";
  onLoop?: boolean;
}
```

把 `const gameState` 替换为：

```ts
const gameState: GameState = {
  player: "",
  hearts: MAX_HEARTS,
  sceneId: "",
  dialogueIndex: 0,
  loop: 1,
  loopStartSceneId: "prologue",
  memories: [],
};
```

- [ ] **Step 2: 把剧情数组类型改为 RawScene**

把 `const scenes: Scene[] = [` 改为 `const rawScenes: RawScene[] = [`，并保持数组内容不变。

- [ ] **Step 3: 把旧选择映射为新选择**

在 `const scenesMap = ...` 之前，替换现有的图片赋值与 `scenesMap` 逻辑为：

```ts
for (const scene of rawScenes) {
  const image = sceneImages[scene.id];
  if (image != null) {
    scene.image = image;
  }
}

const choiceOutcomes: Record<string, ChoiceOutcome[]> = {
  prologue: ["safe", "risky", "risky"],
  "l1-morning": ["safe", "risky", "risky"],
  "l1-humiliate": ["safe", "risky", "safe"],
  "l1-claim": ["bonus", "safe", "bonus"],
  "l2-morning": ["safe", "risky", "bonus"],
  "l2-meeting": ["risky", "safe", "safe"],
  "l2-demo": ["safe", "safe", "risky"],
  "l2-sister": ["safe", "bonus", "risky"],
  "l2-conspiracy": ["risky", "safe", "risky"],
  "l3-morning": ["risky", "safe", "bonus"],
  "l3-board": ["risky", "safe", "risky", "risky"],
  "l3-reveal": ["safe", "bonus", "safe"],
  "l3-sister": ["safe", "safe", "safe", "safe"],
};

const scenes: Scene[] = rawScenes.map((scene) => ({
  ...scene,
  choices: scene.choices?.map((choice, index) => ({
    text: choice.text,
    nextSceneId: choice.nextSceneId,
    ...(choice.requiresMemory ? { requiresMemory: choice.requiresMemory } : {}),
    ...(choice.gainMemory ? { gainMemory: choice.gainMemory } : {}),
    outcome: choiceOutcomes[scene.id]?.[index] ?? "safe",
  })),
}));

const scenesMap = new Map(scenes.map((item) => [item.id, item]));
```

- [ ] **Step 4: 运行类型检查**

Run: `npx tsc --noEmit --pretty false`
Expected: PASS，无新增类型错误。

- [ ] **Step 5: 提交**

```bash
git add src/app/game/my-re-life/page.tsx src/app/game/my-re-life/hearts.ts
git commit -m "refactor: map legacy choices to safe/risky/bonus outcomes"
```

---

### Task 3: 更新选择可用性与结算逻辑

**Files:**
- Modify: `src/app/game/my-re-life/page.tsx`

- [ ] **Step 1: 重写 `availableChoices`**

替换为：

```ts
function availableChoices(scene: Scene): Choice[] {
  if (scene.choices == null) {
    return [];
  }

  return scene.choices.filter((choice) => {
    if (choice.requiresMemory != null && !gameState.memories.includes(choice.requiresMemory)) {
      return false;
    }
    return true;
  });
}
```

- [ ] **Step 2: 重写 `handleChoice`**

替换为：

```ts
function handleChoice(choices: Choice[], choiceIndex: number): void {
  const scene = scenesMap.get(gameState.sceneId);

  if (scene == null) {
    return;
  }

  const choice = choices[choiceIndex];
  const result = applyOutcome(gameState.hearts, choice.outcome);

  if (result.gameOver) {
    renderGameOver();
    return;
  }

  gameState.hearts = result.hearts;
  gameState.sceneId = choice.nextSceneId;
  gameState.dialogueIndex = 0;

  if (choice.gainMemory != null && !gameState.memories.includes(choice.gainMemory)) {
    gameState.memories.push(choice.gainMemory);
  }

  renderScene();
}
```

- [ ] **Step 3: 新增 Game Over 与重试函数**

在 `handleChoice` 之前加入：

```ts
function renderGameOver(): void {
  const app = document.getElementById("app")!;

  app.innerHTML = `
<div class="game-over-screen">
  <div class="game-over-content">
    <div class="game-over-emoji">💔</div>
    <h2 class="game-over-title">这一世，你没能走到最后</h2>
    <p class="game-over-text">命运没有给你重来的机会。但轮回，还在等着你。</p>
    <div class="game-over-actions">
      <button class="start-button" id="retry-loop-btn">回到本周目开头</button>
      <button class="start-button ghost" id="restart-game-btn">重新开始</button>
    </div>
  </div>
</div>
`;

  document.getElementById("retry-loop-btn")!.addEventListener("click", () => {
    gameState.hearts = MAX_HEARTS;
    gameState.dialogueIndex = 0;
    gameState.sceneId = gameState.loopStartSceneId || "prologue";
    renderSceneEntry();
  });

  document.getElementById("restart-game-btn")!.addEventListener("click", () => {
    location.reload();
  });
}
```

- [ ] **Step 4: 更新周目进入逻辑**

把 `enterLoop` 和 `renderLoopTransition` 替换为：

```ts
function enterLoop(nextLoop: number, startSceneId: string): void {
  gameState.loop = nextLoop;
  gameState.hearts = MAX_HEARTS;
  gameState.loopStartSceneId = startSceneId;
  gameState.sceneId = "";
  gameState.dialogueIndex = 0;
}

function renderLoopTransition(nextLoop: number, startSceneId: string): void {
  const app = document.getElementById("app")!;

  app.innerHTML = `
<div class="loop-transition">
  <div class="loop-content">
    <h2 class="loop-title">重生</h2>
    <p class="loop-subtitle">第 ${nextLoop} 周目 · 记忆苏醒，重写命运</p>
    <button class="start-button loop-button" id="loop-continue-btn">继续</button>
  </div>
</div>
`;

  document.getElementById("loop-continue-btn")!.addEventListener("click", () => {
    enterLoop(nextLoop, startSceneId);
    gameState.sceneId = startSceneId;
    renderScene();
  });
}
```

- [ ] **Step 5: 运行类型检查**

Run: `npx tsc --noEmit --pretty false`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/app/game/my-re-life/page.tsx
git commit -m "feat: add game over and loop retry"
```

---

### Task 4: 替换右上角为爱心进度条

**Files:**
- Modify: `src/app/game/my-re-life/page.tsx`
- Modify: `src/app/game/my-re-life/styles.css`

- [ ] **Step 1: 更新 `initGameUI` 中的 stats bar**

把现有 `stats-bar` 整块替换为：

```ts
<div class="stats-bar">
  <div class="stat-item hearts-item">
    <span class="stat-label">状态</span>
    <div class="hearts-meter">
      <div class="hearts-track">
        <div class="hearts-fill" id="hearts-fill"></div>
        <div class="hearts-markers" id="hearts-markers">
          <span class="heart-marker">❤️</span>
          <span class="heart-marker">❤️</span>
          <span class="heart-marker">❤️</span>
          <span class="heart-marker">❤️</span>
          <span class="heart-marker">❤️</span>
        </div>
      </div>
    </div>
  </div>
  <div class="stat-item loop-item">
    <span class="stat-label">周目</span>
    <span id="loop-value" class="loop-value">第 1 轮</span>
  </div>
</div>
```

- [ ] **Step 2: 重写 `updateStats`**

替换为：

```ts
function updateStats(): void {
  const hearts = Math.max(0, Math.min(MAX_HEARTS, gameState.hearts));
  const fill = document.getElementById("hearts-fill")!;
  const loopValue = document.getElementById("loop-value")!;

  fill.style.width = `${(hearts / MAX_HEARTS) * 100}%`;

  document.querySelectorAll(".heart-marker").forEach((marker, index) => {
    marker.classList.toggle("filled", index < hearts);
    marker.classList.toggle("empty", index >= hearts);
  });

  loopValue.textContent = `第 ${gameState.loop} 轮`;
}
```

- [ ] **Step 3: 添加爱心进度条与 Game Over CSS**

在 `styles.css` 中替换 `.stats-bar`、`.stat-item`、`.stat-bar`、`.stat-fill` 相关样式，并新增：

```css
.stats-bar {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 168px;
  padding: 12px 14px;
  background-color: rgba(0, 0, 0, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  backdrop-filter: blur(10px);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
  white-space: nowrap;
}

.hearts-meter {
  flex: 1;
  min-width: 108px;
}

.hearts-track {
  position: relative;
  height: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
}

.hearts-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  background-image: linear-gradient(90deg, #ff6b6b 0%, #ff8fa3 55%, #d66cf0 100%);
  border-radius: 999px;
  box-shadow: 0 0 14px rgba(255, 107, 107, 0.5);
  transition: width 0.35s ease;
}

.hearts-markers {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  pointer-events: none;
}

.heart-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.heart-marker.filled {
  opacity: 1;
  transform: scale(1);
}

.heart-marker.empty {
  opacity: 0.3;
  transform: scale(0.82);
}

.loop-item {
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.loop-value {
  font-size: 0.8rem;
  font-weight: 700;
  color: #f6e05e;
  white-space: nowrap;
}

.game-over-screen {
  display: flex;
  width: 100%;
  min-height: 100%;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.game-over-content {
  width: min(420px, 100%);
  padding: 42px 30px 34px;
  text-align: center;
  background: rgba(20, 12, 24, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(12px);
}

.game-over-emoji {
  margin-bottom: 14px;
  font-size: 2.8rem;
  animation: loadingFloat 1.8s ease-in-out infinite;
}

.game-over-title {
  margin: 0 0 10px;
  font-size: 1.45rem;
  font-weight: 700;
  color: #ffe1e7;
}

.game-over-text {
  margin: 0 0 26px;
  font-size: 0.9rem;
  line-height: 1.7;
  color: #b9a8c1;
}

.game-over-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.start-button.ghost {
  background: rgba(255, 255, 255, 0.1);
  box-shadow: none;
  border: 1px solid rgba(255, 255, 255, 0.18);
}
```

- [ ] **Step 4: 运行构建检查**

Run: `npx tsc --noEmit --pretty false`
Expected: PASS。

Run: `npm run lint`
Expected: 无新增 error（`handleDeath` 的旧 warning 可忽略）。

- [ ] **Step 5: 提交**

```bash
git add src/app/game/my-re-life/page.tsx src/app/game/my-re-life/styles.css
git commit -m "feat: render heart progress bar and game over screen"
```

---

### Task 5: 手动回归与收尾提交

- [ ] **Step 1: 启动开发服务器**

Run: `npm run dev`
Expected: 页面可访问 `/game/my-re-life`。

- [ ] **Step 2: 手动检查**

1. 开始页显示“开始游戏”，无姓名输入。
2. 点击开始后出现进度条，加载完成后进入序章。
3. 右上角显示 5 格连续爱心进度条。
4. 选择 `risky` 时爱心减少，并有平滑动画。
5. 选择 `bonus` 时回血，且不会超过 5 格。
6. 血量为 0 后再次选择 `risky` 出现 Game Over。
7. Game Over 中“回到本周目开头”能恢复该周目；“重新开始”能回到开始页。

- [ ] **Step 3: 运行测试与类型检查**

Run:

```bash
node --test tests/my-re-life-hearts.test.mjs
npx tsc --noEmit --pretty false
```

Expected: 测试 PASS，类型检查 PASS。

- [ ] **Step 4: 提交剩余改动**

```bash
git add -A docs/superpowers/plans/2026-08-31-my-re-life-risk-hearts.md
git commit -m "docs: add risk hearts implementation plan"
```

> 注意：`git add -A` 仅用于收尾时提交计划文档，代码改动在各自任务中已按文件精确提交。
