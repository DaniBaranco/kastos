// Toast global mínimo.

class ToastStore {
  message = $state<string | null>(null);
  kind = $state<'ok' | 'err'>('ok');
  #timer: ReturnType<typeof setTimeout> | undefined;

  show(message: string, kind: 'ok' | 'err' = 'ok'): void {
    this.message = message;
    this.kind = kind;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => (this.message = null), 2600);
  }
}

export const toast = new ToastStore();
