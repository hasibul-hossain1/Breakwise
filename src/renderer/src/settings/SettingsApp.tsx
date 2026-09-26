import { useCallback, useEffect, useState } from 'react'
import type { AppConfig, StatusPayload, TimerConfig } from '@shared/types'
import { CornerPicker } from '../components/CornerPicker'
import { Stepper } from '../components/Stepper'
import { Toggle } from '../components/Toggle'

/** What to call the tray icon, in the words of whichever desktop this is. */
function trayName(platform: string): string {
  if (platform === 'darwin') return 'the Breakwise icon in the menu bar'
  if (platform === 'win32') return 'the Breakwise icon in the notification area'
  return 'the tray icon in the top bar'
}

function countdown(ms: number | null): string {
  if (ms === null) return 'off'
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`
}

export function SettingsApp(): React.JSX.Element | null {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [status, setStatus] = useState<StatusPayload | null>(null)

  useEffect(() => {
    void window.breakwise.getConfig().then(setConfig)
    void window.breakwise.getStatus().then(setStatus)
    const offConfig = window.breakwise.onConfigChanged(setConfig)
    const offStatus = window.breakwise.onStatus(setStatus)
    return () => {
      offConfig()
      offStatus()
    }
  }, [])

  /** Optimistic update so the controls never feel laggy behind IPC. */
  const patch = useCallback((changes: Partial<AppConfig>) => {
    setConfig((previous) => (previous ? { ...previous, ...changes } : previous))
    void window.breakwise.updateConfig(changes)
  }, [])

  const patchTimer = useCallback(
    (kind: 'eye' | 'body', changes: Partial<TimerConfig>) => {
      setConfig((previous) => {
        if (!previous) return previous
        const next = { ...previous, [kind]: { ...previous[kind], ...changes } }
        void window.breakwise.updateConfig({ [kind]: next[kind] })
        return next
      })
    },
    []
  )

  if (!config) return null

  const paused = status?.paused ?? false

  return (
    <div className="app">
      <header className="titlebar">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">Breakwise</span>
        </div>
        <div className="window-controls">
          <button
            type="button"
            aria-label="Minimize"
            onClick={() => window.breakwise.minimizeSettings()}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="close"
            aria-label="Close"
            onClick={() => window.breakwise.closeSettings()}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                d="M1.5 1.5l7 7M8.5 1.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <main className="content">
        <section className={`status-bar${paused ? ' paused' : ''}`}>
          <div className="status-times">
            <div className="status-item">
              <span className="dot dot-eye" />
              <span className="status-label">Eyes</span>
              <span className="status-value">{countdown(status?.nextEyeMs ?? null)}</span>
            </div>
            <div className="status-item">
              <span className="dot dot-body" />
              <span className="status-label">Body</span>
              <span className="status-value">{countdown(status?.nextBodyMs ?? null)}</span>
            </div>
          </div>
          <div className="status-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => window.breakwise.restartTimers()}
              title="Reset both countdowns to a full interval"
            >
              Restart
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => window.breakwise.setPaused(!paused)}
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
          </div>
        </section>

        <section className="card-group">
          <div className="group-head">
            <div>
              <h2>
                <span className="dot dot-eye" />
                Eye break
              </h2>
              <p>The 20-20-20 rule — look ~6 m away to relax your focus muscles.</p>
            </div>
            <Toggle
              label="Enable eye breaks"
              checked={config.eye.enabled}
              onChange={(enabled) => patchTimer('eye', { enabled })}
            />
          </div>

          <div className="row">
            <span className="row-label">Every</span>
            <Stepper
              label="Eye break interval"
              value={config.eye.intervalMinutes}
              onChange={(intervalMinutes) => patchTimer('eye', { intervalMinutes })}
              min={1}
              max={120}
              unit="min"
              disabled={!config.eye.enabled}
            />
          </div>
          <div className="row">
            <span className="row-label">Lasting</span>
            <Stepper
              label="Eye break duration"
              value={config.eye.durationSeconds}
              onChange={(durationSeconds) => patchTimer('eye', { durationSeconds })}
              min={5}
              max={120}
              step={5}
              unit="sec"
              disabled={!config.eye.enabled}
            />
          </div>
        </section>

        <section className="card-group">
          <div className="group-head">
            <div>
              <h2>
                <span className="dot dot-body" />
                Body break
              </h2>
              <p>The longer one — stand up, stretch, and move away from the desk.</p>
            </div>
            <Toggle
              label="Enable body breaks"
              checked={config.body.enabled}
              onChange={(enabled) => patchTimer('body', { enabled })}
            />
          </div>

          <div className="row">
            <span className="row-label">Every</span>
            <Stepper
              label="Body break interval"
              value={config.body.intervalMinutes}
              onChange={(intervalMinutes) => patchTimer('body', { intervalMinutes })}
              min={5}
              max={240}
              step={5}
              unit="min"
              disabled={!config.body.enabled}
            />
          </div>
          <div className="row">
            <span className="row-label">Lasting</span>
            <Stepper
              label="Body break duration"
              value={Math.round(config.body.durationSeconds / 60)}
              onChange={(minutes) => patchTimer('body', { durationSeconds: minutes * 60 })}
              min={1}
              max={60}
              unit="min"
              disabled={!config.body.enabled}
            />
          </div>
        </section>

        <section className="card-group">
          <div className="group-head">
            <div>
              <h2>Appearance &amp; behaviour</h2>
              <p>Where the card shows up, and how it behaves.</p>
            </div>
          </div>

          <div className="row row-stack">
            <span className="row-label">Overlay position</span>
            <CornerPicker
              value={config.position}
              onChange={(position) => patch({ position })}
            />
          </div>

          <div className="row">
            <span className="row-label">
              Allow skipping
              <em>Shows a Skip button on the card</em>
            </span>
            <Toggle
              label="Allow skipping"
              checked={config.allowSkip}
              onChange={(allowSkip) => patch({ allowSkip })}
            />
          </div>

          <div className="row">
            <span className="row-label">
              Start with my session
              <em>Launches automatically after you log in</em>
            </span>
            <Toggle
              label="Start with session"
              checked={config.autostart}
              onChange={(autostart) => patch({ autostart })}
            />
          </div>
        </section>

        <footer className="actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => void window.breakwise.resetConfig().then(setConfig)}
          >
            Reset to defaults
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={status?.breakActive}
            onClick={() => window.breakwise.takeBreakNow('eye')}
          >
            Preview the card
          </button>
        </footer>

        <p className="quit-hint">
          Closing this window keeps the countdown running — reopening it never
          resets the timer. Use {trayName(window.breakwise.platform)} to pause,
          restart, or quit Breakwise.
        </p>
      </main>
    </div>
  )
}
