import { Link } from 'react-router-dom';
import { ArrowRight } from '../components/Icons';
import { muscleSets, records, weekDays } from '../placeholder';

const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
const maxSets = Math.max(...muscleSets.map(([, sets]) => sets));

export default function Home() {
  return (
    <div className="page">
      <div className="title-block">
        <div className="caption">{today}</div>
        <h1 className="h1">Ready to train?</h1>
      </div>

      <Link to="/generate" className="cta">
        <div>
          <div className="cta-title">Generate a workout</div>
          <div className="cta-sub">Pick a focus and how long you have</div>
        </div>
        <ArrowRight size={22} />
      </Link>
      <button className="btn-manual">Build one manually</button>

      <section className="card roomy">
        <div className="card-head">
          <h2 className="card-title">This week</h2>
          <div className="caption">2 sessions · 12,450 kg lifted</div>
        </div>
        <div className="week">
          {weekDays.map((day, i) => (
            <div key={i} className="week-day">
              <div className={`week-cell${day.trained ? ' on' : ''}`} />
              {day.label}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Muscle balance</h2>
          <div className="caption">sets, last 14 days</div>
        </div>
        {muscleSets.map(([name, sets]) => (
          <div key={name} className="balance-row">
            <div className="name">{name}</div>
            <div className={`track${sets < 7 ? ' lag' : ''}`}>
              <div style={{ width: `${Math.round((sets / maxSets) * 100)}%` }} />
            </div>
            <div className="val">{sets}</div>
          </div>
        ))}
        <p className="note">
          Legs and core are behind. The next generated session will lean that way unless you choose otherwise.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Recent records</h2>
        {records.map((r) => (
          <div key={r.name} className="record-row">
            <div className="name">{r.name}</div>
            <div className="val">
              {r.value} <span className="gain">{r.gain}</span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
