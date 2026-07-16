# 《Raiden Fighters VFX Bible》

## Version 1.0（适用于 Pixel STG / Unity / Godot / Phaser）

> **设计目标**
>
> 不是"做炫"，而是**做到街机厅时代 Seibu Kaihatsu 的视觉语言**。
>
> 《Raiden Fighters》《Raiden II》《Viper Phase 1》的特效共同特点是：
>
> **信息优先 > 打击感 > 华丽度。** Seibu 开发者在访谈中也提到，他们追求的是“真实感”和可读性，例如小敌机动作快、大敌机动作慢，并非常注重阴影与动画细节，而不是单纯堆砌效果。([shmuplations.com][1])

---

# 第一章：视觉原则（Visual Language）

## Rule 01：每一种东西只能表达一种含义

| 对象    | 颜色               |
| ----- | ---------------- |
| 玩家子弹  | Blue / Cyan      |
| 激光    | White + Cyan     |
| 导弹    | Yellow           |
| 敌弹    | Red / Orange     |
| Boss弹 | Purple / Crimson |
| 奖励    | Gold             |
| 护盾    | Sky Blue         |
| EMP   | Cyan White       |

不要混色。

例如：

❌ 玩家和敌人都发绿色球。

应该：

```
蓝 = 我

红 = 敌

黄 = 奖励
```

---

# Rule 02：Bloom 不是主角

允许 Bloom：

✅ Boss死亡

✅ 大招

✅ 升级

其他时间：

```
Bloom = OFF
```

全部使用：

```
Sprite Glow

Additive Blend

1px Highlight
```

---

# Rule 03：所有特效都有寿命

| 特效   | 寿命       |
| ---- | -------- |
| 火花   | 3 Frame  |
| 爆炸   | 6 Frame  |
| 尾焰   | 循环       |
| 激光命中 | 2 Frame  |
| EMP  | 20 Frame |

不要存在：

> 永远发光。

---

# 第二章：玩家武器

---

# A. 普通机枪

Prompt

```text
Retro arcade vulcan cannon.

Small blue-white projectile.

Solid white core.

Thin cyan outline.

No bloom.

Straight trajectory.

1200 px/s.

Tiny 2-frame afterimage.

Classic Raiden Fighters.
```

---

参数

```
Sprite

8x8

Scale

1.0

Lifetime

0.6s

Trail

OFF

Afterimage

2 Frame
```

---

# B. 激光

Prompt

```text
Classic Raiden laser.

Solid white center beam.

Cyan outer edge.

Sharp pixel boundaries.

No transparency.

Constant beam width.

Small electric flicker.

Retro arcade style.
```

---

宽度

```
Lv1

6px

Lv2

10px

Lv3

16px

Lv4

24px
```

---

命中特效

```
白闪

↓

黄色火花

↓

消失
```

不要：

烟雾。

---

# C. 散弹

```
Spread

±30°

5 Shot

```

子弹：

```
Oval

Blue

White Core
```

不要：

圆球。

---

# D. 波纹

Prompt

```text
Blue plasma wave.

Expanding ring.

Transparent center.

Cyan edge.

No particle emission.

Expands smoothly.

Pixel art.
```

---

# 第三章：导弹

这是雷电味最重的一部分。

---

普通导弹

```
Yellow Nose

Gray Body

Orange Tail
```

轨迹：

```
↑

↑

↑

Boom
```

---

追踪导弹

Prompt

```text
Snake-like homing missile.

Head sprite leads.

Body segments follow with delay.

Smooth steering.

Maximum turning speed.

Purple plasma segments.

No smoke.

Retro arcade.
```

---

算法：

```
Head

↓

Segment1

↓

Segment2

↓

Segment3
```

不是：

Sin()。

而是：

Follow Chain。

---

# 第四章：Option（僚机）

---

不要：

发光球。

应该：

```
Metal Drone

↓

Rotate

↓

Shoot
```

Prompt

```text
Small metallic satellite.

White body.

Golden sensor.

Blue engine.

Orbit around player.

Minimal glow.

Classic arcade option.
```

---

轨迹

```
Lv1

左

Lv2

左右

Lv3

圆周

Lv4

攻击模式
```

---

