import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import ExercisePicker from '../components/ExercisePicker';
import { ChevronDown, ChevronLeft, ChevronUp, Close, Plus } from '../components/Icons';
import NumInput from '../components/NumInput';
import { useActiveWorkout, useExerciseMap, useWorkout } from '../hooks/data';
import { discardWorkout, newTarget, startWorkout, updateWorkout } from '../db/workouts';
import type { Exercise } from '../db/types';
import { equipmentLabel, exerciseMuscleLabel } from '../utils';

export default function Builder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const workout = useWorkout(id);
  const active = useActiveWorkout();
  const exercises = useExerciseMap();
  const [picking, setPicking] = useState(false);

  if (workout === undefined || exercises === undefined) return null;
  if (workout === null) return <Navigate to="/" replace />;
  if (workout.status === 'active') return <Navigate to={`/session/${workout.id}`} replace />;
  if (workout.status === 'done') return <Navigate to={`/summary/${workout.id}`} replace />;

  const blocked = !!active && active.id !== workout.id;
  const setCount = workout.exercises.reduce((n, we) => n + we.target.sets, 0);

  const add = (ex: Exercise) =>
    updateWorkout(workout.id, (w) => {
      if (w.exercises.some((we) => we.exerciseId === ex.id)) return;
      w.exercises.push({ ...newTarget(ex), order: w.exercises.length });
    });

  const remove = (index: number) =>
    updateWorkout(workout.id, (w) => {
      w.exercises.splice(index, 1);
      w.exercises.forEach((we, i) => (we.order = i));
    });

  const move = (index: number, by: -1 | 1) =>
    updateWorkout(workout.id, (w) => {
      const to = index + by;
      if (to < 0 || to >= w.exercises.length) return;
      [w.exercises[index], w.exercises[to]] = [w.exercises[to], w.exercises[index]];
      w.exercises.forEach((we, i) => (we.order = i));
    });

  const target = (index: number, patch: Partial<(typeof workout.exercises)[number]['target']>) =>
    updateWorkout(workout.id, (w) => {
      const we = w.exercises[index];
      if (we) we.target = { ...we.target, ...patch };
    });

  const leave = async () => {
    if (workout.exercises.length === 0) await discardWorkout(workout.id);
    navigate('/');
  };

  const start = async () => {
    // Tidy anything half typed: at least one set, and a rep range that makes sense.
    await updateWorkout(workout.id, (w) =>
      w.exercises.forEach((we) => {
        const t = we.target;
        t.sets = Math.max(1, Math.round(t.sets));
        t.repsLow = Math.max(1, Math.round(t.repsLow));
        t.repsHigh = Math.max(t.repsLow, Math.round(t.repsHigh));
      }),
    );
    await startWorkout(workout.id);
    navigate(`/session/${workout.id}`, { replace: true });
  };

  return (
    <>
      <div className="scroll">
        <div className="flow">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="back" aria-label="Back to home" onClick={leave}>
              <ChevronLeft />
            </button>
            <h1 className="h1-sm">Build a workout</h1>
          </div>

          {blocked && (
            <div className="coach">
              A workout is already in progress.{' '}
              <Link to={`/session/${active.id}`} className="inline-link">
                Resume it
              </Link>{' '}
              before starting another.
            </div>
          )}

          {workout.exercises.length === 0 ? (
            <p className="note">Add the exercises you want to do, then set sets, reps and an optional starting weight.</p>
          ) : (
            <div className="caption">
              {workout.exercises.length} exercise{workout.exercises.length === 1 ? '' : 's'} · {setCount} sets
            </div>
          )}

          {workout.exercises.map((we, i) => {
            const ex = exercises.get(we.exerciseId);
            return (
              <section key={we.exerciseId} className="card build-card">
                <div className="build-head">
                  <div className="build-title">
                    <div className="plan-name">{ex?.name ?? 'Unknown exercise'}</div>
                    {ex && (
                      <div className="plan-detail">
                        {exerciseMuscleLabel(ex)} · {equipmentLabel(ex.equipment)}
                      </div>
                    )}
                  </div>
                  <button
                    className="icon-btn"
                    aria-label={`Move ${ex?.name} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ChevronUp size={20} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Move ${ex?.name} down`}
                    disabled={i === workout.exercises.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ChevronDown size={20} />
                  </button>
                  <button className="icon-btn" aria-label={`Remove ${ex?.name}`} onClick={() => remove(i)}>
                    <Close size={20} />
                  </button>
                </div>
                <div className="target-grid">
                  <label className="target-field">
                    <span className="caption">Sets</span>
                    <NumInput
                      className="set-input"
                      label={`${ex?.name} sets`}
                      value={we.target.sets}
                      onChange={(n) => n !== undefined && target(i, { sets: n })}
                    />
                  </label>
                  <label className="target-field">
                    <span className="caption">Min reps</span>
                    <NumInput
                      className="set-input"
                      label={`${ex?.name} minimum reps`}
                      value={we.target.repsLow}
                      onChange={(n) => n !== undefined && target(i, { repsLow: n })}
                    />
                  </label>
                  <label className="target-field">
                    <span className="caption">Max reps</span>
                    <NumInput
                      className="set-input"
                      label={`${ex?.name} maximum reps`}
                      value={we.target.repsHigh}
                      onChange={(n) => n !== undefined && target(i, { repsHigh: n })}
                    />
                  </label>
                  <label className="target-field">
                    <span className="caption">Kg</span>
                    <NumInput
                      className="set-input"
                      decimal
                      label={`${ex?.name} starting weight in kg`}
                      placeholder="–"
                      value={we.target.weight}
                      onChange={(n) => target(i, { weight: n })}
                    />
                  </label>
                </div>
              </section>
            );
          })}

          <button className="btn-outline add-btn" onClick={() => setPicking(true)}>
            <Plus size={18} /> Add exercise
          </button>
        </div>
      </div>

      <div className="flow-footer">
        <button className="btn-primary" disabled={workout.exercises.length === 0 || blocked} onClick={start}>
          Start session
        </button>
      </div>

      {picking && (
        <ExercisePicker
          mode="add"
          selectedIds={workout.exercises.map((we) => we.exerciseId)}
          onPick={add}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
