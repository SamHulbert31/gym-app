import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import ExercisePicker from '../components/ExercisePicker';
import { Check, ChevronLeft } from '../components/Icons';
import NumInput from '../components/NumInput';
import Sheet from '../components/Sheet';
import { useExerciseHistory, useExerciseMap, useMeta, useWorkout } from '../hooks/data';
import { useNow } from '../hooks/useNow';
import { clearRest, useRest } from '../hooks/useRest';
import { useWakeLock } from '../hooks/useWakeLock';
import { nowISO } from '../db/db';
import { discardWorkout, doneSetCount, finishWorkout, swapExercise, updateExercise } from '../db/workouts';
import type { Exercise, SetLog, WorkoutExercise } from '../db/types';
import { lastTimeText } from '../engine/format';
import { bestsFor, setRecord } from '../engine/records';
import { formatClock } from '../utils';

const indexKey = (id: string) => `gym.sessionIndex.${id}`;
const storedIndex = (id: string) => {
  try {
    const n = parseInt(localStorage.getItem(indexKey(id)) ?? '', 10);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
};
const storeIndex = (id: string, n: number) => {
  try {
    localStorage.setItem(indexKey(id), String(n));
  } catch {
    // The session still works; resume just opens on the first unfinished exercise.
  }
};

const repsText = (t: WorkoutExercise['target']) => (t.repsLow === t.repsHigh ? `${t.repsHigh}` : `${t.repsLow}–${t.repsHigh}`);
const targetText = (t: WorkoutExercise['target']) =>
  `${t.sets} × ${repsText(t)}${t.weight ? ` at ${t.weight} kg` : ''}`;

type Dialog = 'jump' | 'finish' | 'discard' | 'swap' | null;

export default function Session() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const workout = useWorkout(id);
  const exercises = useExerciseMap();
  const meta = useMeta();
  const rest = useRest(id);
  const now = useNow(1000);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [picked, setPicked] = useState<number | undefined>(undefined);

  useWakeLock(workout?.status === 'active');

  const count = workout?.exercises.length ?? 0;
  // The exercise on screen is chosen once when the session opens (where it was left, else the
  // first with an open set) and after that only moves when the user moves it. Finishing the last
  // set of an exercise must not jump ahead on its own.
  const initial = useRef<number>(undefined);
  if (workout && initial.current === undefined) {
    const firstOpen = workout.exercises.findIndex((we) => we.sets.some((s) => !s.done));
    initial.current = storedIndex(id) ?? (firstOpen < 0 ? count - 1 : firstOpen);
  }
  const current = Math.min(Math.max(picked ?? initial.current ?? 0, 0), Math.max(count - 1, 0));
  const we = workout?.exercises[current];
  const history = useExerciseHistory(we?.exerciseId, id);
  const lastTime = history?.[history.length - 1]?.sets;
  const bests = history ? bestsFor(history) : undefined;

  if (workout === undefined || exercises === undefined) return null;
  if (workout === null) return <Navigate to="/" replace />;
  if (workout.status === 'planned') return <Navigate to={`/builder/${id}`} replace />;
  if (workout.status === 'done') return <Navigate to={`/summary/${id}`} replace />;
  if (!we) return <Navigate to="/" replace />;

  const ex = exercises.get(we.exerciseId);
  const next = workout.exercises[current + 1];
  const nextEx = next && exercises.get(next.exerciseId);
  const isLast = current === count - 1;
  const activeSet = we.sets.findIndex((s) => !s.done);
  const doneSets = doneSetCount(workout);
  const elapsed = workout.startedAt ? now - new Date(workout.startedAt).getTime() : 0;

  const goTo = (n: number) => {
    setPicked(n);
    storeIndex(id, n);
    setDialog(null);
  };

  const patchSet = (i: number, patch: Partial<SetLog>) =>
    updateExercise(id, current, (e) => {
      if (e.sets[i]) e.sets[i] = { ...e.sets[i], ...patch };
    });

  const toggleDone = (i: number) => {
    const s = we.sets[i];
    if (s.done) {
      void updateExercise(id, current, (e) => {
        e.sets[i] = { ...e.sets[i], done: false, doneAt: undefined };
      });
      return;
    }
    // Empty reps fill with the target, and an empty weight with the starting weight if there is one.
    void updateExercise(id, current, (e) => {
      const cur = e.sets[i];
      e.sets[i] = { ...cur, reps: cur.reps ?? e.target.repsHigh, weight: cur.weight ?? e.target.weight, done: true, doneAt: nowISO() };
    });
    const nextOpen = we.sets.findIndex((x, j) => j !== i && !x.done && j > i);
    const anyOpen = we.sets.some((x, j) => j !== i && !x.done);
    if (anyOpen || !isLast) rest.start(meta?.restSeconds ?? 90);
    if (nextOpen >= 0) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLInputElement>(`[data-set="${nextOpen}"] input`)?.focus(),
      );
    }
  };

  const addSet = () =>
    updateExercise(id, current, (e) => {
      const last = e.sets[e.sets.length - 1];
      e.sets.push({ weight: last?.weight ?? e.target.weight, done: false });
    });

  const swapTo = (to: Exercise) => swapExercise(id, current, to);

  const finish = async () => {
    if (doneSets === 0) {
      setDialog('discard');
      return;
    }
    await finishWorkout(id);
    clearRest();
    navigate(`/summary/${id}`, { replace: true });
  };

  const discard = async () => {
    await discardWorkout(id);
    clearRest();
    navigate('/', { replace: true });
  };

  const restPct = rest.durationMs ? Math.round((1 - rest.remainingMs / rest.durationMs) * 100) : 0;

  return (
    <>
      <div className="scroll">
        <div className="flow">
          <div className="session-bar">
            <Link to="/" className="back" aria-label="Leave session (it stays open)">
              <ChevronLeft />
            </Link>
            <button className="btn-text caption" onClick={() => setDialog('jump')}>
              Exercise {current + 1} of {count}
            </button>
            <div className="session-clock">{formatClock(elapsed)}</div>
          </div>

          <div className="segments" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
            {workout.exercises.map((e, i) => (
              <div key={e.exerciseId} className={i <= current ? 'on' : ''} />
            ))}
          </div>

          <div className="exercise-head">
            <h1 className="h1">{ex?.name ?? 'Unknown exercise'}</h1>
            <div style={{ fontSize: 15 }}>Target {targetText(we.target)}</div>
            {lastTime && <div className="caption">Last time {lastTimeText(lastTime)}</div>}
          </div>

          <div className="sets">
            <div className="set-grid set-labels">
              <div>Set</div>
              <div>Weight, kg</div>
              <div>Reps</div>
              <div />
            </div>
            {we.sets.map((s, i) => (
              <div
                key={i}
                data-set={i}
                className={`set-grid set-row${s.done ? ' done' : ''}${i === activeSet ? ' active' : ''}`}
              >
                <div className="set-num">
                  {i + 1}
                  {s.done && bests && setRecord(s, bests) && <span className="pr">PR</span>}
                </div>
                <NumInput
                  className="set-input"
                  decimal
                  label={`Set ${i + 1} weight in kg`}
                  value={s.weight}
                  onChange={(n) => patchSet(i, { weight: n })}
                />
                <NumInput
                  className="set-input"
                  label={`Set ${i + 1} reps`}
                  placeholder={String(we.target.repsHigh)}
                  value={s.reps}
                  onChange={(n) => patchSet(i, { reps: n })}
                />
                <button
                  className="set-check"
                  aria-label={`Mark set ${i + 1} done`}
                  aria-pressed={s.done}
                  onClick={() => toggleDone(i)}
                >
                  <Check size={20} />
                </button>
              </div>
            ))}
          </div>

          {rest.active && (
            <div className="card" style={{ padding: '14px 16px' }} role="timer" aria-label="Rest timer">
              <div className="rest-row">
                <div className="caption">Rest</div>
                <div className="rest-time">{formatClock(Math.ceil(rest.remainingMs / 1000) * 1000)}</div>
                <button className="btn-text rest-skip" onClick={rest.skip}>
                  Skip
                </button>
              </div>
              <div className="rest-track">
                <div style={{ width: `${restPct}%` }} />
              </div>
            </div>
          )}

          <div className="pair">
            <button className="btn-outline" onClick={addSet}>
              Add a set
            </button>
            <button className="btn-outline" onClick={() => setDialog('swap')}>
              Swap exercise
            </button>
          </div>

          {we.note && <p className="coach">{we.note}</p>}

          <div className="next-row">
            <div>{nextEx ? `Next: ${nextEx.name}, ${targetText(next.target)}` : 'Last exercise'}</div>
            {!isLast && (
              <button className="finish-early" onClick={() => (doneSets === 0 ? setDialog('discard') : setDialog('finish'))}>
                Finish early
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flow-footer">
        {isLast ? (
          <button className="btn-primary" onClick={finish}>
            Finish workout
          </button>
        ) : (
          <button className="btn-primary" onClick={() => goTo(current + 1)}>
            Next exercise
          </button>
        )}
      </div>

      {dialog === 'jump' && (
        <Sheet title="Jump to exercise" onClose={() => setDialog(null)}>
          <div className="sheet-list">
            {workout.exercises.map((e, i) => (
              <button key={e.exerciseId} className={`list-row${i === current ? ' current' : ''}`} onClick={() => goTo(i)}>
                <span className="plan-name">{exercises.get(e.exerciseId)?.name}</span>
                <span className="plan-detail">
                  {e.sets.filter((s) => s.done).length}/{e.sets.length} sets
                </span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {dialog === 'finish' && (
        <Sheet title="Finish workout now?" onClose={() => setDialog(null)}>
          <p className="note">
            {doneSets} set{doneSets === 1 ? '' : 's'} logged. Exercises and sets you did not do are left out.
          </p>
          <button className="btn-primary" onClick={finish}>
            Finish workout
          </button>
          <button className="btn-outline" onClick={() => setDialog(null)}>
            Keep training
          </button>
        </Sheet>
      )}

      {dialog === 'discard' && (
        <Sheet title="No sets logged" onClose={() => setDialog(null)}>
          <p className="note">Nothing has been marked done yet. Discard this workout, or keep training.</p>
          <button className="btn-outline btn-warn" onClick={discard}>
            Discard workout
          </button>
          <button className="btn-primary" onClick={() => setDialog(null)}>
            Keep training
          </button>
        </Sheet>
      )}

      {dialog === 'swap' && (
        <ExercisePicker
          mode="swap"
          initialMuscle={ex?.primary}
          onPick={swapTo}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
