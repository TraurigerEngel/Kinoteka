# Kinoteka Standalone v1.1 Stable

**Release source prepared: 2026-10-09.** Promote **Startup & Titlebar Preview 1 Hotfix 6 — Early Centered Titlebar**, restored after user rejection of experimental Hotfix 7. This release contains **no Hotfix 7 hidden-window / delayed native reveal**.

## Changes since v1.0 Stable
- New 42px frameless top bar with an early centered `Кинотека` caption and custom 46x42px SVG minimize/close buttons.
- First-paint splash and two-stage, approximately 1.73-second startup handoff inspired by Software Hub.
- Visible + maximized + centered Tauri window without later native show/maximize; non-resizable border to suppress misleading resize cursor.
- Early titlebar styling to reduce button flicker, preserving Chromium hover behavior and original UI theme.

## Limits of the accepted Hotfix 6
- A short Windows/WebView2 native black frame may still precede the first HTML paint. **This is accepted from Hotfix 6; no claim of fixing it.**
- Hotfix 7 was rejected and was rolled back. Its first-frame synchronization and `window_ready` IPC are absent.

## Canonical data (unchanged)
- [количество удалено] items; [скрыто] favorites; 0 trash; revision [скрыта].
- Identical live/seed `kinoteka.sqlite3` SHA-256:
  `(redacted — historical user DB)`
- SQLite schema, persistence, recovery, backups, and single-instance identity preserved.

## Metadata and distribution
- Package / Cargo / Tauri version: `1.1.0`.
- Stable identifier: `com.lostheaven.kinoteka`.
- Output: `Kinoteka_Standalone_v1.1_Stable_Portable.zip` and `_Source.zip`.
- The clean runtime allowlist remains exactly 3 files.
- Windows Release build and runtime smoke test **must be performed on Windows before declaring an official final release**.
