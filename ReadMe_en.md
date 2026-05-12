# CloseFlow

CloseFlow is a Windows-only Zotero plugin that controls what happens when you click the close button on Zotero's main window: minimize Zotero to the system tray or quit Zotero normally.

## Features

- Shows a choice dialog when the Zotero main window close button is clicked.
- Supports `Minimize to system tray` and `Close Zotero`.
- Supports `Remember this action` for future close-button clicks.
- Adds a Zotero settings pane for changing the default close behavior later.
- Keeps using Zotero's own application icon for the Windows tray icon.
- Provides tray menu actions to restore Zotero or close Zotero.

## Installation

1. Open Zotero.
2. Go to `Tools` -> `Add-ons`.
3. Click the gear button and choose `Install Add-on From File`.
4. Select `dist/closeflow-1.0.0.xpi`.
5. Restart Zotero if prompted.

## Usage

When you click the close button on Zotero's main window:

- Choose `Minimize to system tray` to hide the main window and show Zotero in the Windows system tray.
- Choose `Close Zotero` to quit Zotero normally.
- Check `Remember this action` to reuse the same choice for future close-button clicks.

When Zotero is in the system tray:

- Double-click the tray icon to restore Zotero.
- Right-click the tray icon and choose `Restore Zotero` to restore the main window.
- Right-click the tray icon and choose `Close Zotero` to quit Zotero normally.

## Change the Default Close Behavior

Open Zotero settings, switch to the `CloseFlow` preferences pane, and choose one of:

- `Ask every time`
- `Minimize to system tray by default`
- `Close Zotero by default`

The setting is stored in:

```text
extensions.zoteroCloseToTray.rememberCloseAction
```

Set it to `ask`, or choose `Ask every time` in the settings pane, if you want the close-choice dialog to appear again.

## Build

```powershell
npm test
npm run build
```

The importable Zotero add-on is generated at:

```text
dist/closeflow-1.0.0.xpi
```
