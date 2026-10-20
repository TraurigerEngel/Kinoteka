> **Статус на 2026-10-19 (Hotfix 44):** разделы ниже фиксируют историю разработки Preview 1. Описанный в старых пунктах онлайн-поиск TMDB уже удалён из рабочего интерфейса и не требует API-токена. В текущей сборке есть только локальный поиск по коллекции и импорт Letterboxd; исторические TMDB-ID могут использоваться без сети для безопасного сопоставления. Вкладка «Мои списки» временно скрыта, данные списков сохранены. Текущее руководство — `START-HERE.txt`.

### Hotfix 39 — Windows taskbar & particles

- Windows: apply a 2-physical-pixel bottom inset to the maximized frameless window only when a bottom auto-hide taskbar is detected on its monitor; restore after focus/resize if Windows resets it. Do not change original Tauri window configuration or startup sequences.
- Background: prevent long streaks spanning the canvas when a moving particle wraps to the opposite screen edge; keep regular short trails, particle count, colors, and animation.
- No changes to the user's database, posters, ratings or card layout.

### Hotfix 38 — Visual polish

- Subtle transparency on empty-poster surfaces only; real poster images and overlay controls stay sharp.
- In card mode, selecting one card gently dims other cards until Esc or another selection; no movement.
- Table/Cards view switch now matches the category filter buttons.
- No library-data or storage change.

### Hotfix 35 — Selected Card Polish (2026-10-18)
- One neutral cyan selection outline, independent of film rating; calm hover glow and whole-card lift.
- No second poster highlight. The small "+" score chooser remains unchanged, with its 1–10 and viewing-status actions.
- No personal data, poster files, SQLite changes or grid changes.

### Hotfix 34 — Single Card Highlight & Full Titles (2026-10-18)
- One active outer card border; no doubled poster border on hover/selection.
- Three uniform lines per title; full names appear on title hover/keyboard card focus when truncated.
- No changes to user database, poster contents, card count, or table.
- Confirmed self-hosted Inter (Regular/Medium/SemiBold/Bold); automated local-font asset checks added, with no external font source.

## Hotfix 30 — Unified Poster Status & Native Clipboard (2026-10-18)

- Card badge at bottom-right opens one menu for **1–10 / Смотрю / Запланировано**. Planned/watching appear directly on poster as colored compact labels; the duplicated status select under cards is gone.
- Favorite stars are hidden when selecting one is impossible due to low numeric score or incompatible status; existing favorites are never silently removed.
- Numeric values persist when switching to pending states but are temporarily hidden behind the current status label; favorites require confirmation before removal.
- Native Windows clipboard insertion through a new Tauri command; no WebView2 browser clipboard permission prompt. Ctrl+V remains a fallback when necessary.
- Titles/categories, 6-column grid, 24 cards/page, table, personal SQLite and posters unchanged. Synthetic QA and Chromium layout checks passed; native Windows build pending.

**Hotfix 26 — Offline Catalogue Removal & Card Surface Polish:** IMDb offline catalog removed from current app and build tooling. Letterboxd import, lists, manual posters and existing personal SQLite remain. Read `HOTFIX26-README.txt`. Historical descriptions below refer to previous releases.

Hotfix 25: Card View Visual Cleanup — softer poster contours/hover, quieter manual-poster overlay, compact year/stars, subtler category, retained colored statuses, aligned two-line headings. Approved top view toggle stays beside filters. No database or catalog changes.

Hotfix 24: View toggle moved beside category tabs; card titles slightly more legible; category badges calmer; pagination independent. No data changes.

### Hotfix 18 — Commons Poster Search Improvements
- Явное различение сетевых ошибок / отсутствия изображения / неподходящих свободных лицензий.
- Список до 6 найденных свободно лицензированных P18-изображений с выбором в предпросмотре, без автоматического сохранения.
- 24-часовая отрицательная память автопоиска, ручной поиск без ограничения. Постеры и IMDb-каталог пользовательского экземпляра не включены в патч.

### Hotfix 16: Offline Posters Foundation
Поддержка локального выбора, отображения и удаления JPG, PNG, WebP (до 5 МБ) в режиме карточек. Отдельная папка `posters/`, без обращения к интернету, встроенного каталога изображений или личных данных в архиве. Данные IMDb-каталога и SQLite не меняются.

