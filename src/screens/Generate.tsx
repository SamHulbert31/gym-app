import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ExercisePicker from '../components/ExercisePicker';
import { ChevronLeft, Plus, Swap } from '../components/Icons';
import Sheet from '../components/Sheet';
import SwapSheet from '../components/SwapSheet';
import { useActiveWorkout, useAllWorkouts, useExerciseMap, useMeta } from '../hooks/data';
import { createWorkout, startWorkout } from '../db/workouts';
import type { Exercise, Muscle } from '../db/types';
import { makeSuggestContext, suggestIn } from '../engine/apply';
import { defaultReps } from '../engine/classify';
import { muscleBalance } from '../engine/balance';
import { planDetail } from '../engine/format';
import { generatePlan, type PlanItem } from '../engine/generate';
import { planMinutes, planSeconds } from '../engine/time';
import { muscleLabel, selectOnFocus } from '../utils';

type Choice = Muscle | 'full';
const CHIPS: [label: string, value: Choice][] = [
  ['Legs', 'legs'],
  ['Core', 'core'],
  ['Chest', 'chest'],
  ['Back', 'back'],
  ['Shoulders', 'shoulders'],
  ['Arms', 'arms'],
  ['Full body', 'full'],
];
const DURATIONS = [30, 45, 60, 75];

type Dialog = { kind: 'actions' | 'swap'; index: number } | { kind: 'add' } | null;

