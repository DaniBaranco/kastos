# Kastos

> Tu **hipoteca** y los **gastos de casa**, bajo control y 100 % local.
> Guarda tu préstamo para saber cuánto pagarás, cuánto te queda y cuándo
> terminas; apunta tus facturas mes a mes y compara en el histórico en qué
> meses pagas más luz, gas o agua.

[![Live](https://img.shields.io/badge/demo-live-brightgreen)](https://danibaranco.github.io/kastos/)
![PWA](https://img.shields.io/badge/PWA-offline--ready-blueviolet)
![No backend](https://img.shields.io/badge/backend-none-lightgrey)

## La dinámica

1. **Hipoteca** — Capital, TIN, plazo y mes de la primera cuota. Kastos genera
   el cuadro de amortización (sistema francés) y te muestra la cuota, el capital
   pendiente, los intereses pagados y pendientes, el total a pagar y la fecha de
   fin. Registra **revisiones de tipo** (variables/mixtas) y **amortizaciones
   anticipadas** (reduciendo plazo o cuota) y verás cuánto te ahorran. Cuadro
   por años o por meses, con gráficas y export CSV. Admite varias hipotecas.
2. **Gastos** — Control mes a mes: luz, gas, agua, comunidad, seguros… en
   categorías personalizables. La cuota de la hipoteca se suma sola a cada mes
   (opcional). Comparativa con el mes anterior y con el mismo mes del año
   pasado, y botón para copiar los gastos del mes anterior.
3. **Histórico** — Evolución mes a mes, comparativa año contra año,
   **estacionalidad** (media de cada mes natural: "pagas más gas en enero") y
   tabla categoría × mes. Filtrable por categoría y periodo.
4. **Interés compuesto** — Calculadora independiente: capital inicial,
   aportación mensual, interés y plazo, con desglose aportado vs. intereses.

Además: export JSON/CSV, **import con migración automática desde versiones
anteriores** (de la v1 se recuperan los gastos; de las v2/v3 de ahorro, los
ajustes), recordatorio de copia de seguridad y tema claro/oscuro/sistema.

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
- **Esquema versionado**: exports con `schemaVersion: 4`; el import valida antes
  de escribir (un archivo corrupto no toca tus datos) y migra exports v1/v2/v3.

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
│   ├── core/               # motor puro + tests (dinero, fechas, hipoteca
│   │                       #   y amortización, gastos e histórico, interés
│   │                       #   compuesto, migradores v1/v2/v3 → v4)
│   ├── db/                 # Dexie + repositorios
│   ├── stores/             # estado global (runes) y toasts
│   ├── components/         # Modal, TabBar, formularios, gráficas…
│   ├── views/              # Hipoteca · Gastos · Histórico · Interés · Ajustes
│   ├── export/             # CSV + descarga de ficheros
│   └── i18n/es.ts          # strings centralizados
docs/v1-schema.md           # análisis del esquema y lógica de v1
legacy/v1/                  # código de la v1 (referencia)
```

## Persistencia y migración

Todo se guarda automáticamente en IndexedDB: al volver a la app, los datos
introducidos siguen ahí para consultarlos o actualizarlos. Para copias de
seguridad o cambio de dispositivo: Ajustes → *Exportar todo (JSON)* /
*Importar datos (JSON)*. El import acepta copias de cualquier versión: de la
v1 se recuperan los gastos (cada movimiento pasa a su mes y categoría); las
versiones de ahorro (v2/v3) solo aportan los ajustes, porque la bolsa de
ahorro, los patrones y los objetivos ya no existen en la app.
Detalles del esquema v1 en [docs/v1-schema.md](docs/v1-schema.md).

## Privacidad

Sin registro, sin nube, sin telemetría, sin peticiones de red tras la carga.
Todos los datos viven en el IndexedDB de tu dispositivo.

## Licencia

[MIT](LICENSE)