# Kinoteka v1.2 Preview 1 — Library Integration (2026-10-17)

## New

- Letterboxd official ZIP/CSV import: watched, ratings, diary, reviews,
  watchlist, and `lists/*.csv`. Local extraction with ZIP CRC32 verification,
  bounded uncompressed sizes and RFC4180-style CSV parsing.
- Pre-import preview: additions, exact title/year matches, entries in Trash,
  imported lists; no changes made until the user confirms.
- One `persist_movies_state` commit and built-in SQLite backup on confirmation.
  Existing ratings, favorites, Trash and UI preferences are not overwritten.
  A repeated import does not duplicate exact-matching films.
- Full Letterboxd film-specific metadata retained as extension data in the
  version 1 state JSON (`state.letterboxd`): original numeric ratings, diary,
  review text, tags, dates, links and list membership. Imported lists browsable.
- TMDB opt-in search (Russian localization) with poster, synopsis and
  single-click addition as planned. Adds `state.catalog` metadata; API token
  stays in memory, not in the database.
- Cinema Mono-style 3-tab 'Импорт и каталог' dialog; no prior UI removed.

## Compatibility and limitations

- v1.1 Stable canonical data unchanged; same product identifier, SQLite
  path, Tauri runtime and WebView2 UI. Builds use new version 1.2.0-preview.1.
- Existing v1.1 Portable EXE is not patchable using the source Overlay.
  Build a new v1.2 EXE with `BUILD-DEV.cmd` on Windows.
- Hotfix 5 adds controlled fuzzy matching (review only), stored manual links, and
  verified local TMDB metadata aliases/IDs when available. Letterboxd CSV has no
  universal TMDB ID; Russian/English cross-language mapping may still require
  manual confirmation. The app never silently merges on a fuzzy score.
- Extended metadata remains in SQLite and is not yet shown in main film cards.
- Profile, likes, comments, deleted material and other nonmovie exports
  intentionally not ingested; the word 'full' refers to supported active lists.
- Live TMDB search could not be end-to-end verified without a user's token
  and Windows WebView2; Windows executable could not be compiled here.

## Verification

`npm run verify` runs legacy v1.1 regression checks (adapted to this preview)
plus new ZIP/CSV parser and bridge atomic-merge tests. Canonical data checksum
and original record/favorite counts are checked. Tests use synthetic data only.

## Hotfix 1 — Windows verification paths (2026-10-17)

The remote-URL safety check now compares Windows and POSIX asset paths consistently. The strict runtime endpoint allowlist remains active. No runtime, data, or package version changes.
To update an unpacked Preview 1, extract the Hotfix 1 patch over the project root, then run `npm run verify` and `./BUILD-DEV.cmd` on Windows.

## Hotfix 3 — Letterboxd v7 list export and excluded folders (2026-10-17)

- Recognize Letterboxd `lists/*.csv` two-section v7 exports: version marker,
  Date/Name/Tags/URL/Description metadata, followed by Position/Name/Year/URL/Description films.
  Preserve the real UTF-8 list title, date, link, description and tags, and
  present its films in original position order. Legacy one-table CSV lists remain supported.
- Exclude root and nested `deleted/`, `orphaned/`, `likes/` folders from the active
  import candidate list, including `deleted/diary.csv` and `orphaned/reviews.csv`.
- Added regression test with actual user's reported export structure (synthetic film data).
- No changes to SQLite seed, existing state payloads, Tauri config, Rust dependencies,
  release identifier or original UI. Upgrade test version by rebuilding with `BUILD-DEV.cmd`.

## Hotfix 5 — Smart Duplicate Review (2026-10-18)

- Preview separates exact matches, possible duplicates, Trash matches and new records.
  Suspected same-year/similar-title records block SQLite confirmation until reviewed.
- The user can link to an existing local entry (including Russian titles), approve
  an independent new entry, or skip. Optional on-demand TMDB suggestions use the
  user's token; no batch search or automatic merge from a suggestion.
- Existing TMDB identifiers and saved original/localized aliases can provide a
  trusted single-match link; no ID is fabricated for Letterboxd exports.
