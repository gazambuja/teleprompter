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

## Build locally

```bash
npm run build:linux
```

`build:win` needs Windows (or wine), and `build:mac` needs macOS. Output goes to `release/<version>/`. To attach a local build to an existing release:

```bash
gh release upload v0.1.2 release/0.1.2/*.AppImage release/0.1.2/*.deb --clobber
```

## Code signing

Windows and macOS builds are **not signed** (the workflow sets `CSC_IDENTITY_AUTO_DISCOVERY=false`). Users see a SmartScreen warning on Windows and a Gatekeeper block on macOS. The README explains how to get past both.

To sign, add the certificates as repository secrets and pass them to the **Package** step instead of disabling discovery:

- **macOS** (Apple Developer Program): `CSC_LINK` (base64 `.p12`), `CSC_KEY_PASSWORD`. For notarization, also `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`.
- **Windows:** `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` (or a cloud signing service).

## Landing page

The landing page at [teleprompter.sandboxlabs.uk](https://teleprompter.sandboxlabs.uk) (`site/`) is deployed separately. See `deploy/`. Its Linux download links point at `site/downloads/` on that server, which is ignored by git. Update those files and links by hand, or point the links at the GitHub release assets instead:

```
https://github.com/gazambuja/teleprompter/releases/latest/download/Teleprompter-<v>-win-x64.exe
```
