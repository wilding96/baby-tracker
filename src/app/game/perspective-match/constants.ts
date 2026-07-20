// Candy color palette — bright, saturated candy tones
export const COLOR_PALETTE = [
  { hex: "#B69CFF", name: "purple candy" },
  { hex: "#FF9DB5", name: "pink candy" },
  { hex: "#8CCEFF", name: "blue candy" },
  { hex: "#98E6C0", name: "green candy" },
  { hex: "#FFD98E", name: "yellow candy" },
  { hex: "#FF9FB2", name: "strawberry candy" },
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

// Block visual — rounder for candy feel
export const BLOCK_SIZE = 0.88;
export const BLOCK_ROUND = 0.25;
export const BLOCK_GAP = 1.0;

// Puzzle
export const TRAY_SIZE = 7;
export const MATCH_COUNT = 3;
export const TAP_THRESHOLD = 6;
export const REMOVE_DURATION_MS = 250;
export const MATCH_DELAY_MS = 300;
