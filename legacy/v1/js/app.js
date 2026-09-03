// app.js — Lógica principal de Kastos.
// Router SPA, gestión de vistas, modales, dashboard, movimientos,
// categorías, metas y ajustes. Todo con IndexedDB local.

import {
  addTransaction, updateTransaction, deleteTransaction, getAllTransactions,
  addCategory, updateCategory, deleteCategory, getAllCategories,
  addGoal, updateGoal, deleteGoal, getAllGoals,
  getSetting, setSetting, resetAllData, exportAllData, importAllData,
} from './db.js';

import { renderEvolutionChart, renderDonutChart, renderSavingsChart, renderProjectionChart, formatCurrency, PALETTE } from './charts.js';

// ══════════════════════════════════════════════════════════════════
// Estado global
// ══════════════════════════════════════════════════════════════════

const state = {
  transactions: [],
  categories:   [],
  goals:        [],
  currency:     'EUR',
  userName:     '',
  currentMonth: new Date().getMonth(),
  currentYear:  new Date().getFullYear(),
};

// Categorías por defecto que se crean en el primer arranque.
const DEFAULT_CATEGORIES = [
  { emoji: '🛒', name: 'Alimentación',  color: '#30d158', budget: 0 },
  { emoji: '🏠', name: 'Vivienda',      color: '#0a84ff', budget: 0 },
  { emoji: '🚗', name: 'Transporte',    color: '#ffd60a', budget: 0 },
  { emoji: '💊', name: 'Salud',         color: '#ff453a', budget: 0 },
  { emoji: '🎉', name: 'Ocio',          color: '#bf5af2', budget: 0 },
  { emoji: '👕', name: 'Ropa',          color: '#ff9f0a', budget: 0 },
  { emoji: '📱', name: 'Tecnología',    color: '#64d2ff', budget: 0 },
  { emoji: '📚', name: 'Educación',     color: '#5e5ce6', budget: 0 },
  { emoji: '💰', name: 'Nómina',        color: '#66d4cf', budget: 0 },
  { emoji: '📦', name: 'Otros',         color: '#8e8e93', budget: 0 },
];

// ══════════════════════════════════════════════════════════════════
// Arranque
// ══════════════════════════════════════════════════════════════════

async function init() {
  await loadSettings();
  await loadData();
  await applyRecurringTransactions(); // crea automáticamente los del mes si no existen
  setupRouter();
  setupInstallBanner();
  setupGreeting();
  registerSW();
  renderCurrentView();
  await maybeShowWelcome(); // guía de bienvenida en el primer arranque
}

async function loadSettings() {
  state.currency = await getSetting('currency') || 'EUR';
  state.userName = await getSetting('userName') || '';
  document.getElementById('currency-select').value = state.currency;
  document.getElementById('user-name').value        = state.userName;
}

async function loadData() {
  [state.transactions, state.categories, state.goals] = await Promise.all([
    getAllTransactions(),
    getAllCategories(),
    getAllGoals(),
  ]);

  // Primera vez: crear categorías por defecto.
  if (state.categories.length === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      await addCategory(cat);
    }
    state.categories = await getAllCategories();
  }
}

// ══════════════════════════════════════════════════════════════════
// Router SPA
// ══════════════════════════════════════════════════════════════════

function setupRouter() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
  });
  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.goto));
  });
}

function navigateTo(viewId) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));

  const view = document.getElementById(`view-${viewId}`);
  const nav  = document.querySelector(`.nav-item[data-view="${viewId}"]`);
  if (view) view.classList.add('active');
  if (nav)  nav.classList.add('active');

  renderCurrentView(viewId);
}

function renderCurrentView(viewId) {
  const active = viewId || document.querySelector('.nav-item.active')?.dataset.view || 'dashboard';
  if (active === 'dashboard')   renderDashboard();
  if (active === 'movimientos') renderMovimientos();
  if (active === 'categorias')  renderCategorias();
  if (active === 'metas')       renderMetas();
}

// ══════════════════════════════════════════════════════════════════
// Dashboard
// ══════════════════════════════════════════════════════════════════

function renderDashboard() {
  updateMonthNav();
  const { income, expense, savings, txs } = getMonthSummary(state.currentYear, state.currentMonth);

  // Saldo
  const balanceEl = document.getElementById('balance-amount');
  balanceEl.textContent = formatCurrency(savings, state.currency);
  balanceEl.classList.toggle('negative', savings < 0);

  document.getElementById('total-income').textContent  = formatCurrency(income,  state.currency);
  document.getElementById('total-expense').textContent = formatCurrency(expense, state.currency);
  document.getElementById('total-savings').textContent = formatCurrency(Math.max(0, savings), state.currency);

  // Últimos movimientos
  renderTxList('recent-tx-list', txs.slice(-5).reverse(), { compact: true });

  // Gráfica evolución (últimos 6 meses)
  const evolutionData = getLast6Months();
  renderEvolutionChart(evolutionData);

  // Gráfica dona (gastos por categoría del mes)
  const donutData = getCategoryBreakdown(state.currentYear, state.currentMonth);
  renderDonutChart(donutData, document.getElementById('donut-legend'));

  // Gráfica ahorro acumulado (últimos 6 meses)
  const savingsData = getLast6Months();
  renderSavingsChart(savingsData);

  // Alertas de presupuesto superado
  checkBudgetAlerts();
}

