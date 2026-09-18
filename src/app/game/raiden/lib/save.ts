// ═══════════════════════════════════════════════════════════════════
// RAIDEN — localStorage persistence
// ═══════════════════════════════════════════════════════════════════

import type { SaveData } from "./types";

const SAVE_KEY = "raiden_save";

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // ensure upgrades field exists (old save data might not have it)
      if (!parsed.upgrades) {
        parsed.upgrades = { extraBomb: 0, weaponBoost: false, startShield: false, startWingman: false };
      }
      return parsed;
    }
  } catch {}
  return { highScore: 0, totalGames: 0, upgrades: { extraBomb: 0, weaponBoost: false, startShield: false, startWingman: false } };
}

export function writeSave(data: SaveData) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
}
