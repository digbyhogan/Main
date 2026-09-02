# Main

## Fixing the Xcode license error

If a build fails with:

> You have not agreed to the Xcode license agreements. Please run 'sudo xcodebuild -license' from within a Terminal window to review and agree to the Xcode and Apple SDKs license.

run this in Terminal on the Mac:

```bash
sudo xcodebuild -license accept
```

Or use the script in this repo, which also handles the case where the
developer tools are pointing at the Command Line Tools instead of Xcode:

```bash
./fix-xcode-license.sh
```

Note: every Xcode update resets the license, so this recurs. Opening
Xcode once after an update and clicking **Agree** also works.