export default function Generate() {
  const navigate = useNavigate();
  const active = useActiveWorkout();
  const workouts = useAllWorkouts();
  const exercises = useExerciseMap();
  const meta = useMeta();
  const [picked, setPicked] = useState<Choice[] | undefined>(undefined);
  const [minutes, setMinutes] = useState(45);
  const [note, setNote] = useState('');
  const [items, setItems] = useState<PlanItem[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  if (active === undefined || workouts === undefined || exercises === undefined) return null;

  const now = new Date();
  const restSeconds = meta?.restSeconds ?? 90;
  const balance = muscleBalance(workouts, exercises, now);
  // Until the user touches the chips, the muscles that are behind are selected for them.
  const focus: Choice[] = picked ?? balance.lagging;
  const suggestCtx = makeSuggestContext(workouts, meta, now);

  const toggle = (value: Choice) => {
    const without = focus.filter((c) => c !== 'full');
    if (value === 'full') setPicked(focus.includes('full') ? [] : ['full']);
    else setPicked(without.includes(value) ? without.filter((c) => c !== value) : [...without, value]);
  };

  const run = () => {
    setItems(
      generatePlan({
        focus: focus.includes('full') ? ['full'] : (focus as Muscle[]),
        minutes,
        note,
        exercises: [...exercises.values()],
        workouts,
        restSeconds,
        now,
        avoid: items?.map((i) => i.exerciseId),
        muscleSets: balance.sets,
      }),
    );
  };

  const rows = (items ?? []).flatMap((item, index) => {
    const ex = exercises.get(item.exerciseId);
    return ex ? [{ item, ex, index, suggestion: suggestIn(suggestCtx, ex, item.target, '') }] : [];
  });
  const seconds = planSeconds(rows.map((r) => ({ ex: r.ex, sets: r.item.target.sets })), restSeconds);

  const edit = (change: (list: PlanItem[]) => PlanItem[]) => setItems((cur) => (cur ? change([...cur]) : cur));

  const swapTo = (index: number, to: Exercise) =>
    edit((list) => {
      const it = list[index];
      list[index] = {
        exerciseId: to.id,
        target: { sets: it.target.sets, ...defaultReps(to) },
        swappedFromExerciseId: it.swappedFromExerciseId ?? it.exerciseId,
      };
      return list;
    });

  const move = (index: number, by: -1 | 1) =>
    edit((list) => {
      const to = index + by;
      if (to >= 0 && to < list.length) [list[index], list[to]] = [list[to], list[index]];
      return list;
    });

  const setSets = (index: number, sets: number) =>
    edit((list) => {
      list[index] = { ...list[index], target: { ...list[index].target, sets: Math.min(8, Math.max(1, sets)) } };
      return list;
    });

  const start = async () => {
    if (!rows.length) return;
    const w = await createWorkout({
      source: 'generated',
      focus: focus.includes('full') ? ['full'] : (focus as Muscle[]),
      plannedMinutes: minutes,
      userNote: note.trim() || undefined,
      exercises: rows.map((r, order) => ({
        exerciseId: r.item.exerciseId,
        order,
        target: { ...r.item.target, weight: r.suggestion.weight },
        sets: [],
        note: r.suggestion.coaching,
        swappedFromExerciseId: r.item.swappedFromExerciseId,
      })),
    });
    await startWorkout(w.id);
    navigate(`/session/${w.id}`);
  };

  const open = dialog && 'index' in dialog ? rows.find((r) => r.index === dialog.index) : undefined;
  const preselected = picked === undefined && balance.lagging.length > 0;

  return (
    <div className="scroll">
      <div className="flow">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/" className="back" aria-label="Back to home">
            <ChevronLeft />
          </Link>
          <h1 className="h1-sm">New workout</h1>
        </div>

        <div className="field">
          <div className="caption">What are we training?</div>
          <div className="chips">
            {CHIPS.map(([label, value]) => (
              <button key={value} className="chip" aria-pressed={focus.includes(value)} onClick={() => toggle(value)}>
                {label}
              </button>
            ))}
          </div>
          {preselected && (
            <div className="caption">
              {balance.lagging.map(muscleLabel).join(' and ')} preselected: behind over the last two weeks.
            </div>
          )}
        </div>

        <div className="field">
          <div className="caption">How long do you have?</div>
          <div className="segmented">
            {DURATIONS.map((m) => (
              <button key={m} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>
                {m} min
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="gen-notes" className="caption">
            Anything else?
          </label>
          <input
            id="gen-notes"
            className="text-input"
            type="text"
            value={note}
            placeholder="Squat racks are busy tonight"
            onChange={(e) => setNote(e.target.value)}
            onFocus={selectOnFocus}
          />
        </div>

        <button className="btn-primary" disabled={focus.length === 0} onClick={run}>
          Generate
        </button>

        {items && (
          <section className="plan">
            <div className="plan-head">
              <h2 className="card-title">Your session</h2>
              <div className="caption">
                {rows.length} exercise{rows.length === 1 ? '' : 's'} · about {planMinutes(seconds)} min
              </div>
            </div>
            {rows.map((r) => (
              <div key={r.item.exerciseId} className="plan-row">
                <button
                  className="plan-main"
                  aria-label={`Edit ${r.ex.name}`}
                  onClick={() => setDialog({ kind: 'actions', index: r.index })}
                >
                  <span className="plan-name">{r.ex.name}</span>
                  <span className="plan-detail">{planDetail(r.item.target, r.ex, r.suggestion)}</span>
                </button>
                <button className="icon-btn" aria-label={`Swap ${r.ex.name}`} onClick={() => setDialog({ kind: 'swap', index: r.index })}>
                  <Swap size={18} />
                </button>
              </div>
            ))}
            <button className="plan-add" onClick={() => setDialog({ kind: 'add' })}>
              <Plus size={18} /> Add exercise
            </button>
          </section>
        )}

        {items &&
          (active ? (
            <Link to={`/session/${active.id}`} className="btn-outline-accent">
              Resume workout
            </Link>
          ) : (
            <button className="btn-outline-accent" disabled={rows.length === 0} onClick={start}>
              Start session
            </button>
          ))}
      </div>

      {dialog?.kind === 'swap' && open && (
        <SwapSheet
          current={open.ex}
          excludeIds={rows.map((r) => r.item.exerciseId)}
          onSwap={(to) => swapTo(open.index, to)}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === 'actions' && open && (
        <Sheet title={open.ex.name} onClose={() => setDialog(null)}>
          <div className="stepper">
            <span>Sets</span>
            <div className="stepper-controls">
              <button className="step-btn" aria-label="Fewer sets" onClick={() => setSets(open.index, open.item.target.sets - 1)}>
                −
              </button>
              <span className="stepper-value" aria-live="polite">
                {open.item.target.sets}
              </span>
              <button className="step-btn" aria-label="More sets" onClick={() => setSets(open.index, open.item.target.sets + 1)}>
                +
              </button>
            </div>
          </div>
          <div className="pair">
            <button className="btn-outline" disabled={open.index === 0} onClick={() => move(open.index, -1)}>
              Move up
            </button>
            <button className="btn-outline" disabled={open.index === rows.length - 1} onClick={() => move(open.index, 1)}>
              Move down
            </button>
          </div>
          <button className="btn-outline" onClick={() => setDialog({ kind: 'swap', index: open.index })}>
            Swap exercise
          </button>
          <button
            className="btn-outline btn-warn"
            onClick={() => {
              edit((list) => list.filter((_, i) => i !== open.index));
              setDialog(null);
            }}
          >
            Remove from session
          </button>
        </Sheet>
      )}

      {dialog?.kind === 'add' && (
        <ExercisePicker
          mode="add"
          selectedIds={rows.map((r) => r.item.exerciseId)}
          onPick={(ex) =>
            edit((list) =>
              list.some((i) => i.exerciseId === ex.id) ? list : [...list, { exerciseId: ex.id, target: { sets: 3, ...defaultReps(ex) } }],
            )
          }
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
