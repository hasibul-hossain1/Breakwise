# Breakwise

A break reminder for Linux, macOS, and Windows that stays out of your way. A
small card slides into a corner of the screen, counts down, and closes itself.
No fullscreen takeover, no nagging.

Two independent timers:

- **Eye break** — the 20-20-20 rule. Every 20 minutes, look at something about
  6 m (20 ft) away for 20 seconds.
- **Body break** — the longer one. Every 60 minutes, stand up for 5 minutes.

Both are fully configurable, and a body break restarts the eye timer too (the
long break already rests your eyes).

![The eye break card](shots/break-eye.png)
![The body break card](shots/break-body.png)
![Settings](shots/settings.png)

## Requirements

Nothing extra to run a packaged build. Node.js 20+ for development.

| | |
| --- | --- |
| **Linux** | Ubuntu 24.04 (GNOME) or similar. Built and verified there, on Wayland with XWayland. The tray icon needs the **Ubuntu AppIndicators** GNOME extension, which ships enabled on Ubuntu by default. |
| **macOS** | 11 Big Sur or newer, Apple silicon or Intel. Breakwise runs in the menu bar with no Dock icon. |
| **Windows** | 10 or 11, x64 or arm64. Breakwise runs in the notification area — the tray next to the clock. |

The app behaves the same everywhere; the differences are where it lives while
it waits, and what the platform calls that place.

## Development

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` starts Vite with hot reload for the React UI — edit anything in
`src/renderer` and the window updates without restarting Electron.

Useful checks:

```bash
npm run typecheck
```

```bash
npm run build
```

## Packaging

Artifacts land in `dist/`.

### Linux — .deb and AppImage

```bash
npm run dist:deb
```

```bash
npm run dist:appimage
```

Install the .deb with:

```bash
sudo apt install ./dist/breakwise_1.0.0_amd64.deb
```

The AppImage needs no install — mark it executable and run it.

### macOS — .dmg

```bash
npm run dist:mac
```

Builds a .dmg and a .zip for both arm64 and x64. **This has to run on a Mac** —
the DMG tooling is macOS-only.

The build is unsigned unless you have an Apple Developer certificate in your
keychain, so Gatekeeper will refuse the first launch on any other machine.
Right-click the app → **Open** → **Open**, or clear the quarantine flag:

```bash
xattr -dr com.apple.quarantine /Applications/Breakwise.app
```

To ship it properly, set `CSC_LINK` and `CSC_KEY_PASSWORD` for signing and
`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` for notarising;
the config already turns on the hardened runtime, which notarisation requires.

### Windows — installer

```bash
npm run dist:win
```

Builds an NSIS installer for x64 and arm64 — a normal wizard that installs per
user, so it needs no administrator prompt.

Cross-building this from Linux gets all the way to the end and then fails at
`signApp`: stamping the icon and version metadata onto the `.exe` runs a
Windows tool, which needs **wine** on the build machine. Either install wine
(`sudo apt install wine`) or build on Windows. Nothing in the app itself is
Linux-specific — only that one packaging step is.

## Using it

Launching the app opens the settings window. If it is already running, that
raises the existing window instead of starting a second copy — and it
**never resets a running countdown**. Use **Restart countdown**, in the tray
menu or next to the timers in settings, when you actually want to reset it.

The app lives in the tray — the GNOME top bar, the macOS menu bar, or the
Windows notification area. From its menu you can see the countdown to each
break, take a break immediately, restart the countdown, pause reminders,
reopen settings, or quit.

On Windows a left click on the icon opens settings and a right click opens the
menu. On macOS and GNOME, a click opens the menu — that is what those desktops
expect a status item to do.

There are deliberately **no desktop notifications**. The only things this app
puts on screen are the settings window and the break card.

Closing the settings window does **not** quit the app — the countdown keeps
running, which is the point. Quit from the tray menu, or:

```bash
pkill breakwise
```

On macOS there is no Dock icon and no ⌘Q, deliberately: this is a menu bar app,
and quitting it is a decision you make in the menu, not something you do by
reflex while closing windows.

### Starting at login

Turn on **Start with my session** in settings. It starts the app silently —
countdowns running, no settings window in your face every time you log in.
Each platform gets its own mechanism:

| | |
| --- | --- |
| **Linux** | Writes `~/.config/autostart/breakwise.desktop` with an `--autostart` flag. If you add it to startup applications by hand instead, append the flag — `/opt/Breakwise/breakwise --autostart` — or you will get the settings window at every login. |
| **Windows** | Registers a Run entry pointing at the installed `.exe`, with the same flag. |
| **macOS** | Registers a login item. macOS passes no arguments to login items, so instead of the flag the app asks Launch Services whether it was opened at login. |

It only does something useful for a packaged build; in dev it would register
the bare Electron binary.

### Where settings live

| | |
| --- | --- |
| **Linux** | `~/.config/breakwise/config.json` |
| **macOS** | `~/Library/Application Support/breakwise/config.json` |
| **Windows** | `%APPDATA%\breakwise\config.json` |

Editing the file by hand is safe: anything invalid falls back to the default.

## Project layout

```
src/
  main/        Electron main process — no UI code
    index.ts       app lifecycle, IPC handlers, wiring
    scheduler.ts   the dual-timer engine
    windows.ts     overlay + settings window creation and placement
    config.ts      JSON settings store
    tray.ts        tray icon and menu
    autostart.ts   launch-at-login, one mechanism per platform
    platform.ts    the platform flags and resource paths everything else uses
  preload/     the contextBridge — the only main↔renderer surface
  renderer/    React UI
    src/break/      the overlay card
    src/settings/   the settings window
    src/components/ shared UI pieces
    src/styles/     CSS, design tokens in base.css
  shared/      types and defaults used by both sides
