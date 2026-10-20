# Кинотека v1.2 Stable (HF49) — конфиденциальность публикации

- `Kinoteka_Standalone_v1.2_Stable_Portable.zip`: `Kinoteka.exe` и две чистые SQLite, без личных данных.
- В `data/kinoteka.sqlite3` и `seed-data/kinoteka.sqlite3` проверено `PRAGMA integrity_check = ok`. Оба файла идентичны (SHA-256: `c77594b04f0a4049317d670ced7139f70e8501cc903fee5fd0439bfea85c3834`).
- Структура: `state` и `ui_state`; `items=[]`, `favorites=[]`, `trash=[]`, `revision=0`. Строки служебного состояния присутствуют, но записей фильмов нет.
- Личные коллекции, пользовательские постеры, рабочие резервные копии, cookies и API-токены в релизных архивах не обнаружены.
- Репозиторий **публичный**. В Git хранится только чистая `seed-data/kinoteka.sqlite3`; рабочая `data/*.sqlite3` исключена через `.gitignore`.
- Готовый ZIP нельзя распаковывать поверх рабочего экземпляра с реальной библиотекой: его `data/kinoteka.sqlite3` пустая.
- Исходный Release Source ZIP сохранён без изменений, а `LICENSE` / `THIRD_PARTY_NOTICES.md` сохраняются в публичной Git-ветке.
- Данные исходной сборки приведены в `RELEASE-METADATA.json`, контрольные суммы — в `SHA256SUMS.txt`.
