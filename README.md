# Kastos

> Personal finance manager built as a Progressive Web App. Track income, expenses, savings goals and category budgets — entirely client-side, no backend required.

[![Live demo](https://img.shields.io/badge/demo-live-brightgreen)](https://danibaranco.github.io/kastos/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![No backend](https://img.shields.io/badge/backend-none-lightgrey)
![PWA](https://img.shields.io/badge/PWA-offline--ready-blueviolet)

---

## Features

- **Dashboard** — monthly balance, income, expenses and net savings at a glance
- **Transaction log** — full history with filters by month, category and type
- **Category budgets** — custom emoji/color categories with monthly spending limits and visual alerts (90 % warning, 100 % exceeded)
- **Savings goals** — target amount, deadline and progress tracking
- **Recurring expenses** — mark any transaction as recurring; the app auto-generates copies at the start of each month
- **Charts** — bar chart (income vs expenses, 6-month window), doughnut (spending by category), line chart (accumulated savings over time)
- **Data portability** — full export/import in JSON; transaction export in CSV
- **Installable PWA** — works fully offline once installed on any device

## Tech stack

| Layer | Technology |
|---|---|
| UI | HTML5 · CSS3 · JavaScript ES Modules (no framework, no build step) |
| Persistence | IndexedDB via native browser API |
| Charts | [Chart.js 4](https://www.chartjs.org/) (CDN) |
| Typography | Inter (Google Fonts) |
| Icons | Flaticon Uicons |
| Offline | Service Worker (network-first for app shell, cache-first for CDN assets) |
| PWA | Web App Manifest |

## Architecture

The app is a single-page application with a hash-based router. All state lives in IndexedDB — there is no server, no authentication and no external API call.

```
kastos/
├── index.html              # SPA shell — all views and modals inline
├── sw.js                   # Service Worker (offline-first caching strategy)
├── manifest.webmanifest    # PWA metadata
├── make_icons.py           # Pillow-based icon generator (no native deps)
├── css/
│   └── styles.css          # Design tokens, layout, components, dark theme
├── js/
│   ├── db.js               # IndexedDB abstraction layer (CRUD + export/import)
│   ├── charts.js           # Chart.js wrappers (bar, doughnut, line)
│   └── app.js              # Router, view renderers, business logic
└── icons/                  # PWA icons (192 · 512 · maskable · apple-touch · favicon)
```

### IndexedDB schema (`kastos-db` v1)

| Store | Key | Notable fields |
|---|---|---|
| `transactions` | autoIncrement `id` | `type`, `amount`, `description`, `categoryId`, `date`, `recurring` |
| `categories` | autoIncrement `id` | `emoji`, `name`, `color`, `budget` |
| `goals` | autoIncrement `id` | `name`, `target`, `saved`, `deadline`, `emoji` |
| `settings` | inline key | `currency`, `userName`, `recurringApplied` |

## Getting started

Any static file server works. No build step is needed.

```bash
# Python (stdlib)
python -m http.server 8080 --directory kastos/

# Node.js
npx serve kastos/
```

Then open `http://localhost:8080` in your browser.

### Regenerate icons

The included icons were generated with [Pillow](https://python-pillow.org/) (no system-level dependencies required on Windows).

```bash
pip install pillow
python make_icons.py
```

## Privacy

All data is stored exclusively in the browser's IndexedDB on the local device. No data is transmitted to any server. The application is fully functional without a network connection after the initial load.

## License

[MIT](LICENSE)
