# CloseFlow

CloseFlow 是一个 Windows 专用的 Zotero 插件，用于控制点击 Zotero 主窗口右上角关闭按钮时的行为：最小化到系统托盘，或正常关闭 Zotero。

## 功能

- 点击 Zotero 主窗口关闭按钮时弹出选择框。
- 可选择 `最小化到系统托盘` 或 `关闭 Zotero`。
- 可勾选 `记住本次操作`，以后自动执行同一操作。
- 可在 Zotero 设置界面重新修改默认关闭行为。
- 最小化到系统托盘后，托盘图标继续使用 Zotero 本体图标。
- 托盘右键菜单支持恢复 Zotero 或关闭 Zotero。

## 安装

1. 打开 Zotero。
2. 进入 `工具` -> `插件`。
3. 点击齿轮按钮，选择 `Install Add-on From File`。
4. 选择 `dist/closeflow-1.0.0.xpi`。
5. 如 Zotero 提示重启，请重启 Zotero。

## 使用

点击 Zotero 主窗口右上角关闭按钮时：

- 选择 `最小化到系统托盘`：隐藏 Zotero 主窗口，并在系统托盘显示 Zotero 图标。
- 选择 `关闭 Zotero`：正常退出 Zotero。
- 勾选 `记住本次操作`：以后点击关闭按钮时自动执行本次选择。

当 Zotero 位于系统托盘中时：

- 双击托盘图标可恢复 Zotero。
- 右键托盘图标，选择 `恢复 Zotero` 可恢复主窗口。
- 右键托盘图标，选择 `关闭 Zotero` 可正常退出 Zotero。

## 修改默认关闭行为

打开 Zotero 设置，进入 `CloseFlow` 设置页，可选择：

- `每次询问`
- `默认最小化到系统托盘`
- `默认关闭 Zotero`

该设置对应的偏好项为：

```text
extensions.zoteroCloseToTray.rememberCloseAction
```

如果想恢复每次点击关闭按钮时都弹出选择框，请设置为 `ask` 或在设置页选择 `每次询问`。

## 构建

```powershell
npm test
npm run build
```

构建完成后，可导入 Zotero 的插件文件位于：

```text
dist/closeflow-1.0.0.xpi
```
