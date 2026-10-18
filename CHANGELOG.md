## Hotfix 41 — Import Modal Polish / Hide Lists

Import Letterboxd modal now uses Kinoteka neutral chrome; retired visible My Lists tab only, keeping data and import engine intact.

## Hotfix 40 — Tooltip Policy (2026-10-18)
- Native tooltips are available only on the seven top summary/status counters.
- Full title hint remains on card names in Card view (the existing styled popup is used for clamped names).
- Removed duplicate/native hints from year, category, rating, favorite, titlebar and table/cards view controls, retaining aria-labels.
- No changes to database, library operations, layout or poster storage.

## Hotfix 39 — Windows Auto-Hide Taskbar & Particle Edge Wrap

- Windows: apply a 2-physical-pixel bottom inset to the maximized frameless window only when a bottom auto-hide taskbar is detected on its monitor; restore after focus/resize if Windows resets it. Do not change original Tauri window configuration or startup sequences.
- Background: prevent long streaks spanning the canvas when a moving particle wraps to the opposite screen edge; keep regular short trails, particle count, colors, and animation.
- No changes to the user's database, posters, ratings or card layout.

## Hotfix 38 — Soft Poster Glass & Selection Focus

- Subtle transparency on empty-poster surfaces only; real poster images and overlay controls stay sharp.
- In card mode, selecting one card gently dims other cards until Esc or another selection; no movement.
- Table/Cards view switch now matches the category filter buttons.
- No library-data or storage change.

## Hotfix 37 — Escape Deselection & Stationary Cards (2026-10-18)
- Esc clears selected card; dialog, poster menu and context menu retain dismissal priority.
- Disabled card lift on hover, keyboard focus and selection, preserving cyan selection highlight.
- No data, poster, status, score, grid size or table changes.

### Hotfix 36 — Category Badges & Top Alignment
- Год и значок категории объединены в компактную группу с одинаковой высотой и адаптивным зазором.
- Убраны дополнительные 16 px над сеткой карточек, чтобы таблица и карточки начинались на одной линии.
- Без изменений коллекции, таблицы, постеров и кнопок.

### Hotfix 35 — Selected Card Polish (2026-10-18)
- One neutral cyan selection outline, independent of film rating; calm hover glow and whole-card lift.
- No second poster highlight. The small "+" score chooser remains unchanged, with its 1–10 and viewing-status actions.
- No personal data, poster files, SQLite changes or grid changes.

### Hotfix 34 — Single Card Highlight & Full Titles (2026-10-18)
- One active outer card border; no doubled poster border on hover/selection.
- Three uniform lines per title; full names appear on title hover/keyboard card focus when truncated.
- No changes to user database, poster contents, card count, or table.
- Confirmed self-hosted Inter (Regular/Medium/SemiBold/Bold); automated local-font asset checks added, with no external font source.

## Hotfix 33 — Card Actions & Clearer Category Icons

- Значки категорий: фильм с более различимой перфорацией и треугольником, сериал — экран с Play, анимация — выразительная искра. Рисунки 17 px внутри прежнего бейджа рядом с годом; размеры карточек не меняются.
- Правый клик по карточке открывает меню «Скопировать название и год» / «Удалить карточку». Удаление запрашивает подтверждение и переносит запись в существующую корзину с возможностью восстановления; не удаляет локальный постер.
- Клик по названию и Ctrl+C на выбранной карточке копируют `Название (год)`, а при отсутствии года — только название. Ctrl+V по-прежнему вставляет постер в выбранную карточку. Контекстное меню доступно с клавиатуры через Shift+F10.
- В патч не включены пользовательские SQLite, каталог, экспорт Letterboxd и локальные постеры.

## Hotfix 32 — Category Icons on Posters (Preview 1)

- Added film/series/animation SVG icons directly on poster, immediately to the right of the existing year.
- Kept status-colored year, optional favorite star, score/status at bottom-right and action button at bottom-left.
- Removed redundant category badges beneath card names (card view only); table and filters unchanged.
- Accessible Russian tooltips; no remote resources, database changes or personal data included.

## Hotfix 31 — Selected Card Ctrl+V & Poster Label (2026-10-18)

- In card mode, clicking a card selects it; Ctrl+V sends clipboard image to the selected card using native poster storage. No action without selection; text inputs and dialogs preserve normal paste.
- Existing poster replacements request confirmation; cancellation leaves local files untouched.
- On empty cards, the manual action is simply «Постер» (not «+ Постер»). Existing images keep the «Изменить» label and the same menu.
- Compact action and «Смотрю»/«План» badges share one bottom row without wrapping; grid sizes and database formats unchanged.
- Includes no personal SQLite, images, Letterboxd exports or IMDb catalog.

## Hotfix 30 — Unified Poster Status & Native Clipboard (2026-10-18)

- Card badge at bottom-right opens one menu for **1–10 / Смотрю / Запланировано**. Planned/watching appear directly on poster as colored compact labels; the duplicated status select under cards is gone.
- Favorite stars are hidden when selecting one is impossible due to low numeric score or incompatible status; existing favorites are never silently removed.
- Numeric values persist when switching to pending states but are temporarily hidden behind the current status label; favorites require confirmation before removal.
- Native Windows clipboard insertion through a new Tauri command; no WebView2 browser clipboard permission prompt. Ctrl+V remains a fallback when necessary.
- Titles/categories, 6-column grid, 24 cards/page, table, personal SQLite and posters unchanged. Synthetic QA and Chromium layout checks passed; native Windows build pending.

## Hotfix 29 — Poster Control Alignment
- Кнопка «Изменить» и оценка выровнены по нижнему краю (одинаковые bottom и height).
- Выравнивание проверяется отдельно для стандартной и компактной ширины.
- Логика и личные данные не меняются.

## Hotfix 27 — Numeric Ratings (1–10)
- Независимый числовой `score10` в JSON-состоянии SQLite с проверкой 1–10 в Rust.
- Бейдж с одним числом в правом нижнем углу постера, интерактивный локальный редактор.
- Импорт Letterboxd 0.5–5 звёзд → 1–10; статус нового фильма 1–4 / 5–6 / 7–10.
- Существующие статусы/избранное и вручную введённые числа сохраняются при импорте.
- Регрессионные синтетические проверки, без личных данных.

Hotfix 26 — удалён офлайн-каталог IMDb (UI, JS, команды Tauri, Rust, скрипты импорта/обновления и перенос базы в сборках). В тестах добавлен строгий контроль отсутствия функции. Прежние метаданные личных записей и постеры сохранены. В карточках полированы заглушка, hover, кнопка ручного постера и ритм подписей без изменения года, цветов статусов и сетки.

Hotfix 25: Card View Visual Cleanup — softer poster contours/hover, quieter manual-poster overlay, compact year/stars, subtler category, retained colored statuses, aligned two-line headings. Approved top view toggle stays beside filters. No database or catalog changes.

