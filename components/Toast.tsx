"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// =============================================================================
// Module Overview
// =============================================================================
// The prototype's toast: one short status line at the bottom of the screen.
// `ToastProvider` sits in the root layout so a toast survives `router.push`,
// and `useToast` hands any client component the `show` function.

const TOAST_MS = 2600;

// Outside a provider a toast has nowhere to render, so the default drops it.
const ToastContext = createContext<(message: string) => void>(() => {});

/** Render children plus the toast region, and give them `useToast`. */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Always in the DOM so screen readers already track the live region when text arrives */}
      <div className="toast" role="status" hidden={message === null}>
        {message}
      </div>
    </ToastContext.Provider>
  );
}

/** Return the function that shows a toast for 2.6 seconds. */
export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}
