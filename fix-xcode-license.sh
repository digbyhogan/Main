#!/usr/bin/env bash
# fix-xcode-license.sh
#
# Fixes: "You have not agreed to the Xcode license agreements. Please run
# 'sudo xcodebuild -license' from within a Terminal window..."
#
# Run this on your Mac (it will ask for your admin password):
#   ./fix-xcode-license.sh

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "error: this script only makes sense on macOS." >&2
  exit 1
fi

# xcodebuild refuses to work if the developer directory points at the
# Command Line Tools instead of the full Xcode app.
dev_dir="$(xcode-select -p 2>/dev/null || true)"
if [[ "$dev_dir" != *"Xcode.app"* ]]; then
  if [[ -d /Applications/Xcode.app ]]; then
    echo "Developer directory is '$dev_dir'; switching to /Applications/Xcode.app ..."
    sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
  else
    echo "error: full Xcode not found at /Applications/Xcode.app — install it from the App Store first." >&2
    exit 1
  fi
fi

echo "Accepting the Xcode license ..."
sudo xcodebuild -license accept

# Installs any pending first-launch components so the next build doesn't
# stall on a different prompt. Harmless if there's nothing to do.
sudo xcodebuild -runFirstLaunch >/dev/null 2>&1 || true

echo "Done. Xcode should stop complaining now."
