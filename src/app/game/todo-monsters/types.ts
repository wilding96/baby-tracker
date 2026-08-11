export interface Monster {
  id: string;
  text: string;
  emoji: string;
  color: string;
  accent: string;
  name: string;
  createdAt: number;
  completedAt: number | null;
}

export interface Poop {
  id: string;
  monsterId: string;
  x: number;
  y: number;
  droppedAt: number;
}

export interface MonsterVisual {
  emoji: string;
  name: string;
  color: string;
  accent: string;
}

export interface GameData {
  monsters: Monster[];
  history: Monster[];
  poops: Poop[];
}

export type GamePhase = "idle" | "confirming";
