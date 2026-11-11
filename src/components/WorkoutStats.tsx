import type { Workout } from '../db/types';
import { doneSetCount } from '../db/workouts';
import { workoutMinutes } from '../engine/stats';
import { workoutVolume } from '../engine/volume';
import { formatKg } from '../utils';

// Duration, volume, sets and exercises for a finished workout, as four tiles.
export default function WorkoutStats({ workout }: { workout: Workout }) {
  const tiles: [string, string][] = [
    [`${workoutMinutes(workout)} min`, 'duration'],
    [formatKg(workoutVolume(workout)), 'volume'],
    [String(doneSetCount(workout)), 'sets'],
    [String(workout.exercises.length), 'exercises'],
  ];
  return (
    <div className="tiles two">
      {tiles.map(([value, label]) => (
        <div key={label} className="tile">
          <div className="tile-val">{value}</div>
          <div className="tile-label">{label}</div>
        </div>
      ))}
    </div>
  );
}
