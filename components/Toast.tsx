"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// =============================================================================
// Module Overview
// =============================================================================
// One short status line at the bottom of the screen. `ToastProvider` sits in
// the root layout so a toast survives `router.push`, and `useToast` hands any
// client component the `show` function. A toast can carry one link, such as
// "See outbox"; it then stays up longer and holds while hovered or focused.

const TOAST_MS = 2600;
const TOAST_WITH_LINK_MS = 6000;

/** A link a toast offers, such as `{ label: "See outbox", href: "#outbox" }`. */
export interface ToastLink {
  readonly label: string;
  readonly href: string;
}

interface ToastState {
  readonly message: string;
  readonly link?: ToastLink;
}

type Show = (message: string, link?: ToastLink) => void;

// Outside a provider a toast has nowhere to render, so the default drops it.
const ToastContext = createContext<Show>(() => {});

/** Render children plus the toast region, and give them `useToast`. */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const schedule = useCallback((ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), ms);
  }, []);

  const show = useCallback<Show>(
    (message, link) => {
      setToast({ message, link });
      schedule(link === undefined ? TOAST_MS : TOAST_WITH_LINK_MS);
    },
    [schedule],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  // A toast with a link waits while the pointer or focus is on it, so it can't vanish mid-tap.
  const hold = () => clearTimeout(timer.current);
  const release = () => schedule(TOAST_MS);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Always in the DOM so screen readers already track the live region when text arrives */}
      <div
        className="toast"
        role="status"
        hidden={toast === null}
        onMouseEnter={hold}
        onMouseLeave={release}
        onFocus={hold}
        onBlur={release}
      >
        {toast?.message}
        {toast?.link !== undefined && (
          <a href={toast.link.href} onClick={() => setToast(null)}>
            {toast.link.label}
          </a>
        )}
      </div>
    </ToastContext.Provider>
  );
}

/** Return the function that shows a toast, with an optional link. */
export function useToast(): Show {
  return useContext(ToastContext);
}
