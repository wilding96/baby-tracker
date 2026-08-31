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
