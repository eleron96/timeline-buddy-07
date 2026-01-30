# Timeline Planner

Веб‑приложение для командного планирования задач на таймлайне с проектами, участниками, виджетами и админ‑панелью. Фронтенд на Vite/React/TypeScript, бэкенд и авторизация — Supabase, интеграция через Edge Functions.

## Возможности

- Таймлайн задач с двумя режимами отображения (timeline / calendar), фильтрами и быстрым созданием задач.
- Проекты с цветами, архивированием и просмотром задач проекта.
- Сотрудники: список участников, их задачи, массовые действия, фильтры и история.
- Дашборд с настраиваемыми виджетами и автосохранением раскладки.
- Роли и доступ: viewer/editor/admin, инвайты по email или ссылке.
- Настройки воркспейса: статусы, типы задач, теги, шаблоны, удаление.
- Супер‑админка: пользователи, воркспейсы, супер‑админы, бэкапы.

## Архитектура и ключевые модули

- `src/app/App.tsx` — маршрутизация и защита страниц.
- `src/features/planner` — таймлайн, задачи, фильтры, панель деталей.
- `src/features/dashboard` — дашборд и виджеты аналитики.
- `src/features/projects` — список проектов и задачи проекта.
- `src/features/members` — участники и их задачи/доступ.
- `src/features/workspace` — настройки воркспейса и управление участниками.
- `infra/supabase` — миграции и Edge Functions (`admin`, `invite`).
- `infra/backup-service` — сервис бэкапов (доступ через `/backup`).

## Требования

- Node.js 20+
- Docker Desktop (для локального Supabase через Compose)
- Supabase CLI (опционально, для локального Supabase без Compose)

## Быстрый старт (Docker Compose)

Самый простой способ поднять весь стек локально.

```sh
make up
```

Что произойдет:
- Поднимется Supabase‑стек (db/auth/rest/functions/gateway) и фронтенд.
- `.env` будет сгенерирован автоматически (JWT/ANON/SERVICE роли).
- Данные сохраняются в volume `supabase_db_data`.

Остановить контейнеры (данные сохраняются):

```sh
make down
```

Логи контейнеров:

```sh
make logs
```

Сервис доступен:
- Frontend: `http://localhost:5173`
- Supabase Gateway: `http://localhost:8080`
- Postgres: `localhost:54322`

## Локальный запуск с Supabase CLI

Используйте, если хотите локальный Supabase вне Docker Compose.

```sh
npm install
npm run dev:local
```

Скрипт:
- запускает `supabase start` в `infra/`;
- записывает `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` в `.env`;
- поднимает `supabase functions serve invite`;
- стартует фронтенд (`npm run dev`).

## Локальный запуск через Compose скрипт

Эквивалент `make up`, но в npm‑формате.

```sh
npm run dev:compose
```

## Ручная настройка Supabase (если используете внешний проект)

1) Создайте Supabase‑проект.
2) Примените миграции из `infra/supabase/migrations/`.
3) Создайте `.env` на основе `.env.example` и заполните:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4) Разверните Edge Functions:
   ```sh
   cd infra
   supabase functions deploy invite
   supabase functions deploy admin
   ```
5) Настройте переменные функций:
   - `APP_URL` (например, `http://localhost:5173`)
   - `RESEND_API_KEY` и `RESEND_FROM` (опционально для email‑инвайтов)
   - `RESERVE_ADMIN_EMAIL`, `RESERVE_ADMIN_PASSWORD` (см. ниже)
6) Включите email‑auth в Supabase и настройте SMTP при необходимости.

## Переменные окружения

Ключевые:

- `VITE_SUPABASE_URL` — URL Supabase Gateway.
- `VITE_SUPABASE_ANON_KEY` — публичный ключ.
- `RESEND_API_KEY`, `RESEND_FROM` — отправка инвайтов через Resend.
- `RESERVE_ADMIN_EMAIL`, `RESERVE_ADMIN_PASSWORD` — резервный супер‑админ.

Файл‑шаблон: `.env.example`. В Compose‑режиме `.env` создается автоматически.

## Супер‑админка

- Страница: `/admin/users`.
- Доступ только для пользователей из таблицы `super_admins`.
- Резервный супер‑админ создается автоматически, если заданы:
  - `RESERVE_ADMIN_EMAIL`
  - `RESERVE_ADMIN_PASSWORD`

## Использование

1) Перейдите на `/auth`, зарегистрируйтесь или войдите.
2) Создайте воркспейс (создается автоматически при первом входе).
3) На таймлайне создайте задачи и назначьте участников.
4) В `Projects` управляйте проектами и смотрите задачи.
5) В `Members`:
   - вкладка `Tasks` — задачи участников с фильтрами и массовыми действиями;
   - вкладка `Access` — приглашения и роли.
6) В `Dashboard` добавляйте и настраивайте виджеты.
7) В `Workspace settings` настраивайте статусы, типы, теги и шаблоны.

## Скрипты

```sh
npm run dev         # фронтенд
npm run dev:local   # Supabase CLI + фронтенд
npm run dev:compose # Docker Compose
npm run build
npm run lint
npm run test
npm run test:watch
```

## Тестирование и линтинг

- `npm run test` — прогон тестов.
- `npm run lint` — линтер.

## Примечания

- Инвайты работают через Edge Function `invite` и возвращают ссылку, если email не отправлен.
- Бэкапы доступны в супер‑админке (вкладка `Backups`).
- Все пользовательские настройки и роли ограничены RLS в Supabase.
