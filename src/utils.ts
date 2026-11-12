import type { FocusEvent } from 'react';
import type { ArmPart, Equipment, Exercise, Muscle } from './db/types';
import { armPart } from './engine/classify';

// Focusing a field selects its contents so one tap replaces the value.
export const selectOnFocus = (e: FocusEvent<HTMLInputElement>) => e.currentTarget.select();

export const muscleLabel = (m: Muscle) => m.charAt(0).toUpperCase() + m.slice(1);
export const partLabel = (p: ArmPart) => p.charAt(0).toUpperCase() + p.slice(1);

// "Biceps" or "Triceps" for arms exercises, the muscle group for everything else.
export const exerciseMuscleLabel = (ex: Pick<Exercise, 'name' | 'primary' | 'part'>) => {
  const part = armPart(ex);
  return part ? partLabel(part) : muscleLabel(ex.primary);
};

export const equipmentLabel = (e: Equipment) => e.charAt(0).toUpperCase() + e.slice(1);

// 754000 -> "12:34", 3_725_000 -> "1:02:05"
export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export const formatKg = (kg: number) => `${kg.toLocaleString('en-AU', { maximumFractionDigits: 1 })} kg`;
