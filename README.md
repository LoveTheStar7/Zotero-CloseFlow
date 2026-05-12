# CloseFlow

Windows-only Zotero plugin that controls whether Zotero closes or flows into the system tray.

## Install

1. Open Zotero.
2. Go to `Tools` -> `Add-ons`.
3. Click the gear icon and choose `Install Add-on From File`.
4. Select `dist/closeflow-1.0.0.xpi`.
5. Restart Zotero if prompted.

## Behavior

When you click the main window close button:

- Choose `最小化到系统托盘` to hide Zotero and show a tray icon.
- Choose `关闭 Zotero` to let Zotero quit normally.
- Check `记住本次操作` to reuse the same choice on future close-button clicks.

When Zotero is in the tray:

- Double-click the tray icon to restore Zotero.
- Right-click the tray icon and choose `恢复 Zotero` to restore it.
- Right-click the tray icon and choose `关闭 Zotero` to request a normal Zotero shutdown.

## Change Default Close Behavior

Open Zotero settings, switch to the `CloseFlow` preferences pane, and choose one of:

- `每次询问`
- `默认最小化到系统托盘`
- `默认关闭 Zotero`

The selector updates:

```text
extensions.zoteroCloseToTray.rememberCloseAction
```

Set it to `ask` if you want the close-choice dialog to appear again.

## Build

```powershell
npm test
npm run build
```

The importable plugin is generated at:

```text
dist/closeflow-1.0.0.xpi
```
