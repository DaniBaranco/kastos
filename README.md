# Kastos — Finanzas del Hogar

PWA de gestión de ingresos, gastos y ahorro familiar. **100% local**, sin registro, sin nube. Los datos se guardan cifrados en el dispositivo mediante IndexedDB.

## ✨ Funcionalidades

- 💰 **Dashboard** con saldo del mes, ingresos, gastos y ahorro en tiempo real
- 📊 **Gráfica de evolución** — ingresos vs gastos de los últimos 6 meses
- 🍩 **Gráfica de dona** — distribución de gastos por categoría
- 📋 **Movimientos** — listado completo con filtros por mes, categoría y tipo
- 🏷️ **Categorías personalizables** con emoji, color y presupuesto mensual
- 🎯 **Metas de ahorro** con progreso visual y alerta de fecha límite
- 💾 **Exportar / Importar** datos en JSON y CSV
- 📱 **PWA instalable** — funciona offline como app nativa

## 🎨 Design System

Inspirado en eToro: dark mode profundo, acentos verde lima `#00c853`, tarjetas glassmórficas, tipografía Inter, botones pill y números grandes.

## 🛠️ Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript (ES Modules) |
| Persistencia | IndexedDB (API nativa) |
| Gráficas | Chart.js 4 (CDN) |
| Fuentes | Inter (Google Fonts) |
| Iconos UI | Flaticon Uicons |
| PWA | Service Worker + Web App Manifest |

## 📁 Estructura

```
kastos/
├── index.html              # SPA principal (todas las vistas)
├── sw.js                   # Service Worker (offline-first)
├── manifest.webmanifest    # Metadatos PWA
├── make_icons.py           # Generador de iconos PNG
├── css/
│   └── styles.css          # Tema dark completo
├── js/
│   ├── db.js               # Capa IndexedDB (CRUD)
│   ├── charts.js           # Gráficas Chart.js
│   └── app.js              # Lógica principal + router SPA
└── icons/                  # Iconos PWA (genera con make_icons.py)
```

## 🚀 Uso local

```bash
# Servir localmente (cualquier servidor estático)
npx serve .
# o con Python
python -m http.server 8080
```

Abre `http://localhost:8080` en el navegador.

## 🖼️ Generar iconos

```bash
pip install cairosvg pillow
python make_icons.py
```

## 🔒 Privacidad

Todos los datos se guardan **solo en este dispositivo** usando IndexedDB. Ningún dato se envía a ningún servidor. La app funciona completamente sin conexión una vez instalada.
