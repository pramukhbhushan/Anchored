"use client";

import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import type { HandOff } from "./handoff";

// =============================================================================
// Module Overview
// =============================================================================
// The owner's last step for one approved draft in the outbox. A text or an
// email gets a link that opens the owner's own texting or email app with the
// message typed out; a post, a review reply or a text to many people gets Copy,
// Share where the device has a share sheet, and links to where it gets pasted.

/** Copy `text` to the clipboard, falling back to a hidden text box where the async API is missing or refused. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // No async clipboard (an insecure origin or an older browser), or permission refused; try the old way below.
  }
  const area = document.createElement("textarea");
  try {
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    return document.execCommand("copy");
  } catch {
    // Nothing left to try; the caller tells the owner where the text still is.
    return false;
  } finally {
    area.remove();
  }
}

/** Render the send step for one approved draft. */
export function SendYourself({ handOff }: { readonly handOff: HandOff }) {
  const [copied, setCopied] = useState<boolean | null>(null);
  const [canShare, setCanShare] = useState(false);
  // Read after mount: the server render has no `navigator`, and a first render that differs would not hydrate.
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  if (handOff.kind === "open") {
    return (
      <div className="handoff">
        <div className="handoff-acts">
          <a className={buttonClass("secondary", "sm")} href={handOff.href}>
            {handOff.label}
          </a>
        </div>
      </div>
    );
  }

  const { text, what, hint, places } = handOff;

  async function share() {
    try {
      await navigator.share({ text });
    } catch {
      // The owner closed the share sheet, or the device refused; the Copy button still works.
    }
  }

  return (
    <div className="handoff">
      {hint !== "" && <p>{hint}</p>}
      <div className="handoff-acts">
        <Button variant="secondary" size="sm" onClick={async () => setCopied(await copyText(text))}>
          Copy {what}
        </Button>
        {canShare && (
          <Button variant="secondary" size="sm" onClick={share}>
            Share
          </Button>
        )}
        {places.map((place) => (
          <a key={place.href} className={buttonClass("secondary", "sm")} href={place.href} target="_blank" rel="noopener noreferrer">
            {place.label}
          </a>
        ))}
      </div>
      <p className="handoff-note" role="status">
        {copied === null ? "" : copied ? "Copied. Now paste it." : "Your browser blocked the clipboard. Select the text above to copy it."}
      </p>
    </div>
  );
}
