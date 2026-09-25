# Развёртывание tdzz.ru

## Требования к хостингу
* Apache (или nginx) со статикой, PHP 7.4+ с функцией `mail()`.
* Возможность записи в папку `data/` (для редактора цен и журнала заявок).

## Первый запуск
1. Скопируйте всё из `dist/` в корень сайта (например, `public_html/`).
2. Откройте `api/config.php` на сервере и заполните:
   * `admin_password` — пароль редактора цен (пока стоит `change-me-please`, редактор не будет сохранять);
   * `mail_routes` / `mail_to` — почта для заявок по типу формы (Trade@ / export@ / info@), `mail_from` — адрес отправителя на домене сайта;
   * при желании `telegram_token` и `telegram_chat_id`.
3. Убедитесь, что папка `data/` доступна на запись веб-серверу.
4. Откройте `https://tdzz.ru/admin/`, введите пароль, «Загрузить с сайта», измените любую цену,
   «Сохранить на сайт», обновите главную — цена должна измениться.
5. Отправьте тестовую заявку с формы на главной; письмо должно прийти на `mail_to`,
   запись — появиться в `data/leads/`.

## Обновление сайта после правок текстов
Вручную: `python3 build.py` → загрузить содержимое `dist/`, **кроме** `data/` и `api/config.php`
(если случайно перезаписали цены — актуальная копия лежит в `data/backups/`).
Автоматически: см. раздел «GitHub + автодеплой» ниже — после `git push` сайт обновится сам.

## GitHub + автодеплой (CI/CD)
Проект уже содержит `.github/workflows/deploy.yml`: при каждом push в ветку `main`
GitHub собирает сайт (`build.py`) и заливает `dist/` на хостинг по SSH (rsync).
Папка `data/` (цены из админки, заявки, вложения) и `api/config.php` на сервере **не перезаписываются** —
они заливаются только один раз, если их ещё нет.

### 1. Репозиторий
```bash
cd tdzz-site
git init -b main
git add .
git commit -m "tdzz.ru: сайт"
# создайте на GitHub пустой ПРИВАТНЫЙ репозиторий (без README), затем:
git remote add origin git@github.com:ВАШ_ЛОГИН/tdzz-site.git
git push -u origin main
```
`api/config.php` в репозиторий не попадает (он в `.gitignore`); в git лежит `api/config.example.php`.

### 2. SSH-ключ для деплоя
На своём компьютере:
```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/tdzz_deploy -N ""
cat ~/.ssh/tdzz_deploy.pub     # публичный — в Timeweb
cat ~/.ssh/tdzz_deploy         # приватный — в GitHub
```
В панели Timeweb: **Хостинг → SSH → SSH-ключи → Добавить** — вставьте содержимое `tdzz_deploy.pub`.
Там же посмотрите хост и логин SSH (вида `vh123.timeweb.ru`, `cv12345`) и путь к сайту
(обычно `/home/c/cv12345/tdzz.ru/public_html`).

### 3. Секреты в GitHub
Репозиторий → **Settings → Secrets and variables → Actions → New repository secret**:

| Секрет | Значение |
|---|---|
| `SSH_HOST` | хост SSH, например `vh123.timeweb.ru` |
| `SSH_USER` | логин хостинга, например `cv12345` |
| `SSH_KEY` | содержимое приватного ключа `tdzz_deploy` целиком |
| `REMOTE_PATH` | путь к корню сайта, например `/home/c/cv12345/tdzz.ru/public_html` |

### 4. Первый деплой
Вкладка **Actions → Deploy to hosting → Run workflow** (или просто сделайте push).
После первого запуска зайдите на сервер (файловый менеджер Timeweb или SFTP) и заполните
`api/config.php`: пароль админки, при необходимости `mail_from`, Telegram.
Дальше всё обновляется само: правка в `src/` → commit → push → через ~1 минуту на сайте.

### Если на тарифе нет SSH
Используйте `.github/workflows/deploy-ftp.yml` (выкладка по FTPS): удалите `deploy.yml`,
в `deploy-ftp.yml` замените `workflow_dispatch:` на `push: {branches: [main]}` и добавьте секреты
`FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`, `FTP_PATH`. `data/` и `config.php` при этом загрузите вручную один раз.

### Как это сочетается с админкой цен
Цены редактируются на сервере через `/admin/` и хранятся в `data/prices.json`; деплой их не трогает.
В репозитории `src/data/prices.json` — только стартовые значения для нового сервера.

## nginx (если не Apache)
```
location /api/config.php { deny all; }
location ~ ^/data/(leads|backups)/ { deny all; }
location ~ \.log$ { deny all; }
error_page 404 /404.html;
gzip on; gzip_types text/css application/javascript application/json image/svg+xml;
```

## Метрика / аналитика
`src/data/site.json` → `metrika_id` (только цифры) и/или `ga_id`, затем пересобрать.
Цели: `quiz_done`, `passport_done`, `form_supplier`, `form_export_rfq`, `form_contact` (тип «JavaScript-событие»).