Hotfix 24: View toggle moved beside category tabs; card titles slightly more legible; category badges calmer; pagination independent. No data changes.

Hotfix 23: card titles made more legible, year moved to top-left poster badge, poster removal button repositioned to the right, disabled/nonfavorite star contrast improved. No user SQLite, catalog or poster changes.

Kinoteka Hotfix 22 — Real Collection Card Polish: clean KINOTEKA placeholder, two-line labels, 24 cards/25 table per page, stable mode-switch position, improved navigation spacing. Manual posters only; user databases unchanged.

## Hotfix 21 — Card Status Clean & Real Library Preview
- Удалены цветные точки в плашках статусов только карточек; таблица, цветовая кодировка и выбор статуса без изменений.
- Добавлен PREPARE-REAL-PREVIEW.ps1 для изолированного восстановления личной базы на компьютере владельца.
- Личная SQLite и постеры не входят в исходники или патч; пустые data/ и seed-data/ сохранены.

## Hotfix 19 — Card Visual Parity (2026-10-18)
- Card colours follow the table's existing six rating tokens (liked, neutral, disliked, watching, planned, favourite).
- Equal-height two-line titles, consistent year/type and status rows, subtle outlines and focus/hover polish.
- Existing local poster selection, replacement, deletion, and stored posters unchanged.
- Commons and auto-poster UI paused; no online requests are triggered by card controls.
- Separate CARD_DEMO preserved; shipped SQLite remains empty.

## v1.2 Preview 1 — Hotfix 18: Commons Poster Search Diagnostics & Choices
- По IMDb ID проверяется до шести прямых изображений Wikidata P18; при нескольких свободно лицензированных вариантах пользователь выбирает обложку в окне предпросмотра (Назад / Далее / Отмена / Сохранить). Никакой автоматической подмены.
- Разделены случаи: нет изображения в Wikidata, есть изображения без поддерживаемой свободной лицензии, сетевой сбой / некорректный ответ и HTTP 429.
- Подтверждённые пустые результаты сохраняются в локальном браузерном хранилище на 24 часа для автоматического режима; ручной поиск Commons всегда обходит паузу. Сетевые ошибки не кэшируются как отсутствие изображения.
- Постеры, кредит автора, исходный Commons-файл, ручная замена, старые IMDb-идентификаторы и личная SQLite сохраняют прежние правила; исходные базы пустые, постеры и IMDb-дамп в патч не включены.
- Источник по-прежнему ограничен Wikidata/Commons. Для многих фильмов P18 отсутствует либо не является афишей.

## v1.2 Preview 1 — Hotfix 16: Offline Posters Foundation
- Карточки: локальные JPG/PNG/WebP постеры до 5 МБ, выбор и удаление прямо на карточке.
- Постеры сохраняются отдельно в `posters/` по SHA-256 ключа IMDb ID (или локальной идентичности записи).
- При перезапуске выбранные изображения считываются с диска; без постера остаётся прежняя заглушка.
- Нет внешних запросов, новых токенов, пересоздания SQLite или вложенных изображений в базе.
- Исходники и патч не содержат реальных постеров и личных данных.

## 2026-10-18 — v1.2 Preview 1 Hotfix 6 — Duplicate Matching Improvements
- Единственное точное совпадение после нормализации пунктуации/регистра + тот же год + совместимый тип определяется автоматически. Неоднозначные записи, разные типы без известного `mediaType` и Корзина требуют ручной проверки.
- Карточки Letterboxd и Kinoteka сравниваются рядом: название, год, тип, статус, оценка и просмотр. Добавлена вкладка «Автосовпадения» для проверки автоматических связей.
- Групповое подтверждение доступно только для явно отмеченных уникальных пар с одинаковым нормализованным названием и годом, но разной категорией; требуется дополнительное подтверждение. Само подтверждение не пишет SQLite, только изменяет план.
- Никакого массового пропуска, автоматического связывания нечётких/переводных названий или передачи всего ZIP в TMDB. Подтверждение окончательного импорта по-прежнему блокируется при спорных связях.
- Исходные SQLite, Rust/Tauri, идентичность приложения и пользовательская коллекция не затронуты. Обновлены тесты регрессии и сценарий проверки интерфейса.

## 2026-10-18 — v1.2 Preview 1 Hotfix 5 — Smart Duplicate Review
- Предпросмотр Letterboxd: точные/ранее подтверждённые совпадения, похожие записи и Корзина.
- Для похожих названий импорт блокируется до ручного решения: связать, добавить отдельно или пропустить. Дополнительный ручной поиск по локальной коллекции, включая русские названия; необязательная адресная подсказка TMDB по кнопке.
- Подтверждённые соответствия и исключения сохраняются между импортами, позиции списков перенаправляются на найденные локальные записи.
- Не меняются существующие статусы, избранное, Корзина, исходные SQLite и Tauri-конфигурация. Добавлены тесты на атомарное сохранение, повторный импорт, ошибочные решения и похожие записи в Корзине.
- Важно: автоматический перевод названий между языками невозможен без надёжных внешних идентификаторов; ручная сверка остаётся обязательной для спорных случаев.

## 2026-10-17 — v1.2 Preview 1 (Library Integration)
- Импорт CSV/ZIP Letterboxd с предпросмотром, защитой данных и метаданными оценок/дневника/рецензий/списков.
- Поиск TMDB с токеном пользователя и сохранением новой записи.
- Проверки ZIP/CSV, повторного импорта и сохранности исходной коллекции.

## v1.1 Stable — Startup & Titlebar Hotfix 6 Promotion (2026-10-09)

- Promoted accepted Startup/Titlebar Preview 1 Hotfix 6 to v1.1 Stable; rejected Hotfix 7 is excluded.
- Smooth 1.73s startup handoff, early centered 42px titlebar, custom vector window controls.
- Native visible/maximized first paint; no late show/maximize; non-resizable edge and early button CSS.
- Runtime and canonical SQLite state unchanged; version, release metadata, verifier contracts, and artifact naming updated.
- Retains known short native black pre-WebView frame; Windows visual smoke test remains required.

## v1.0 Stable — Reset Fade Parity with Trash

- Затухание кнопки «Сбросить» переведено на тот же проверенный двухфазный принцип, что используется у Корзины: сначала заканчивается press/icon-анимация, затем отдельный CSS transition ведёт кнопку к неактивному состоянию.
- Fade-кадр теперь полностью совпадает с фактическим финальным `:disabled` состоянием (border/background/color/opacity/filter/box-shadow), поэтому в конце больше нет визуального скачка.
- Длительность затухания — 0.78 с с тем же `cubic-bezier(.22,.61,.36,1)`, что у плавного Trash-перехода; основная reset-анимация остаётся 0.82 с.
- `disabled=true` применяется только после `transitionend`; сохранён fallback `fade + 180 ms`, а повторный клик/Ctrl+Z во время анимации блокируется.
- SQLite, канонические данные и остальной UI не менялись.

