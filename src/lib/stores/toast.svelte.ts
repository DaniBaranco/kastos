// Toast global mínimo (con acción opcional, p. ej. «Deshacer»).

export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}

class ToastStore {
  message = $state<string | null>(null);
  kind = $state<'ok' | 'err'>('ok');
  action = $state<ToastAction | null>(null);
  #timer: ReturnType<typeof setTimeout> | undefined;

  show(message: string, kind: 'ok' | 'err' = 'ok', action: ToastAction | null = null): void {
    this.message = message;
    this.kind = kind;
    this.action = action;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.hide(), action ? 5000 : 2600);
  }

  hide(): void {
    clearTimeout(this.#timer);
    this.message = null;
    this.action = null;
  }

  async runAction(): Promise<void> {
    const action = this.action;
    this.hide();
    await action?.run();
  }
}

export const toast = new ToastStore();
