const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function readBuffer(relPath) {
  return fs.readFileSync(path.join(root, relPath));
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

test("manifest describes a Zotero bootstrap extension", () => {
  const manifest = JSON.parse(read("src/manifest.json"));

  assert.equal(manifest.manifest_version, 2);
  assert.equal(manifest.name, "CloseFlow");
  assert.equal(manifest.icons["48"], "icon48.png");
  assert.equal(manifest.icons["96"], "icon96.png");
  assert.equal(manifest.applications.zotero.id, "zotero-close-to-tray@example.com");
  assert.equal(
    manifest.applications.zotero.update_url,
    "https://raw.githubusercontent.com/LoveTheStar7/Zotero-CloseFlow/main/update.json"
  );
  assert.equal(manifest.applications.zotero.strict_min_version, "6.999");
  assert.equal(manifest.applications.zotero.strict_max_version, "9.0.*");
  assert.equal(manifest.homepage_url, "https://github.com/LoveTheStar7/Zotero-CloseFlow");
  assert.ok(!Object.hasOwn(manifest, "bootstrap"));
});

test("update manifest points to the GitHub release asset", () => {
  const updates = JSON.parse(read("update.json"));
  const update =
    updates.addons["zotero-close-to-tray@example.com"].updates[0];

  assert.equal(update.version, "1.0.0");
  assert.equal(
    update.update_link,
    "https://github.com/LoveTheStar7/Zotero-CloseFlow/releases/download/v1.0.0/closeflow-1.0.0.xpi"
  );
  assert.match(update.update_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(update.applications.zotero.strict_min_version, "6.999");
  assert.equal(update.applications.zotero.strict_max_version, "9.0.*");
});

test("custom plugin icons exist while tray helper still uses the Zotero executable icon", () => {
  const svg = read("src/icon.svg");
  const icon32 = readBuffer("src/icon32.png");
  const icon48 = readBuffer("src/icon48.png");
  const icon96 = readBuffer("src/icon96.png");
  const bootstrap = read("src/bootstrap.js");

  assert.match(svg, /CloseFlow/);
  assert.match(svg, /<svg/);
  assert.deepEqual([...icon32.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.deepEqual([...icon48.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.deepEqual([...icon96.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.match(bootstrap, /ExtractAssociatedIcon\(\$TargetExe\)/);
});

test("bootstrap intercepts close and exposes a two-action prompt plus cancel semantics", () => {
  const bootstrap = read("src/bootstrap.js");

  assert.match(bootstrap, /startup\(\{\s*id,\s*version,\s*rootURI\s*\}\)/);
  assert.match(bootstrap, /onMainWindowLoad\(\{\s*window\s*\}\)/);
  assert.match(bootstrap, /onMainWindowUnload\(\{\s*window\s*\}\)/);
  assert.match(bootstrap, /addEventListener\("close",\s*closeEventHandler,\s*false\)/);
  assert.match(bootstrap, /win\.close = function/);
  assert.match(bootstrap, /event\.stopPropagation\(\)/);
  assert.match(bootstrap, /event\.preventDefault\(\)/);
  assert.match(bootstrap, /ACTION_CANCEL/);
  assert.match(bootstrap, /action === ACTION_CANCEL/);
  assert.match(bootstrap, /Zotero\.Utilities\.Internal\.quit\(\)/);
  assert.match(bootstrap, /rememberCloseAction/);
  assert.match(bootstrap, /prompt\.BUTTON_POS_0 \* prompt\.BUTTON_TITLE_IS_STRING/);
  assert.match(bootstrap, /prompt\.BUTTON_POS_1 \* prompt\.BUTTON_TITLE_IS_STRING/);
  assert.doesNotMatch(bootstrap, /BUTTON_POS_2/);
});

test("tray helper hides and restores Zotero through Win32 APIs", () => {
  const helper = read("src/tray-helper.ps1");

  assert.match(helper, /NotifyIcon/);
  assert.match(helper, /ExtractAssociatedIcon/);
  assert.match(helper, /\$TargetExe/);
  assert.match(helper, /ShowWindow/);
  assert.match(helper, /SetForegroundWindow/);
  assert.match(helper, /SW_HIDE/);
  assert.match(helper, /SW_RESTORE/);
});

test("tray close uses one-shot signal and avoids restoring the hidden window", () => {
  const bootstrap = read("src/bootstrap.js");
  const helper = read("src/tray-helper.ps1");

  assert.match(bootstrap, /allow-close\.flag/);
  assert.match(bootstrap, /consumeHelperCloseSignal/);
  assert.match(bootstrap, /quitApplication/);
  assert.match(bootstrap, /quit-request\.flag/);
  assert.match(bootstrap, /startQuitSignalWatcher/);
  assert.match(helper, /\$SignalDir/);
  assert.match(helper, /quit-request\.flag/);
  assert.doesNotMatch(
    helper,
    /\$closeAction[\s\S]*ShowWindow\(\$script:windowHandle,\s*\[ZoteroCloseToTrayWin32\]::SW_RESTORE\)/
  );
  assert.doesNotMatch(helper, /CloseMainWindow\(\)/);
  assert.doesNotMatch(helper, /WaitForExit/);
  assert.doesNotMatch(bootstrap, /WaitForExit/);
});

test("bootstrap launches PowerShell helper with explicit argv length", () => {
  const bootstrap = read("src/bootstrap.js");

  assert.match(bootstrap, /wscript\.exe/i);
  assert.match(bootstrap, /tray-launcher\.vbs/);
  assert.match(bootstrap, /const args = \[/);
  assert.match(bootstrap, /process\.run\(false,\s*args,\s*args\.length\)/);
});

test("bootstrap rewrites helper assets on startup so plugin upgrades refresh cached scripts", () => {
  const bootstrap = read("src/bootstrap.js");

  assert.match(bootstrap, /refreshHelperAssets/);
  assert.match(bootstrap, /writeStringToFile\(file,\s*TRAY_HELPER\)/);
  assert.match(bootstrap, /writeStringToFile\(launcher,\s*TRAY_LAUNCHER\)/);
});

test("preferences assets define a default ask state and three UI options", () => {
  const prefs = read("src/prefs.js");
  const pane = read("src/prefs.xhtml");

  assert.match(
    prefs,
    /pref\("extensions\.zoteroCloseToTray\.rememberCloseAction",\s*"ask"\)/
  );
  assert.match(pane, /rememberCloseAction/);
  assert.match(pane, /ask/);
  assert.match(pane, /tray/);
  assert.match(pane, /close/);
});

test("bootstrap registers and unregisters the Zotero preference pane", () => {
  const bootstrap = read("src/bootstrap.js");

  assert.match(bootstrap, /Zotero\.PreferencePanes\.register/);
  assert.match(bootstrap, /prefs\.xhtml/);
  assert.match(bootstrap, /label:\s*"CloseFlow"/);
  assert.match(bootstrap, /image:\s*"icon32\.png"/);
  assert.match(bootstrap, /unregisterPreferencePane/);
});

test("build script creates a zip first then publishes xpi", () => {
  const build = read("build.ps1");

  assert.match(build, /\$zipPackage/);
  assert.match(build, /closeflow-1\.0\.0\.xpi/);
  assert.match(build, /\$packageFiles/);
  assert.match(build, /manifest\.json/);
  assert.match(build, /bootstrap\.js/);
  assert.match(build, /prefs\.js/);
  assert.match(build, /prefs\.xhtml/);
  assert.match(build, /icon\.svg/);
  assert.match(build, /icon32\.png/);
  assert.match(build, /icon48\.png/);
  assert.match(build, /icon96\.png/);
  assert.match(build, /Compress-Archive[\s\S]+DestinationPath \$zipPackage/);
  assert.match(build, /Move-Item[\s\S]+Destination \$package/);
});
