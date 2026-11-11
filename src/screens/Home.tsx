import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from '../components/Icons';
import RecordRows from '../components/RecordRows';
import { useActiveWorkout, useAllWorkouts, useExerciseMap } from '../hooks/data';
import { createWorkout } from '../db/workouts';
import { MUSCLES } from '../db/types';
import { muscleBalance } from '../engine/balance';
import { latestRecords, recordEvents } from '../engine/records';
import { thisWeek } from '../engine/stats';
import { muscleLabel } from '../utils';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const startedAgo = (iso: string | undefined) => {
  if (!iso) return '';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return min < 60 ? `${min} min ago` : `${Math.floor(min / 60)} h ${min % 60} min ago`;
};

export default function Home() {
  const navigate = useNavigate();
  const active = useActiveWorkout();
  const workouts = useAllWorkouts();
  const exercises = useExerciseMap();

  const build = async () => {
    const w = await createWorkout();
    navigate(`/builder/${w.id}`);
  };

  if (active === undefined || workouts === undefined || exercises === undefined) return null;

  const now = new Date();
  const today = now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  const week = thisWeek(workouts, now);
  const balance = muscleBalance(workouts, exercises, now);
  const records = latestRecords(recordEvents(workouts), 3);
  const maxSets = Math.max(1, ...MUSCLES.map((m) => balance.sets[m]));
  // Strongest first, as in the mockup.
  const ordered = [...MUSCLES].sort((a, b) => balance.sets[b] - balance.sets[a]);

  return (
    <div className="page">
      <div className="title-block">
        <div className="caption">{today}</div>
        <h1 className="h1">Ready to train?</h1>
      </div>

      {active && (
        <Link to={`/session/${active.id}`} className="cta">
          <div>
            <div className="cta-title">Resume workout</div>
            <div className="cta-sub">
              {active.exercises.length} exercises · started {startedAgo(active.startedAt)}
            </div>
          </div>
          <ArrowRight size={22} />
        </Link>
      )}

      <Link to="/generate" className={active ? 'cta secondary' : 'cta'}>
        <div>
          <div className="cta-title">Generate a workout</div>
          <div className="cta-sub">Pick a focus and how long you have</div>
        </div>
        <ArrowRight size={22} />
      </Link>
      <button className="btn-manual" onClick={build}>
        Build one manually
      </button>

      <section className="card roomy">
        <div className="card-head">
          <h2 className="card-title">This week</h2>
          <div className="caption" data-testid="week-summary">
            {week.sessions === 0
              ? 'nothing logged yet'
              : `${week.sessions} session${week.sessions === 1 ? '' : 's'} · ${Math.round(week.volume).toLocaleString('en-AU')} kg lifted`}
          </div>
        </div>
        <div className="week">
          {week.trained.map((trained, i) => (
            <div key={i} className="week-day">
              <div className={`week-cell${trained ? ' on' : ''}`} />
              {DAY_LABELS[i]}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Muscle balance</h2>
          <div className="caption">sets, last 14 days</div>
        </div>
        {ordered.map((m) => (
          <div key={m} className="balance-row">
            <div className="name">{muscleLabel(m)}</div>
            <div className={`track${balance.lagging.includes(m) ? ' lag' : ''}`}>
              <div style={{ width: `${Math.round((balance.sets[m] / maxSets) * 100)}%` }} />
            </div>
            <div className="val">{balance.sets[m]}</div>
          </div>
        ))}
        <p className="note">{balance.sentence}</p>
      </section>

      <section className="card">
        <h2 className="card-title">Recent records</h2>
        {records.length ? (
          <RecordRows events={records} exercises={exercises} />
        ) : (
          <p className="note">No records yet. They show up here when you beat a previous best.</p>
        )}
      </section>
    </div>
  );
}