- Approved manual links and skips remain stable on reimport; Letterboxd lists
  point to the actual selected local entry, preserving order.
- Trash and existing status/favorites are not overwritten. SQLite writes retain
  the existing atomic backup-before-commit behavior.
- The canonical live/seed SQLite and build toolchain stay unchanged. Windows
  EXE still needs a local `BUILD-DEV.cmd` and real-user verification.

## Hotfix 6 — Duplicate Matching Improvements

- Auto-match only when canonical title after punctuation/case normalization, year and compatible type identify exactly one active entry; ambiguity with Trash or category changes is not auto-linked. Known TMDB IDs continue to use media-type validation. Letterboxd ZIP does not supply TMDB identifiers by default.
- Side-by-side comparisons show the source and local row with metadata, and a separate tab allows auditing automatic matches. Search results switch the compared local row without linking until explicitly approved.
- Selected unique cross-category exact-title/year candidates can be linked as a group **only** after ticking individual checkboxes and approving the batch confirmation. This changes the pending plan, not the SQLite database.
- Pre-save block for unresolved review is retained; existing SQLite and Tauri configuration unchanged. Install after Hotfix 5 in the same source folder; run `npm run verify`, `BUILD-DEV.cmd`, and launch the refreshed Portable DEV EXE.


### Hotfix 14 — IMDb Catalog Import & Update
См. `HOTFIX14-README.txt`. Обновление без пересборки EXE, проверка целостности перед заменой, резервная копия прежнего каталога.


## Hotfix 17 — Commons Posters (opt-in)

- Карточки получили кнопку «Commons ↗»: запрос только по IMDb ID (Wikidata P345/P18), затем проверка файла и лицензии в Wikimedia Commons. Без TMDB и ключей.
- После загрузки показывается предварительный просмотр; изображение не назначается до подтверждения. Commons может не содержать киноафишу или изображение вообще.
- На панели коллекции есть необязательный флажок «Автопоиск обложки»: **по умолчанию выключен**. При включении после добавления одной новой записи с IMDb ID выполняется только один поиск, с таким же подтверждением.
- Разрешены только JPG/PNG/WebP до 5 МБ с подтверждёнными CC0, CC BY или CC BY-SA. Иные лицензии игнорируются. Описание автора, лицензия и адрес исходного файла сохраняются рядом с постером (файл `posters/*.credit.json`), а не в `kinoteka.sqlite3`.
- Постеры, установленные вручную, не перезаписываются без подтверждения. Без сети можно пользоваться уже сохранёнными изображениями и ручным выбором файла.
- Проверено: `npm run verify`, `COMMONS POSTERS QA: PASS` с подставными сетевыми ответами. **Не проверено**: реальные ответы Wikidata/Commons и сборка Windows EXE; проверь на Windows.
- Не распространять каталог IMDb, личную SQLite и папку `posters/` внутри патчей.


Hotfix 42 — Import Review UX Polish (preview; pending Windows confirmation)
- Wider review dialog, lighter nested separators, four visible summary counters; the imported-list counter remains available internally.
- Unresolved matches now appear as compact rows with title, year and proposed type; expand any row for full Letterboxd/Kinoteka comparison and explicit decisions. Secondary candidates and manual search expand independently inside a row.
- Film/series/animation type chips explicitly flag mismatches between Letterboxd and Kinoteka, without changing matching rules.
- Commit/help footer remains accessible at the bottom; the importer still blocks saving until all ambiguous matches are resolved.
- No changes to SQLite, matching policy, Letterboxd source data, or already-imported lists.


Hotfix 43 — Import Review Refinement (preview; pending Windows verification)
- Condensed comparison rows and moved Add separately / Skip / Reset above the optional additional candidates list.
- Do not repeat “Letterboxd type: Not specified” when the export lacks media-type metadata; never infer a type mismatch from missing data. Genuine film vs series mismatches remain highlighted.
- Preserves review page and list position after a single decision, avoiding repeated jumps to the first of 92 unresolved matches. Explicit page/filter/search changes still begin at the top.
- No changes to Letterboxd matching rules, approval requirements, SQLite, or imported rating/status semantics.
