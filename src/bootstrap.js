/* global Components, Services, Zotero */

const PREF_BRANCH = "extensions.zoteroCloseToTray.";
const PREF_REMEMBER_CLOSE_ACTION = "rememberCloseAction";
const HELPER_CLOSE_SIGNAL = "allow-close.flag";
const HELPER_QUIT_REQUEST = "quit-request.flag";
const TRAY_LAUNCHER = String.raw`Set shell = CreateObject("WScript.Shell")
command = """" & WScript.Arguments(0) & """ -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & WScript.Arguments(1) & """ -TargetPid " & WScript.Arguments(2) & " -SignalDir """ & WScript.Arguments(3) & """ -TargetExe """ & WScript.Arguments(4) & """"
shell.Run command, 0, False
`;
const ACTION_ASK = "ask";
const ACTION_TRAY = "tray";
const ACTION_CLOSE = "close";
const ACTION_CANCEL = "cancel";

const TRAY_HELPER = String.raw`param(
    [Parameter(Mandatory = $true)]
    [int]$TargetPid,

    [Parameter(Mandatory = $true)]
    [string]$SignalDir,

    [Parameter(Mandatory = $true)]
    [string]$TargetExe
)

$ErrorActionPreference = "SilentlyContinue"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class ZoteroCloseToTrayWin32 {
    public const int SW_HIDE = 0;
    public const int SW_RESTORE = 9;

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

function New-UnicodeText {
    param([int[]]$Codes)
    return -join ($Codes | ForEach-Object { [char]$_ })
}

function Get-ZoteroProcess {
    try {
        return Get-Process -Id $TargetPid -ErrorAction Stop
    } catch {
        return $null
    }
}

function Get-ZoteroWindowHandle {
    $process = Get-ZoteroProcess
    if ($null -eq $process) {
        return [IntPtr]::Zero
    }

    for ($i = 0; $i -lt 20; $i++) {
        $process.Refresh()
        if ($process.MainWindowHandle -ne [IntPtr]::Zero) {
            return $process.MainWindowHandle
        }
        Start-Sleep -Milliseconds 100
    }

    return [IntPtr]::Zero
}

$script:process = Get-ZoteroProcess
if ($null -eq $script:process) {
    exit 0
}

$script:windowHandle = Get-ZoteroWindowHandle
if ($script:windowHandle -eq [IntPtr]::Zero) {
    exit 0
}

[ZoteroCloseToTrayWin32]::ShowWindow($script:windowHandle, [ZoteroCloseToTrayWin32]::SW_HIDE) | Out-Null

$script:notifyIcon = New-Object System.Windows.Forms.NotifyIcon
if (Test-Path -LiteralPath $TargetExe) {
    $script:notifyIcon.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon($TargetExe)
} else {
    $script:notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
}
$script:notifyIcon.Text = "Zotero " + (New-UnicodeText @(0x6B63, 0x5728, 0x540E, 0x53F0, 0x8FD0, 0x884C))
$script:notifyIcon.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$restoreItem = $menu.Items.Add((New-UnicodeText @(0x6062, 0x590D)) + " Zotero")
$closeItem = $menu.Items.Add((New-UnicodeText @(0x5173, 0x95ED)) + " Zotero")
$script:notifyIcon.ContextMenuStrip = $menu

$restoreAction = {
    $process = Get-ZoteroProcess
    if ($null -ne $process) {
        [ZoteroCloseToTrayWin32]::ShowWindow($script:windowHandle, [ZoteroCloseToTrayWin32]::SW_RESTORE) | Out-Null
        [ZoteroCloseToTrayWin32]::SetForegroundWindow($script:windowHandle) | Out-Null
    }
    $script:notifyIcon.Visible = $false
    [System.Windows.Forms.Application]::Exit()
}

$closeAction = {
    New-Item -ItemType Directory -Force -Path $SignalDir | Out-Null
    New-Item -ItemType File -Force -Path (Join-Path $SignalDir "quit-request.flag") | Out-Null
    $script:notifyIcon.Visible = $false
    [System.Windows.Forms.Application]::Exit()
}

$script:notifyIcon.add_DoubleClick($restoreAction)
$restoreItem.add_Click($restoreAction)
$closeItem.add_Click($closeAction)

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1000
$timer.add_Tick({
    $process = Get-ZoteroProcess
    if ($null -eq $process -or $process.HasExited) {
        $script:notifyIcon.Visible = $false
        [System.Windows.Forms.Application]::Exit()
    }
})
$timer.Start()

[System.Windows.Forms.Application]::Run()
$script:notifyIcon.Dispose()
`;

