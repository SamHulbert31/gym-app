import { useMemo, useState } from 'react';
import { useExerciseMap } from '../hooks/data';
import { createCustomExercise } from '../db/workouts';
import { ARM_PARTS, EQUIPMENT, MUSCLES, type ArmPart, type Equipment, type Exercise, type Muscle } from '../db/types';
import { armPart } from '../engine/classify';
import { equipmentLabel, exerciseMuscleLabel, muscleLabel, partLabel } from '../utils';
import { Check, Close } from './Icons';

interface Props {
  /** "add" stays open so several exercises can be added; "swap" picks one and closes. */
  mode: 'add' | 'swap';
  initialMuscle?: Muscle;
  selectedIds?: string[];
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}

export default function ExercisePicker({ mode, initialMuscle, selectedIds = [], onPick, onClose }: Props) {
  const map = useExerciseMap();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'all'>(initialMuscle ?? 'all');
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(map?.values() ?? [])]
      .filter((e) => !e.deletedAt && !e.unavailable)
      .filter((e) => muscle === 'all' || e.primary === muscle)
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [map, query, muscle]);

  const pick = (ex: Exercise) => {
    onPick(ex);
    if (mode === 'swap') onClose();
  };

  if (creating) {
    return (
      <CreateForm
        initialName={query.trim()}
        initialMuscle={muscle === 'all' ? 'chest' : muscle}
        onCancel={() => setCreating(false)}
        onCreated={(ex) => {
          setCreating(false);
          pick(ex);
        }}
      />
    );
  }

  return (
    <div className="overlay screen">
      <div className="picker-head">
        <h2 className="h1-sm">{mode === 'swap' ? 'Swap exercise' : 'Add exercises'}</h2>
        <button className="btn-text picker-done" onClick={onClose}>
          {mode === 'swap' ? <Close size={20} /> : 'Done'}
        </button>
      </div>

      <div className="picker-filters">
        <input
          className="text-input"
          type="search"
          aria-label="Search exercises"
          placeholder="Search exercises"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="chips">
          {(['all', ...MUSCLES] as const).map((m) => (
            <button key={m} className="chip" aria-pressed={muscle === m} onClick={() => setMuscle(m)}>
              {m === 'all' ? 'All' : muscleLabel(m)}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll picker-list">
        <button className="list-row create-row" onClick={() => setCreating(true)}>
          <span className="plan-name">Create custom exercise</span>
        </button>
        {list.map((ex) => {
          const picked = selectedIds.includes(ex.id);
          return (
            <button key={ex.id} className="list-row" onClick={() => pick(ex)}>
              <span>
                <span className="plan-name">{ex.name}</span>
                <span className="plan-detail">
                  {exerciseMuscleLabel(ex)} · {equipmentLabel(ex.equipment)}
                </span>
              </span>
              {picked && (
                <span className="picked">
                  <Check size={20} />
                </span>
              )}
            </button>
          );
        })}
        {map && list.length === 0 && <p className="note empty-note">No exercises match. Create it as a custom one.</p>}
      </div>
    </div>
  );
}

function CreateForm(props: {
  initialName: string;
  initialMuscle: Muscle;
  onCancel: () => void;
  onCreated: (ex: Exercise) => void;
}) {
  const [name, setName] = useState(props.initialName);
  const [primary, setPrimary] = useState<Muscle>(props.initialMuscle);
  const [equipment, setEquipment] = useState<Equipment>('machine');
  // Until chosen, the side follows the name ("Bayesian curl" is biceps, "JM press" triceps).
  const [part, setPart] = useState<ArmPart | undefined>(undefined);
  const side = part ?? armPart({ name, primary: 'arms' })!;
  const ready = name.trim().length > 0;

  const save = async () =>
    props.onCreated(await createCustomExercise({ name: name.trim(), primary, equipment, part: primary === 'arms' ? side : undefined }));

  return (
    <div className="overlay screen">
      <div className="picker-head">
        <h2 className="h1-sm">Custom exercise</h2>
        <button className="btn-text picker-done" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
      <div className="scroll">
        <div className="flow">
          <div className="field">
            <label htmlFor="custom-name" className="caption">
              Name
            </label>
            <input
              id="custom-name"
              className="text-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <div className="caption">Main muscle</div>
            <div className="chips">
              {MUSCLES.map((m) => (
                <button key={m} className="chip" aria-pressed={primary === m} onClick={() => setPrimary(m)}>
                  {muscleLabel(m)}
                </button>
              ))}
            </div>
          </div>
          {primary === 'arms' && (
            <div className="field">
              <div className="caption">Which side</div>
              <div className="chips">
                {ARM_PARTS.map((p) => (
                  <button key={p} className="chip" aria-pressed={side === p} onClick={() => setPart(p)}>
                    {partLabel(p)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="field">
            <div className="caption">Equipment</div>
            <div className="chips">
              {EQUIPMENT.map((q) => (
                <button key={q} className="chip" aria-pressed={equipment === q} onClick={() => setEquipment(q)}>
                  {equipmentLabel(q)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flow-footer">
        <button className="btn-primary" disabled={!ready} onClick={save}>
          Save exercise
        </button>
      </div>
    </div>
  );
}
