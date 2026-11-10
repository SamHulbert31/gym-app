import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Swap } from '../components/Icons';
import { durations, focusOptions, plan } from '../placeholder';
import { selectOnFocus } from '../utils';

export default function Generate() {
  const [focus, setFocus] = useState<string[]>(['Legs', 'Core']);
  const [minutes, setMinutes] = useState(45);
  const [note, setNote] = useState('');

  const toggle = (name: string) =>
    setFocus((cur) => (cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]));

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
            {focusOptions.map((name) => (
              <button key={name} className="chip" aria-pressed={focus.includes(name)} onClick={() => toggle(name)}>
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="caption">How long do you have?</div>
          <div className="segmented">
            {durations.map((m) => (
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

        <button className="btn-primary">Generate</button>

        <section className="plan">
          <div className="plan-head">
            <h2 className="card-title">Your session</h2>
            <div className="caption">5 exercises · about 44 min</div>
          </div>
          {plan.map((p) => (
            <div key={p.name} className="plan-row">
              <div>
                <div className="plan-name">{p.name}</div>
                <div className="plan-detail">{p.detail}</div>
              </div>
              <button className="icon-btn" aria-label={`Swap ${p.name}`}>
                <Swap size={18} />
              </button>
            </div>
          ))}
        </section>

        <Link to="/session" className="btn-outline-accent">
          Start session
        </Link>
      </div>
    </div>
  );
}
