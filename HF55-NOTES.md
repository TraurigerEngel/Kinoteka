# Kinoteka v1.2 Stable HF55 — Sorting Dropdown Polish

Small, visual-only polish over HF54. The 14 sorting modes, sorting persistence,
search, filters, local SQLite, poster paths, and taskbar/window geometry are unchanged.

- Give the sorter its own themed-select kind (`sort`), leaving rating/category menus untouched.
- Compact 29 px rows, max 258 px menu height, dark 5 px scrollbar and subtle violet selection.
- Keep keyboard/listbox accessibility, focus management, Escape/Tab behavior, and reduced-motion handling.
- No new runtime dependencies, network calls, or SQLite migrations.

The installer builds locally using existing npm and Cargo caches, backs up all changed
source files and available EXEs, verifies the release with clean canonical SQLite,
and prepares a separate HF55 portable ZIP. Rollback returns to HF54.
