import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from '../components/Icons';
import NumInput from '../components/NumInput';
import Sheet from '../components/Sheet';
import { updateMeta } from '../db/db';
import { EQUIPMENT, type Exercise } from '../db/types';
import { deleteCustomExercise, updateExerciseSettings } from '../db/workouts';
import { incrementFor } from '../engine/progression';
import { useExerciseMap, useMeta } from '../hooks/data';
import { syncEngine, useSyncState } from '../sync';
import { DEFAULT_PATH, DEFAULT_REPO, readSettings, syncConfig, writeSettings, type DeviceSettings } from '../sync/config';
import { exportJson, importJson, readFileText } from '../sync/file';
import { GitHubError, testConnection } from '../sync/github';
import { equipmentLabel, muscleLabel, selectOnFocus } from '../utils';

const REST_CHOICES = [60, 90, 120, 150, 180];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card settings-section">
      <h2 className="card-title">{title}</h2>
      {children}
    </section>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id} className="caption">
        {label}
      </label>
      {children}
    </div>
  );
}

const STATUS_WORDS = { off: 'Not set up', synced: 'Synced', syncing: 'Syncing', offline: 'Offline', error: 'Error' } as const;

const whenText = (iso: string | undefined) => {
  if (!iso) return 'never';
  const d = new Date(iso);
  const today = new Date();
  const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === today.toDateString() ? `today at ${time}` : `${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} at ${time}`;
};

