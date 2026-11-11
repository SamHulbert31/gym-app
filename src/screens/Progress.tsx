import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from '../components/Icons';
import RecordRows from '../components/RecordRows';
import Sheet from '../components/Sheet';
import { useAllWorkouts, useExerciseMap } from '../hooks/data';
import { exerciseHistory } from '../engine/history';
import { fmtNum, fmtWeight, longDate, shortDate } from '../engine/format';
import {
  bestSet,
  chartGeometry,
  forecast,
  inWindow,
  seriesFor,
  windowStart,
  WINDOW_WEEKS,
  type Forecast,
  type Metric,
} from '../engine/progress';
import { recordEvents } from '../engine/records';
import { loggedExercises, weeklyVolumes } from '../engine/stats';

const KEY = 'gym.progress.exercise';
const readPick = () => {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
};
const savePick = (id: string) => {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Only the remembered choice is lost.
  }
};

const unit = (metric: Metric) => (metric === 'e1rm' ? 'kg' : 'reps');

function forecastText(f: Forecast, metric: Metric, now: Date) {
  if (f.kind === 'few') {
    return `Not enough data for a forecast yet. It needs at least four sessions with this exercise in the last ${WINDOW_WEEKS} weeks, and you have ${f.have}.`;
  }
  if (f.kind === 'flat') {
    return `Your ${metric === 'e1rm' ? 'estimated max' : 'best reps'} has been flat or dropping over the last ${WINDOW_WEEKS} weeks, so there is no forecast to show.`;
  }
  const rate = fmtNum(f.ratePerWeek);
  const when = longDate(f.date, f.date.getFullYear() !== now.getFullYear());
  return metric === 'e1rm'
    ? `At your current rate of about ${rate} kg a week, a ${f.milestone} kg estimated max lands around ${when}.`
    : `At your current rate of about ${rate} reps a week, ${f.milestone} reps in a set lands around ${when}.`;
}

