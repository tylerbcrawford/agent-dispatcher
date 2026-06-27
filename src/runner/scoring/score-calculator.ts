// src/runner/scoring/score-calculator.ts
// Pure scoring formula: combines project weight, priority, urgency, and effort into 0-100 score.
import type { Priority } from '../../shared/types.js'

// --- Factor weights (must sum to 1.0) ---
const W_PROJECT  = 0.40
const W_PRIORITY = 0.25
const W_URGENCY  = 0.20
const W_EFFORT   = 0.15

// --- Priority → numeric value ---
const PRIORITY_VALUES: Record<Priority, number> = {
  HIGH: 100,
  MEDIUM: 60,
  LOW: 30,
}

export function mapPriorityToValue(priority: Priority): number {
  return PRIORITY_VALUES[priority] ?? 60
}

// --- Time estimate → effort bonus (inverse: quicker tasks score higher) ---
export function mapEffortToBonus(timeMinutes: number): number {
  if (timeMinutes <= 15) return 100
  if (timeMinutes <= 30) return 80
  if (timeMinutes <= 60) return 60
  return 40
}

// --- Main scoring function ---
export function calculateScore(
  projectWeight: number,
  priority: Priority,
  timeMinutes: number,
  urgencyBoost: number = 50,
): number {
  const raw =
    (projectWeight * W_PROJECT) +
    (mapPriorityToValue(priority) * W_PRIORITY) +
    (urgencyBoost * W_URGENCY) +
    (mapEffortToBonus(timeMinutes) * W_EFFORT)

  return Math.round(Math.max(0, Math.min(100, raw)))
}