## v1.0 Stable — Reset Animation Timing + Fade Handoff Fix

- Основная анимация «Сбросить» ускорена умеренно: 0.94 → 0.82 с; иконка синхронизирована с той же длительностью.
- Исправлен переход в неактивное состояние: после окончания press-анимации класс `reset-press` снимается сразу и без промежуточной паузы запускается transition-fade.
- Восстановлен корректный `transitionend` по `opacity`; старый V840 animation-end больше не используется, потому что canonical v1.8.43 CSS намеренно отключает эту keyframe-анимацию.
- Добавлен 800 мс fallback, чтобы WebView2 не мог оставить кнопку активной, если `transitionend` не придёт из-за compositor/lifecycle-события.
- Принятая плавная траектория вращения из Reset Animation Pause Fix сохранена; SQLite и канонические данные не менялись.

## v1.0 Stable — Reset Animation Pause Fix

- Исправлена воспринимаемая пауза/ступенька в середине анимации кнопки «Сбросить».
- Сохранены подтверждённые длительности и анимация самой кнопки/ripple из v1.8.32; изменён только трек иконки.
- После короткого обратного движения иконка теперь возвращается по почти равномерной угловой траектории без резкого падения скорости в средней точке.
- Для вращения иконки используется linear timing, чтобы границы keyframes не создавали визуальное зависание.
- Runtime, SQLite, данные, фильтры и release-контракты не менялись.

## v1.0 Stable — RC1 Promotion

- Promoted the confirmed `v0.1 RC1 Theme Preview 15 Hotfix 3` baseline to `1.0.0` Stable.
- Release channel is `Stable`; artifact root/name is `Kinoteka_Standalone_v1.0_Stable`.
- DEV portable path is `Portable\Kinoteka_Standalone_v1.0_Stable_DEV`.
- Runtime/UI behavior, SQLite schema and canonical data are unchanged by the promotion.
- Canonical live/seed state: [количество удалено] items, [скрыто] favorites, 0 trash, revision [скрыта].
- Canonical SQLite SHA-256: `(redacted — historical user DB)`.
- Version/release metadata, documentation, verifier contracts and artifact naming were synchronized for Stable.

## v0.1 RC1 — Theme Preview 15 Hotfix 1: Compositor Seam Fix

- Уточнена причина полноэкранных горизонтальных/вертикальных полос: это не короткие particle-glints, а WebView2 compositor seams, которые проявляются при hover-repaint поверх фиксированного анимированного canvas и `backdrop-filter` слоёв.
- Прозрачность UI сохранена через RGBA-поверхности, но `backdrop-filter` убран с постоянно видимых/интерактивных поверхностей и titlebar.
- Верхняя панель остаётся прозрачнее, но без blur-композитинга; line-free particle renderer из Theme Preview 15 сохранён.
- SQLite/runtime/data contracts не менялись.

## v0.1 RC1 — Theme Preview 15: Softer Glass + Line-Free Living Particles

- UI surfaces receive one additional restrained transparency step; particles read through the interface a little more clearly while text contrast is preserved.
- The custom Tauri titlebar/top panel is now translucent monochrome glass (`rgba(3,3,4,.80)`) with blur; the existing first-paint/titlebar flicker fix is preserved.
- Investigated the periodic horizontal/vertical background lines: they were drawn deliberately by the particle renderer's glint cross-flare strokes; fast particles also had short line streaks. Both straight-line drawing paths are retired.
- Glints now render as point + soft circular halo only, preserving color/twinkle/chaos without horizontal or vertical bars.
- SQLite, Modal Motion, No-Tab, semantic controls and particle counts/colors remain unchanged.

## v0.1 RC1 — Theme Preview 14: White Trash Restore + White Close

- В окне «Корзина» кнопки «Восстановить» переведены в нейтральный бело-графитовый стиль вместо контекстной цветовой окраски.
- Нижняя кнопка «Закрыть» теперь визуально следует той же белой utility-логике, что и остальные нейтральные действия.
- Красные destructive-действия («Удалить навсегда» и «Очистить корзину») намеренно сохранены отдельной semantic-группой.
- Runtime, SQLite, частицы фона, пагинация, поиск и прочие Theme Preview 1–13 contracts не менялись.


## v0.1 RC1 — Theme Preview 6: Add Modal Semantic Mono

- Окно «Добавить запись» переведено на true-black/graphite surfaces без остаточного фиолетового chrome.
- Фокус строки и полей теперь наследует цвет выбранного статуса записи: planned/liked/normal/disliked/in-progress/favorite.
- Статус остаётся цветным только текстом/active focus, favorite использует золото только когда доступен/выбран.
- «+ ещё запись» нейтрален в покое и становится фиолетовым только при взаимодействии; Cancel/Close нейтральны, основное Add-действие сохраняет единый violet action-accent.
- SQLite, Modal Motion, No-Tab, Living Particles, titlebar fix и release contracts не менялись.

## v0.1 RC1 — Theme Preview 3: True Black Runtime + Contextual Filter Accent

- Убран последний runtime-override фиолетово-чёрного `#08070d`: root/route/titlebar first-paint теперь используют нейтральный `#020203`.
- Активные кнопки категорий/года теперь наследуют цвет выбранной верхней quick-stat карточки (Смотрю/Понравилось/Нормально/Не понравилось/Запланировано/Избранное/Всего).
- Карточка `Смотрю` при наведении теперь окрашивает цифру и подпись своим фиолетовым статусным цветом так же, как остальные статистические карточки.
- Living Particles, SQLite, Modal Motion, No-Tab, RC1 Polish 1 и release contracts не менялись.


## v0.1 RC1 — Theme Preview 1: Cinema Mono + Living Particles
- Added an optional visual preview pass with monochrome passive chrome on a black background.
- Kept semantic and interactive controls colorful so actions remain easy to identify.
- Reworked the background particle field to use the full hue wheel with slow per-particle color cycling while preserving the 90 FPS cap and hidden-window pause.
- No SQLite, storage, modal timing, No-Tab, or release-version changes.
# Kinoteka Standalone — Changelog

## v0.1 RC1 — Canonical Icon Refresh

- Добавлена собственная иконка Кинотеки в едином визуальном стиле с Игротекой: кинематографическая хлопушка, карточки и фиолетово-розово-золотая палитра.
- Обновлены Windows `src-tauri/icons/icon.ico` и встроенный `app/favicon.ico`; добавлен канонический исходник `src-tauri/icons/icon.png`.
- Standalone verifier теперь проверяет SHA-256 канонических icon assets и совпадение favicon с Windows icon.
- Версия, runtime/UI, SQLite schema и canonical data не менялись.

## v0.1 RC1 — Release Candidate Promotion

