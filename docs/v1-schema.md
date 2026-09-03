# Kastos v1 — Análisis de esquema y lógica de negocio

> Documento de la Fase 1 del brief v2. Fuente: código de v1 (ahora en `legacy/v1/`),
> en su última revisión (v1.1, con la calculadora de interés compuesto incluida).

## 1. Persistencia

v1 **no usa localStorage**: todo vive en **IndexedDB**, base de datos `kastos-db`,
versión `1`, con acceso mediante la API nativa (sin librerías). Stores:

| Store | keyPath | Índices | Contenido |
|---|---|---|---|
| `transactions` | `id` (autoIncrement, number) | `date`, `type`, `categoryId` | Movimientos |
| `categories` | `id` (autoIncrement, number) | — | Categorías |
| `goals` | `id` (autoIncrement, number) | — | Metas de ahorro |
| `settings` | clave out-of-line (string) | — | Ajustes sueltos |

Claves usadas en `settings`: `currency` (string), `userName` (string),
`recurringApplied` (string `YYYY-MM`, control de idempotencia de recurrentes),
`welcomeSeen` (string `'1'`, añadida en v1.1 para la guía de bienvenida).

El Service Worker (`sw.js`) solo cachea el app shell; nunca toca datos.

## 2. Esquema del export JSON (v1)

Generado por `exportAllData()` en `legacy/v1/js/db.js`:

```jsonc
{
  "transactions": [
    {
      "id": 3,                      // number, autoIncrement de IndexedDB
      "type": "expense",            // "income" | "expense"
      "amount": 42.5,               // number, EUROS en float, SIEMPRE positivo
      "description": "Mercadona",   // string (máx. 60 en UI)
      "categoryId": 1,              // number; puede apuntar a categoría borrada
      "date": "2026-09-01",         // string YYYY-MM-DD (de <input type=date>)
      "note": "",                   // string (máx. 120), puede faltar
      "recurring": false            // boolean; true = actúa como PLANTILLA mensual
    }
  ],
  "categories": [
    {
      "id": 1,
      "emoji": "🛒",                // string (máx. 2 chars)
      "name": "Alimentación",       // string (máx. 30)
      "color": "#30d158",           // hex string
      "budget": 0                   // number, EUROS float; 0 = sin presupuesto
    }
  ],
  "goals": [
    {
      "id": 1,
      "name": "Vacaciones",         // string (máx. 50)
      "target": 1500,               // number, EUROS float, > 0
      "saved": 350,                 // number, EUROS float — ALMACENADO, no derivado
      "deadline": "2027-06-01",     // YYYY-MM-DD o "" (opcional en v1)
      "emoji": "🏖️"
    }
  ],
  "settings": {
    "currency": "EUR",              // "EUR" | "USD" | "GBP" | "MXN"
    "userName": ""
  },
  "exportedAt": "2026-09-02T10:00:00.000Z"  // ISO, informativo
}
```

Notas para el migrador v1 → v2:

- **Importes**: float de euros → multiplicar por 100 y redondear (`Math.round(amount * 100)`)
  para obtener céntimos enteros. Siempre positivos; el signo lo da `type`.
- **IDs**: numéricos autoincrementales → generar UUID nuevos y mapear
  `categoryId` numérico → UUID de la categoría migrada. `categoryId` colgante
  (categoría borrada) → `null`.
- **`transactions[].recurring === true`** → en v2 se convierte en una
  `RecurringRule` (dayOfMonth = 1, ver §4) **y además** el propio movimiento se
  conserva en el histórico como movimiento normal.
- **`goals[].saved`** → v2 no almacena `savedCents`: crear una `SavingsEntry`
  inicial de importe `saved` asignada al objetivo (mes = mes del import), de modo
  que el acumulado derive correctamente.
- **`goals[].deadline` vacío** → v2 exige deadline: usar +12 meses desde el import
  y marcarlo en la nota, o pedir fecha al usuario (decisión de diseño: default +12m).
- El export v1 **no tiene `schemaVersion`**: su ausencia (junto a la presencia de
  `transactions`) es el discriminador para detectar un export v1.
