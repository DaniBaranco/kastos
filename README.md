# Kastos

> Tu **bolsa de ahorro** con un plan, 100 % local. Registra lo que apartas,
> márcate un patrón mensual, simula escenarios y comprueba si llegas a tus
> objetivos. Sin gastos, sin categorías, sin contabilidad: solo ahorro.

[![Live](https://img.shields.io/badge/demo-live-brightgreen)](https://danibaranco.github.io/kastos/)
![PWA](https://img.shields.io/badge/PWA-offline--ready-blueviolet)
![No backend](https://img.shields.io/badge/backend-none-lightgrey)

## La dinámica

1. **Mi ahorro** — Tu bolsa: aportaciones y retiradas mes a mes, tu ritmo real
   y la evolución del acumulado. Todo usuario **parte de 0**; si ya tienes
   ahorros, los añades como *punto de partida*: suman a la bolsa pero no cuentan
   como ahorro del mes ni distorsionan tu ritmo. Todo queda registrado en el
   dispositivo: vuelves a la app y tus datos siguen ahí, listos para
   actualizarlos.
2. **Patrones de ahorro** — Decide cuánto quieres apartar cada mes ("Base:
   150 €/mes", "Ambicioso: 300 €/mes", con interés anual opcional). El patrón
   activo es tu compromiso: Kastos mide cada mes si lo cumples.
3. **Simulación** — Compara escenarios: ¿dónde estará tu bolsa en 1, 2, 5 o 10
   años con cada patrón? (capitalización mensual, con desglose aportado vs.
   intereses).
4. **Objetivos** — Boda, coche, colchón… con importe y fecha. Kastos calcula la
   cuota mensual necesaria y la compara con tu patrón: *en camino / ajustado /
   inalcanzable*, con fecha alternativa realista si no llegas.

Además: export JSON/CSV, **import con migración automática desde versiones
anteriores** (v1 y v2), recordatorio de copia de seguridad y tema
claro/oscuro/sistema.

## Stack

| Capa | Tecnología |
|---|---|
| UI | Svelte 5 (runes) + TypeScript estricto + Vite |
| Persistencia | Dexie sobre IndexedDB (`kastos-v2`) |
| Offline / PWA | vite-plugin-pwa (precache, autoUpdate) |
| Gráficas | Chart.js 4 (registro selectivo, tree-shaking) |
| Iconos | [UIcons de Flaticon](https://www.flaticon.com/uicons) (CDN, cacheado offline por el SW) |
| Estilos | CSS vanilla con design tokens; estética minimalista tipo Trade Republic, light por defecto, mobile-first |
| Tests | Vitest (motor de cálculo `src/lib/core/`) |
| CI/CD | GitHub Actions: lint + check + test + build; deploy a Pages desde `main` |

## Principios

- **Importes en céntimos enteros** en todo el dominio; los floats solo existen
  en el borde (parseo de input y `Intl.NumberFormat` de salida).
- **Motor de cálculo puro** (`src/lib/core/`): sin DOM, sin Dexie, 100 % testeado.
  La UI nunca calcula dinero.
- **Fechas civiles locales**: `YYYY-MM-DD` / `YYYY-MM`, sin timezones.
- **Esquema versionado**: exports con `schemaVersion: 3`; el import valida antes
  de escribir (un archivo corrupto no toca tus datos) y migra exports v1/v2.

## Desarrollo

```bash
npm install
npm run dev       # servidor de desarrollo
npm test          # tests del motor (Vitest)
npm run check     # svelte-check (tipos)
npm run lint      # prettier + eslint
npm run build     # build de producción (base /kastos/)
```

Iconos PWA: `python scripts/make_icons.py` (requiere Pillow).

## Estructura

```
src/
├── App.svelte              # shell: tabs, tema, bienvenida
├── app.css                 # design tokens + base (light/dark)
├── lib/
│   ├── core/               # motor puro + tests (dinero, fechas, bolsa de
│   │                       #   ahorro, simulación de patrones, objetivos,
│   │                       #   migradores v1/v2 → v3)
│   ├── db/                 # Dexie + repositorios
│   ├── stores/             # estado global (runes) y toasts
│   ├── components/         # Modal, TabBar, formularios, gráficas…
│   ├── views/              # Mi ahorro · Simulación · Objetivos · Ajustes
│   ├── export/             # CSV + descarga de ficheros
│   └── i18n/es.ts          # strings centralizados
docs/v1-schema.md           # análisis del esquema y lógica de v1
legacy/v1/                  # código de la v1 (referencia)
```

## Persistencia y migración

Todo se guarda automáticamente en IndexedDB: al volver a la app, los datos
introducidos siguen ahí para consultarlos o actualizarlos. Para copias de
seguridad o cambio de dispositivo: Ajustes → *Exportar todo (JSON)* /
*Importar datos (JSON)*. El import acepta copias de cualquier versión: de
v1/v2 se conservan el ahorro registrado y los objetivos (el `saved` de cada
meta v1 se convierte en aportación inicial); los movimientos de gastos e
ingresos de versiones antiguas se descartan porque la app ya no los modela.
Detalles del esquema v1 en [docs/v1-schema.md](docs/v1-schema.md).

## Privacidad

Sin registro, sin nube, sin telemetría, sin peticiones de red tras la carga.
Todos los datos viven en el IndexedDB de tu dispositivo.

## Licencia

[MIT](LICENSE)