function updateMonthNav() {
  const date = new Date(state.currentYear, state.currentMonth, 1);
  const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  document.getElementById('month-label').textContent = label.charAt(0).toUpperCase() + label.slice(1);

  if (!_navListeners) {
    document.getElementById('prev-month-btn').addEventListener('click', () => {
      if (state.currentMonth === 0) { state.currentMonth = 11; state.currentYear--; }
      else { state.currentMonth--; }
      renderDashboard();
    });
    document.getElementById('next-month-btn').addEventListener('click', () => {
      if (state.currentMonth === 11) { state.currentMonth = 0; state.currentYear++; }
      else { state.currentMonth++; }
      renderDashboard();
    });
    _navListeners = true;
  }
}
let _navListeners = false;

function getMonthSummary(year, month) {
  const txs = state.transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const income  = txs.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const expense = txs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  return { income, expense, savings: income - expense, txs };
}

function getLast6Months() {
  const result = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const { income, expense } = getMonthSummary(d.getFullYear(), d.getMonth());
    result.push({
      label:   d.toLocaleDateString('es-ES', { month: 'short' }),
      income,
      expense,
    });
  }
  return result;
}

function getCategoryBreakdown(year, month) {
  const expenses = state.transactions.filter((t) => {
    const d = new Date(t.date);
    return t.type === 'expense' && d.getFullYear() === year && d.getMonth() === month;
  });

  const map = {};
  expenses.forEach((t) => {
    const key = t.categoryId || 0;
    map[key] = (map[key] || 0) + t.amount;
  });

  return Object.entries(map)
    .map(([catId, value]) => {
      const cat = state.categories.find((c) => c.id === Number(catId));
      return {
        label: cat ? `${cat.emoji} ${cat.name}` : 'Sin categoría',
        value,
        color: cat?.color || '#8e8e93',
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

// ══════════════════════════════════════════════════════════════════
// Movimientos
// ══════════════════════════════════════════════════════════════════

let _movListeners = false;

function renderMovimientos() {
  populateMonthFilter();
  populateCategoryFilter();
  applyTxFilters();

  if (!_movListeners) {
    document.getElementById('filter-month').addEventListener('change', applyTxFilters);
    document.getElementById('filter-cat').addEventListener('change', applyTxFilters);
    document.getElementById('filter-type').addEventListener('change', applyTxFilters);
    _movListeners = true;
  }
}

function populateMonthFilter() {
  const sel = document.getElementById('filter-month');
  const months = [...new Set(state.transactions.map((t) => t.date.slice(0, 7)))].sort().reverse();
  const cur = `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}`;

  sel.innerHTML = months.map((m) => {
    const [y, mo] = m.split('-');
    const label = new Date(y, mo - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return `<option value="${m}" ${m === cur ? 'selected' : ''}>${label.charAt(0).toUpperCase() + label.slice(1)}</option>`;
  }).join('');

  if (!months.includes(cur)) {
    const label = new Date(state.currentYear, state.currentMonth, 1)
      .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    sel.innerHTML = `<option value="${cur}">${label.charAt(0).toUpperCase() + label.slice(1)}</option>` + sel.innerHTML;
    sel.value = cur;
  }
}

function populateCategoryFilter() {
  const sel = document.getElementById('filter-cat');
  sel.innerHTML = '<option value="">Todas</option>' +
    state.categories.map((c) => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');
}

function applyTxFilters() {
  const month   = document.getElementById('filter-month').value;
  const catId   = document.getElementById('filter-cat').value;
  const type    = document.getElementById('filter-type').value;

  let txs = state.transactions;
  if (month) txs = txs.filter((t) => t.date.startsWith(month));
  if (catId) txs = txs.filter((t) => String(t.categoryId) === catId);
  if (type)  txs = txs.filter((t) => t.type === type);

  renderTxList('all-tx-list', txs.sort((a, b) => b.date.localeCompare(a.date)));
}

// ── Lista de transacciones genérica ──────────────────────────────

function renderTxList(elId, txs, opts = {}) {
  const ul = document.getElementById(elId);
  if (!ul) return;

  if (txs.length === 0) {
    ul.innerHTML = '<li class="tx-empty">No hay movimientos todavía.<br><small style="color:var(--ink-muted)">Pulsa el botón «Añadir» de arriba para registrar tu primer ingreso o gasto.</small></li>';
    return;
  }

  ul.innerHTML = txs.map((t) => {
    const cat    = state.categories.find((c) => c.id === t.categoryId);
    const sign   = t.type === 'income' ? '+' : '-';
    const cls    = t.type;
    const emoji  = cat?.emoji || '💳';
    const catName = cat?.name || 'Sin categoría';
    const date   = new Date(t.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

    return `<li class="tx-item" data-id="${t.id}">
      <div class="tx-icon" style="background:${cat?.color || '#8e8e93'}22">${emoji}</div>
      <div class="tx-info">
        <div class="tx-desc">${escapeHtml(t.description)}${t.recurring ? ' <span style="font-size:11px;color:var(--ink-muted)">🔁</span>' : ''}</div>
        <div class="tx-meta">${catName} · ${date}</div>
      </div>
      <span class="tx-amount ${cls}">${sign}${formatCurrency(t.amount, state.currency)}</span>
    </li>`;
  }).join('');

  // Clic para editar
  ul.querySelectorAll('.tx-item').forEach((li) => {
    li.addEventListener('click', () => {
      const tx = state.transactions.find((t) => t.id === Number(li.dataset.id));
      if (tx) openTxModal(tx);
    });
  });
}

// ══════════════════════════════════════════════════════════════════
// Categorías
// ══════════════════════════════════════════════════════════════════

function renderCategorias() {
  const ul = document.getElementById('cat-list');
  if (!ul) return;

  if (state.categories.length === 0) {
    ul.innerHTML = '<li class="tx-empty">No hay categorías.</li>';
    return;
  }

  ul.innerHTML = state.categories.map((cat) => {
    const spent  = getSpentInCategory(cat.id);
    const budget = cat.budget || 0;
    const pct    = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
    const overBudget  = budget > 0 && spent >= budget;
    const nearBudget  = budget > 0 && !overBudget && pct >= 90;
    const badge  = overBudget  ? '<span class="cat-budget-badge">⚠️ Superado</span>'
                 : nearBudget  ? '<span class="cat-budget-badge" style="color:var(--yellow);border-color:var(--yellow);background:var(--yellow)22">⚡ 90%</span>'
                 : '';
    const fill   = budget > 0 ? `<div class="cat-budget-bar">
      <div class="cat-budget-fill" style="width:${pct}%;background:${pct >= 90 ? 'var(--red)' : cat.color}"></div>
    </div>` : '';
    const budgetText = budget > 0
      ? `${formatCurrency(spent, state.currency)} / ${formatCurrency(budget, state.currency)} (${pct}%)`
      : `${formatCurrency(spent, state.currency)} gastado`;

    return `<li class="cat-item" data-id="${cat.id}">
      <div class="cat-emoji" style="background:${cat.color}22">${cat.emoji}</div>
      <div class="cat-info">
        <div class="cat-name-row"><span class="cat-name">${escapeHtml(cat.name)}</span>${badge}</div>
        <div class="cat-budget-text">${budgetText}</div>
        ${fill}
      </div>
      <div class="cat-actions">
        <button class="icon-btn edit-cat" data-id="${cat.id}" aria-label="Editar"><i class="fi fi-rr-pencil"></i></button>
        <button class="icon-btn danger del-cat" data-id="${cat.id}" aria-label="Eliminar"><i class="fi fi-rr-trash"></i></button>
      </div>
    </li>`;
  }).join('');

  ul.querySelectorAll('.edit-cat').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cat = state.categories.find((c) => c.id === Number(btn.dataset.id));
      if (cat) openCatModal(cat);
    });
  });
  ul.querySelectorAll('.del-cat').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDeleteCategory(Number(btn.dataset.id));
    });
  });
}

function getSpentInCategory(catId, year, month) {
  const now = new Date();
  const y   = year  ?? now.getFullYear();
  const m   = month ?? now.getMonth();
  return state.transactions
    .filter((t) => {
      const d = new Date(t.date);
      return t.type === 'expense' && t.categoryId === catId
        && d.getFullYear() === y && d.getMonth() === m;
    })
    .reduce((a, t) => a + t.amount, 0);
}

async function confirmDeleteCategory(id) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat) return;
  if (!confirm(`¿Eliminar la categoría "${cat.name}"? Los movimientos asociados quedarán sin categoría.`)) return;
  await deleteCategory(id);
  state.categories = await getAllCategories();
  renderCategorias();
  showToast('Categoría eliminada', 'ok');
}

// ══════════════════════════════════════════════════════════════════
// Gastos recurrentes
// ══════════════════════════════════════════════════════════════════

// Crea automáticamente los gastos marcados como recurrentes al inicio
// de cada mes, si aún no existen para el mes en curso.
async function applyRecurringTransactions() {
  const now         = new Date();
  const thisYear    = now.getFullYear();
  const thisMonth   = now.getMonth();
  const monthKey    = `${thisYear}-${String(thisMonth + 1).padStart(2, '0')}`;
  const lastApplied = await getSetting('recurringApplied') || '';

  if (lastApplied === monthKey) return; // ya se aplicaron este mes

  const recurring = state.transactions.filter((t) => t.recurring);
  let created = 0;

  for (const t of recurring) {
    // Comprobar si ya existe una copia en este mes (mismo desc + categoría)
    const alreadyExists = state.transactions.some((tx) =>
      !tx.recurring &&
      tx.description === t.description &&
      tx.categoryId  === t.categoryId &&
      tx.date.startsWith(monthKey)
    );
    if (!alreadyExists) {
      await addTransaction({
        type:        t.type,
        amount:      t.amount,
        description: t.description,
        categoryId:  t.categoryId,
        date:        `${monthKey}-01`,
        note:        t.note || '',
        recurring:   false, // la copia no es recurrente para no duplicar infinitamente
      });
      created++;
    }
  }

  if (created > 0) {
    state.transactions = await getAllTransactions();
  }

  await setSetting('recurringApplied', monthKey);
}

// Renderiza la lista de recurrentes en la vista de Ajustes
function renderRecurringList() {
  const ul = document.getElementById('recurring-list');
  if (!ul) return;

  const recurring = state.transactions.filter((t) => t.recurring);

  if (recurring.length === 0) {
    ul.innerHTML = '<li class="tx-empty" style="padding:14px 18px">No hay gastos recurrentes.<br><small style="color:var(--ink-muted)">Activa "Gasto recurrente" al crear un movimiento.</small></li>';
    return;
  }

  ul.innerHTML = recurring.map((t) => {
    const cat = state.categories.find((c) => c.id === t.categoryId);
    return `<li class="recurring-item">
      <span class="rec-emoji">${cat?.emoji || '💳'}</span>
      <div class="rec-info">
        <div class="rec-name">${escapeHtml(t.description)}</div>
        <div class="rec-meta">${cat?.name || 'Sin categoría'} · Día 1 de cada mes</div>
      </div>
      <span class="rec-amount">-${formatCurrency(t.amount, state.currency)}</span>
    </li>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════
// Alertas de presupuesto por categoría
// ══════════════════════════════════════════════════════════════════

let _budgetAlertsShown = new Set();

function checkBudgetAlerts() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();

  state.categories.forEach((cat) => {
    if (!cat.budget || cat.budget <= 0) return;
    const spent = getSpentInCategory(cat.id, year, month);
    const pct   = (spent / cat.budget) * 100;
    const key   = `${cat.id}-${year}-${month}`;

    if (pct >= 100 && !_budgetAlertsShown.has(key)) {
      _budgetAlertsShown.add(key);
      showToast(`⚠️ ${cat.emoji} ${cat.name}: presupuesto superado`, 'err');
    } else if (pct >= 90 && !_budgetAlertsShown.has(`${key}-warn`)) {
      _budgetAlertsShown.add(`${key}-warn`);
      showToast(`⚡ ${cat.emoji} ${cat.name}: 90% del presupuesto`, '');
    }
  });
}

// ══════════════════════════════════════════════════════════════════
// Metas
// ══════════════════════════════════════════════════════════════════

function renderMetas() {
  // Si la pestaña visible es la calculadora, refrescarla (moneda, datos…)
  if (!document.getElementById('seg-calc').classList.contains('hidden')) runCalculator();

  const ul = document.getElementById('goal-list');
  if (!ul) return;

  if (state.goals.length === 0) {
    ul.innerHTML = '<li class="tx-empty">Aún no tienes metas de ahorro.<br><small style="color:var(--ink-muted)">Crea una con «Nueva meta»: unas vacaciones, un fondo de emergencia, la entrada de un piso…</small></li>';
    return;
  }

  ul.innerHTML = state.goals.map((goal) => {
    const pct      = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0;
    const deadlineStr = goal.deadline
      ? new Date(goal.deadline).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
      : 'Sin fecha límite';
    const remaining  = goal.target - goal.saved;
    const isLate     = goal.deadline && new Date(goal.deadline) < new Date() && pct < 100;

    return `<li class="goal-item" data-id="${goal.id}">
      <div class="goal-header">
        <span class="goal-emoji">${goal.emoji || '🎯'}</span>
        <div>
          <div class="goal-title">${escapeHtml(goal.name)}</div>
          <div class="goal-deadline">📅 ${deadlineStr}</div>
        </div>
        <div class="goal-actions">
          <button class="icon-btn edit-goal" data-id="${goal.id}" aria-label="Editar meta"><i class="fi fi-rr-pencil"></i></button>
          <button class="icon-btn danger del-goal" data-id="${goal.id}" aria-label="Eliminar meta"><i class="fi fi-rr-trash"></i></button>
        </div>
      </div>
      <div class="goal-amounts">
        <span class="goal-saved">${formatCurrency(goal.saved, state.currency)}</span>
        <span class="goal-target">de ${formatCurrency(goal.target, state.currency)}</span>
      </div>
      <div class="goal-bar">
        <div class="goal-bar-fill ${pct >= 100 ? 'over' : ''}" style="width:${pct}%"></div>
      </div>
      <div class="goal-pct">${pct}% completado${pct < 100 ? ` · Faltan ${formatCurrency(Math.max(0, remaining), state.currency)}` : ' 🎉'}</div>
      ${isLate ? '<div class="goal-alert">⚠️ Fecha límite superada</div>' : ''}
    </li>`;
  }).join('');

  ul.querySelectorAll('.edit-goal').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const goal = state.goals.find((g) => g.id === Number(btn.dataset.id));
      if (goal) openGoalModal(goal);
    });
  });
  ul.querySelectorAll('.del-goal').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDeleteGoal(Number(btn.dataset.id));
    });
  });
}

async function confirmDeleteGoal(id) {
  if (!confirm('¿Eliminar esta meta?')) return;
  await deleteGoal(id);
  state.goals = await getAllGoals();
  renderMetas();
  showToast('Meta eliminada', 'ok');
}

// ══════════════════════════════════════════════════════════════════
// Ahorro: segmentos (Metas | Calculadora) e interés compuesto
// ══════════════════════════════════════════════════════════════════

function setupSavingsSegments() {
  document.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const seg = btn.dataset.seg;
      document.querySelectorAll('.seg-btn').forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', String(b === btn));
      });
      document.getElementById('seg-metas').classList.toggle('hidden', seg !== 'metas');
      document.getElementById('seg-calc').classList.toggle('hidden', seg !== 'calc');
      // El botón "Nueva meta" solo tiene sentido en la pestaña de metas
      document.getElementById('add-goal-btn').classList.toggle('hidden', seg !== 'metas');
      if (seg === 'calc') runCalculator();
    });
  });

  ['calc-initial', 'calc-monthly', 'calc-rate', 'calc-years'].forEach((id) => {
    document.getElementById(id).addEventListener('input', runCalculator);
  });
}

// Capitalización mensual: cada mes el saldo genera intereses y se
// suma la aportación. Devuelve la proyección año a año.
function runCalculator() {
  const initial = Math.max(0, parseFloat(document.getElementById('calc-initial').value) || 0);
  const monthly = Math.max(0, parseFloat(document.getElementById('calc-monthly').value) || 0);
  const rate    = Math.max(0, parseFloat(document.getElementById('calc-rate').value) || 0) / 100;
  const years   = Math.min(50, Math.max(1, parseInt(document.getElementById('calc-years').value, 10) || 1));

  const monthlyRate = rate / 12;
  let balance     = initial;
  let contributed = initial;

  const points = [{ label: 'Hoy', total: balance, contributed }];
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + monthlyRate) + monthly;
      contributed += monthly;
    }
    points.push({ label: `Año ${y}`, total: balance, contributed });
  }

  const interest = balance - contributed;
  document.getElementById('calc-years-label').textContent = years;
  document.getElementById('calc-total').textContent       = formatCurrency(balance, state.currency);
  document.getElementById('calc-contributed').textContent = formatCurrency(contributed, state.currency);
  document.getElementById('calc-interest').textContent    = formatCurrency(Math.max(0, interest), state.currency);
  document.getElementById('calc-currency-symbol').textContent = getCurrencySymbol(state.currency);

  renderProjectionChart(points);
}

// ══════════════════════════════════════════════════════════════════
// Modal: Transacción
// ══════════════════════════════════════════════════════════════════

function openTxModal(tx = null) {
  const modal    = document.getElementById('modal-tx');
  const titleEl  = document.getElementById('modal-tx-title');
  const editId   = document.getElementById('tx-edit-id');
  const amount   = document.getElementById('tx-amount');
  const desc     = document.getElementById('tx-desc');
  const catSel   = document.getElementById('tx-cat');
  const dateInp  = document.getElementById('tx-date');
  const noteInp  = document.getElementById('tx-note');
  const typeBtns = document.querySelectorAll('.type-btn');

  // Poblar categorías
  catSel.innerHTML = state.categories.map((c) =>
    `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');

  // Símbolo de moneda
  document.getElementById('modal-currency-symbol').textContent = getCurrencySymbol(state.currency);

  if (tx) {
    titleEl.textContent = 'Editar movimiento';
    editId.value   = tx.id;
    amount.value   = tx.amount;
    desc.value     = tx.description;
    catSel.value   = tx.categoryId || '';
    dateInp.value  = tx.date;
    noteInp.value  = tx.note || '';
    document.getElementById('tx-recurring').checked = !!tx.recurring;
    document.getElementById('tx-recurring-hint').classList.toggle('hidden', !tx.recurring);
    setActiveType(tx.type);
  } else {
    titleEl.textContent = 'Nuevo movimiento';
    editId.value   = '';
    amount.value   = '';
    desc.value     = '';
    dateInp.value  = new Date().toISOString().slice(0, 10);
    noteInp.value  = '';
    document.getElementById('tx-recurring').checked = false;
    document.getElementById('tx-recurring-hint').classList.add('hidden');
    setActiveType('expense');
  }

  modal.classList.remove('hidden');
  amount.focus();
}

function setActiveType(type) {
  document.querySelectorAll('.type-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.type === type);
  });
}

function closeTxModal() {
  document.getElementById('modal-tx').classList.add('hidden');
}

async function saveTx() {
  const editId   = document.getElementById('tx-edit-id').value;
  const amount   = parseFloat(document.getElementById('tx-amount').value);
  const desc     = document.getElementById('tx-desc').value.trim();
  const catId    = Number(document.getElementById('tx-cat').value);
  const date     = document.getElementById('tx-date').value;
  const note      = document.getElementById('tx-note').value.trim();
  const type      = document.querySelector('.type-btn.active')?.dataset.type || 'expense';
  const recurring = document.getElementById('tx-recurring').checked;

  if (!amount || amount <= 0) return showToast('Introduce un importe válido', 'err');
  if (!desc)                  return showToast('Introduce una descripción', 'err');
  if (!date)                  return showToast('Selecciona una fecha', 'err');

  const data = { type, amount, description: desc, categoryId: catId, date, note, recurring };

  if (editId) {
    await updateTransaction({ ...data, id: Number(editId) });
  } else {
    await addTransaction(data);
  }

  state.transactions = await getAllTransactions();
  closeTxModal();
  showToast(editId ? 'Movimiento actualizado' : 'Movimiento añadido', 'ok');
  renderCurrentView();
}

// ══════════════════════════════════════════════════════════════════
// Modal: Categoría
// ══════════════════════════════════════════════════════════════════

const CAT_COLORS = [
  '#30d158','#ff453a','#0a84ff','#ffd60a','#bf5af2',
  '#ff9f0a','#64d2ff','#ff375f','#66d4cf','#5e5ce6',
  '#ac8e68','#98989d','#8e8e93','#f5f5f7',
];

function openCatModal(cat = null) {
  const modal      = document.getElementById('modal-cat');
  const titleEl    = document.getElementById('modal-cat-title');
  const editId     = document.getElementById('cat-edit-id');
  const emojiInp   = document.getElementById('cat-emoji');
  const nameInp    = document.getElementById('cat-name');
  const budgetInp  = document.getElementById('cat-budget');
  const picker     = document.getElementById('cat-color-picker');

  document.getElementById('cat-currency-symbol').textContent = getCurrencySymbol(state.currency);

  // Construir selector de colores
  picker.innerHTML = CAT_COLORS.map((c) =>
    `<span class="color-swatch" data-color="${c}" style="background:${c}" title="${c}"></span>`
  ).join('');

  picker.querySelectorAll('.color-swatch').forEach((sw) => {
    sw.addEventListener('click', () => {
      picker.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
  });

  if (cat) {
    titleEl.textContent = 'Editar categoría';
    editId.value    = cat.id;
    emojiInp.value  = cat.emoji  || '';
    nameInp.value   = cat.name   || '';
    budgetInp.value = cat.budget || '';
    const sw = picker.querySelector(`[data-color="${cat.color}"]`);
    if (sw) sw.classList.add('selected');
    else picker.querySelector('.color-swatch')?.classList.add('selected');
  } else {
    titleEl.textContent = 'Nueva categoría';
    editId.value    = '';
    emojiInp.value  = '';
    nameInp.value   = '';
    budgetInp.value = '';
    picker.querySelector('.color-swatch')?.classList.add('selected');
  }

  modal.classList.remove('hidden');
  emojiInp.focus();
}

function closeCatModal() {
  document.getElementById('modal-cat').classList.add('hidden');
}

async function saveCat() {
  const editId   = document.getElementById('cat-edit-id').value;
  const emoji    = document.getElementById('cat-emoji').value.trim() || '📦';
  const name     = document.getElementById('cat-name').value.trim();
  const budget   = parseFloat(document.getElementById('cat-budget').value) || 0;
  const color    = document.querySelector('#cat-color-picker .color-swatch.selected')?.dataset.color || '#8e8e93';

  if (!name) return showToast('Introduce un nombre', 'err');

  const data = { emoji, name, color, budget };

  if (editId) {
    await updateCategory({ ...data, id: Number(editId) });
  } else {
    await addCategory(data);
  }

  state.categories = await getAllCategories();
  closeCatModal();
  showToast(editId ? 'Categoría actualizada' : 'Categoría creada', 'ok');
  renderCategorias();
}

// ══════════════════════════════════════════════════════════════════
// Modal: Meta
// ══════════════════════════════════════════════════════════════════

function openGoalModal(goal = null) {
  const modal      = document.getElementById('modal-goal');
  const titleEl    = document.getElementById('modal-goal-title');
  const editId     = document.getElementById('goal-edit-id');
  const nameInp    = document.getElementById('goal-name');
  const targetInp  = document.getElementById('goal-target');
  const savedInp   = document.getElementById('goal-saved');
  const deadlineInp = document.getElementById('goal-deadline');
  const emojiInp   = document.getElementById('goal-emoji');

  document.getElementById('goal-currency-symbol').textContent = getCurrencySymbol(state.currency);

  if (goal) {
    titleEl.textContent    = 'Editar meta';
    editId.value           = goal.id;
    nameInp.value          = goal.name       || '';
    targetInp.value        = goal.target     || '';
    savedInp.value         = goal.saved      || '';
    deadlineInp.value      = goal.deadline   || '';
    emojiInp.value         = goal.emoji      || '🎯';
  } else {
    titleEl.textContent = 'Nueva meta';
    editId.value        = '';
    nameInp.value       = '';
    targetInp.value     = '';
    savedInp.value      = '';
    deadlineInp.value   = '';
    emojiInp.value      = '🎯';
  }

  modal.classList.remove('hidden');
  nameInp.focus();
}

function closeGoalModal() {
  document.getElementById('modal-goal').classList.add('hidden');
}

async function saveGoal() {
  const editId   = document.getElementById('goal-edit-id').value;
  const name     = document.getElementById('goal-name').value.trim();
  const target   = parseFloat(document.getElementById('goal-target').value) || 0;
  const saved    = parseFloat(document.getElementById('goal-saved').value)  || 0;
  const deadline = document.getElementById('goal-deadline').value;
  const emoji    = document.getElementById('goal-emoji').value.trim() || '🎯';

  if (!name)       return showToast('Introduce un nombre para la meta', 'err');
  if (target <= 0) return showToast('El objetivo debe ser mayor que 0', 'err');

  const data = { name, target, saved, deadline, emoji };

  if (editId) {
    await updateGoal({ ...data, id: Number(editId) });
  } else {
    await addGoal(data);
  }

  state.goals = await getAllGoals();
  closeGoalModal();
  showToast(editId ? 'Meta actualizada' : 'Meta creada', 'ok');
  renderMetas();
}

// ══════════════════════════════════════════════════════════════════
// Ajustes
// ══════════════════════════════════════════════════════════════════

function setupSettings() {
  document.getElementById('currency-select').addEventListener('change', async (e) => {
    state.currency = e.target.value;
    await setSetting('currency', state.currency);
    showToast('Moneda actualizada', 'ok');
  });

  document.getElementById('user-name').addEventListener('change', async (e) => {
    state.userName = e.target.value.trim();
    await setSetting('userName', state.userName);
    setupGreeting();
  });

  document.getElementById('export-json-btn').addEventListener('click', exportJSON);
  document.getElementById('export-csv-btn').addEventListener('click', exportCSV);

  document.getElementById('import-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.transactions) throw new Error('Formato inválido');
      await importAllData(data);
      await loadData();
      renderCurrentView();
      showToast('Datos importados correctamente', 'ok');
    } catch {
      showToast('Error al importar: archivo inválido', 'err');
    }
    e.target.value = '';
  });

  document.getElementById('reset-btn').addEventListener('click', async () => {
    if (!confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) return;
    await resetAllData();
    await loadData();
    renderCurrentView();
    showToast('Datos borrados', 'ok');
  });

  // Recurrentes
  document.getElementById('apply-recurring-btn').addEventListener('click', async () => {
    await setSetting('recurringApplied', ''); // resetea el control del mes
    await applyRecurringTransactions();
    state.transactions = await getAllTransactions();
    renderRecurringList();
    renderCurrentView();
    showToast('Recurrentes aplicados', 'ok');
  });

  renderRecurringList();
}

async function exportJSON() {
  const data = await exportAllData();
  const json = JSON.stringify(data, null, 2);
  downloadFile(`kastos-backup-${todayStr()}.json`, json, 'application/json');
  showToast('JSON exportado', 'ok');
}

function exportCSV() {
  const headers = ['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Importe', 'Nota', 'Recurrente'];
  const rows = state.transactions
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => {
      const cat = state.categories.find((c) => c.id === t.categoryId);
      return [
        t.date,
        t.type === 'income' ? 'Ingreso' : 'Gasto',
        `"${(t.description || '').replace(/"/g, '""')}"`,
        cat ? `${cat.emoji} ${cat.name}` : 'Sin categoría',
        t.amount.toFixed(2),
        `"${(t.note || '').replace(/"/g, '""')}"`,
        t.recurring ? 'Sí' : 'No',
      ].join(';');
    });
  const csv = [headers.join(';'), ...rows].join('\n');
  downloadFile(`kastos-movimientos-${todayStr()}.csv`, '\uFEFF' + csv, 'text/csv');
  showToast('CSV exportado', 'ok');
}

// ══════════════════════════════════════════════════════════════════
// Utilidades
// ══════════════════════════════════════════════════════════════════

function setupGreeting() {
  const h    = new Date().getHours();
  const name = state.userName ? `, ${state.userName}` : '';
  let greet  = h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  document.getElementById('greeting-text').textContent = `${greet}${name} 👋`;
}

function getCurrencySymbol(code) {
  const map = { EUR: '€', USD: '$', GBP: '£', MXN: '$' };
  return map[code] || code;
}

function escapeHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

let _toastTimer = null;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

// ══════════════════════════════════════════════════════════════════
// PWA — Service Worker e instalación
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// Bienvenida (primer arranque y desde Ajustes)
// ══════════════════════════════════════════════════════════════════

async function maybeShowWelcome() {
  const seen = await getSetting('welcomeSeen');
  if (!seen) document.getElementById('modal-welcome').classList.remove('hidden');
}

function setupWelcome() {
  document.getElementById('welcome-start-btn').addEventListener('click', async () => {
    document.getElementById('modal-welcome').classList.add('hidden');
    await setSetting('welcomeSeen', '1');
  });
  document.getElementById('show-welcome-btn').addEventListener('click', () => {
    navigateTo('dashboard');
    document.getElementById('modal-welcome').classList.remove('hidden');
  });
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

let _deferredPrompt = null;
function setupInstallBanner() {
  const btn = document.getElementById('install-btn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    btn.classList.remove('hidden');
  });
  btn.addEventListener('click', async () => {
    if (!_deferredPrompt) return;
    _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;
    if (outcome === 'accepted') btn.classList.add('hidden');
    _deferredPrompt = null;
  });
  window.addEventListener('appinstalled', () => btn.classList.add('hidden'));
}

// ══════════════════════════════════════════════════════════════════
// Conexión de eventos globales
// ══════════════════════════════════════════════════════════════════

function setupEvents() {
  // Botón principal "Añadir"
  document.getElementById('add-btn').addEventListener('click', () => openTxModal());

  // Toggle recurrente → mostrar/ocultar hint
  document.getElementById('tx-recurring').addEventListener('change', (e) => {
    document.getElementById('tx-recurring-hint').classList.toggle('hidden', !e.target.checked);
  });

  // Modal transacción
  document.querySelectorAll('.type-btn').forEach((btn) => {
    btn.addEventListener('click', () => setActiveType(btn.dataset.type));
  });
  document.getElementById('modal-tx-cancel').addEventListener('click', closeTxModal);
  document.getElementById('modal-tx-save').addEventListener('click', saveTx);
  document.getElementById('modal-tx').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeTxModal();
  });

  // Modal categoría
  document.getElementById('add-cat-btn').addEventListener('click', () => openCatModal());
  document.getElementById('modal-cat-cancel').addEventListener('click', closeCatModal);
  document.getElementById('modal-cat-save').addEventListener('click', saveCat);
  document.getElementById('modal-cat').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCatModal();
  });

  // Modal meta
  document.getElementById('add-goal-btn').addEventListener('click', () => openGoalModal());
  document.getElementById('modal-goal-cancel').addEventListener('click', closeGoalModal);
  document.getElementById('modal-goal-save').addEventListener('click', saveGoal);
  document.getElementById('modal-goal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeGoalModal();
  });

  // Ahorro: pestañas y calculadora
  setupSavingsSegments();

  // Bienvenida
  setupWelcome();

  // Ajustes
  setupSettings();

  // Cerrar modales con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeTxModal();
    closeCatModal();
    closeGoalModal();
  });
}

// ══════════════════════════════════════════════════════════════════
// Arranque
// ══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  setupEvents();
  await init();
});
