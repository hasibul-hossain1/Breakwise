#!/usr/bin/env python3
"""Minimal break reminder: work for N minutes, then a small countdown window
appears in a screen corner and closes itself when the break is over."""

import argparse
import os
import signal
import sys
import time

# Force the X11 backend: under Wayland, GNOME does not let a client keep itself
# above other windows or place itself in a corner. XWayland does.
os.environ.setdefault("GDK_BACKEND", "x11")

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, GLib, Gtk, Pango  # noqa: E402

CSS = b"""
.break-card {
    background-color: rgba(24, 24, 27, 0.94);
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 14px;
}
.break-title {
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
    letter-spacing: 1.2px;
}
.break-time {
    color: #ffffff;
    font-size: 30px;
    font-weight: 300;
}
.break-skip {
    color: rgba(255, 255, 255, 0.35);
    font-size: 11px;
    background: none;
    border: none;
    box-shadow: none;
    padding: 0 4px;
    min-height: 0;
    min-width: 0;
}
.break-skip:hover { color: rgba(255, 255, 255, 0.85); }
progressbar trough {
    background-color: rgba(255, 255, 255, 0.10);
    border: none;
    min-height: 3px;
    border-radius: 2px;
}
progressbar progress {
    background-image: none;
    background-color: #7dd3fc;
    border: none;
    min-height: 3px;
    border-radius: 2px;
}
"""

WIDTH, HEIGHT, MARGIN = 236, 104, 28


def notify(summary, body):
    try:
        GLib.spawn_async(
            ["notify-send", "-a", "Break Reminder", "-u", "normal", summary, body],
            flags=GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
        )
    except GLib.Error:
        pass


class BreakWindow(Gtk.Window):
    """The small countdown card. Lives only for the duration of one break."""

    def __init__(self, seconds, position, on_finished):
        super().__init__(type=Gtk.WindowType.TOPLEVEL)
        self.total = seconds
        self.deadline = time.monotonic() + seconds
        self.on_finished = on_finished
        self.tick_id = None

        self.position = position
        self.placed_for = None

        self.set_title("Break Reminder")
        self.set_default_size(WIDTH, HEIGHT)
        self.set_size_request(WIDTH, HEIGHT)
        self.set_decorated(False)
        self.set_type_hint(Gdk.WindowTypeHint.UTILITY)
        self.set_keep_above(True)
        self.set_skip_taskbar_hint(True)
        self.set_skip_pager_hint(True)
        self.set_accept_focus(False)
        self.set_focus_on_map(False)
        self.set_resizable(False)
        self.set_app_paintable(True)
        self.stick()

        screen = self.get_screen()
        visual = screen.get_rgba_visual()
        if visual is not None:
            self.set_visual(visual)

        card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        card.get_style_context().add_class("break-card")
        card.set_border_width(14)
        self.add(card)

        header = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        title = Gtk.Label(label="BREAK TIME", xalign=0.0)
        title.get_style_context().add_class("break-title")
        header.pack_start(title, True, True, 0)

        skip = Gtk.Button(label="skip")
        skip.get_style_context().add_class("break-skip")
        skip.set_relief(Gtk.ReliefStyle.NONE)
        skip.connect("clicked", lambda _b: self.finish())
        header.pack_end(skip, False, False, 0)
        card.pack_start(header, False, False, 0)

        self.time_label = Gtk.Label(xalign=0.0)
        self.time_label.get_style_context().add_class("break-time")
        self.time_label.set_attributes(_mono())
        card.pack_start(self.time_label, False, False, 0)

        self.bar = Gtk.ProgressBar()
        self.bar.set_fraction(0.0)
        card.pack_start(self.bar, False, False, 2)

        # Placement waits for the real allocation: the card can end up taller
        # than HEIGHT once the font metrics are known.
        self.connect("size-allocate", self._place)
        self._render()

    def _place(self, _widget, allocation):
        size = (allocation.width, allocation.height)
        if size == self.placed_for:
            return
        self.placed_for = size
        display = self.get_display()
        monitor = display.get_primary_monitor() or display.get_monitor(0)
        area = monitor.get_workarea()
        left = "left" in self.position
        top = "top" in self.position
        x = area.x + (MARGIN if left else area.width - size[0] - MARGIN)
        y = area.y + (MARGIN if top else area.height - size[1] - MARGIN)
        self.move(x, y)

    def start(self):
        self.show_all()
        self.tick_id = GLib.timeout_add(250, self._render)

    def _render(self):
        left = max(0, self.deadline - time.monotonic())
        secs = int(left + 0.999)
        self.time_label.set_text(f"{secs // 60:02d}:{secs % 60:02d}")
        self.bar.set_fraction(1.0 - left / self.total if self.total else 1.0)
        if left <= 0:
            self.finish()
            return GLib.SOURCE_REMOVE
        return GLib.SOURCE_CONTINUE

    def finish(self):
        if self.tick_id is not None:
            GLib.source_remove(self.tick_id)
            self.tick_id = None
        self.destroy()
        self.on_finished()


def _mono():
    attrs = Pango.AttrList()
    attrs.insert(Pango.attr_family_new("monospace"))
    return attrs


class Scheduler:
    def __init__(self, args):
        self.args = args
        self.window = None

    def run(self):
        self._schedule_work()
        Gtk.main()

    def _schedule_work(self):
        if self.args.heads_up > 0 and self.args.heads_up < self.args.work * 60:
            GLib.timeout_add_seconds(
                int(self.args.work * 60 - self.args.heads_up),
                self._heads_up,
            )
        GLib.timeout_add_seconds(int(self.args.work * 60), self._start_break)

    def _heads_up(self):
        notify("Break coming up", f"{self.args.heads_up}s until your {self.args.brk}-minute break.")
        return GLib.SOURCE_REMOVE

    def _start_break(self):
        self.window = BreakWindow(
            int(self.args.brk * 60), self.args.position, self._break_over
        )
        self.window.start()
        return GLib.SOURCE_REMOVE

    def _break_over(self):
        self.window = None
        if self.args.once:
            Gtk.main_quit()
        else:
            self._schedule_work()


def main():
    p = argparse.ArgumentParser(description="Minimal work/break reminder for Ubuntu.")
    p.add_argument("--work", type=float, default=60, help="work minutes (default: 60)")
    p.add_argument("--break", dest="brk", type=float, default=5,
                   help="break minutes (default: 5)")
    p.add_argument("--position", default="top-right",
                   choices=["top-right", "top-left", "bottom-right", "bottom-left"],
                   help="corner for the timer card (default: top-right)")
    p.add_argument("--heads-up", type=int, default=30,
                   help="seconds of desktop-notification warning before a break; 0 disables")
    p.add_argument("--once", action="store_true", help="run a single cycle, then exit")
    p.add_argument("--test", action="store_true",
                   help="show a 10-second break card immediately and exit")
    args = p.parse_args()

    signal.signal(signal.SIGINT, signal.SIG_DFL)

    provider = Gtk.CssProvider()
    provider.load_from_data(CSS)
    Gtk.StyleContext.add_provider_for_screen(
        Gdk.Screen.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
    )

    if args.test:
        BreakWindow(10, args.position, Gtk.main_quit).start()
        Gtk.main()
        return 0

    Scheduler(args).run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