var closeToTray = {
  id: null,
  version: null,
  rootURI: null,
  helperFile: null,
  launcherFile: null,
  lockedWindows: new Map(),
  allowNextClose: new WeakSet(),
  isActuallyQuitting: false,
  quitSignalTimer: null,
  preferencePaneId: null,

  init({ id, version, rootURI }) {
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.refreshHelperAssets();
    this.registerPreferencePane();
    this.addToAllWindows();
    this.startQuitSignalWatcher();
  },

  shutdown() {
    this.removeFromAllWindows();
    this.lockedWindows = new Map();
    this.allowNextClose = new WeakSet();
    this.isActuallyQuitting = false;
    this.unregisterPreferencePane();
    if (this.quitSignalTimer) {
      this.quitSignalTimer.cancel();
      this.quitSignalTimer = null;
    }
  },

  registerPreferencePane() {
    if (this.preferencePaneId) {
      return;
    }

    this.preferencePaneId = Zotero.PreferencePanes.register({
      pluginID: this.id,
      src: "prefs.xhtml",
      label: "CloseFlow",
      image: "icon32.png",
    });
  },

  unregisterPreferencePane() {
    if (!this.preferencePaneId) {
      return;
    }

    Zotero.PreferencePanes.unregister(this.preferencePaneId);
    this.preferencePaneId = null;
  },

  addToAllWindows() {
    const windows = Zotero.getMainWindows();
    for (const win of windows) {
      if (!win.ZoteroPane) {
        continue;
      }
      this.addToWindow(win);
    }
  },

  removeFromAllWindows() {
    const windows = Zotero.getMainWindows();
    for (const win of windows) {
      if (!win.ZoteroPane) {
        continue;
      }
      this.removeFromWindow(win);
    }
  },

  addToWindow(win) {
    if (!win?.ZoteroPane || this.lockedWindows.has(win)) {
      return;
    }

    const originalClose = win.close;
    const closeEventHandler = (event) => {
      if (this.isActuallyQuitting) {
        return;
      }
      if (this.consumeAllowedClose(win)) {
        return;
      }

      const action = this.resolveCloseAction(win);
      if (action === ACTION_CANCEL) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (action === ACTION_CLOSE) {
        this.quitApplication();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      this.minimizeToTray(win);
    };

    win.close = function () {
      if (closeToTray.isActuallyQuitting) {
        originalClose.call(this);
        return;
      }
      if (closeToTray.consumeAllowedClose(win)) {
        originalClose.call(this);
        return;
      }

      const action = closeToTray.resolveCloseAction(win);
      if (action === ACTION_CANCEL) {
        return;
      }
      if (action === ACTION_CLOSE) {
        closeToTray.quitApplication();
        return;
      }

      closeToTray.minimizeToTray(win);
    };

    win.addEventListener("close", closeEventHandler, false);
    this.lockedWindows.set(win, { closeEventHandler, originalClose });
  },

  removeFromWindow(win) {
    if (!win || !this.lockedWindows.has(win)) {
      return;
    }

    const { closeEventHandler, originalClose } = this.lockedWindows.get(win);
    try {
      win.removeEventListener("close", closeEventHandler, false);
      win.close = originalClose;
      this.lockedWindows.delete(win);
    } catch (error) {
      // Window may already be half-destroyed.
    }
  },

  resolveCloseAction(win) {
    if (this.consumeHelperCloseSignal()) {
      return ACTION_CLOSE;
    }
    const action = this.getRememberedAction();
    if (action === ACTION_CLOSE) {
      return ACTION_CLOSE;
    }
    if (action === ACTION_TRAY) {
      return ACTION_TRAY;
    }
    return this.promptForCloseAction(win);
  },

  beginActualQuit(win) {
    this.isActuallyQuitting = true;
    this.allowCloseOnce(win);

    const lock = this.lockedWindows.get(win);
    if (lock) {
      try {
        win.removeEventListener("close", lock.closeEventHandler, false);
        win.close = lock.originalClose;
      } catch (error) {
        // If cleanup fails, the one-shot allow flag still avoids re-interception.
      }
    }

    win.close();
  },

  quitApplication() {
    this.isActuallyQuitting = true;
    Zotero.Utilities.Internal.quit();
  },

  startQuitSignalWatcher() {
    if (this.quitSignalTimer) {
      return;
    }

    this.quitSignalTimer = Components.classes["@mozilla.org/timer;1"].createInstance(
      Components.interfaces.nsITimer
    );
    this.quitSignalTimer.initWithCallback(
      () => {
        if (this.consumeQuitRequestSignal()) {
          this.quitApplication();
        }
      },
      500,
      Components.interfaces.nsITimer.TYPE_REPEATING_SLACK
    );
  },

  consumeQuitRequestSignal() {
    const flag = this.getHelperDirectory();
    flag.append(HELPER_QUIT_REQUEST);
    if (!flag.exists()) {
      return false;
    }
    try {
      flag.remove(false);
    } catch (error) {
      // Best-effort cleanup only.
    }
    return true;
  },

  allowCloseOnce(win) {
    this.allowNextClose.add(win);
  },

  consumeAllowedClose(win) {
    if (!this.allowNextClose.has(win)) {
      return false;
    }

    this.allowNextClose.delete(win);
    return true;
  },

  promptForCloseAction(win) {
    const prompt = Services.prompt;
    const remember = { value: false };
    const flags =
      prompt.BUTTON_POS_0 * prompt.BUTTON_TITLE_IS_STRING +
      prompt.BUTTON_POS_1 * prompt.BUTTON_TITLE_IS_STRING;

    const result = prompt.confirmEx(
      win,
      "关闭 Zotero",
      "你想将 Zotero 最小化到系统托盘，还是直接关闭 Zotero？",
      flags,
      "最小化到系统托盘",
      "关闭 Zotero",
      null,
      "记住本次操作",
      remember
    );

    const action = result === 0 ? ACTION_TRAY : result === 1 ? ACTION_CLOSE : ACTION_CANCEL;
    if (remember.value && action !== ACTION_CANCEL) {
      this.setRememberedAction(action);
    }

    return action;
  },

  getRememberedAction() {
    try {
      const value = Services.prefs
        .getBranch(PREF_BRANCH)
        .getStringPref(PREF_REMEMBER_CLOSE_ACTION, ACTION_ASK);
      return [ACTION_ASK, ACTION_TRAY, ACTION_CLOSE].includes(value) ? value : ACTION_ASK;
    } catch (error) {
      return ACTION_ASK;
    }
  },

  setRememberedAction(action) {
    Services.prefs.getBranch(PREF_BRANCH).setStringPref(PREF_REMEMBER_CLOSE_ACTION, action);
  },

  minimizeToTray(win) {
    this.ensureHelperFile();

    if (!this.helperFile || !this.helperFile.exists()) {
      win.minimize();
      return;
    }

    const powershell = this.getPowerShellFile();
    const launcher = this.getWindowsScriptHostFile();
    if (!powershell || !powershell.exists() || !launcher || !launcher.exists()) {
      win.minimize();
      return;
    }

    const process = Components.classes["@mozilla.org/process/util;1"].createInstance(
      Components.interfaces.nsIProcess
    );
    process.init(launcher);
    const args = [
      this.launcherFile.path,
      powershell.path,
      this.helperFile.path,
      String(Services.appinfo.processID),
      this.getHelperDirectory().path,
      this.getApplicationExecutablePath(),
    ];
    process.run(false, args, args.length);
  },

  ensureHelperFile() {
    if (this.helperFile && this.helperFile.exists() && this.launcherFile && this.launcherFile.exists()) {
      return;
    }
    this.refreshHelperAssets();
  },

  refreshHelperAssets() {
    const dir = this.getHelperDirectory();
    if (!dir.exists()) {
      dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o700);
    }

    const file = dir.clone();
    file.append("tray-helper.ps1");
    this.writeStringToFile(file, TRAY_HELPER);
    this.helperFile = file;

    const launcher = dir.clone();
    launcher.append("tray-launcher.vbs");
    this.writeStringToFile(launcher, TRAY_LAUNCHER);
    this.launcherFile = launcher;
  },

  consumeHelperCloseSignal() {
    const flag = this.getHelperDirectory();
    flag.append(HELPER_CLOSE_SIGNAL);
    if (!flag.exists()) {
      return false;
    }

    try {
      flag.remove(false);
    } catch (error) {
      // If cleanup fails, still allow this one close request from the tray menu.
    }
    return true;
  },

  getHelperDirectory() {
    const dir = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
    dir.append("zotero-close-to-tray");
    return dir;
  },

  writeStringToFile(file, contents) {
    const stream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(
      Components.interfaces.nsIFileOutputStream
    );
    stream.init(file, 0x02 | 0x08 | 0x20, 0o600, 0);

    const converter = Components.classes[
      "@mozilla.org/intl/converter-output-stream;1"
    ].createInstance(Components.interfaces.nsIConverterOutputStream);
    converter.init(stream, "UTF-8");
    converter.writeString(contents);
    converter.close();
  },

  getPowerShellFile() {
    if (Services.appinfo.OS !== "WINNT") {
      return null;
    }

    const file = Components.classes["@mozilla.org/file/local;1"].createInstance(
      Components.interfaces.nsIFile
    );
    file.initWithPath("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe");
    return file;
  },

  getWindowsScriptHostFile() {
    if (Services.appinfo.OS !== "WINNT") {
      return null;
    }

    const file = Components.classes["@mozilla.org/file/local;1"].createInstance(
      Components.interfaces.nsIFile
    );
    file.initWithPath("C:\\Windows\\System32\\wscript.exe");
    return file;
  },

  getApplicationExecutablePath() {
    try {
      return Services.dirsvc.get("XREExeF", Components.interfaces.nsIFile).path;
    } catch (error) {
      return "";
    }
  },
};

function install() {}

function uninstall() {}

function startup({ id, version, rootURI }) {
  closeToTray.init({ id, version, rootURI });
}

function onMainWindowLoad({ window }) {
  closeToTray.addToWindow(window);
}

function onMainWindowUnload({ window }) {
  closeToTray.removeFromWindow(window);
}

function shutdown() {
  closeToTray.shutdown();
}
