import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from '../components/Icons';
import { useAllWorkouts, useExerciseMap } from '../hooks/data';
import type { Exercise, Workout } from '../db/types';
import { shortDate } from '../engine/format';
import { doneWorkouts, workoutDate } from '../engine/history';
import { workoutMinutes } from '../engine/stats';
import { workoutVolume } from '../engine/volume';
import { muscleLabel } from '../utils';

// "Legs, Core", "Full body", or what was actually trained when no focus was chosen.
export function focusLabel(w: Workout, exercises: Map<string, Exercise>) {
  const focus = w.focus as string[];
  if (focus.length === 1 && focus[0] === 'full') return 'Full body';
  const muscles = focus.length
    ? focus
    : [...new Set(w.exercises.map((we) => exercises.get(we.exerciseId)?.primary).filter((m): m is Exercise['primary'] => !!m))];
  return muscles.length ? muscles.map((m) => muscleLabel(m as Exercise['primary'])).join(', ') : 'Workout';
}

// Bodyweight only sessions have no volume, so they simply leave it out.
const volumeText = (w: Workout) => {
  const kg = Math.round(workoutVolume(w));
  return kg > 0 ? `${kg.toLocaleString('en-AU')} kg · ` : '';
};

export const historyDate = (w: Workout) => shortDate(workoutDate(w), true);

export default function History() {
  const workouts = useAllWorkouts();
  const exercises = useExerciseMap();
  if (workouts === undefined || exercises === undefined) return null;

  const list = doneWorkouts(workouts).reverse();

  return (
    <div className="scroll">
      <div className="flow">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/progress" className="back" aria-label="Back to progress">
            <ChevronLeft />
          </Link>
          <h1 className="h1-sm">History</h1>
        </div>

        {list.length === 0 ? (
          <p className="note">No finished workouts yet. They are listed here, newest first, once you finish one.</p>
        ) : (
          <section className="card history-list">
            {list.map((w) => (
              <Link key={w.id} to={`/history/${w.id}`} className="list-row history-row">
                <span>
                  <span className="plan-name">
                    {historyDate(w)} · {focusLabel(w, exercises)}
                  </span>
                  <span className="plan-detail">
                    {workoutMinutes(w)} min · {volumeText(w)}
                    {w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'}
                  </span>
                </span>
                <ChevronRight size={18} />
              </Link>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