- Promoted the Windows-confirmed Cleanup Pass 23 + RC Prep 1 baseline to `0.1.0-rc.1`.
- Canonical data freeze confirmed before promotion: [количество удалено] items, [скрыто] favorites, 0 trash, revision [скрыта].
- Release channel is now `Release Candidate`; artifact root/name is `Kinoteka_Standalone_v0.1_RC1`.
- DEV portable path is now `Portable\Kinoteka_Standalone_v0.1_RC1_DEV`.
- No runtime/UI/SQLite schema or collection changes in this promotion pass.


## RC Prep 1 — Canonical Data Freeze Tooling

- Добавлен отдельный `FREEZE-CANONICAL-DATA.cmd/.ps1`: он переносит только явно проверенную Portable DEV SQLite в canonical `data` и `seed-data` перед RC.
- Перед записью source DB проходит semantic SQLite verifier; работающая Кинотека и `-wal/-shm/-journal` sidecars блокируют freeze.
- Предыдущая canonical live/seed пара сохраняется в `CanonicalDataBackups` и автоматически восстанавливается при ошибке.
- После копирования live/seed повторно проверяются и обязаны совпасть с source по SHA-256; затем запускается полный `npm run verify`.
- По умолчанию freeze блокирует непустую Корзину; намеренное сохранение Trash требует явного `-AllowTrash`.
- SHA-256 реализован через .NET, без `Get-FileHash`, для совместимости с Windows PowerShell 5.1.
- `MAKE-FINAL-RELEASE` теперь включает freeze-tooling в Source ZIP; runtime/UI/SQLite schema и пользовательские данные самим патчем не менялись.

## Cleanup Pass 23 — Runtime Performance & Semantic DB Validation

- Ограничена декоративная фоновая анимация максимумом 90 FPS; на 180 Гц она больше не рендерится на каждом refresh-cycle.
- Canvas-анимация полностью ставится на паузу при `document.hidden` и безопасно возобновляется при возврате окна без большого скачка `dt`.
- Удалены доказанно неиспользуемые `dust`/`streaks` генераторы и массивы, которые создавались при каждом rebuild, но никогда не отрисовывались.
- Rust runtime/recovery validation теперь проверяет семантику записей, категорий, годов, рейтингов, favorite references, Trash records и обязательные UI-state поля, а не только типы верхнего уровня.
- Те же semantic contracts добавлены в standalone/migration/release SQLite verifiers, чтобы DEV, recovery и release проверяли одинаковую модель данных.
- SQLite live/seed, пользовательские данные, Modal Motion Pass 2, No-Tab policy и CSS-визуал не менялись.


## Cleanup Pass 22 — CSS Consolidation III

- Removed dead Trash CSS for retired `trash-activate` / `trash-deactivate` classes.
- Removed unused V841–V844 Trash keyframes and reduced-motion branches tied only to those retired classes.
- Preserved the active v1.8.49+ `trash-transition-in/out`, `trash-dot-enter/exit`, `trash-fade-out` and `trashDotAppearV849` runtime path.
- No HTML/JS behavior, SQLite, Rust/Tauri, Modal Motion Pass 2, No-Tab policy, or release pipeline changes.

## v0.1 Preview — Cleanup Pass 21: CSS Consolidation II

- Удалены полностью вытесненные исторические Trash CSS-слои `v1.18` и `v1.23`; сохранено только реально действующее `flex:0 0 auto!important` для `.trash-modal .trash-actions`.
- Удалены устаревшие PATCH 025/PATCH 027 favorite-star overrides, потому что канонический PATCH 028 задаёт те же/более поздние итоговые значения.
- Канонический `v1.88` Trash layout и PATCH 028 favorite-star geometry остаются единственными поздними источниками этих визуальных правил.
- Итоговые effective declarations для затронутых selectors/media contexts проверены до/после и сохранены.
- HTML/JS, Modal Motion Pass 2, No-Tab, SQLite, Rust/Tauri и release pipeline не менялись.

## v0.1 Preview — Cleanup Pass 20: CSS Consolidation I

- Удалены только точные дубликаты top-level CSS rules, где более позднее правило уже полностью повторяло тот же selector и declarations.
- Финальный cascade и визуальный результат намеренно сохранены: остаётся последняя каноническая копия каждого совпадающего правила.
- Не выполнялось рискованное объединение конфликтующих historical override-слоёв; это оставлено для отдельного этапа после Windows-проверки.
- Добавлен verifier guard на отсутствие точных duplicate top-level rules и marker текущего CSS consolidation pass.
- HTML/JS, Modal Motion Pass 2, No-Tab, SQLite, Rust/Tauri и release pipeline не менялись.

## v0.1 Preview — Cleanup Pass 19: Dead Code + Behavior Preservation

- Удалены доказанно мёртвые frontend-состояния `paginationRenderCache`, `persistedTrashJSON` и `trashIndicatorDeferred`.
- Удалены write-only поля `lastModified`/`lastModifiedReason`: они не входят в canonical SQLite persistence contract и никогда не читаются UI/backend.
- Add/rating/favorite confirmed-write и rollback-пути сохранены без изменения пользовательского поведения.
- `renderTrash()` теперь напрямую синхронизирует индикатор Корзины без неиспользуемого deferred-флага.
- Добавлены verifier guards на отсутствие retired residue и сохранение критичных write/rollback bindings.
- SQLite, Rust/Tauri, Modal Motion Pass 2, No-Tab policy и release pipeline не менялись.

## v0.1 Preview — Cleanup Pass 16: Functional Integrity

- Добавлена единая каноническая идентичность записи `тип + нормализованное название + год`; она используется при добавлении, подсветке дубликатов и восстановлении из Корзины.
- Одинаковые названия с разными годами или типами больше не считаются дубликатами; точная совпадающая запись по-прежнему блокируется.
- Исправлен `Escape` при непустом поиске: удалена ссылка на несуществующий `searchRenderTimer` и мёртвый `scheduleSearchRender()`.
- Verifier проверяет все три identity call-site и отсутствие retired search-timer residue, а также семантические fixtures для года/типа.
- SQLite, Rust/Tauri, данные, modal motion и release pipeline не менялись.

## v0.1 Preview — Modal Motion Pass 2: Mirrored Open/Close Motion

- Закрытие всех модальных окон теперь визуально зеркалит открытие: тот же fade/scale/vertical/backdrop path.
- Канонические тайминги: 280 ms открытие, 260 ms закрытие; close остаётся чуть быстрее, но больше не ощущается резким.
- `prefers-reduced-motion` и последовательность confirm → SQLite → Trash сохранены.

## v0.1 Preview — Cleanup Pass 15: Canonical Frontend Persistence Helpers

