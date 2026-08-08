#!/bin/bash
# Replaces electron-builder's generated postinst, so it must also do the
# symlink and database updates that the default one handled.
set -e

APP_DIR='/opt/Breakwise'

# Expose the binary on PATH.
if type update-alternatives 2>/dev/null >&1; then
    if [ -L '/usr/bin/breakwise' ] && [ -e '/usr/bin/breakwise' ] &&
       [ "$(readlink '/usr/bin/breakwise')" != '/etc/alternatives/breakwise' ]; then
        rm -f '/usr/bin/breakwise'
    fi
    update-alternatives --install '/usr/bin/breakwise' 'breakwise' "$APP_DIR/breakwise" 100 ||
        ln -sf "$APP_DIR/breakwise" '/usr/bin/breakwise'
else
    ln -sf "$APP_DIR/breakwise" '/usr/bin/breakwise'
fi

# Always install the SUID sandbox helper, unconditionally.
#
# electron-builder's default postinst only does this when `unshare --user` fails
# at install time. That test is misleading on Ubuntu 24.04: with
# kernel.apparmor_restrict_unprivileged_userns=1, a login shell may still be
# permitted to create a user namespace while an app launched by GNOME Shell is
# not. The install then looks fine, the app runs from a terminal, and every
# launch from the app menu dies with:
#
#   FATAL:setuid_sandbox_host.cc(163) The SUID sandbox helper binary was found,
#   but is not configured correctly.
#
# Setting 4755 makes the SUID sandbox available in both cases. Chromium still
# prefers the namespace sandbox wherever that is permitted.
chown root:root "$APP_DIR/chrome-sandbox" || true
chmod 4755 "$APP_DIR/chrome-sandbox" || true

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi
