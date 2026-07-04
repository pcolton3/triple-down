'use client';

import { Download, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && Boolean(window.navigator.standalone))
  );
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setShowHelp(false);
    }

    function handleInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) {
      setShowHelp((value) => !value);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  }

  if (installed) {
    return (
      <div className="mx-auto mt-5 flex max-w-md items-center justify-center gap-2 rounded-2xl border border-[#c9d8c7] bg-white px-4 py-3 text-sm font-bold text-[#0f5132] shadow-sm">
        <Smartphone className="h-4 w-4" aria-hidden="true" />
        Installed on this device
      </div>
    );
  }

  return (
    <div className="mx-auto mt-5 max-w-md rounded-2xl border border-[#c9d8c7] bg-white p-3 text-center shadow-sm">
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#071b12] px-4 py-3 text-sm font-black text-white"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Install App
      </button>
      {showHelp ? (
        <p className="mt-3 text-sm font-semibold leading-5 text-[#52635a]">
          On iPhone, open this site in Safari, tap Share, then Add to Home Screen. On Android, open it in Chrome and use
          Install app or Add to Home screen from the menu.
        </p>
      ) : null}
    </div>
  );
}
