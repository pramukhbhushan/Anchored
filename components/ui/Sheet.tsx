"use client";

import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import styles from "./inspection.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// A shadcn Sheet composition adapted to Anchored's CSS tokens. Radix owns
// focus trapping, Escape, background inertness and focus restoration. The same
// content slides from the side on desktop and from the bottom on phones.

/** Show a named inspection panel, controlled by its parent or its trigger. */
export function Sheet({
  title,
  description,
  trigger,
  children,
  open,
  onOpenChange,
}: {
  readonly title: string;
  readonly description: string;
  readonly trigger?: ReactNode;
  readonly children: ReactNode;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.sheet}
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(event) => {
            if (!trigger && returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
        >
          <header className={styles.header}>
            <div>
              <span className={styles.eyebrow}>Anchored / Work in view</span>
              <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            </div>
            <Dialog.Close className={styles.close} aria-label="Close panel">
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
            <Dialog.Description className={styles.description}>
              {description}
            </Dialog.Description>
          </header>
          <div className={styles.body}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
