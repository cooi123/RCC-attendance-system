import { Download, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-banner-dismissed";

function isInStandaloneMode() {
  return (
    ("standalone" in navigator &&
      (navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

/** iOS Safari: iPhone, iPad (including iPads that report Macintosh + touch) */
function isIosSafari() {
  const ua = navigator.userAgent;
  const isIosUA = /iphone|ipad|ipod/i.test(ua);
  const isMacWithTouch =
    /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
  return (isIosUA || isMacWithTouch) && isSafari;
}

function isMobileBrowser() {
  return /android|iphone|ipad|ipod|mobile|tablet/i.test(navigator.userAgent) ||
    navigator.maxTouchPoints > 1;
}

type Platform = "ios" | "android-chrome" | "generic-mobile" | "desktop";

function detectPlatform(): Platform {
  if (isIosSafari()) return "ios";
  const ua = navigator.userAgent;
  if (/android/i.test(ua) && /chrome/i.test(ua)) return "android-chrome";
  if (isMobileBrowser()) return "generic-mobile";
  return "desktop";
}

export function PWAInstallBanner() {
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem(DISMISSED_KEY) === "true"
  );
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (dismissed || isInStandaloneMode()) return;

    setPlatform(detectPlatform());
    setReady(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissed]);

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }

  async function handleInstall() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setPromptEvent(null);
  }

  if (!ready || dismissed) return null;

  // Chrome/Edge on Android with native install prompt — one-tap install
  if (promptEvent) {
    return (
      <Banner onDismiss={handleDismiss}>
        <button
          onClick={handleInstall}
          className="flex flex-1 items-center gap-2 text-sm font-medium hover:underline"
        >
          <Download className="h-4 w-4 shrink-0" />
          Install this app for quick access
        </button>
      </Banner>
    );
  }

  // iOS Safari — must use Share sheet
  if (platform === "ios") {
    return (
      <Banner onDismiss={handleDismiss}>
        <span className="flex items-start gap-2 text-sm">
          <Share2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Install: tap{" "}
            <span className="font-semibold">Share</span>{" "}
            <Share2 className="inline h-3 w-3" /> then{" "}
            <span className="font-semibold">"Add to Home Screen"</span>
          </span>
        </span>
      </Banner>
    );
  }

  // Android Chrome waiting for prompt, or other mobile browsers
  if (platform === "android-chrome" || platform === "generic-mobile") {
    return (
      <Banner onDismiss={handleDismiss}>
        <span className="flex items-center gap-2 text-sm">
          <Download className="h-4 w-4 shrink-0" />
          Install: open your browser menu and tap{" "}
          <span className="font-semibold">"Add to Home Screen"</span>
        </span>
      </Banner>
    );
  }

  return null;
}

function Banner({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-primary px-4 py-2.5 text-primary-foreground">
      <div className="flex flex-1 items-center">{children}</div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss install banner"
        className="shrink-0 rounded p-1 hover:bg-white/20"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
