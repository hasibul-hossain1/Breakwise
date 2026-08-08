# break-reminder

A minimal work/break reminder for Ubuntu. Every hour a small dark card slides into
a screen corner, counts down five minutes, and closes itself. Nothing else — no
tray icon, no settings window, no fullscreen takeover.

## Try it

```bash
python3 break_reminder.py --test
```

Shows the card with a 10-second countdown, then exits.

## Install (starts automatically with your session)

```bash
./install.sh
```

Defaults to 60 minutes of work / 5 minutes of break, card in the top-right corner.
To change that, pass `work break corner`:

```bash
./install.sh 50 10 bottom-right
```

This copies the script to `~/.local/bin/break-reminder` and enables a systemd
user service.

## Control it

```bash
systemctl --user status break-reminder
systemctl --user stop break-reminder
systemctl --user start break-reminder
systemctl --user disable --now break-reminder
```

To change the schedule later, just re-run `./install.sh` with new numbers.

## Options

| Flag | Default | Meaning |
| --- | --- | --- |
| `--work` | `60` | Minutes of work before a break |
| `--break` | `5` | Minutes the break card stays up |
| `--position` | `top-right` | `top-right`, `top-left`, `bottom-right`, `bottom-left` |
| `--heads-up` | `30` | Seconds of desktop notification before the break; `0` disables |
| `--once` | off | Run a single cycle, then exit |
| `--test` | off | Show a 10-second card immediately |

Fractional minutes work, which is handy for testing: `--work 0.1 --break 0.2`.

## Behaviour notes

- The card ignores focus, so it never steals your keystrokes mid-typing. Click
  `skip` to end a break early; the next work interval starts immediately.
- Placement respects the GNOME top bar and dock, so it won't sit underneath them.
- Timing uses a monotonic clock that excludes suspend, so closing the lid for
  lunch does not burn through your work interval.
- The app forces `GDK_BACKEND=x11` (via XWayland). Under native Wayland, GNOME
  forbids a client from placing itself in a corner or staying above other
  windows, which is exactly what this needs.

## Requirements

Ubuntu 24.04 with GNOME. `python3-gi`, `gir1.2-gtk-3.0`, and `libnotify-bin`
ship by default, so there is normally nothing to install.
