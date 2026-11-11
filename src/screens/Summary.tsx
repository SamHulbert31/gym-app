import { Link, Navigate, useParams } from 'react-router-dom';
import RecordRows from '../components/RecordRows';
import WorkoutStats from '../components/WorkoutStats';
import { useAllWorkouts, useExerciseMap, useWorkout } from '../hooks/data';
import { recordEvents } from '../engine/records';
import { setVolume } from '../engine/volume';

export default function Summary() {
  const { id } = useParams();
  const workout = useWorkout(id);
  const exercises = useExerciseMap();
  const all = useAllWorkouts();

  if (workout === undefined || exercises === undefined || all === undefined) return null;
  if (workout === null) return <Navigate to="/" replace />;
  if (workout.status !== 'done') return <Navigate to={`/session/${workout.id}`} replace />;

  const records = recordEvents(all).filter((e) => e.workoutId === workout.id);
  const date = new Date(workout.endedAt ?? workout.createdAt).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      <div className="scroll">
        <div className="flow">
          <div className="title-block" style={{ paddingTop: 8 }}>
            <div className="caption">{date}</div>
            <h1 className="h1">Workout done</h1>
          </div>

          <WorkoutStats workout={workout} />

          {records.length > 0 && (
            <section className="card">
              <h2 className="card-title">Records</h2>
              <RecordRows events={records} exercises={exercises} />
            </section>
          )}

          <section className="card">
            <h2 className="card-title">What you did</h2>
            {workout.exercises.map((we) => {
              const best = we.sets
                .filter((s) => s.done)
                .reduce<(typeof we.sets)[number] | undefined>(
                  (b, s) => (!b || setVolume(s) > setVolume(b) || (!b.weight && (s.reps ?? 0) > (b.reps ?? 0)) ? s : b),
                  undefined,
                );
              return (
                <div key={we.exerciseId} className="record-row">
                  <div className="name">{exercises.get(we.exerciseId)?.name}</div>
                  <div className="val">
                    {we.sets.length} {we.sets.length === 1 ? 'set' : 'sets'} · best {best?.weight ? `${best.weight} kg × ` : ''}
                    {best?.reps ?? '–'}
                    {best?.weight ? '' : ' reps'}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </div>

      <div className="flow-footer">
        <Link to="/" className="btn-primary">
          Done
        </Link>
      </div>
    </>
  );
}
