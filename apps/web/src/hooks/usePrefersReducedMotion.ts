import { useEffect, useState } from "react";

/**
 * Returns true if the user has requested reduced motion via OS setting
 * (prefers-reduced-motion: reduce) or the manual reduced-motion override.
 * Safe in SSR — initial value is `false` server-side.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () =>
      setReduced(mq.matches || window.localStorage.getItem("ameo:reduced-motion") === "1");
    sync();
    mq.addEventListener("change", sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "ameo:reduced-motion") sync();
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
    window.localStorage.setItem("ameo:reduced-motion", "1");
  } else {
    window.localStorage.removeItem("ameo:reduced-motion");
  }
  window.dispatchEvent(new Event("ameo:reduced-motion"));
}
