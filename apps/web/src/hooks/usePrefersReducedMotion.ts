import { useEffect, useState } from "react";

import {
  safeStorageGet,
  safeStorageRemove,
  safeStorageSet,
} from "../lib/safeStorage";

const STORAGE_KEY = "ameo:reduced-motion";

/**
 * Returns true if the user has requested reduced motion via OS setting
 * (prefers-reduced-motion: reduce) or the manual reduced-motion override.
 * Safe in SSR — initial value is `false` server-side.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches || safeStorageGet(STORAGE_KEY) === "1");
    sync();
    mq.addEventListener("change", sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) sync();
    };
    const onOverride = () => sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener("ameo:reduced-motion", onOverride);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ameo:reduced-motion", onOverride);
    };
  }, []);

  return reduced;
}

export function setReducedMotionOverride(enabled: boolean): void {
  if (enabled) {
    safeStorageSet(STORAGE_KEY, "1");
  } else {
    safeStorageRemove(STORAGE_KEY);
  }
  window.dispatchEvent(new Event("ameo:reduced-motion"));
}
