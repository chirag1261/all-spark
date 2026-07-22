"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import Loader from "../Loader";

interface RouteLoaderApi {
  /** Show the buffer loader (e.g. before a slow API call). */
  show: (label?: string) => void;
  /** Hide it (e.g. on error, when no navigation will happen). */
  hide: () => void;
  /**
   * Show the loader and navigate. The overlay stays up until the destination
   * route actually renders (pathname change), covering slow server renders.
   */
  navigate: (href: string, label?: string) => void;
}

const RouteLoaderContext = createContext<RouteLoaderApi | null>(null);

// Never let the overlay get stuck if a navigation is cancelled/interrupted.
const SAFETY_TIMEOUT_MS = 15000;

/**
 * App-wide "buffer loader". A single blocking overlay shown during slow route
 * transitions and flow actions (login/logout/payment) so the UI never appears
 * frozen while a server component or API is still resolving.
 *
 * Auto-hides on pathname change (navigation completed). Deliberately watches
 * only usePathname — using useSearchParams here would force a static-render
 * bailout across the whole app.
 */
export default function RouteLoaderProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  const [label, setLabel] = useState<string | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const hide = useCallback(() => {
    clearTimer();
    setPending(false);
    setLabel(undefined);
  }, []);

  const show = useCallback((next?: string) => {
    clearTimer();
    setLabel(next);
    setPending(true);
    timerRef.current = setTimeout(() => setPending(false), SAFETY_TIMEOUT_MS);
  }, []);

  const navigate = useCallback(
    (href: string, next?: string) => {
      show(next);
      router.push(href);
      router.refresh();
    },
    [router, show]
  );

  // Navigation finished once the pathname changes — drop the overlay. Deferred
  // a tick so the state update isn't synchronous within the effect body.
  useEffect(() => {
    const t = setTimeout(hide, 0);
    return () => clearTimeout(t);
    // Intentionally keyed on pathname only: fire on route change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => () => clearTimer(), []);

  return (
    <RouteLoaderContext.Provider value={{ show, hide, navigate }}>
      {children}
      {pending && <Loader fullscreen label={label} />}
    </RouteLoaderContext.Provider>
  );
}

/** Access the app-wide buffer loader. Must be used under RouteLoaderProvider. */
export function useRouteLoader(): RouteLoaderApi {
  const ctx = useContext(RouteLoaderContext);
  if (!ctx) throw new Error("useRouteLoader must be used within RouteLoaderProvider");
  return ctx;
}
