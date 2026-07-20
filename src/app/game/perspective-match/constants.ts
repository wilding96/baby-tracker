// Mille-crepe cake palette — creamy, layered dessert tones
export const COLOR_PALETTE = [
  { hex: "#FFB5C2", name: "strawberry crepe" },
  { hex: "#B8D8B8", name: "matcha crepe" },
  { hex: "#FFF3E0", name: "vanilla crepe" },
  { hex: "#D4C5E2", name: "taro crepe" },
  { hex: "#FFE6B3", name: "mango crepe" },
  { hex: "#C5C8E8", name: "blueberry crepe" },
];

// Camera orbit
export const CAMERA_RADIUS = 10;
export const CAMERA_RADIUS_MIN = 5;
export const CAMERA_RADIUS_MAX = 20;
export const MIN_PHI = (10 * Math.PI) / 180;
export const MAX_PHI = (170 * Math.PI) / 180;
export const DAMPING = 0.94;
export const SWIPE_SENSITIVITY = 0.006;
export const MAX_VELOCITY = 0.08;

// Block visual
export const BLOCK_SIZE = 0.88;
export const BLOCK_ROUND = 0.12;
export const BLOCK_GAP = 1.0;

// Puzzle
export const TRAY_SIZE = 7;
export const MATCH_COUNT = 3;
export const TAP_THRESHOLD = 6;
export const REMOVE_DURATION_MS = 250;
export const MATCH_DELAY_MS = 300;