- Оставшиеся frontend-only helper/state identifiers с игровым наследием переведены на нейтральный entry namespace: `migrateEntryStatuses`, `entryNameNormCache`/`entryNameNorm`, `persistedEntriesJSON`, `entriesDirty`, `nextProvisionalEntryId`.
- Переименование механическое и не меняет массив `games`, SQLite/schema-поле `game`, sort keys `game-asc/game-desc` или backend API `getGamesSync`/`replaceGamesConfirmed`; эти контракты намеренно сохранены для совместимости данных.
- Все call-sites в `core.js`, `games.js`, `trash.js` и `runtime.js` синхронизированы; verifier запрещает возврат старых frontend helper-имён и проверяет новые bindings.
- UI, modal motion, SQLite, Rust/Tauri и build/release/migration pipeline не менялись.

## v0.1 Preview — Modal Motion Pass 1: Unified Modal Animations

- Все модальные окна Кинотеки переведены на один motion-contract: мягкий fade backdrop + лёгкий подъём/scale карточки при открытии и зеркально более быстрый close.
- Канонические тайминги централизованы: 280 ms для открытия и 240 ms для закрытия с единым `cubic-bezier(.22,.61,.36,1)`.
- Единая анимация применяется к Add Entry, Корзине, Year Picker, confirm/delete modal и runtime `KinotekaDialog` alert/confirm.
- Удалены конфликтующие исторические modal keyframes и прежний блок, полностью отключавший modal-анимации; Hotfix 2 сохраняет последовательность confirm → SQLite → Trash, но визуально использует общий motion-system.
- `prefers-reduced-motion` сохранён: при системном отключении анимаций modal close завершается без ожидания motion.
- SQLite, Rust/Tauri, persistence и функциональная логика записей не менялись. Verifier контролирует единый CSS/JS motion-contract и запрещает возврат старых modal overrides.

## v0.1 Preview — Cleanup Pass 14 Hotfix 2: Smooth Confirmed Trash Close

- После подтверждения «Удалить навсегда» и «Очистить корзину» модальные окна теперь закрываются последовательно: сначала confirm, затем после успешной SQLite-операции сама Корзина.
- Для этих двух destructive-путей добавлена отдельная мягкая fade/scale-анимация закрытия; глобальная политика мгновенного закрытия остальных модалок не менялась.
- Корзина закрывается только после успешной записи в SQLite; при ошибке остаётся открытой и показывает сообщение об ошибке.
- Restore-путь, SQLite, Rust/Tauri и release pipeline не менялись.
- Verifier проверяет обе destructive-ветки, последовательность закрытия и scoped CSS-анимацию.

## v0.1 Preview — Cleanup Pass 14 Hotfix 1: Trash Modal Stability

- Исправлено мерцание/двойное закрытие при безвозвратном удалении записи и очистке Корзины.
- Confirm-modal теперь полностью завершает своё закрытие до выполнения SQLite-операции, поэтому два modal-backdrop больше не закрываются одновременно.
- После «Удалить навсегда» и «Очистить корзину» окно Корзины остаётся открытым и обновляется на месте, включая состояние «Корзина пуста».
- Restore-путь не менялся; SQLite, Rust/Tauri, CSS и release pipeline не затронуты.
- Добавлены verifier guards на sequencing confirm-close и запрет автоматического закрытия Корзины после destructive actions.

## v0.1 Preview — Cleanup Pass 14

- Активные UI helpers `selectGameRow()` и `copyGameNameFromRow()` переименованы в `selectEntryRow()` и `copyEntryNameFromRow()` без изменения поведения выбора строки и копирования названия с годом.
- Все call-sites синхронизированы; добавлены verifier guards против возврата старых helper-имен и рассинхронизации copy binding.
- SQLite/schema-модель `game`, sort keys `game-asc/game-desc` и backend-контракт намеренно не переименовывались.

# Changelog — Kinoteka Standalone

## v0.1 Preview — Cleanup Pass 13: Canonical Active Entry Identifiers

- Оставшиеся активные UI id `addGameTitle`/`addGameRow` переведены на `addEntryTitle`/`addEntryRow`; `aria-labelledby` и JS-binding синхронизированы.
- Функция удаления строки `deleteGameAtIndex()` переименована в `deleteEntryAtIndex()` во всех вызовах, включая контекстное удаление по названию.
- Изменения механические: DOM-структура, визуальный UI, SQLite/schema, Rust/Tauri и persistence не менялись.
- Добавлены verifier guards на согласованность modal aria/id, add-row binding и delete handler, чтобы не повторить selector-регрессию Pass 12.

## v0.1 Preview — Cleanup Pass 12 Hotfix 1: Table Row Selector Sync

- Исправлена регрессия Pass 12: генератор строк таблицы продолжал создавать `class="game-name"`, тогда как обработчики копирования и удаления уже ожидали `.entry-name`.
- Runtime-разметка таблицы теперь канонически создаёт `class="entry-name"`; восстановлены копирование названия с годом и удаление/контекстное удаление.
- Verifier усилен отдельным guard на совпадение класса, создаваемого render-путём, с селекторами copy/delete handlers.
- SQLite, Rust/Tauri, persistence, CSS и build/release/migration pipeline не менялись.

## v0.1 Preview — Cleanup Pass 12: Canonical Entry Table & Delete Namespace

- Активный DOM/runtime namespace таблицы записей переведён с `gameEntries`/`.game-name`/`.game-col` на `entryEntries`/`.entry-name`/`.entry-col`.
- `kinotekaAddGameModal` и внутренние modal-controller keys `add-game`/`games-trash`/`game-delete` заменены на `kinotekaAddEntryModal` и `add-entry`/`entries-trash`/`entry-delete`.
- Классы диалога удаления `delete-game-*` и id `deleteGameName` переведены на `delete-entry-*` / `deleteEntryName`.
- Функция UI-добавления `addGame()` переименована в `addEntry()`; SQLite/schema-поле `game`, массив данных `games` и контракт backend намеренно не переименовывались.
- Изменения механические: внешний вид, обработчики, persistence и данные не менялись. Добавлены verifier guards против возврата retired namespace.
- Rust/Tauri, SQLite и build/release/migration pipeline не менялись.

## v0.1 Preview — Cleanup Pass 11: Canonical Add-Entry DOM Namespace

- Внутренние DOM/CSS-классы формы добавления переведены с исторического `game-entry-*` на собственный `kinoteka-entry-*` namespace.
- `add-game-action`/`add-game-modal`/`add-game-form` переименованы в нейтральные `add-entry-*` классы.
- Переименование механическое: структура формы, обработчики, визуальные параметры, значения полей и SQLite/schema-модель не менялись.
- Добавлены verifier guards против возврата старых `game-entry-*`/`add-game-*` классов и против потери нового канонического namespace.
- Rust/Tauri, SQLite, persistence и build/release/migration pipeline не менялись.

## v0.1 Preview — Cleanup Pass 10: Canonical Record Terminology