export default function Progress() {
  const workouts = useAllWorkouts();
  const exercises = useExerciseMap();
  const [picked, setPicked] = useState(readPick);
  const [choosing, setChoosing] = useState(false);

  if (workouts === undefined || exercises === undefined) return null;

  const now = new Date();
  const logged = loggedExercises(workouts);
  const volumes = weeklyVolumes(workouts, now, 8);
  const maxKg = Math.max(...volumes.map((w) => w.kg));

  const exerciseId = logged.some((l) => l.id === picked) ? picked : logged[0]?.id;
  const exercise = exerciseId ? exercises.get(exerciseId) : undefined;
  const history = exerciseId ? exerciseHistory(workouts, exerciseId) : [];
  const { metric, points } = seriesFor(history);
  const windowPoints = inWindow(points, now);
  const latest = points[points.length - 1];
  const best = bestSet(history, metric);
  const change = windowPoints.length >= 2 ? windowPoints[windowPoints.length - 1].value - windowPoints[0].value : undefined;
  const start = windowStart(now);
  const geo = chartGeometry(windowPoints, start, now);
  const mid = new Date((start.getTime() + now.getTime()) / 2);
  const records = exerciseId ? recordEvents(workouts).filter((e) => e.exerciseId === exerciseId).reverse() : [];

  const bestText = best ? (best.weight ? `${fmtWeight(best.weight)} × ${best.reps}` : `${best.reps} reps`) : '–';

  const choose = (id: string) => {
    savePick(id);
    setPicked(id);
    setChoosing(false);
  };

  return (
    <div className="page">
      <h1 className="h1">Progress</h1>

      {logged.length === 0 ? (
        <section className="card">
          <h2 className="card-title">Nothing to chart yet</h2>
          <p className="note">Finish a workout and your estimated max, volume and records for each lift show up here.</p>
        </section>
      ) : (
        <>
          <button className="select-btn" onClick={() => setChoosing(true)} aria-haspopup="dialog">
            {exercise?.name ?? 'Choose exercise'}
            <ChevronDown size={18} />
          </button>

          <div className="tiles">
            <div className="tile">
              <div className="tile-val">{latest ? `${fmtNum(latest.value)} ${unit(metric)}` : '–'}</div>
              <div className="tile-label">{metric === 'e1rm' ? 'estimated 1RM' : 'best reps'}</div>
            </div>
            <div className="tile">
              <div className={`tile-val${change !== undefined && change > 0 ? ' gain' : ''}`}>
                {change === undefined ? '–' : `${change > 0 ? '+' : change < 0 ? '−' : ''}${fmtNum(Math.abs(change))} ${unit(metric)}`}
              </div>
              <div className="tile-label">in {WINDOW_WEEKS} weeks</div>
            </div>
            <div className="tile">
              <div className={`tile-val${bestText.length > 8 ? ' sm' : ''}`}>{bestText}</div>
              <div className="tile-label">best set</div>
            </div>
          </div>

          <section className="card roomy" style={{ gap: 10 }}>
            <div className="card-head">
              <h2 className="card-title">{metric === 'e1rm' ? 'Estimated 1RM' : 'Best reps in a set'}</h2>
              <div className="caption">last {WINDOW_WEEKS} weeks</div>
            </div>
            {windowPoints.length === 0 ? (
              <p className="note">No sessions with this exercise in the last {WINDOW_WEEKS} weeks.</p>
            ) : (
              <>
                <svg
                  className="chart"
                  role="img"
                  aria-label={`Line chart of ${metric === 'e1rm' ? 'estimated one rep max' : 'best reps'} ${
                    windowPoints.length > 1
                      ? `going from ${fmtNum(windowPoints[0].value)} to ${fmtNum(windowPoints[windowPoints.length - 1].value)} ${unit(metric)}`
                      : `at ${fmtNum(windowPoints[0].value)} ${unit(metric)}`
                  } over ${WINDOW_WEEKS} weeks`}
                  viewBox="0 0 318 124"
                >
                  {geo.ticks.map((t) => (
                    <line key={`l${t.value}`} x1="0" y1={t.y} x2="318" y2={t.y} stroke="#26292E" strokeWidth="1" />
                  ))}
                  {geo.ticks.map((t) => (
                    <text key={`t${t.value}`} x="0" y={Number((t.y - 5.6).toFixed(1))} fill="#A0A6AE" fontSize="10" fontFamily="Inter, sans-serif">
                      {fmtNum(t.value)}
                    </text>
                  ))}
                  {geo.points.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#C8F03C"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={geo.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    />
                  )}
                  <circle cx={geo.points[geo.points.length - 1].x} cy={geo.points[geo.points.length - 1].y} r="4.5" fill="#C8F03C" />
                  <line x1="0" y1="116" x2="318" y2="116" stroke="#3A3E45" strokeWidth="1" />
                </svg>
                <div className="chart-axis">
                  <div>{shortDate(start)}</div>
                  <div>{shortDate(mid)}</div>
                  <div>{shortDate(now)}</div>
                </div>
              </>
            )}
          </section>
        </>
      )}

      <section className="card roomy">
        <div className="card-head">
          <h2 className="card-title">Weekly volume, all lifts</h2>
          <div className="caption">tonnes</div>
        </div>
        {maxKg === 0 ? (
          <p className="note">No volume logged in the last eight weeks.</p>
        ) : (
          <div className="bars">
            {volumes.map((w) => (
              <div key={w.start.toISOString()} className="bar-col">
                <div>{w.kg ? (w.kg / 1000).toFixed(1) : '–'}</div>
                <div
                  className={`bar${w.current ? ' current' : ''}`}
                  style={{ height: `${w.kg ? Math.max(2, Math.round((w.kg / maxKg) * 56)) : 0}px` }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {logged.length > 0 && (
        <section className="estimate">
          <div className="estimate-label">Estimate</div>
          <p className="estimate-body">{forecastText(forecast(points, now), metric, now)}</p>
        </section>
      )}

      {exercise && (
        <section className="card">
          <h2 className="card-title">Records, {exercise.name}</h2>
          {records.length ? (
            <RecordRows events={records.slice(0, 10)} exercises={exercises} left={(e) => shortDate(e.date)} />
          ) : (
            <p className="note">No records yet. After a second session, anything that beats a previous best is listed here.</p>
          )}
        </section>
      )}

      <Link to="/history" className="history-link">
        <span>Workout history</span>
        <ChevronRight size={18} />
      </Link>

      {choosing && (
        <Sheet title="Choose exercise" onClose={() => setChoosing(false)}>
          <div className="sheet-list">
            {logged.map((l) => (
              <button key={l.id} className={`list-row${l.id === exerciseId ? ' current' : ''}`} onClick={() => choose(l.id)}>
                <span className="plan-name">{exercises.get(l.id)?.name ?? 'Exercise'}</span>
                <span className="plan-detail">
                  {l.sessions} session{l.sessions === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
