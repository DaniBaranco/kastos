// Instalación de la PWA: captura beforeinstallprompt y expone la acción.
// Nota: el evento solo existe en navegadores Chromium; en iOS/Safari la
// instalación es manual (Compartir → Añadir a pantalla de inicio).

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class InstallStore {
  /** Hay prompt de instalación disponible (aparece el botón). */
  available = $state(false);

  #deferred: BeforeInstallPromptEvent | null = null;

  init(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.#deferred = e as BeforeInstallPromptEvent;
      this.available = true;
    });
    window.addEventListener('appinstalled', () => {
      this.#deferred = null;
      this.available = false;
    });
  }

  async prompt(): Promise<void> {
    if (!this.#deferred) return;
    await this.#deferred.prompt();
    const { outcome } = await this.#deferred.userChoice;
    if (outcome === 'accepted') {
      this.available = false;
    }
    this.#deferred = null;
  }
}

export const install = new InstallStore();