scripts/
  make-icons.py   regenerates resources/ icons
  capture.cjs     renders the windows to shots/ for review
legacy-python/  the original GTK prototype, kept for reference
```

## How it works

**Process split.** The main process owns all timing and window placement; the
renderers only draw. They talk over a fixed set of IPC channels defined in
`src/preload/index.ts`. Renderers run with `contextIsolation: true` and
`nodeIntegration: false`, so the UI has no access to Node or the filesystem —
only the handful of calls the preload exposes.

**Timing.** One 1-second tick drives both countdowns, decrementing by *measured*
elapsed time rather than assuming each tick is exactly 1000 ms. Any gap longer
than 5 seconds is treated as a suspend and not credited, so closing the lid for
lunch doesn't burn through a work interval.

**The overlay.** Frameless, transparent, `alwaysOnTop` at the `screen-saver`
level so it stays above fullscreen editors and video calls. It's shown with
`showInactive()` — it never takes focus, so it can't swallow a keystroke while
you're typing. Position is computed from the display's *work area*, which is why
it sits clear of the GNOME top bar, the macOS menu bar, the Windows taskbar,
and any dock.

**What differs per platform.** Not much, and all of it is in the main process.
The overlay is declared a `notification` window on Linux and a `panel` on macOS
— both tell the compositor this is an overlay rather than a window you were
meant to switch to, which is what stops GNOME posting a "Breakwise is ready"
notification on every break and what lets the card take a click on macOS
without yanking you out of your editor. Windows needs no such hint. The tray
mark ships in three forms, because macOS recolours a black template image
itself while GNOME and Windows want a finished one — and the Windows taskbar
follows the system light/dark setting, so the icon is chosen to match it and
re-chosen when it changes. Launch-at-login is the one place with three genuinely
different implementations; see above.

**A note on Wayland.** Under native Wayland a client cannot position its own
window or force itself above others — the compositor decides. Electron on Linux
still defaults to X11/XWayland, which is what makes the corner placement and
always-on-top behaviour work here. If you ever force
`--ozone-platform=wayland`, expect the card to land wherever the compositor
feels like putting it.

## Regenerating assets

```bash
python3 scripts/make-icons.py
```

```bash
npx electron scripts/capture.cjs
```

The first regenerates every icon into `resources/` — the app icon in three
shapes (full-bleed PNG for Linux, inset PNG for the macOS Dock, multi-size
`.ico` for Windows) and the tray mark in four (light PNG for GNOME, black
template PNG for the macOS menu bar, light and dark `.ico` for the Windows
notification area). Needs Pillow. The second
renders the windows to `shots/` with stubbed data — handy for reviewing UI
changes without waiting for a real break.

## The break-card animations

Each break card carries a small animation: a walking figure for the body
break, and a head turning from the screen to the horizon for the eye break.
Both live in `src/renderer/src/components/BreakAnimation.tsx` as inline SVG,
animated with CSS keyframes in `break.css`. Swing angles and cycle length are
plain `@keyframes` values — tune them there.

They are drawn with `currentColor`, so each one picks up its break's accent
colour automatically instead of having it baked in.

This started out as Lottie and was replaced. Lottie is the right tool when you
are dropping in professionally made files from After Effects, but for
pictograms we draw ourselves it cost ~690 kB of `lottie-web` (the break chunk
is ~6 kB now), and it did not survive the overlay's CSP: lottie-web builds its
parser worker from a `blob:` URL and uses `eval`, neither of which is allowed.
The failure mode was the card showing lottie's worker source as raw text.

If you ever do want a professionally made animation, expect to relax the
overlay CSP in `break.html` to permit `blob:` workers and `unsafe-eval`.

## A note on build verification

`npm run build` ends by running `scripts/verify-build.mjs`, which fails if any
file in `out/` is empty. This exists because a build once emitted zero-byte JS
and CSS chunks while still printing the correct sizes to stdout. The app
launched, the tray appeared, the timers ran — and every window rendered blank.
Nothing in the normal output revealed it, so the check is now mandatory.