# 第五章：敌弹

这是整个游戏最重要。

---

普通敌弹

Prompt

```text
Small pink bullet.

Dark magenta outline.

Light pink core.

No glow.

No bloom.

Constant speed.

Arcade readability.
```

---

Boss弹

```
Purple

↓

Outer Ring

↓

White Core
```

---

危险弹

```
Red

↓

Pulse

↓

Outer Circle
```

靠近玩家：

增加：

20%

亮度。

---

# 第六章：爆炸

街机爆炸：

不是：

火焰。

而是：

Flash。

---

小爆炸

```
Frame1

白

↓

Frame2

黄

↓

Frame3

橙

↓

Frame4

碎片
```

6 Frame。

---

Boss爆炸

循环：

```
Boom

Boom

Boom

Boom
```

持续：

2 秒。

每次：

随机位置。

---

# 第七章：尾焰

Prompt

```text
Jet exhaust.

White core.

Orange flame.

Blue edge.

Four-frame animation.

Pixel art.

No smoke.
```

不要：

火焰粒子。

---

# 第八章：能量球

Prompt

```text
Floating plasma orb.

Turquoise center.

Rotating outer ring.

Electric pulse.

No particles.

Retro arcade.
```

---

动画：

```
Scale

95%

↓

100%

↓

105%

↓

100%
```

循环。

---

# 第九章：背景

背景：

永远不要抢戏。

---

颜色：

```
#060A18

↓

#101C30
```

即可。

---

动态：

```
Grid

↓

Cloud

↓

Energy Ribbon
```

透明度：

15%。

---

# 第十章：HUD

不要：

现代UI。

应该：

```
LIFE

BOMB

POWER

SCORE
```

采用：

街机字体。

---

# 第十一章：颜色规范

```
Player

#5AD9FF

Laser

#FFFFFF

Enemy

#FF6050

Boss

#A040FF

Explosion

#FFD83D

PowerUp

#FFE14A

Warning

#FF2020
```

---

# 第十二章：动画原则

任何东西：

都遵守：

```
Idle

↓

Charge

↓

Shoot

↓

Recover
```

不要：

瞬移。

---

# 第十三章：镜头

街机：

几乎：

没有：

Camera Shake。

只有：

Boss：

```
0.15

Amplitude
```

即可。

---

# 第十四章：音效对应

| 事件      | 声音   |
| ------- | ---- |
| 普通射击    | 轻脆高频 |
| 导弹      | 低频   |
| 激光      | 持续电流 |
| 升级      | 电子音阶 |
| Boss死亡  | 连续爆炸 |
| PowerUp | 清脆上扬 |

---

# 第十五章：推荐统一 Prompt（所有 AI 素材都以它开头）

```text
1996 Japanese arcade shoot'em up.

Inspired by Seibu Kaihatsu.

Raiden Fighters.

Raiden II.

Raiden Fighters Jet.

Viper Phase 1.

Authentic arcade pixel art.

Clean silhouette.

Minimal bloom.

Minimal particles.

Solid sprite shapes.

High gameplay readability.

CRT arcade aesthetic.

Bright only where necessary.

Every effect is short-lived.

No modern VFX.

No volumetric lighting.

No cinematic smoke.

Fast, crisp, deterministic animation.

Designed for 60 FPS vertical shoot'em up.
```

---

## 最后送你一条我认为最重要的规范（也是很多独立 STG 最容易犯的错误）

### **街机 VFX 黄金比例**

假设画面有 **100% 的视觉能量**：

```
45% 敌人

25% 玩家飞机

15% 玩家子弹

10% UI

5% 特效
```

而很多现代独立 STG 会变成：

```
40% 特效

25% Bloom

20% 粒子

10% 子弹

5% 飞机
```

这就是为什么看起来"很炫"，却没有《Raiden Fighters》的质感。

**真正的《Raiden Fighters》风格，是玩家始终能在 0.1 秒内看清：自己在哪里、危险在哪里、奖励在哪里，而特效只是强化这一切，而不是掩盖这一切。**

[1]: https://shmuplations.com/viperphase1/?utm_source=chatgpt.com "Viper Phase 1 – 2006 Developer Interview - shmuplations.com"
