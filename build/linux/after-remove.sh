#!/bin/bash

# Delete the link to the binary
if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove '${executable}' '/usr/bin/${executable}'
else
    rm -f '/usr/bin/${executable}'
fi

PROFILE='/etc/apparmor.d/${executable}'
if [ -f "$PROFILE" ]; then
    hash apparmor_parser 2>/dev/null && apparmor_parser --remove "$PROFILE" 2>/dev/null || true
    rm -f "$PROFILE"
fi
