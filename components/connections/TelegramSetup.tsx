"use client";

import { useId, useState, type ReactNode } from "react";
import { copyText } from "@/components/business/SendYourself";
import { Button, buttonClass } from "@/components/ui/Button";
import styles from "./telegram.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The business's Telegram test link, as the server made it, with Open and
// Copy. It asks for no credentials, so a guest sees it too. The caller may
// pass a QR code drawn on the server (`TelegramQr`); this file draws none and
// never sends the link to an outside image service. A link that isn't a plain
// t.me bot link with one start parameter shows as unavailable.

interface TelegramSetupProps {
  readonly businessId: string;
  readonly url: string | null;
  readonly unavailableReason?: string;
  readonly qrCode?: ReactNode;
}

/** Accept only a Telegram bot deep link with one valid start parameter. */
function testLink(raw: string | null): string | null {
  if (raw === null) return null;
  try {
    const url = new URL(raw);
    const start = url.searchParams.get("start");
    if (url.origin !== "https://t.me" || url.username !== "" || url.password !== "" || url.hash !== "") return null;
    if (!/^\/[A-Za-z0-9_]{5,32}$/.test(url.pathname)) return null;
    if (start === null || !/^[A-Za-z0-9_-]{1,64}$/.test(start)) return null;
    if ([...url.searchParams.keys()].length !== 1) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Render the Telegram test link for one business, starting fresh when the business or link changes. */
export function TelegramSetup(props: TelegramSetupProps) {
  return <TelegramLink key={`${props.businessId}:${props.url}`} {...props} />;
}

function TelegramLink({ url, unavailableReason, qrCode }: TelegramSetupProps) {
  const id = useId();
  const [copied, setCopied] = useState<boolean | null>(null);
  const link = testLink(url);
  return (
    <section className={styles.setup} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Telegram test link</h2>
      {link === null ? (
        <p>{unavailableReason ?? "Your Telegram test link isn't available yet. Check back after Telegram is set up."}</p>
      ) : (
        <>
          <p>Customers open this link to message your business. Your approved replies go back to the same chat.</p>
          <label htmlFor={`${id}-link`}>Your business's test link</label>
          <input id={`${id}-link`} className={styles.link} value={link} readOnly onFocus={(event) => event.currentTarget.select()} />
          <div className={styles.actions}>
            <a className={buttonClass("secondary", "sm")} href={link} target="_blank" rel="noopener noreferrer">Open Telegram</a>
            <Button variant="quiet" size="sm" onClick={async () => setCopied(await copyText(link))}>Copy link</Button>
          </div>
          {qrCode !== undefined && <figure className={styles.qr}>{qrCode}<figcaption>Scan to open your business's Telegram chat.</figcaption></figure>}
          <p role="status">{copied === null ? "" : copied ? "Copied. Share this test link with someone trying your business." : "Your browser blocked the clipboard. Select the test link above to copy it."}</p>
        </>
      )}
    </section>
  );
}
