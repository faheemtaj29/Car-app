"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Registers the service worker and offers "Install app" when the browser allows it. */
export function AppInstall() {
  const [ev, setEv] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEv(e as InstallEvent);
    };
    const onInstalled = () => setEv(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!ev) return null;
  return (
    <button
      type="button"
      className="site-btn app-install"
      onClick={async () => {
        await ev.prompt();
        await ev.userChoice.catch(() => undefined);
        setEv(null);
      }}
    >
      📲 Install app
    </button>
  );
}
