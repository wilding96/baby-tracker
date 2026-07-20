export interface PuzzleBlock {
  id: string;
  color: number; // index into COLOR_PALETTE
  gridPos: [number, number, number]; // position in the grid
  worldPos: [number, number, number]; // 3D world position
  exposed: boolean; // has at least one face without a neighbor
  removed: boolean;
}

export interface TraySlot {
  id: string;
  color: number;
}

export type GamePhase = "menu" | "playing" | "levelComplete" | "gameOver";
