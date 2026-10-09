# POP3D M5 批次 3a-FX（弹幕表现力补丁）Implementation Plan

日期：2026-10-09　前置：批次 3a（弹型/僚机/环绕弹）已验收

**触发**：试玩反馈"太扁平了，子弹很无聊"。诊断（有数可算）：720p 画布下场地
≈10.6 像素/世界单位，我方弹体只有 2.6~13px（敌机是 ~32px），且是 `MeshBasicMaterial`
纯平涂、无描边、无拖尾，未拿元素卡时还全是同一种青色。

**范围**：只动表现层，不改玩法数值（除了把弹体判定半径同步放宽 1.2 倍，避免"看着打中却没伤害"）。

---

## 实现清单

| # | 项 | 落点 |
| --- | --- | --- |
| 1 | 弹体放大 1.5 倍 + ink 描边壳 | `BULLET_VIS.scale/outline`、`render/assets.ts` |
| 2 | 加法混合的外圈辉光贴片（环形渐变，1 个 draw call） | `createGlowTexture/Geometry`、`scene.ts` |
| 3 | 拖尾：位置由速度反推（不存历史、零分配），3 节/发 | `BULLET_VIS.trail/trailGap/trailDim`、`scene.ts` |
| 4 | 属性差异：电＝锯齿残影 / 火＝拖焰 / 冰＝旋转菱形 | `scene.ts` 拖尾分支 |
| 5 | 僚机独立枪口闪光 | `Wingman.muzzle`、`game.ts`、`scene.ts` |
| 6 | 命中火花（复用爆点池，节流 ~33/秒） | `FX.hitSpark`、`game.ts#spawnSpark` |
| 7 | 背景速度线（26 条，1 个 draw call） | `FX.speedLines`、`scene.ts` |
| 8 | Bloom 后处理：桌面开、移动端关，`?bloom=0/1` 可覆盖 | `FX.bloom*`、`scene.ts` composer |

**Bloom 的关键取舍**：阈值取 `1.0`（线性亮度）。米色场地线性亮度 ≈0.94 不参与发光，
只有加法辉光贴片叠出来的"过曝"区域会发光——于是背景不糊、弹芯保持纯色。
`EffectComposer` 默认用 HalfFloat 渲染目标，加法叠加可以越过 1.0，这是这套做法的前提。

---

## 验收读数

`?stress=1` + 新星机型，点「开始」等 10 秒，连读 3 次：

| 配置 | FPS | 帧耗时 | 同屏弹幕 | draw call |
| --- | --- | --- | --- | --- |
| 批次 3a（改动前） | 60 | 16.7 ms | 544~552 | 15~16 |
| 3a-FX，`?bloom=0` | 60 | 16.7 ms | 546~552 | 19~20 |
| 3a-FX，默认（bloom 开） | 60 | 16.7 ms | 548~552 | **33** |

- 新增表现层固定成本 +4 draw call（描边 1 + 辉光 1 + 拖尾 1 + 速度线 1）；
  bloom 追加 ~13（5 级模糊 × 双向 + 亮度提取 + 合成）。
- 33 < §4.3 的 60 红线；移动端 `(pointer: coarse)` 直接关 bloom，回到 ~20。
- 普通局（`?auto=1`，新星）同样 60fps / 16.7ms / DC 32~34，console 零报错。

## 调参入口（不用碰渲染代码）

- `BULLET_VIS`：`scale` / `outline` / `glow` / `glowGain` / `trail` / `trailGap` / `trailDim`
- `FX`：`bloom` / `bloomStrength` / `bloomRadius` / `bloomThreshold` / `speedLines` / `hitSpark`
- 运行时 A/B：`?bloom=0`（关 bloom）、`?bloom=1`（强制开，含移动端）

## 未验证 / 风险

- **画面本身没有人眼确认**：实现环境读不了截图，配色与"够不够炫"需要人工过目；
  参数已集中到 `BULLET_VIS` / `FX`，不满意直接调数字。
- **移动端未实测**：只按 `(pointer: coarse)` 关 bloom，未在真机验证 60fps。
- bloom 阈值与"米色场地不发光"的边界只差 0.06（0.94 vs 1.0）；若背景色以后调亮，
  需要同步抬高阈值或压暗场地。
- 拖尾是加法混合、且排在透明队列（在所有不透明物体之后绘制），会轻微提亮它扫过的敌机；
  如果实测觉得伤可读性，把 `BULLET_VIS.trail` 降到 1~2。
