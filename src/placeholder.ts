// Sample data copied from the approved mockups in design/. It keeps the Phase 1 screens
// looking finished; later phases replace each piece with real data from the database and engine.

export const weekDays = [
  { label: 'M', trained: true },
  { label: 'T', trained: false },
  { label: 'W', trained: true },
  { label: 'T', trained: false },
  { label: 'F', trained: false },
  { label: 'S', trained: false },
  { label: 'S', trained: false },
];

export const muscleSets: [name: string, sets: number][] = [
  ['Back', 16],
  ['Chest', 14],
  ['Arms', 10],
  ['Shoulders', 8],
  ['Legs', 6],
  ['Core', 3],
];

export const records = [
  { name: 'Bench press', value: '82.5 kg × 5', gain: '+2.5' },
  { name: 'Lat pulldown', value: '73 kg × 10', gain: '+1 rep' },
];

export const focusOptions = ['Legs', 'Core', 'Chest', 'Back', 'Shoulders', 'Arms', 'Full body'];
export const durations = [30, 45, 60, 75];

// Stand-in for the generator until Phase 5. Starting it logs these exercises with no weights.
export const plan = [
  { id: 'leg-press', sets: 4, reps: 10, name: 'Leg press', detail: '4 × 10 at 165 kg · up 5 kg on last time' },
  { id: 'romanian-deadlift', sets: 3, reps: 10, name: 'Romanian deadlift', detail: '3 × 10 at 80 kg · same as last time' },
  { id: 'walking-lunge', sets: 3, reps: 12, name: 'Walking lunge', detail: '3 × 12 each side at 16 kg dumbbells' },
  { id: 'hanging-knee-raise', sets: 3, reps: 12, name: 'Hanging knee raise', detail: '3 × 12 · bodyweight' },
  { id: 'cable-crunch', sets: 3, reps: 15, name: 'Cable crunch', detail: '3 × 15 at 35 kg · up 2.5 kg' },
];

export const weeklyVolume = [9.8, 11.2, 7.4, 12.1, 10.6, 12.9, 8.3, 12.5];
