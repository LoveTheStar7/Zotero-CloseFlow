param(
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