- El import v1 en la propia v1 solo valida `data.transactions != null`; machaca
  todos los stores y conserva IDs. v2 debe validar de verdad.

## 3. Export CSV (v1)

Solo movimientos. Separador `;`, BOM UTF-8, cabeceras es-ES:
`Fecha;Tipo;Descripción;Categoría;Importe;Nota;Recurrente`.
Importe con `toFixed(2)` (punto decimal), tipo traducido ("Ingreso"/"Gasto"),
categoría como `emoji nombre`. No se reimporta (solo salida).

## 4. Lógica de negocio no obvia

1. **Recurrentes por plantilla**: no hay entidad propia. Un movimiento con
   `recurring: true` es a la vez un movimiento del histórico **y** la plantilla.
   Al arrancar la app, si `settings.recurringApplied !== YYYY-MM` actual, por cada
   plantilla se crea una **copia no recurrente** con fecha `YYYY-MM-01`, salvo que
   ya exista un movimiento no recurrente del mes con la misma
   `description + categoryId` (heurística anti-duplicados). Después se escribe
   `recurringApplied = YYYY-MM`. La copia siempre se fecha el día 1; ambos tipos
   (ingreso/gasto) se copian aunque la UI lo llame "Gasto recurrente".
2. **Presupuestos**: alertas al 90 % (aviso) y 100 % (superado) del presupuesto
   mensual por categoría, como toasts una sola vez por categoría/mes y sesión
   (estado en memoria, no persistido). Barras de progreso en la vista Categorías.
3. **Borrado de categoría**: los movimientos asociados conservan el `categoryId`
   colgante y se pintan como "Sin categoría" en render. No hay limpieza.
4. **"Ahorro" del dashboard** = `ingresos − gastos` del mes (capacidad, no ahorro
   real). La gráfica "Ahorro acumulado" acumula ese neto de los últimos 6 meses,
   con `Math.max(0, acc)` (los acumulados negativos se truncan a 0 — pérdida de
   información que v2 no debe replicar).
5. **Categorías por defecto**: se siembran 10 al primer arranque (Alimentación,
   Vivienda, Transporte, Salud, Ocio, Ropa, Tecnología, Educación, Nómina, Otros).
6. **Meses**: el resumen mensual filtra con `new Date(t.date)` y compara
   año/mes locales; los filtros de Movimientos comparan por prefijo `YYYY-MM`.

## 5. Calculadora de interés compuesto (v1.1)

Ubicación: vista **Ahorro** (`#view-metas`), pestaña `📈 Calculadora`
(control segmentado `seg-metas | seg-calc`). Código: `runCalculator()` en
`legacy/v1/js/app.js` + `renderProjectionChart()` en `legacy/v1/js/charts.js`.
No está en un fichero aparte ni en un modal: por eso no se ve en el HTML de la
home sin interactuar (el panel arranca con clase `hidden`).

- **Inputs** (recalculo en vivo con `input`): ahorro inicial (€ ≥ 0, default 1000),
  aportación mensual (€ ≥ 0, default 100), interés anual % (0–30, default 5),
  años (1–50 con clamp, default 10).
- **Fórmula**: iterativa con **capitalización mensual fija**, aportación al final
  de cada mes: `balance = balance × (1 + r/12) + aportación`, 12 iteraciones por
  año. Equivale a `FV = P·(1+i)^n + A·[((1+i)^n − 1)/i]` con `i = r/12`,
  `n = años × 12` (aportación vencida). `r = 0` funciona por ser iterativa.
- **Outputs**: total final, total aportado (`inicial + mensual × n`), intereses
  (`total − aportado`, truncado a ≥ 0 en pantalla), y gráfica de líneas año a año
  con dos series: "Total con intereses" (relleno) vs. "Aportado por ti" (punteada).
  Etiquetas "Hoy, Año 1 … Año N". Símbolo de moneda según ajustes.
- **Limitaciones a superar en v2** (paridad mejorada): sin selector de frecuencia
  de capitalización (v2: mensual/anual), opera en floats (v2: céntimos), gráfica
  de líneas superpuestas (v2: aportado vs. intereses apilados), y sin conexión con
  el ritmo real de ahorro del usuario (v2: botón "usar mi ritmo actual").
