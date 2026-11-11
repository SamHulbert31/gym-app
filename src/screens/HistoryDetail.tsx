import { Link, Navigate, useParams } from 'react-router-dom';
import { ChevronLeft } from '../components/Icons';
import RecordRows from '../components/RecordRows';
import WorkoutStats from '../components/WorkoutStats';
import { useAllWorkouts, useExerciseMap } from '../hooks/data';
import { recordEvents } from '../engine/records';
import { focusLabel, historyDate } from './History';

// A finished workout, read only.
export default function HistoryDetail() {
  const { id } = useParams();
  const workouts = useAllWorkouts();
  const exercises = useExerciseMap();
  if (workouts === undefined || exercises === undefined) return null;

  const workout = workouts.find((w) => w.id === id && w.status === 'done' && !w.deletedAt);
  if (!workout) return <Navigate to="/history" replace />;

  const records = recordEvents(workouts).filter((e) => e.workoutId === workout.id);

  return (
    <div className="scroll">
      <div className="flow">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/history" className="back" aria-label="Back to history">
            <ChevronLeft />
          </Link>
          <div className="title-block">
            <div className="caption">{historyDate(workout)}</div>
            <h1 className="h1-sm">{focusLabel(workout, exercises)}</h1>
          </div>
        </div>

        <WorkoutStats workout={workout} />

        {records.length > 0 && (
          <section className="card">
            <h2 className="card-title">Records</h2>
            <RecordRows events={records} exercises={exercises} />
          </section>
        )}

        {workout.exercises.map((we) => (
          <section key={we.exerciseId} className="card">
            <h2 className="card-title">{exercises.get(we.exerciseId)?.name ?? 'Exercise'}</h2>
            {we.swappedFromExerciseId && (
              <div className="caption">Swapped from {exercises.get(we.swappedFromExerciseId)?.name ?? 'another exercise'}</div>
            )}
            {we.sets.map((s, i) => (
              <div key={i} className="record-row">
                <div className="name">Set {i + 1}</div>
                <div className="val">{s.weight ? `${s.weight} kg × ${s.reps ?? '–'}` : `${s.reps ?? '–'} reps`}</div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
