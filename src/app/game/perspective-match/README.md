# 立体积木消消乐（3D版羊了个羊）

## 核心玩法

- 3D 立方体由彩色方块堆叠而成，玩家可 360° 旋转视角
- 点击最外层（exposed）方块，飞入底部 7 格收集槽
- 收集槽中每凑齐 3 个同色方块 → 消除 + 得分（45分）
- 7 格填满且无 3 同色 → 游戏失败
- 所有方块移除 → 过关，进入下一关

## 关卡难度

| 关卡 | 尺寸 | 方块数 | 颜色数 |
|------|------|--------|--------|
| 1-2  | 3×3×3 | 27 | 随机 6 色中的子集 |
| 3-4  | 4×4×4 | 63* | 同上 |
| 5+   | 5×5×5 | 123* | 同上 |

\* 方块数向下取整到 3 的倍数，以保证颜色三联组完整。

## 颜色生成（三联组保证）

`generatePuzzle()` 每次生成一组 3 个同色方块，Fisher-Yates 洗牌后填充网格。确保每种颜色出现次数为 3 的倍数，不会出现最后孤立方块无法消除的情况。

```ts
// 每批 3 个方块同色
for (let i = 0; i < total; i += 3) {
  const c = Math.floor(Math.random() * 6);
  colorPool.push(c, c, c);
}
// 洗牌后分配到 gridPos
```

## 暴露检测

`computeExposure()` 遍历每个方块，检查 6 个邻面方向（±x, ±y, ±z）是否有邻居。至少一个方向没有邻居 → `exposed = true` → 可点击。

方块被移除后，邻居的暴露状态自动重算。

## 视觉风格

### 色板（莫兰迪/马卡龙）

```ts
blush    #d4a5a5  粉
sky      #a5b5d4  蓝
sage     #a5c4a5  绿
warm     #d4c4a5  米
lavender #c4a5d4  紫
peach    #d4b5a5  桃
```

### 背景

页面背景：暖奶油渐变 `#f5f0eb → #fff8f2 → #f0ebe5`
3D 画布背景：米灰色径向渐变 `#e8e0d8 → #d5cdc5 → #c8bfb5`
无网格、无星空。

### 方块

- `RoundedBox` 组件，圆角半径 0.15，smoothness 3
- 哑光质感：`roughness 0.4`，`metalness 0.05`
- 未暴露方块：灰紫色 `#8a8a9a`
- 暴露方块：带极淡白色 wireframe 外框（opacity 0.08）
- 点击移除时 scale 动画缩小到 0

### 光影

- `SoftShadows`（size=8, samples=16）全局柔和阴影
- `ContactShadows` 地面投影（opacity 0.25, blur=3）
- 三光源系统：
  - 主方向光：暖色 `#ffeedd`，位置 [5, 10, 5]，投射阴影
  - 补光：冷色 `#ddeeff`，位置 [-4, -2, -4]
  - 底部 rim 光：冷色 `#ccddff`，位置 [0, -6, 0]

### 收集槽 UI

- 固定在 3D 画布底部，半透明毛玻璃背景（`backdrop-filter: blur(12px)`）
- 每个槽位 34×34px，圆角 10px
- 空槽：虚线边框，半透明
- 已填充：实色 + 同色光晕投影

## 交互方式

| 操作 | 效果 |
|------|------|
| 单指滑动 | 360° 旋转视角（惯性阻尼 0.94） |
| 双指捏合 | 缩放（半径 5-20） |
| 点击（移动 < 6px） | Raycaster 检测点击方块 |
| 点击非暴露方块 | 无反馈（不可交互） |

## 文件结构

```
perspective-match/
├── constants.ts     # 色板、相机参数、方块尺寸、游戏常量
├── types.ts         # PuzzleBlock, TraySlot, GamePhase
├── page.tsx         # 主组件：生成/暴露检测/Raycaster/收集槽/场景渲染
└── README.md        # 本文档
```

## 关键技术栈

- Next.js (App Router) + TypeScript
- @react-three/fiber (R3F) — Three.js React 渲染器
- @react-three/drei — RoundedBox, SoftShadows, ContactShadows
- Three.js — Raycaster, Spherical, Vector2