export default function Settings() {
  const [s, setS] = useState<DeviceSettings>(readSettings);
  const [showToken, setShowToken] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [query, setQuery] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const sync = useSyncState();
  const meta = useMeta();
  const exercises = useExerciseMap();

  const save = (patch: Partial<DeviceSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    writeSettings(patch);
    syncEngine.refresh();
    setTestResult(null);
  };

  const test = async () => {
    const cfg = syncConfig(s);
    if (!cfg) {
      setTestResult({ ok: false, text: 'Fill in the owner, repo, path and token first.' });
      return;
    }
    setTesting(true);
    try {
      const info = await testConnection(cfg);
      setTestResult({
        ok: info.canWrite,
        text: info.canWrite
          ? `Connected to ${info.fullName}${info.isPrivate ? ' (private)' : ' (public: anyone can read your data)'}. The token can read and write.`
          : `Connected to ${info.fullName}, but the token can only read. It needs Contents read and write.`,
      });
    } catch (e) {
      setTestResult({ ok: false, text: e instanceof GitHubError ? e.message : 'Could not reach GitHub.' });
    } finally {
      setTesting(false);
    }
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const r = await importJson(await readFileText(file));
      const parts = [`${r.workouts} workout${r.workouts === 1 ? '' : 's'}`, `${r.exercises} exercise${r.exercises === 1 ? '' : 's'}`];
      if (r.settings) parts.push('settings');
      setImportResult({ ok: true, text: r.workouts + r.exercises === 0 && !r.settings ? 'Nothing new in that file; everything in it was already here.' : `Imported ${parts.join(', ')}.` });
    } catch (e) {
      setImportResult({ ok: false, text: e instanceof Error ? e.message : 'Import failed.' });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const all = useMemo(() => [...(exercises?.values() ?? [])].filter((e) => !e.deletedAt), [exercises]);
  const custom = all.filter((e) => e.isCustom).sort((a, b) => a.name.localeCompare(b.name));
  const unavailable = all.filter((e) => e.unavailable).sort((a, b) => a.name.localeCompare(b.name));
  const q = query.trim().toLowerCase();
  const matches = q ? all.filter((e) => e.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8) : [];
  const live = editing && exercises?.get(editing.id);

  return (
    <div className="scroll">
      <div className="flow">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/" className="back" aria-label="Back to home">
            <ChevronLeft />
          </Link>
          <h1 className="h1-sm">Settings</h1>
        </div>

        <Section title="Sync">
          <p className="note">
            Your data is kept in one JSON file in a private GitHub repo you own. The token is stored only on this device.
          </p>
          <Field id="owner" label="GitHub owner">
            <input id="owner" className="text-input" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={s.owner} onChange={(e) => save({ owner: e.target.value })} onFocus={selectOnFocus} placeholder="your-github-username" />
          </Field>
          <Field id="repo" label="Repo name">
            <input id="repo" className="text-input" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={s.repo} onChange={(e) => save({ repo: e.target.value })} onFocus={selectOnFocus} placeholder={DEFAULT_REPO} />
          </Field>
          <Field id="path" label="File path">
            <input id="path" className="text-input" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={s.path} onChange={(e) => save({ path: e.target.value })} onFocus={selectOnFocus} placeholder={DEFAULT_PATH} />
          </Field>
          <Field id="token" label="Fine grained personal access token">
            <div className="input-row">
              <input id="token" className="text-input" type={showToken ? 'text' : 'password'} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={s.token} onChange={(e) => save({ token: e.target.value })} onFocus={selectOnFocus} placeholder="github_pat_…" />
              <button className="btn-text input-side" onClick={() => setShowToken((v) => !v)}>
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="caption">Contents: read and write, on that one repo only.</div>
          </Field>
          <div className="pair">
            <button className="btn-outline" disabled={testing} onClick={test}>
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            <button className="btn-outline" disabled={sync.status === 'off' || sync.status === 'syncing'} onClick={() => void syncEngine.sync()}>
              Sync now
            </button>
          </div>
          {testResult && (
            <p className={`note ${testResult.ok ? 'ok' : 'bad'}`} role="status">
              {testResult.text}
            </p>
          )}
          <div className="status-row" role="status" aria-live="polite">
            <span className={`sync-dot ${sync.status}`}>{STATUS_WORDS[sync.status]}</span>
            <span className="caption">last synced {whenText(sync.lastSync ?? meta?.lastSync)}</span>
          </div>
          {sync.status === 'error' && sync.message && <p className="note bad">{sync.message}</p>}
          {sync.status === 'off' && <p className="note">Fill in all four fields to turn sync on.</p>}
        </Section>

        <Section title="AI">
          <p className="note">Optional. With a free Gemini key the generator can read your note properly. Without one, everything still works.</p>
          <Field id="gemini-key" label="Gemini API key">
            <div className="input-row">
              <input id="gemini-key" className="text-input" type={showKey ? 'text' : 'password'} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={s.geminiKey} onChange={(e) => save({ geminiKey: e.target.value })} onFocus={selectOnFocus} />
              <button className="btn-text input-side" onClick={() => setShowKey((v) => !v)}>
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>
          <Field id="gemini-model" label="Model name">
            <input id="gemini-model" className="text-input" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={s.geminiModel} onChange={(e) => save({ geminiModel: e.target.value })} onFocus={selectOnFocus} placeholder="set when the AI layer arrives" />
          </Field>
        </Section>

        <Section title="Training">
          <div className="field">
            <div className="caption">Default rest between sets</div>
            <div className="segmented five">
              {REST_CHOICES.map((sec) => (
                <button key={sec} aria-pressed={(meta?.restSeconds ?? 90) === sec} onClick={() => void updateMeta({ restSeconds: sec })}>
                  {sec}s
                </button>
              ))}
            </div>
            <div className="caption">Heavy compound lifts always get at least 120 s.</div>
          </div>
          <div className="field">
            <div className="caption">Weight increments, kg</div>
            <div className="increments">
              {EQUIPMENT.filter((eq) => eq !== 'bodyweight').map((eq) => (
                <label key={eq} className="target-field">
                  <span className="caption">{equipmentLabel(eq)}</span>
                  <NumInput
                    className="set-input"
                    decimal
                    label={`${equipmentLabel(eq)} increment in kg`}
                    value={meta?.increments[eq] ?? incrementFor({ equipment: eq })}
                    onChange={(n) => n !== undefined && n > 0 && void updateMeta({ increments: { ...meta?.increments, [eq]: n } })}
                  />
                </label>
              ))}
            </div>
            <div className="caption">Dumbbells are per hand. Any exercise can override its own increment below.</div>
          </div>
        </Section>

        <Section title="Exercises">
          <Field id="ex-search" label="Exercise settings">
            <input id="ex-search" className="text-input" type="search" placeholder="Search any exercise" value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>
          {matches.length > 0 && (
            <div className="sheet-list">
              {matches.map((e) => (
                <button key={e.id} className="list-row" onClick={() => { setEditing(e); setQuery(''); }}>
                  <span>
                    <span className="plan-name">{e.name}</span>
                    <span className="plan-detail">
                      {muscleLabel(e.primary)} · {equipmentLabel(e.equipment)}
                      {e.increment ? ` · ${e.increment} kg steps` : ''}
                      {e.unavailable ? ' · not available' : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="caption">Custom exercises</div>
          {custom.length === 0 ? (
            <p className="note">None yet. Create one from any exercise picker.</p>
          ) : (
            <div className="sheet-list">
              {custom.map((e) => (
                <button key={e.id} className="list-row" onClick={() => setEditing(e)}>
                  <span>
                    <span className="plan-name">{e.name}</span>
                    <span className="plan-detail">{muscleLabel(e.primary)} · {equipmentLabel(e.equipment)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="caption">Not available at my gym</div>
          {unavailable.length === 0 ? (
            <p className="note">Nothing marked. Use the switch on the swap sheet, or search above.</p>
          ) : (
            <div className="sheet-list">
              {unavailable.map((e) => (
                <div key={e.id} className="list-row">
                  <span>
                    <span className="plan-name">{e.name}</span>
                    <span className="plan-detail">{muscleLabel(e.primary)} · {equipmentLabel(e.equipment)}</span>
                  </span>
                  <button className="btn-text accent" onClick={() => void updateExerciseSettings(e.id, { unavailable: false })}>
                    Available again
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Data">
          <div className="pair">
            <button className="btn-outline" onClick={() => void exportJson()}>
              Export JSON
            </button>
            <button className="btn-outline" onClick={() => fileRef.current?.click()}>
              Import JSON
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden aria-label="Import JSON file" onChange={(e) => void onImportFile(e.target.files?.[0])} />
          <p className="note">Export downloads everything as one file. Import merges a file in; newer records win, so nothing here is lost.</p>
          {importResult && (
            <p className={`note ${importResult.ok ? 'ok' : 'bad'}`} role="status">
              {importResult.text}
            </p>
          )}
        </Section>

        <Section title="About">
          <p className="note">
            Overload {__APP_VERSION__} · built {new Date(__BUILD_DATE__).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </Section>
      </div>

      {live && (
        <Sheet title={live.name} onClose={() => setEditing(null)}>
          <div className="caption">
            {muscleLabel(live.primary)} · {equipmentLabel(live.equipment)}
            {live.isCustom ? ' · custom' : ''}
          </div>
          <label className="target-field">
            <span className="caption">Weight increment, kg (blank for the {equipmentLabel(live.equipment).toLowerCase()} default of {incrementFor({ equipment: live.equipment }, meta?.increments)})</span>
            <NumInput
              className="set-input"
              decimal
              label={`${live.name} increment in kg`}
              placeholder={String(incrementFor({ equipment: live.equipment }, meta?.increments))}
              value={live.increment}
              onChange={(n) => void updateExerciseSettings(live.id, { increment: n })}
            />
          </label>
          <button className="switch-row" role="switch" aria-checked={!!live.unavailable} onClick={() => void updateExerciseSettings(live.id, { unavailable: !live.unavailable })}>
            <span>Not available at my gym</span>
            <span className="switch" aria-hidden="true" />
          </button>
          {live.isCustom && (
            <button
              className="btn-outline btn-warn"
              onClick={() => {
                void deleteCustomExercise(live.id);
                setEditing(null);
              }}
            >
              Delete custom exercise
            </button>
          )}
          <button className="btn-primary" onClick={() => setEditing(null)}>
            Done
          </button>
        </Sheet>
      )}
    </div>
  );
}