- Исправлена остаточная user-visible игровая терминология в standalone Кинотеке: «Удалить игру?»/«Игра…» → «Удалить запись?»/«Запись…».
- Accessibility-подпись кнопки Корзины больше не использует неверное множественное «игр»: теперь канонически `Корзина, записей: N`.
- Исправлена повреждённая строка `записейу` → `запись` во всех error/fallback сообщениях Корзины.
- Комментарии/diagnostic-текст в `core.js` приведены к термину «запись»; внутренняя SQLite/schema-модель и поле `game` намеренно не переименовывались.
- Добавлены verifier guards против возврата этих user-visible хвостов; Rust/Tauri, SQLite и persistence/release pipeline не менялись.

## v0.1 Preview — Cleanup Pass 9: Canonical Trash Modal Semantics

- Удалён исторический `history-modal` alias из единственного окна Корзины; остаётся канонический `trash-modal`.
- `history-note` переименован в `trash-note` во всей активной HTML/CSS surface.
- Визуальные параметры, DOM-структура окна, действия Корзины и runtime-логика не менялись.
- Добавлены verifier guards против возврата `history-modal`/`history-note` и против потери канонических trash-селекторов.
- SQLite, Rust/Tauri, persistence bridge и build/release/migration pipeline не менялись.

## v0.1 Preview — Cleanup Pass 8: Retired Runtime Residue Cleanup

- Удалён мёртвый `oldStatus`, который вычислялся при миграции записей, но никогда не использовался.
- Удалён полностью no-op `saveStatus`/`updateSaveStatus`: соответствующего DOM-индикатора в standalone UI уже нет, поэтому код не мог ничего отображать.
- Удалён изменяемый alias `pageSize`; пагинация теперь использует канонический `PAGE_SIZE=25` напрямую без изменения размера страницы.
- Добавлены verifier guards против возврата этих retired runtime-хвостов и против случайного изменения канонической пагинации.
- SQLite, Rust/Tauri, persistence bridge, UI-разметка/CSS и build/release/migration pipeline не менялись.

## v0.1 Preview — Cleanup Pass 7: Hidden Statistics Cleanup

- Удалён постоянно скрытый DOM-элемент `#stats` / `.count`, который больше не показывался в standalone UI.
- Удалены неиспользуемые `statsRenderCache`, binding `stats`, расчёт «Показано X из Y» и мёртвый `statsCache`.
- Удалены CSS-правила `.stats`, `.count`, `.countLabel`, `.countTotal`, относившиеся только к удалённому скрытому счётчику.
- Действующие верхние quick-stat карточки (`Всего`, оценки, `Избранное`) и их фильтрация сохранены без изменения поведения.
- Добавлен verifier guard против возврата hidden-count/statistics surface.
- Rust/Tauri, SQLite и build/release/migration pipeline не менялись.

## v0.1 Preview — Cleanup Pass 6: Non-Interactive Tooling

- Удалены ручные `pause` из `BUILD-RELEASE.cmd`, `MAKE-FINAL-RELEASE.cmd` и `MIGRATE-FROM-LOST-HEAVEN.cmd`.
- Все штатные `.cmd` wrappers теперь завершаются автоматически и возвращают исходный exit code без ожидания клавиши.
- `BUILD-DEV.cmd` остаётся в уже подтверждённом NoPause-виде.
- Добавлен verifier guard против возврата ручного `pause` в build/release/migration wrappers.
- Runtime, UI, Rust/Tauri и SQLite не менялись.

## v0.1 Preview — Cleanup Pass 5: Confirmed Write Hardening

- Критичные сохранения списка переведены с `replaceGamesSync` на `replaceGamesConfirmed` и ожидают подтверждения SQLite backend.
- Добавлена сериализованная `queuePersistence`, чтобы подтверждённые записи не пересекались с уже поставленными в очередь UI-write операциями.
- Удалены устаревшие `replaceTrashSync`, `moveGameToTrashSync`, `restoreTrashSync`, `permanentlyDeleteTrashSync`, `emptyTrashSync`, `__flush` и мёртвые helpers старого fallback-пути.
- Добавление, смена оценки/избранного и операции корзины теперь принимают изменение в UI только после успешной подтверждённой записи.
- Добавлены verifier guards против возврата старого sync compatibility API.

## v0.1 Preview — Cleanup Pass 4

- Удалены остаточные CSS/themed-select селекторы старого игрового статуса `Прохожу`; в Кинотеке канонический статус просмотра — только `Смотрю`.
- Сохранены действующие `rating-in-progress`, цветовая семантика и поведение карточки статистики `Смотрю`.
- Данные, SQLite, Rust/Tauri backend, build/release/migration pipeline и пользовательская логика не менялись.
- Verifier получил Cleanup Pass 4 guards против возврата retired-термина `Прохожу` и проверяет наличие канонического `Смотрю`.

## v0.1 Preview — Cleanup Pass 3

- Удалён недостижимый `duplicateOnly` state/filter branch; действующие поиск, quickFilter, сортировка, категория и год сохранены.
- Canonical live/seed SQLite нормализованы: из `ui_state` удалён retired-ключ `duplicateOnly`; коллекция, корзина и revision не менялись.
- Из `styles.css` удалены selector families элементов, которых больше нет в standalone DOM/runtime: старые sort/page-size/delete/add-choice/filter-chip/history-list элементы.
- Удалены доказанно неиспользуемые compatibility aliases (`setAddMode`, `openBulkModal`, `closeBulkModal`, `addMultipleGames`, `updateBulkInfo`) и `formatHistoryDate`.
- Дубликатная подсветка строк (`duplicateNameSet`) сохранена — удалён только недостижимый режим фильтра «только дубликаты».
- Очищены оставшиеся foreign-project упоминания только в комментариях runtime assets; canonical `com.lostheaven.kinoteka` и мигратор Lost Heaven сохранены намеренно.
- Verifier получил Cleanup Pass 3 guards против возврата retired state, dead selectors и no-op aliases.

## v0.1 Preview — Cleanup Pass 2

- Завершено переименование активных runtime namespaces из общего Lost Heaven/Игротека наследия в `Kinoteka`/`kinoteka-*`.
- `LHModal`/`LHDialog` → `KinotekaModal`/`KinotekaDialog`; route API → `kinotekaRouteTransition`.
- `lh-select-*`, `lh-route-*`, dialog/modal DOM classes, custom event/style IDs и приватные themed-select поля переведены в `kinoteka-*`.
- Исторические `igrotekaModal*` keyframes переименованы в `kinotekaModal*` без изменения анимационных параметров.
- Runtime-комментарии очищены от старой идентичности; мигратор из Lost Heaven сохранён намеренно как compatibility tool.
- Добавлены verifier guards, запрещающие возврат старых `LH*`, `lh*` и `igrotekaModal*` runtime namespaces.
- Функциональная логика, Rust/Tauri backend, SQLite schema/data и release contracts не менялись.


## v0.1 Preview — Cleanup Pass 1

