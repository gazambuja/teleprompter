# Releasing

Installers for all platforms are built by GitHub Actions ([`.github/workflows/release.yml`](.github/workflows/release.yml)) and attached to a GitHub release. Nothing needs to be built locally.

## Cut a new release

1. **Bump the version.** It is hardcoded in more than one place:
   - `package.json`: `"version"` (sets the installer file names and the version the app reports)
   - `src/renderer/src/components/ControlsPanel.tsx`: the `v0.x.y · electron` footer in the settings panel
   - `site/index.html`: the hero meta line, the "Download · v0.x.y" label and the download links (only if you update the landing page)
2. **Check that it builds:**
   ```bash
   npm run typecheck
   ```
   ```bash
   npm run build
   ```
3. **Commit, tag and push:**
   ```bash
   git commit -am "Release v0.1.2"
   ```
   ```bash
   git tag v0.1.2
   ```
   ```bash
   git push origin main v0.1.2
   ```
4. The tag push starts the **Release** workflow. It creates the GitHub release (with auto-generated notes) if needed, then builds on three runners and uploads:
   - Linux: `Teleprompter-<v>-linux-x86_64.AppImage`, `Teleprompter-<v>-linux-amd64.deb`
   - Windows: `Teleprompter-<v>-win-x64.exe` (NSIS installer)
   - macOS: `Teleprompter-<v>-mac-arm64.dmg`, `Teleprompter-<v>-mac-x64.dmg`

   A run takes about 2–3 minutes. Watch it with:
   ```bash
   gh run watch
   ```
5. Optionally edit the release notes on GitHub:
   ```bash
   gh release edit v0.1.2 --notes-file notes.md
   ```

## Rebuild an existing release

To rebuild the installers for a tag that already exists (for example after fixing the workflow), run the workflow manually. It checks out the code at that tag and replaces any assets with the same name:

```bash
gh workflow run release.yml -f tag=v0.1.1
```

## Test the build without releasing

To build every platform from a branch without touching any release, run a dry run. The installers are kept as workflow artifacts for 7 days:

```bash
gh workflow run release.yml -f dry_run=true --ref main
```

## Build locally

```bash
npm run build:linux
```

`build:win` needs Windows (or wine), and `build:mac` needs macOS. Output goes to `release/<version>/`. To attach a local build to an existing release:

```bash
gh release upload v0.1.2 release/0.1.2/*.AppImage release/0.1.2/*.deb --clobber
```

## Code signing

Windows and macOS builds are **not signed with a certificate** (the workflow sets `CSC_IDENTITY_AUTO_DISCOVERY=false`, and `electron-builder.yml` sets `mac.identity: null`). Users see a SmartScreen warning on Windows and a Gatekeeper prompt on macOS. The README explains how to get past both.

macOS apps **must** still be ad-hoc signed. Packaging invalidates Electron's own signature, and Apple Silicon reports an app with a broken signature as "damaged", with no way to open it. That is what happened in v0.1.1. The `afterPack` hook `build/mac-adhoc-sign.cjs` signs the app before the DMG is built. The **Verify macOS app** step in the workflow checks the signature and launches the arm64 app on the runner, and fails the build before anything is uploaded. (electron-builder 25 ignores `identity: '-'`, so don't rely on it.)

To sign properly, add the certificates as repository secrets, pass them to the **Package** step, and remove `identity: null`, `hardenedRuntime: false` and the `afterPack` hook:

- **macOS** (Apple Developer Program): `CSC_LINK` (base64 `.p12`), `CSC_KEY_PASSWORD`. For notarization, also `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`.
- **Windows:** `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` (or a cloud signing service).

## Landing page

The landing page at [teleprompter.sandboxlabs.uk](https://teleprompter.sandboxlabs.uk) (`site/index.html`) links straight to the GitHub release assets. The URLs include the version, for example:

```
https://github.com/gazambuja/teleprompter/releases/download/v0.1.1/Teleprompter-0.1.1-win-x64.exe
```

After each release, once the workflow has finished:

1. In `site/index.html`, replace the old version everywhere: the hero meta line, the "Download · v…" label, the five download URLs and the `.deb` install command.
2. Update the file sizes shown next to each link. To list them in MB:
   ```bash
   gh release view v0.1.2 --json assets -q '.assets[] | "\(.name) \(.size/1000000|round) MB"'
   ```
3. Deploy `site/` to the web root (see `deploy/`). Only `index.html` and `assets/` are needed, because the installers are served by GitHub.
