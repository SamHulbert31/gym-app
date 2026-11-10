import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft } from '../components/Icons';
import { sessionSets } from '../placeholder';
import { selectOnFocus } from '../utils';

const TOTAL_EXERCISES = 5;

export default function Session() {
  const [sets, setSets] = useState(sessionSets);

  const update = (i: number, patch: Partial<(typeof sets)[number]>) =>
    setSets((cur) => cur.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  // The first set that is not done is the one being worked on.
  const activeIndex = sets.findIndex((s) => !s.done);

  return (
    <>
      <div className="scroll">
        <div className="flow">
          <div className="session-bar">
            <Link to="/generate" className="back" aria-label="Back to plan">
              <ChevronLeft />
            </Link>
            <div className="caption">Exercise 1 of {TOTAL_EXERCISES}</div>
            <div className="session-clock">12:40</div>
          </div>

          <div className="segments" style={{ gridTemplateColumns: `repeat(${TOTAL_EXERCISES}, minmax(0, 1fr))` }}>
            {Array.from({ length: TOTAL_EXERCISES }, (_, i) => (
              <div key={i} className={i === 0 ? 'on' : ''} />
            ))}
          </div>

          <div className="exercise-head">
            <h1 className="h1">Leg press</h1>
            <div style={{ fontSize: 15 }}>Target 4 × 10 at 165 kg</div>
            <div className="caption">Last time 160 kg × 10, 10, 10, 9</div>
          </div>

          <div className="sets">
            <div className="set-grid set-labels">
              <div>Set</div>
              <div>Weight, kg</div>
              <div>Reps</div>
              <div />
            </div>
            {sets.map((s, i) => (
              <div
                key={i}
                className={`set-grid set-row${s.done ? ' done' : ''}${i === activeIndex ? ' active' : ''}`}
              >
                <div className="set-num">{i + 1}</div>
                <input
                  className="set-input"
                  aria-label={`Set ${i + 1} weight in kg`}
                  type="text"
                  inputMode="decimal"
                  value={s.weight}
                  onChange={(e) => update(i, { weight: e.target.value })}
                  onFocus={selectOnFocus}
                />
                <input
                  className="set-input"
                  aria-label={`Set ${i + 1} reps`}
                  type="text"
                  inputMode="numeric"
                  placeholder="10"
                  value={s.reps}
                  onChange={(e) => update(i, { reps: e.target.value })}
                  onFocus={selectOnFocus}
                />
                <button
                  className="set-check"
                  aria-label={`Mark set ${i + 1} done`}
                  aria-pressed={s.done}
                  onClick={() => update(i, { done: !s.done })}
                >
                  <Check size={20} />
                </button>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="rest-row">
              <div className="caption">Rest</div>
              <div className="rest-time">1:12</div>
              <button className="btn-text rest-skip">Skip</button>
            </div>
            <div className="rest-track">
              <div style={{ width: '40%' }} />
            </div>
          </div>

          <div className="pair">
            <button className="btn-outline">Add a set</button>
            <button className="btn-outline">Swap exercise</button>
          </div>

          <p className="coach">
            You hit nearly every rep at 160 kg last time, so today moves to 165. If set 3 or 4 drops under 8 reps,
            this weight stays for next session.
          </p>

          <div className="next-row">
            <div>Next: Romanian deadlift, 3 × 10 at 80 kg</div>
            <button className="finish-early">Finish early</button>
          </div>
        </div>
      </div>

      <div className="flow-footer">
        <button className="btn-primary">Next exercise</button>
      </div>
    </>
  );
}
