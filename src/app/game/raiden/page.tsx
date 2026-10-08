"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useGameAudio } from "@/hooks/useGameAudio";
import { createEngine } from "./engine/game";
import {
  ELEMENT_ICON,
  ELEMENT_NAME,
  META_UPGRADES,
  PAL,
  SCHOOL_COLOR,
  SCHOOL_NAME,
  SHIP_INFO,
  SHIPS,
  W as GAME_W,
  H as GAME_H,
} from "./engine/config";
import { buyUpgrade, loadMeta, saveMeta, upgradeInfo } from "./engine/meta";
import type {
  AudioAdapter,
  CardDef,
  EngineHandle,
  MetaData,
  Phase,
  RunStats,
  ShipType,
} from "./engine/types";
import { EMPTY_META } from "./engine/types";

// ═══════════════════════════════════════════════════════════════════
// React 外壳：只负责低频弹层与状态镜像。
// 游戏循环、HUD 数字、三选一之外的一切都在引擎里，绝不触发重渲染。
// ═══════════════════════════════════════════════════════════════════

export default function PopRaiderGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const audio = useGameAudio();

  const [phase, setPhase] = useState<Phase>("menu");
  const [offer, setOffer] = useState<CardDef[]>([]);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [paused, setPaused] = useState(false);
  const [ship, setShip] = useState<ShipType>("nova");
  const [showShop, setShowShop] = useState(false);
  // 存档只能在客户端读：服务端渲染时先给空档，挂载后再灌入，
  // 否则首屏 HTML 与客户端不一致会触发 hydration 失败。
  const [meta, setMeta] = useState<MetaData>(() => ({
    ...EMPTY_META,
    upgrades: { ...EMPTY_META.upgrades },
  }));

  useEffect(() => {
    setMeta(loadMeta());
  }, []);

  // 引擎拿到的是稳定引用，实际调用始终走 ref，避免闭包过期
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const adapter = useMemo<AudioAdapter>(() => ({
    init: () => audioRef.current.initAudio(),
    shoot: (kind) => {
      if (kind === 1) audioRef.current.shootLaser();
      else if (kind === 2) audioRef.current.shootWave();
      else audioRef.current.shoot();
    },
    explosion: (big) => (big ? audioRef.current.bossExplosion() : audioRef.current.explosion()),
    playerHit: () => audioRef.current.playerHit(),
    pick: () => audioRef.current.coinCollect(),
    powerUp: () => audioRef.current.powerUp(),
    bossWarning: () => audioRef.current.bossWarning(),
    bomb: () => audioRef.current.bomb(),
    card: () => audioRef.current.gachaCard(),
    click: () => audioRef.current.buttonClick(),
    startBgm: () => audioRef.current.startBGM(),
    stopBgm: () => audioRef.current.stopBGM(),
  }), []);

  const onPhase = useCallback((next: Phase, cards: CardDef[], runStats: RunStats | null) => {
    setPhase(next);
    setOffer(cards);
    if (next === "gameover" && runStats) {
      setStats(runStats);
      setMeta((prev) => {
        const merged: MetaData = {
          stardust: prev.stardust + runStats.stardust,
          highScore: Math.max(prev.highScore, runStats.score),
          runs: prev.runs + 1,
          upgrades: { ...prev.upgrades },
        };
        saveMeta(merged);
        return merged;
      });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createEngine(canvas, adapter, { onPhase });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [adapter, onPhase]);

  // 暂停由 React 统一掌管，避免和引擎抢同一个按键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (phaseRef.current !== "playing") return;
      setPaused((p) => {
        engineRef.current?.setPaused(!p);
        return !p;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const start = () => {
    audio.buttonClick();
    setPaused(false);
    setStats(null);
    setShowShop(false);
    engineRef.current?.start(ship, meta);
  };

  const pick = (id: string) => {
    engineRef.current?.chooseCard(id);
  };

  const buy = (key: keyof MetaData["upgrades"]) => {
    audio.buttonClick();
    setMeta((prev) => {
      const next = buyUpgrade(prev, key);
      if (next !== prev) saveMeta(next);
      return next;
    });
  };

  const backToMenu = () => {
    audio.buttonClick();
    setPhase("menu");
    setStats(null);
    setPaused(false);
  };

  return (
    <main className="pop-root">
      <style>{STYLES}</style>

      <div className="pop-frame">
        <header className="pop-top">
          <Link href="/games" className="pop-back" onClick={() => audio.buttonClick()}>
            ‹ 返回
          </Link>
          <span className="pop-top-title">POP RAIDER</span>
          <span className="pop-top-dust">★ {meta.stardust}</span>
        </header>

        <div className="pop-stage">
          <canvas
            ref={canvasRef}
            width={GAME_W}
            height={GAME_H}
            className="pop-canvas"
          />

          {/* ── 主菜单 ── */}
          {phase === "menu" && (
            <div className="pop-veil">
              <h1 className="pop-logo">POP<br />RAIDER</h1>
              <p className="pop-sub">波普雷电 · 每一次起飞都不一样</p>

              <div className="pop-ships">
                {SHIPS.map((s) => {
                  const info = SHIP_INFO[s];
                  const active = s === ship;
                  return (
                    <button
                      key={s}
                      className={`pop-ship${active ? " on" : ""}`}
                      style={{ borderColor: PAL.ink, background: active ? info.element === "fire" ? PAL.yellow : PAL.cyan : PAL.paper }}
                      onClick={() => { audio.buttonClick(); setShip(s); }}
                    >
                      <span className="pop-ship-icon">{info.icon}</span>
                      <span className="pop-ship-name">{info.label}</span>
                      <span className="pop-ship-blurb">{info.blurb}</span>
                      <span className="pop-ship-elem">
                        {ELEMENT_ICON[info.element]} {ELEMENT_NAME[info.element]}属性
                      </span>
                    </button>
                  );
                })}
              </div>

              <button className="pop-btn pop-btn-main" onClick={start}>开始</button>
              <button className="pop-btn pop-btn-ghost" onClick={() => { audio.buttonClick(); setShowShop((v) => !v); }}>
                {showShop ? "收起养成" : "局外养成"}
              </button>

              {showShop && <Shop meta={meta} onBuy={buy} />}

              <p className="pop-hint">
                拖拽或 WASD 移动 · 自动开火 · <kbd>空格</kbd> 炸弹 · <kbd>ESC</kbd> 暂停
              </p>
              <p className="pop-record">最高分 {meta.highScore}</p>
            </div>
          )}

          {/* ── 三选一 ── */}
          {phase === "card" && (
            <div className="pop-veil pop-veil-card">
              <p className="pop-card-title">选择强化</p>
              <p className="pop-card-sub">构筑你的流派</p>
              <div className="pop-cards">
                {offer.map((c) => (
                  <button
                    key={c.id}
                    className="pop-card"
                    style={{ borderColor: PAL.ink, boxShadow: `0 6px 0 ${SCHOOL_COLOR[c.school]}` }}
                    onClick={() => { audio.buttonClick(); pick(c.id); }}
                  >
                    <span className="pop-card-school" style={{ background: SCHOOL_COLOR[c.school] }}>
                      {SCHOOL_NAME[c.school]}
                    </span>
                    <span className="pop-card-icon">{c.icon}</span>
                    <span className="pop-card-name">{c.name}</span>
                    <span className="pop-card-desc">{c.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 复活 ── */}
          {phase === "revive" && (
            <div className="pop-veil">
              <h2 className="pop-logo pop-logo-sm">机体损毁</h2>
              <p className="pop-sub">备用机体已就绪</p>
              <button
                className="pop-btn pop-btn-main"
                onClick={() => { audio.buttonClick(); engineRef.current?.useRevive(); }}
              >
                立即复活
              </button>
              <button
                className="pop-btn pop-btn-ghost"
                onClick={() => { audio.buttonClick(); engineRef.current?.giveUp(); }}
              >
                放弃本局
              </button>
            </div>
          )}

          {/* ── 暂停 ── */}
          {paused && phase === "playing" && (
            <div className="pop-veil">
              <h2 className="pop-logo pop-logo-sm">已暂停</h2>
              <button
                className="pop-btn pop-btn-main"
                onClick={() => { audio.buttonClick(); setPaused(false); engineRef.current?.setPaused(false); }}
              >
                继续
              </button>
              <button className="pop-btn pop-btn-ghost" onClick={backToMenu}>返回主菜单</button>
            </div>
          )}

          {/* ── 结算 ── */}
          {phase === "gameover" && stats && (
            <div className="pop-veil">
              <h2 className="pop-logo pop-logo-sm">{stats.isRecord ? "新纪录！" : "本局结束"}</h2>
              <table className="pop-stats">
                <tbody>
                  <tr><td>得分</td><td>{stats.score}</td></tr>
                  <tr><td>击破</td><td>{stats.kills}</td></tr>
                  <tr><td>抵达</td><td>STAGE {stats.stage}</td></tr>
                  <tr><td>复活</td><td>{stats.revives} 次</td></tr>
                  <tr><td>存活</td><td>{stats.seconds} 秒</td></tr>
                  <tr className="pop-stats-dust"><td>星尘</td><td>+{stats.stardust}</td></tr>
                </tbody>
              </table>
              <div className="pop-row">
                <button className="pop-btn pop-btn-main" onClick={start}>再来一局</button>
                <button className="pop-btn pop-btn-ghost" onClick={() => { audio.buttonClick(); setShowShop((v) => !v); }}>
                  养成
                </button>
              </div>
              {showShop && <Shop meta={meta} onBuy={buy} />}
              <button className="pop-btn pop-btn-ghost" onClick={backToMenu}>回主菜单</button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ── 局外养成面板 ──

function Shop({ meta, onBuy }: { meta: MetaData; onBuy: (k: keyof MetaData["upgrades"]) => void }) {
  return (
    <div className="pop-shop">
      <div className="pop-shop-head">
        <span>局外养成</span>
        <span className="pop-shop-dust">★ {meta.stardust}</span>
      </div>
      {META_UPGRADES.map((u) => {
        const info = upgradeInfo(meta, u.key);
        return (
          <div key={u.key} className="pop-shop-row">
            <div className="pop-shop-info">
              <span className="pop-shop-label">{info.label}</span>
              <span className="pop-shop-desc">{info.desc}</span>
              <span className="pop-shop-lv">Lv {info.lv} / {info.max}</span>
            </div>
            <button
              className="pop-shop-buy"
              disabled={info.maxed || !info.affordable}
              onClick={() => onBuy(u.key)}
            >
              {info.maxed ? "已满" : `★ ${info.price}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── 样式：波普 = 硬边 + 印刷原色 + 硬投影，一律不用模糊 ──

const STYLES = `
  .pop-root {
    min-height: 100dvh;
    background: ${PAL.ink};
    display: flex; justify-content: center;
    font-family: "Arial Black", Impact, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  .pop-frame {
    width: 100%; max-width: 420px;
    display: flex; flex-direction: column;
    background: ${PAL.paper};
  }
  .pop-top {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; gap: 8px;
    border-bottom: 3px solid ${PAL.ink};
  }
  .pop-back { color: ${PAL.blue}; font-size: 13px; text-decoration: none; }
  .pop-top-title { font-size: 13px; letter-spacing: 3px; color: ${PAL.ink}; }
  .pop-top-dust { font-size: 12px; color: ${PAL.ink}; }

  .pop-stage {
    position: relative;
    width: 100%;
    aspect-ratio: ${GAME_W} / ${GAME_H};
    max-height: calc(100dvh - 44px);
    margin: 0 auto;
    overflow: hidden;
    background: ${PAL.paper};
  }
  .pop-canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: crosshair; }

  .pop-veil {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 10px; padding: 18px; text-align: center;
    background: rgba(255, 248, 231, 0.94);
    overflow-y: auto;
  }
  .pop-veil-card { background: rgba(255, 248, 231, 0.97); }

  .pop-logo {
    font-size: 40px; line-height: 0.92; letter-spacing: 1px;
    color: ${PAL.yellow};
    -webkit-text-stroke: 3px ${PAL.ink};
    paint-order: stroke fill;
    text-shadow: 5px 5px 0 ${PAL.magenta};
  }
  .pop-logo-sm { font-size: 26px; text-shadow: 4px 4px 0 ${PAL.magenta}; }
  .pop-sub { font-size: 12px; letter-spacing: 2px; color: ${PAL.blue}; }

  .pop-ships { display: flex; gap: 8px; width: 100%; }
  .pop-ship {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 8px 4px; cursor: pointer;
    border: 3px solid ${PAL.ink};
    font-family: inherit;
  }
  .pop-ship.on { outline: 3px solid ${PAL.red}; outline-offset: -3px; }
  .pop-ship-icon { font-size: 18px; }
  .pop-ship-name { font-size: 13px; color: ${PAL.ink}; }
  .pop-ship-blurb { font-size: 9px; color: rgba(16,16,16,0.7); font-family: system-ui, sans-serif; font-weight: 700; }
  .pop-ship-elem { font-size: 9px; color: ${PAL.ink}; }

  .pop-btn {
    border: 4px solid ${PAL.ink}; cursor: pointer;
    font-family: inherit; font-size: 17px; letter-spacing: 3px;
    padding: 9px 30px; background: ${PAL.paper}; color: ${PAL.ink};
  }
  .pop-btn-main { background: ${PAL.red}; color: ${PAL.paper}; box-shadow: 5px 5px 0 ${PAL.ink}; }
  .pop-btn-ghost { background: ${PAL.paper}; font-size: 13px; padding: 7px 18px; letter-spacing: 1px; }
  .pop-btn:active { transform: translate(2px, 2px); box-shadow: none; }

  .pop-hint { font-size: 10px; color: rgba(16,16,16,0.65); font-family: system-ui, sans-serif; font-weight: 700; }
  .pop-hint kbd {
    border: 2px solid ${PAL.ink}; background: ${PAL.yellow};
    padding: 0 4px; font-family: inherit; font-size: 10px;
  }
  .pop-record { font-size: 11px; color: ${PAL.magenta}; }

  .pop-card-title { font-size: 22px; color: ${PAL.ink}; letter-spacing: 3px; }
  .pop-card-sub { font-size: 11px; color: ${PAL.blue}; margin-bottom: 4px; }
  .pop-cards { display: flex; gap: 8px; width: 100%; }
  .pop-card {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px;
    padding: 4px 4px 12px; cursor: pointer;
    border: 4px solid ${PAL.ink}; background: ${PAL.paper};
    font-family: inherit;
  }
  .pop-card:active { transform: translate(2px, 3px); box-shadow: none !important; }
  .pop-card-school {
    align-self: stretch; color: ${PAL.paper};
    font-size: 10px; letter-spacing: 2px; padding: 2px 0;
  }
  .pop-card-icon { font-size: 24px; line-height: 1.1; }
  .pop-card-name { font-size: 13px; color: ${PAL.ink}; }
  .pop-card-desc {
    font-size: 10px; line-height: 1.35; color: rgba(16,16,16,0.8);
    font-family: system-ui, sans-serif; font-weight: 700; padding: 0 2px;
  }

  .pop-stats {
    border: 3px solid ${PAL.ink}; background: ${PAL.paper};
    border-collapse: collapse; font-size: 13px; min-width: 210px;
  }
  .pop-stats td { padding: 4px 12px; border-bottom: 2px solid rgba(16,16,16,0.18); text-align: left; }
  .pop-stats td:last-child { text-align: right; color: ${PAL.blue}; }
  .pop-stats-dust td { color: ${PAL.magenta}; }
  .pop-stats-dust td:last-child { color: ${PAL.magenta}; }
  .pop-row { display: flex; gap: 10px; align-items: center; }

  .pop-shop {
    width: 100%; border: 4px solid ${PAL.ink}; background: ${PAL.paper};
    padding: 8px; display: flex; flex-direction: column; gap: 6px;
  }
  .pop-shop-head {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 13px; color: ${PAL.ink}; border-bottom: 3px solid ${PAL.ink}; padding-bottom: 4px;
  }
  .pop-shop-dust { color: ${PAL.magenta}; }
  .pop-shop-row { display: flex; align-items: center; gap: 8px; text-align: left; }
  .pop-shop-info { flex: 1; display: flex; flex-direction: column; }
  .pop-shop-label { font-size: 12px; color: ${PAL.ink}; }
  .pop-shop-desc { font-size: 10px; font-family: system-ui, sans-serif; font-weight: 700; color: rgba(16,16,16,0.7); }
  .pop-shop-lv { font-size: 9px; color: ${PAL.blue}; }
  .pop-shop-buy {
    border: 3px solid ${PAL.ink}; background: ${PAL.yellow}; color: ${PAL.ink};
    font-family: inherit; font-size: 12px; padding: 5px 10px; cursor: pointer; white-space: nowrap;
  }
  .pop-shop-buy:disabled { background: rgba(16,16,16,0.12); color: rgba(16,16,16,0.4); cursor: default; }

  @media (max-width: 380px) {
    .pop-logo { font-size: 32px; }
    .pop-card-icon { font-size: 20px; }
  }
`;
