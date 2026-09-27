// electron-builder afterPack hook: ad-hoc sign the macOS app.
// Packaging rewrites the Electron bundle, which invalidates Electron's own
// signature, and Apple Silicon then reports the app as "damaged". Without an
// Apple Developer certificate, an ad-hoc signature is the best we can do: the
// app opens after the usual "unidentified developer" confirmation.
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');

exports.default = async function afterPack({ electronPlatformName, appOutDir, packager }) {
  if (electronPlatformName !== 'darwin') return;
  const app = join(appOutDir, `${packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
};