- Удалена неиспользуемая Budget-тема из standalone themed-select; Кинотека теперь жёстко использует library-палитру.
- Удалён межпроектный `data-lh-select-theme` из HTML.
- Исправлен user-visible fallback-заголовок встроенных alert/confirm: `Lost Heaven` → `Кинотека`.
- Добавлены verifier guards против возврата Budget-theme branch и неверного modal fallback title.
- Более широкие legacy namespaces (`LHModal`/`LHDialog`, `lh-select-*`, route/event names, `igrotekaModal*`) намеренно оставлены на следующие cleanup passes, чтобы не смешивать безопасное удаление dead code с runtime API rename.
- Мигратор из Lost Heaven оставлен намеренно как compatibility tool и не является runtime-зависимостью.


## v0.1 Preview — Initial Standalone Extraction

- Кинотека отделена от Lost Heaven Desktop в самостоятельный Tauri-проект.
- За основу frontend взята актуальная Кинотека с cumulative PATCH 028, включая последние правки favorite-star parity и 4-значного поля года.
- Удалена зависимость страницы от `../../shared`: необходимые shared-компоненты включены локально в standalone Source.
- Добавлен отдельный standalone bridge `shared/kinoteka-bridge.js` без shell/Игротеки/Бюджета.
- Добавлена standalone runtime identity `window.kinotekaRuntime` и отдельная database facade `window.kinotekaDatabase`.
- Rust backend сокращён до Кинотеки: `library_state`, `persist_movies_state`, `persist_movies_ui` и управления окном.
- Добавлена отдельная identity `com.lostheaven.kinoteka` и mutex `Local\\KinotekaStandalone`.
- Canonical SQLite вынесена в `data/kinoteka.sqlite3`; seed recovery — в `seed-data/kinoteka.sqlite3`.
- На момент отделения canonical DB содержит [количество удалено] записи, revision [скрыта]; live/seed копии побайтно идентичны.
- Сохранены SQLite integrity/schema/payload checks, automatic backup/recovery и portable data-root hardening.
- Добавлены DEV/Release/Final Release pipelines, строгий 3-file Portable allowlist и re-extract verification обоих ZIP.
- Добавлен безопасный мигратор из Lost Heaven `data\\movies\\kinoteka.sqlite3`.
- Добавлен standalone verifier для identity, JS syntax, backend/frontend surface, SQLite и release contracts.
## Cleanup Pass 17 — Modal Lifecycle Hardening
- Centralized backdrop and Escape dismissal in `KinotekaModal` for project modal overlays.
- Removed duplicate project-level modal Escape/backdrop handlers.
- Removed the unreachable legacy delete-confirmation modal path; context deletion still uses the confirmed async Trash path.
- Removed dead modal helper residue (`closeBackdropAnimated`, `TRASH_MODAL_CLOSE_MS`) and duplicate scroll-lock observer.
- No SQLite, Rust/Tauri, persistence, or Modal Motion timing changes.
## Cleanup Pass 18 — Interaction & Persistence Hardening
- Preserved the project-wide no-Tab policy: Tab remains intentionally suppressed and is not used for UI navigation.
- Ctrl+Z now preserves native text undo while editing inputs/textareas/selects/contenteditable; Kinoteka reset remains available outside editors.
- Clipboard writes are now confirmed asynchronously before success UI is shown, with a local execCommand fallback.
- Rust startup SQLite validation now requires Kinoteka app identity, formatVersion 1, canonical arrays and a valid object ui_state row; persist_movies rejects foreign/wrong-version state too.
- No SQLite data/schema, modal motion, or release layout changes.

- RC1 Polish 1: native window stays hidden until the custom titlebar stylesheet and frontend state are ready, eliminating the startup titlebar/close-button flash.
- RC1 Theme Preview 2: root surface changed from violet-black to neutral near-black (`#020203`); active media/year filters now receive a cyan border, glow and tinted fill matching the selected Total filter. Inactive filter chrome remains graphite; particles/semantic colors/data/runtime behavior are unchanged.


- RC1 Theme Preview 4: compact Add/Trash controls and pagination were brought into the Cinema Mono system. Add uses a restrained violet action accent; empty/disabled Trash is neutral graphite and becomes red only when actionable; pagination/reset hover and the current-page indicator inherit the active quick-stat color. No SQLite/runtime behavior changes.

## v0.1 RC1 — Theme Preview 5: Trash Modal Semantic Mono

- Trash modal приведён к Cinema Mono: почти чёрные поверхности и нейтральные границы без старого фиолетового chrome.
- Restore-action получил отдельный cyan recovery accent; permanent delete/empty trash остаются красными destructive actions.
- Close controls нейтральные в покое и подсвечиваются только мягким graphite hover.
- Данные, SQLite, Trash sequencing, Modal Motion и runtime-поведение не менялись.

### RC1 Theme Preview 7 — Add-row Contextual Select Accent
- Add Entry media-category select now inherits the current row rating accent instead of fixed violet.
- Category popup surface is neutral black/graphite; hover and selected option are contextual to the row rating.
- No persistence, SQLite, Modal Motion, No-Tab, particle, icon, or titlebar behavior changes.


### RC1 Theme Preview 8 — Semantic Rating Select Surface
- Rating dropdown selected-state background now follows the semantic rating color instead of fixed violet.
- Add Entry rating trigger open/focus border and glow follow the current status color.
- Rating popup surfaces stay true-black/graphite; every option keeps its own status color on hover/selection.
- No persistence, SQLite, Modal Motion, No-Tab, particle, icon, or titlebar behavior changes.

### RC1 Theme Preview 9 — Contextual Add Action Accent
- The Add Entry primary action no longer keeps a fixed violet accent.
- `Добавить записи` follows the semantic color of the last-focused add row: pink/gray/red/violet/blue/gold.
- The small add-row `+` uses the same contextual accent on hover.
- With multiple rows, the last-focused row defines the modal action color; data/persistence behavior is unchanged.



### RC1 Theme Preview 10 — Contextual Trash Restore Accent
- Кнопка «Восстановить» в Корзине теперь принимает семантический цвет удалённой записи (понравилось/нормально/не понравилось/смотрю/запланировано/избранное).
- Необратимые действия остаются красными, закрытие — нейтральным; SQLite и поведение Корзины не менялись.

### RC1 Theme Preview 11 — Soft Glass Mono + White Add Action
- Основные graphite-поверхности получили лёгкую прозрачность: частицы мягко просматриваются через таблицу, карточки, фильтры и компактные контролы.
- Корневой фон окна остаётся непрозрачным почти чёрным `#020203`; прозрачность применяется только к UI-поверхностям.
- Модальные окна получили более осторожную glass-прозрачность с blur, чтобы сохранить читаемость.
- Главная кнопка `+` слева от Корзины больше не фиолетовая: в покое она бело-графитовая, на hover/focus получает мягкое белое свечение.
- SQLite, Living Particles, Modal Motion, No-Tab и runtime-поведение не менялись.


