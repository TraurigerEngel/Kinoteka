# v1.1 Stable release checklist

1. Extract full source ZIP into a NEW folder (do not replace v1.0 Stable or the accepted Hotfix 6 Portable).
2. Verify Node >=22.13, Windows Rust, Tauri CLI dependencies. Close all running Kinoteka processes.
3. Run `npm ci` and `npm run verify`. Do not migrate or freeze canonical data.
4. Run `./MAKE-FINAL-RELEASE.cmd` (Windows PowerShell 5.1 is supported); this invokes its own locked install and release build.
5. Require `BUILD-RELEASE` / portable verification / re-extracted ZIP verification PASS and read `Artifacts/SHA256SUMS.txt`.
6. Extract the new Portable ZIP into a separate, empty folder. Verify the three runtime files and run the EXE.
7. On Windows, check early centered title, 42px topbar, SVG controls (hover/minimize/close), 1.73s startup handoff, absence of window jumps or edge-resize cursor, plus live library display and persistence on isolated **test** copy.
8. User accepts the observed short pre-WebView black native frame from Hotfix 6; do NOT add rejected Hotfix 7's hidden-window strategy.
9. Only after Windows runtime review, promote v1.1 Stable as final. Leave v1.0 Stable untouched.

**Safety:** `MAKE-FINAL-RELEASE` and `BUILD-RELEASE` refuse to overwrite existing current-version output folders, especially any portable `data/kinoteka.sqlite3`. Use a fresh release-source folder for another build. The distribution uses the frozen canonical data, SHA-256 `(redacted — historical user DB)`.
