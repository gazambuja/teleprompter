#!/bin/bash

if type update-alternatives 2>/dev/null >&1; then
    # Remove previous link if it doesn't use update-alternatives
    if [ -L '/usr/bin/${executable}' -a -e '/usr/bin/${executable}' -a "`readlink '/usr/bin/${executable}'`" != '/etc/alternatives/${executable}' ]; then
        rm -f '/usr/bin/${executable}'
    fi
    update-alternatives --install '/usr/bin/${executable}' '${executable}' '/opt/${sanitizedProductName}/${executable}' 100 || ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
else
    ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
fi

# Ubuntu 23.10+ blocks unprivileged user namespaces via AppArmor. The stock
# electron-builder check runs `unshare` as root (where it succeeds) and wrongly
# leaves chrome-sandbox at 0755, so the app aborts when a normal user launches it.
# Grant userns through an AppArmor profile (like Chrome/VS Code), else fall back
# to the SUID sandbox.
SANDBOX='/opt/${sanitizedProductName}/chrome-sandbox'
PROFILE='/etc/apparmor.d/${executable}'
if [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ]; then
    cat > "$PROFILE" <<APPARMOR
abi <abi/4.0>,
include <tunables/global>

profile ${executable} /opt/${sanitizedProductName}/${executable} flags=(unconfined) {
  userns,
  include if exists <local/${executable}>
}
APPARMOR
    if hash apparmor_parser 2>/dev/null && apparmor_parser --replace --write-cache --skip-read-cache "$PROFILE"; then
        chmod 0755 "$SANDBOX" || true
    else
        rm -f "$PROFILE"
        chmod 4755 "$SANDBOX" || true
    fi
elif ! { [[ -L /proc/self/ns/user ]] && unshare --user true; }; then
    # Use SUID chrome-sandbox only on systems without user namespaces:
    chmod 4755 "$SANDBOX" || true
else
    chmod 0755 "$SANDBOX" || true
fi

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi
