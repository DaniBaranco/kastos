<script lang="ts">
  import { t } from '../i18n/es';
  import { app } from '../stores/app.svelte';
  import { toast } from '../stores/toast.svelte';
  import { downloadFile, expensesCSV } from '../export/csv';
  import { ImportError } from '../core/migrate';
  import { todayISO } from '../core/dates';
  import type { Currency, ExpenseCategory, Theme } from '../core/types';
  import CategoryForm from '../components/CategoryForm.svelte';

  interface Props {
    onshowwelcome: () => void;
  }
  let { onshowwelcome }: Props = $props();

  let catOpen = $state(false);
  let editingCat = $state<ExpenseCategory | null>(null);

  const sortedCategories = $derived(
    [...app.categories].sort(
      (a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'es'),
    ),
  );

  function openCategory(c: ExpenseCategory | null) {
    editingCat = c;
    catOpen = true;
  }

  async function exportJSON() {
    const bundle = app.buildExport();
    downloadFile(
      `kastos-backup-${todayISO()}.json`,
      JSON.stringify(bundle, null, 2),
      'application/json',
    );
    await app.markExported();
    toast.show(t.toasts.exported);
  }

  function exportExpenses() {
    downloadFile(
      `kastos-gastos-${todayISO()}.csv`,
      expensesCSV(app.expenses, app.categories),
      'text/csv;charset=utf-8',
    );
    toast.show(t.toasts.exported);
  }

  async function onImportFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const source = await app.importJSON(text);
      toast.show(source === 'v4' ? t.settings.importOk : t.settings.importedFromOld);
    } catch (err) {
      const detail = err instanceof ImportError ? ` ${err.message}` : '';
      toast.show(`${t.toasts.importError}.${detail}`, 'err');
    }
  }

  async function wipeAll() {
    if (!confirm(t.settings.deleteConfirm1)) return;
    if (!confirm(t.settings.deleteConfirm2)) return;
    await app.wipe();
    toast.show(t.settings.deleted);
  }
</script>

<header class="view-header">
  <div>
    <h1>{t.settings.title}</h1>
    <p class="subtitle">{t.settings.subtitle}</p>
  </div>
</header>

<div class="two-col">
  <div class="stack">
    <section class="card">
      <h2>{t.settings.general}</h2>

      <div class="field">
        <label for="set-currency">{t.settings.currency}</label>
        <select
          id="set-currency"
          class="select"
          value={app.settings.currency}
          onchange={(e) => app.updateSettings({ currency: e.currentTarget.value as Currency })}
        >
          <option value="EUR">€ Euro</option>
          <option value="USD">$ Dólar</option>
          <option value="GBP">£ Libra</option>
          <option value="MXN">$ Peso MX</option>
        </select>
      </div>

      <div class="field">
        <label for="set-name">{t.settings.name}</label>
        <input
          id="set-name"
          class="input"
          type="text"
          maxlength="24"
          value={app.settings.userName ?? ''}
          onchange={(e) =>
            app.updateSettings({ userName: e.currentTarget.value.trim() || undefined })}
        />
      </div>

      <div class="field">
        <label for="set-theme">{t.settings.theme}</label>
        <select
          id="set-theme"
          class="select"
          value={app.settings.theme}
          onchange={(e) => app.updateSettings({ theme: e.currentTarget.value as Theme })}
        >
          <option value="light">{t.settings.themeLight}</option>
          <option value="dark">{t.settings.themeDark}</option>
          <option value="system">{t.settings.themeSystem}</option>
        </select>
      </div>
    </section>

    <section class="card">
      <div class="spread">
        <h2>{t.settings.categories}</h2>
        <button class="btn btn-ghost small" onclick={() => openCategory(null)}>
          <i class="fi fi-rr-plus" aria-hidden="true"></i>
          {t.settings.newCategory}
        </button>
      </div>
      <p class="card-note">{t.settings.categoriesHint}</p>
      <ul class="row-list">
        {#each sortedCategories as c (c.id)}
          <li class:archived={c.archived}>
            <span class="row-emoji" aria-hidden="true">{c.emoji}</span>
            <button class="row-main cat-btn" onclick={() => openCategory(c)}>
              <span class="row-title">{c.name}</span>
              {#if c.archived}<span class="row-sub">{t.settings.archivedTag}</span>{/if}
            </button>
            <i class="fi fi-rr-angle-small-right muted" aria-hidden="true"></i>
          </li>
        {/each}
      </ul>
    </section>

    <section class="card">
      <h2>{t.settings.about}</h2>
      <p class="card-note">{t.settings.aboutText}</p>
      <button class="btn btn-ghost small" style="margin-top: 12px" onclick={onshowwelcome}>
        <i class="fi fi-rr-interrogation" aria-hidden="true"></i>
        {t.welcome.title}
      </button>
      <p class="version muted">{t.settings.version}</p>
    </section>
  </div>

  <div class="stack">
    <section class="card">
      <h2>{t.settings.data}</h2>
      <p class="card-note" style="margin-bottom: 12px">{t.settings.dataNote}</p>

      {#if app.backupDue === 'stale'}
        <p class="badge warn backup-warn">
          <i class="fi fi-rr-exclamation" aria-hidden="true"></i>
          {t.settings.backupWarn}
        </p>
      {:else if app.backupDue === 'never'}
        <p class="badge warn backup-warn">
          <i class="fi fi-rr-download" aria-hidden="true"></i>
          {t.settings.backupNever}
        </p>
      {/if}

      <div class="data-actions">
        <button class="btn btn-ghost" onclick={exportJSON}
          ><i class="fi fi-rr-download" aria-hidden="true"></i> {t.settings.exportJSON}</button
        >
        <button class="btn btn-ghost" onclick={exportExpenses}
          ><i class="fi fi-rr-download" aria-hidden="true"></i>
          {t.settings.exportExpensesCSV}</button
        >
        <label class="btn btn-ghost import-label">
          <i class="fi fi-rr-upload" aria-hidden="true"></i>
          {t.settings.importJSON}
          <input type="file" accept=".json,application/json" onchange={onImportFile} />
        </label>
      </div>
      <p class="card-note" style="margin-top: 10px">{t.settings.importHint}</p>
    </section>

    <section class="card danger-zone">
      <h2>{t.settings.danger}</h2>
      <button class="btn btn-danger" onclick={wipeAll}
        ><i class="fi fi-rr-trash" aria-hidden="true"></i> {t.settings.deleteAll}</button
      >
    </section>
  </div>
</div>

<CategoryForm open={catOpen} category={editingCat} onclose={() => (catOpen = false)} />

<style>
  .cat-btn {
    text-align: left;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  li.archived {
    opacity: 0.6;
  }
  .data-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .data-actions .btn {
    justify-content: flex-start;
  }
  .import-label {
    position: relative;
    overflow: hidden;
    cursor: pointer;
  }
  .import-label input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .backup-warn {
    display: flex;
    white-space: normal;
    margin-bottom: 12px;
    line-height: 1.4;
  }
  .danger-zone {
    border-color: color-mix(in srgb, var(--danger) 30%, var(--border));
  }
  .version {
    font-size: 12px;
    margin-top: 12px;
  }
</style>
