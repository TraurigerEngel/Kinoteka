# Кинотека (Kinoteka) 🎬

**Актуальная стабильная версия — [v1.2.0 Stable (HF49)](https://github.com/TraurigerEngel/Kinoteka/releases/tag/v1.2.0).**

Windows 11 x64 · Portable · Tauri 2 / Rust / SQLite · автономная коллекция фильмов и сериалов.

[**Скачать Stable v1.2**](https://github.com/TraurigerEngel/Kinoteka/releases/download/v1.2.0/Kinoteka_Standalone_v1.2_Stable_Portable.zip) · [Исходники выпуска](https://github.com/TraurigerEngel/Kinoteka/releases/tag/v1.2.0) · [История изменений](CHANGELOG.md) · [Приватность](GITHUB_PRIVACY_RU.md)

## Возможности

- Локальная библиотека фильмов, сериалов и анимации: таблица, карточки, категории, сортировка, поиск, оценки от 1 до 10, избранное и корзина с восстановлением.
- Статусы «Смотрю» и «Запланировано», ручные постеры, вставка из буфера и необязательный поиск изображений Wikimedia Commons по инициативе пользователя.
- Импорт ZIP/CSV из Letterboxd с предпросмотром, проверкой похожих записей и ручным подтверждением неоднозначных совпадений.
- Поиск фильмов — **только по собственной коллекции**. Сетевой поиск TMDB и поле API-токена удалены в Hotfix 44. Исторические TMDB-идентификаторы сохраняются только для локального сопоставления импортов.
- Cinema Mono, шрифт Inter локально, оформление окна и совместимость с автоскрываемой панелью задач Windows 11 (HF45–HF49).

**Примечание:** вкладка «Мои списки» временно скрыта, но уже импортированные списки сохраняются в SQLite. Приложение не является официальным клиентом Letterboxd, TMDB, Wikimedia Commons или IMDb.

## Установка Portable

1. Скачайте `Kinoteka_Standalone_v1.2_Stable_Portable.zip` из [последнего Stable Release](https://github.com/TraurigerEngel/Kinoteka/releases/tag/v1.2.0).
2. **Распакуйте в новую папку**. Архив содержит `Kinoteka.exe` и пустые `data/kinoteka.sqlite3`, `seed-data/kinoteka.sqlite3`.
3. Запустите `Kinoteka.exe` на Windows 11 x64 (необходим WebView2 Runtime).
4. **Не распаковывайте поверх рабочей коллекции:** чистая SQLite из ZIP может перезаписать ваши данные. Перед переносом делайте резервную копию папки `data` и постеров.

Поставляемые базы проверены: `PRAGMA integrity_check=ok`, `items=[]`, `favorites=[]`, `trash=[]`, `revision=0`. Личные данные в них отсутствуют.

## Сборка из исходников

Требуются Windows 11, Node.js 22.13+, npm 10+, Rust (MSVC), Tauri CLI и зависимости из lock-файлов. Пример:

```powershell
npm ci
npm run verify
.\BUILD-RELEASE.cmd
```

Для воспроизводимого offline release необходимо предварительно установить все npm/Cargo-зависимости в локальные кеши. Сценарии сборки доступны в Source ZIP и в ветке GitHub. ZIP выпуска и результаты публикации проверяются отдельно; SHA-256 не подтверждает безопасность приложения.

## История и релизы

- [v1.2.0 Stable (HF49)](https://github.com/TraurigerEngel/Kinoteka/releases/tag/v1.2.0) — текущая версия; описание в [RELEASE_NOTES_v1.2_STABLE.md](RELEASE_NOTES_v1.2_STABLE.md).
- [v1.2.0-preview.1 (HF43)](https://github.com/TraurigerEngel/Kinoteka/releases/tag/v1.2.0-preview.1) — сохранённый предварительный выпуск.
- [v1.1.0 Stable](https://github.com/TraurigerEngel/Kinoteka/releases/tag/v1.1.0) — предыдущая стабильная версия.

## Конфиденциальность и лицензии

Приложение хранит библиотеку в локальной SQLite, а постеры — локально; добровольный поиск изображений Wikimedia Commons обращается в интернет. **Никогда не публикуйте рабочую папку `data`, пользовательские постеры, резервные копии, экспорт Letterboxd и токены.** В публичной ветке присутствует только пустая база `seed-data/kinoteka.sqlite3`.

Исходный код — [MIT](LICENSE), сторонние компоненты, Inter и Lucide/Feather — со своими условиями, см. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Оригинальный Source ZIP из Windows-сборки опубликован побайтово и не включает файлы лицензий; полный публичный Git-тег содержит `LICENSE` и `THIRD_PARTY_NOTICES.md`.
