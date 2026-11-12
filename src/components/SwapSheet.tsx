import { useMemo, useState } from 'react';
import { useAllWorkouts, useExerciseMap } from '../hooks/data';
import { setUnavailable } from '../db/workouts';
import { EQUIPMENT, type Equipment, type Exercise } from '../db/types';
import { armPart } from '../engine/classify';
import { alternativesFor } from '../engine/generate';
import { buildUsage } from '../engine/usage';
import { equipmentLabel, exerciseMuscleLabel } from '../utils';
import Sheet from './Sheet';

interface Props {
  current: Exercise;
  /** Exercises already in the session, which are not offered again. */
  excludeIds?: string[];
  onSwap: (to: Exercise) => void;
  onClose: () => void;
}

// Alternatives for the same muscle (logged ones first), a search across everything, an equipment
// filter, and a switch that marks the exercise being replaced as not available at this gym.
export default function SwapSheet({ current, excludeIds = [], onSwap, onClose }: Props) {
  const exercises = useExerciseMap();
  const workouts = useAllWorkouts();
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all');
  const [unavailable, setUnavailableFlag] = useState(false);

  const usage = useMemo(() => (exercises && workouts ? buildUsage(workouts, exercises) : undefined), [exercises, workouts]);

  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    if (!exercises || !usage) return [];
    const library = [...exercises.values()];
    if (q) {
      const skip = new Set([current.id, ...excludeIds]);
      return library
        .filter((e) => !e.deletedAt && !e.unavailable && !skip.has(e.id) && e.name.toLowerCase().includes(q))
        .sort((a, b) => (usage.count.get(b.id) ?? 0) - (usage.count.get(a.id) ?? 0) || a.name.localeCompare(b.name));
    }
    return alternativesFor(current, library, usage, excludeIds);
  }, [exercises, usage, current, excludeIds, q]);

  if (!exercises || !usage) return null;

  // Only offer equipment filters that would show something.
  const present = EQUIPMENT.filter((e) => list.some((x) => x.equipment === e));
  const shown = equipment === 'all' ? list : list.filter((e) => e.equipment === equipment);

  const pick = async (to: Exercise) => {
    if (unavailable) await setUnavailable(current.id, true);
    onSwap(to);
    onClose();
  };

  return (
    <Sheet title={`Swap ${current.name}`} onClose={onClose} tall>
      <button
        className="switch-row"
        role="switch"
        aria-checked={unavailable}
        onClick={() => setUnavailableFlag((v) => !v)}
      >
        <span>Not available at my gym</span>
        <span className="switch" aria-hidden="true" />
      </button>

      <input
        className="text-input"
        type="search"
        aria-label="Search all exercises"
        placeholder="Search all exercises"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {present.length > 1 && (
        <div className="chips">
          {(['all', ...present] as const).map((e) => (
            <button key={e} className="chip" aria-pressed={equipment === e} onClick={() => setEquipment(e)}>
              {e === 'all' ? 'All' : equipmentLabel(e)}
            </button>
          ))}
        </div>
      )}

      <div className="caption">{q ? 'All exercises' : `Other ${current.primary} exercises${armPart(current) ? `, ${armPart(current)} first` : ''}`}</div>
      <div className="sheet-list swap-list">
        {shown.map((ex) => {
          const n = usage.count.get(ex.id) ?? 0;
          return (
            <button key={ex.id} className="list-row" onClick={() => pick(ex)}>
              <span>
                <span className="plan-name">{ex.name}</span>
                <span className="plan-detail">
                  {q ? `${exerciseMuscleLabel(ex)} · ` : ''}
                  {equipmentLabel(ex.equipment)} · {n > 0 ? `done ${n} time${n === 1 ? '' : 's'}` : 'new to you'}
                </span>
              </span>
            </button>
          );
        })}
        {shown.length === 0 && <p className="note empty-note">Nothing matches. Try searching all exercises.</p>}
      </div>
    </Sheet>
  );
}