### RC1 Theme Preview 12 — White Pagination + Wilder Living Particles
- Pagination is now fixed to a neutral white/graphite treatment in all states; it no longer inherits semantic filter colors.
- Hover, focus and current-page emphasis stay monochrome white to match the RC1 Cinema Mono direction.
- Living Particles keep the same full-spectrum palette, but the field is denser and slightly more chaotic: more particles, more stars, more glints, and a bit more motion variety.
- SQLite, Modal Motion, data semantics and runtime flows remain unchanged.

### RC1 Theme Preview 13 — White Reset + Neutral Search Focus
- Reset Filters is now a neutral white/graphite utility control in every state and no longer inherits semantic filter colors.
- Search hover/focus chrome is fully monochrome white/graphite; the remaining violet focus ring was removed.
- Theme Preview 12 white pagination and denser Living Particles remain unchanged.
- No SQLite, persistence, Modal Motion or No-Tab behavior changes.

### RC1 Theme Preview 15 Hotfix 2 — Wider Rating Menu
- Rating popup width increased to 176 px so long labels such as «Не понравилось» and «Запланировано» no longer clip.
- Rating popup is centered around the compact trigger where possible and no longer shows a horizontal scrollbar.
- No SQLite/runtime data behavior changes.

### RC1 Theme Preview 15 Hotfix 3 — Restored Local Glints + More Transparency
- Restored the intended decorative glint cross (short local horizontal/vertical flare around a particle) and short streaks behind fast particles.
- The full-screen compositor seam hardening from Hotfix 1 remains active: visible UI/titlebar surfaces still avoid `backdrop-filter`.
- Increased Cinema Mono transparency one more restrained step across table/cards/controls/modals/search and the titlebar.
- Rating popup width from Hotfix 2 is preserved. SQLite/runtime/data semantics are unchanged.

- Hotfix 7 (privacy): Empty source and seed databases; synthetic integration tests; separate clean DEV profile; no personal data in release archives; freeze guards.

## v1.2 Preview 1 — Hotfix 9: Inline Import Help
- Fixed help disclosure overlaying ZIP selection and status: help is now an inline accordion.
- Responsive footer keeps confirmation accessible; helps closes when changing tabs.
- No DB changes; test-only fixture and empty distributed SQLite retained.

## v1.2 Preview 1 — Hotfix 10: Full-width import help
- Import help expands to the full modal width, with no independently scrolling help panel.
- The confirmation button remains in a separate right-aligned footer row.
- Copy condensed without changing import behavior; no SQLite or Tauri changes.

## Hotfix 11 — Card View Preview
- Added switchable Table / Cards layout, sharing the existing filtering, pagination, rating/favorite persistence.
- Card posters have offline placeholders until a licensed local artwork catalog is available.
- View preference persists in the existing UI SQLite; distributed databases remain empty.

### v1.2 Preview 1 — Hotfix 12 (Card View Polish & Mixed Category QA)
- Poster cards now use a roomier responsive grid, consistently spaced title, year, category badge and status underneath.
- Preserved table mode, English titles, 2:3 proportions, keyboard focus and offline placeholder.
- Added opt-in, isolated CARD_DEMO creator: 15 completely fictional entries, equally split between films, series and animation; demo opens in card mode. Canonical/distributed SQLite stays empty.
- Added regression test ensuring demo generation never touches shipped DB or overwrites populated DB.

## Hotfix 13 — Offline Catalog Foundation
- Separate local catalog/catalog.sqlite3 (IMDb Non-Commercial personal-use import, FTS5).
- Russian UI, English titles, category search and confirmed adds with IMDb title ID.
- Synthetic CARD_DEMO catalog generator; no distributed IMDb or personal records.
- Atomic --replace with previous-catalog backup; no runtime network required.


### Hotfix 14 — IMDb Catalog Import & Update
- Опциональное обновление каталога из официального IMDb GZIP или локального TSV без пересборки EXE.
- Валидация нового SQLite/FTS и сохранение прежнего каталога до атомарной замены.
- Статистика по фильмам, сериалам и анимации в разделе офлайн-каталога.
- Регрессионные тесты повреждённой загрузки и сохранности личной пустой базы.


## Hotfix 17 — Commons Posters (opt-in)

- Карточки получили кнопку «Commons ↗»: запрос только по IMDb ID (Wikidata P345/P18), затем проверка файла и лицензии в Wikimedia Commons. Без TMDB и ключей.
- После загрузки показывается предварительный просмотр; изображение не назначается до подтверждения. Commons может не содержать киноафишу или изображение вообще.
- На панели коллекции есть необязательный флажок «Автопоиск обложки»: **по умолчанию выключен**. При включении после добавления одной новой записи с IMDb ID выполняется только один поиск, с таким же подтверждением.
- Разрешены только JPG/PNG/WebP до 5 МБ с подтверждёнными CC0, CC BY или CC BY-SA. Иные лицензии игнорируются. Описание автора, лицензия и адрес исходного файла сохраняются рядом с постером (файл `posters/*.credit.json`), а не в `kinoteka.sqlite3`.
- Постеры, установленные вручную, не перезаписываются без подтверждения. Без сети можно пользоваться уже сохранёнными изображениями и ручным выбором файла.
- Проверено: `npm run verify`, `COMMONS POSTERS QA: PASS` с подставными сетевыми ответами. **Не проверено**: реальные ответы Wikidata/Commons и сборка Windows EXE; проверь на Windows.
- Не распространять каталог IMDb, личную SQLite и папку `posters/` внутри патчей.

## v1.2 Preview 1 — Hotfix 20: Card View Final Polish
- Fixed doubled status border caused by the automatic themed-select trigger inside each card. Preserved keyboard-accessible dropdown with a single coloured border and status dot.
- Reduced poster border and glow, aligned title/year/category/status rows, toned down favorite controls.
- The manual «+ Постер» button appears on hover/focus for pointer devices and remains available on touch devices. No Commons/automatic poster UI.
- Purely visual changes: no modifications to catalog, personal SQLite, Letterboxd importer, or poster files.

### Hotfix 28 — Poster Controls & Unified Card Lift
- Подсветка/приподнимание целой карточки вместо отдельного постера или кнопки, единая анимация всех дочерних элементов и поддержка reduced-motion.
- Выделение карточки по клику, снятие по клику снаружи; без изменений SQLite.
- Отдельный крестик удаления постера убран: кнопка «Изменить» открывает меню для выбора с ПК, вставки из буфера, удаления с подтверждением.
- Clipboard API c запасной вставкой Ctrl+V при ограничениях WebView2; проверка типов и лимита 5 МБ, только локальное сохранение.
- Регрессионный синтетический тест Hotfix 28; личные изображения, Letterboxd ZIP и SQLite в патч не входят.


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
