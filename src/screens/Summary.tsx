import { Link, Navigate, useParams } from 'react-router-dom';
import { useExerciseMap, useWorkout } from '../hooks/data';
import { setVolume, workoutVolume } from '../engine/volume';
import { doneSetCount } from '../db/workouts';
import { formatKg } from '../utils';

export default function Summary() {
  const { id } = useParams();
  const workout = useWorkout(id);
  const exercises = useExerciseMap();

  if (workout === undefined || exercises === undefined) return null;
  if (workout === null) return <Navigate to="/" replace />;
  if (workout.status !== 'done') return <Navigate to={`/session/${workout.id}`} replace />;

  const minutes =
    workout.startedAt && workout.endedAt
      ? Math.max(1, Math.round((new Date(workout.endedAt).getTime() - new Date(workout.startedAt).getTime()) / 60000))
      : 0;
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

          <div className="tiles two">
            <div className="tile">
              <div className="tile-val">{minutes} min</div>
              <div className="tile-label">duration</div>
            </div>
            <div className="tile">
              <div className="tile-val">{formatKg(workoutVolume(workout))}</div>
              <div className="tile-label">volume</div>
            </div>
            <div className="tile">
              <div className="tile-val">{doneSetCount(workout)}</div>
              <div className="tile-label">sets</div>
            </div>
            <div className="tile">
              <div className="tile-val">{workout.exercises.length}</div>
              <div className="tile-label">exercises</div>
            </div>
          </div>

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
