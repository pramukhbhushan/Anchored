"use client";

import { ArrowLeft, ArrowRight, Copy, Download, Share2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { copyText } from "@/components/business/SendYourself";
import { PLATFORM_RULES, POST_PLATFORMS, hashtagsIn, type PostPlatform } from "@/lib/domain/playbook";
import type { PostDraft, PostPhoto } from "@/lib/domain/posts";
import styles from "./post.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// A photo post as the owner reviews it in Approvals: the photos in the order
// they'll post, which the owner can change; a tab per platform with its caption
// to edit and copy; and a way to get the photos out: Download everywhere, plus
// Share on a device that can hand files to Instagram, Facebook or LinkedIn.
// Anchored posts nothing itself. `onChange` tells the card which caption is on
// screen, so approving copies exactly that text.

/** What the card needs to approve the caption on screen. */
export interface PostSelection {
  readonly platform: PostPlatform;
  readonly caption: string;
}

/** Move the item at `from` one place by `step`, or return `items` unchanged at an end. */
export function moved<T>(items: readonly T[], from: number, step: -1 | 1): T[] {
  const to = from + step;
  if (to < 0 || to >= items.length) return [...items];
  const next = [...items];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

/** Fetch each photo as a file named in posting order, for sharing or downloading. */
async function photoFiles(photos: readonly PostPhoto[]): Promise<File[]> {
  return Promise.all(
    photos.map(async (photo, index) => {
      const response = await fetch(photo.url);
      if (!response.ok) throw new Error("A photo couldn't be loaded.");
      const blob = await response.blob();
      const type = blob.type || "image/jpeg";
      return new File([blob], `photo-${index + 1}.${type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg"}`, { type });
    }),
  );
}

/** Report whether this browser can hand image files to another app, as phones do. */
function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function" || typeof File === "undefined") return false;
  try {
    return navigator.canShare({ files: [new File([new Uint8Array([0xff, 0xd8, 0xff])], "test.jpg", { type: "image/jpeg" })] });
  } catch {
    return false;
  }
}

/** Save each file through a temporary download link. */
function downloadFiles(files: readonly File[]): void {
  for (const file of files) {
    const href = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = href;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    // Give the browser a moment to start the download before the address goes away.
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
}

/** Render a photo post for review. `disabled` freezes it while the card is deciding. */
export function PostPreview({ post, disabled, onChange }: { readonly post: PostDraft; readonly disabled: boolean; readonly onChange: (selection: PostSelection) => void }) {
  const baseId = useId();
  const [order, setOrder] = useState<readonly number[]>(() => post.photos.map((_, i) => i));
  const [platform, setPlatform] = useState<PostPlatform>("instagram");
  const [captions, setCaptions] = useState<Readonly<Record<PostPlatform, string>>>(post.captions);
  const [share, setShare] = useState(false);
  const [ready, setReady] = useState<File[] | null>(null);
  const [status, setStatus] = useState("");

  const photos = order.map((i) => post.photos[i]!);
  const orderKey = order.join(",");

  // Decide Share or Download only in the browser, so the server's first render and the page agree.
  useEffect(() => setShare(canShareFiles()), []);

  // A phone shares only while the tap still counts, so the photos load ahead of the tap.
  useEffect(() => {
    if (!share) return;
    let live = true;
    setReady(null);
    void photoFiles(photos)
      .then((files) => live && setReady(files))
      .catch(() => live && setShare(false));
    return () => {
      live = false;
    };
    // `photos` follows `orderKey`; reloading on every render would refetch for nothing.
  }, [share, orderKey]);

  function pick(next: PostPlatform): void {
    setPlatform(next);
    onChange({ platform: next, caption: captions[next] });
  }

  function edit(text: string): void {
    setCaptions((all) => ({ ...all, [platform]: text }));
    onChange({ platform, caption: text });
  }

  async function copyCaption(): Promise<void> {
    setStatus((await copyText(captions[platform])) ? `${PLATFORM_RULES[platform].label} caption copied.` : "Your browser blocked copying. Select the caption and copy it yourself.");
  }

  async function sharePost(): Promise<void> {
    if (!ready) return;
    // Some apps drop the text they're handed, so the caption goes on the clipboard too.
    const copied = await copyText(captions[platform]);
    try {
      await navigator.share({ files: ready, text: captions[platform] });
      setStatus(copied ? "Shared. The caption is also on your clipboard if the app didn't keep it." : "Shared.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Sharing didn't work here. Use Download photos instead.");
    }
  }

  async function download(): Promise<void> {
    setStatus("Getting your photos ready...");
    try {
      downloadFiles(await photoFiles(photos));
      setStatus(`Downloaded ${photos.length} photo${photos.length === 1 ? "" : "s"}, in posting order.`);
    } catch {
      setStatus("A photo couldn't be loaded. Reload the page and try again.");
    }
  }

  const rule = PLATFORM_RULES[platform];
  const caption = captions[platform];
  const tags = hashtagsIn(caption).length;
  const panelId = `${baseId}-panel`;

  return (
    <div className={styles.post}>
      <ol className={styles.photos} aria-label="Photos, in posting order">
        {photos.map((photo, index) => (
          <li key={photo.id} className={styles.photo}>
            {/* An owner's own photo served from Anchored's private store. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={`Photo ${index + 1} of ${photos.length}`} className={styles.image} />
            {post.slides.length === post.photos.length && <p className={styles.slide}>{post.slides[order[index]!]}</p>}
            {photos.length > 1 && (
              <div className={styles.moves}>
                <button type="button" onClick={() => setOrder((o) => moved(o, index, -1))} disabled={disabled || index === 0} aria-label={`Move photo ${index + 1} earlier`}>
                  <ArrowLeft size={16} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setOrder((o) => moved(o, index, 1))} disabled={disabled || index === photos.length - 1} aria-label={`Move photo ${index + 1} later`}>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className={styles.tabs} role="tablist" aria-label="Caption for each platform">
        {POST_PLATFORMS.map((p) => (
          <button key={p} type="button" role="tab" id={`${baseId}-${p}`} aria-selected={p === platform} aria-controls={panelId} className={styles.tab} onClick={() => pick(p)} disabled={disabled}>
            {PLATFORM_RULES[p].label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={panelId} aria-labelledby={`${baseId}-${platform}`} className={styles.panel}>
        <label className="fine" htmlFor={`${baseId}-text`}>
          {rule.label} caption, following the &quot;{post.formats[platform].name}&quot; format
        </label>
        <textarea id={`${baseId}-text`} className={styles.caption} value={caption} onChange={(event) => edit(event.target.value)} disabled={disabled} rows={8} />
        <p className={styles.meta}>
          {caption.length} of {rule.maxChars} characters, {tags} hashtag{tags === 1 ? "" : "s"}
          {post.written[platform] === "template" && " · Written from Anchored's template"}
        </p>
      </div>

      <div className={styles.acts}>
        <button type="button" className={styles.act} onClick={() => void copyCaption()} disabled={disabled}>
          <Copy size={16} aria-hidden="true" /> Copy caption
        </button>
        {/* Download always works; Share joins it where the device can hand photos to another app, as phones do. */}
        <button type="button" className={styles.act} onClick={() => void download()} disabled={disabled}>
          <Download size={16} aria-hidden="true" /> Download photos
        </button>
        {share && (
          <button type="button" className={styles.act} onClick={() => void sharePost()} disabled={disabled || ready === null}>
            <Share2 size={16} aria-hidden="true" /> {ready === null ? "Preparing photos..." : "Share"}
          </button>
        )}
      </div>
      <p className={styles.status} role="status">
        {status}
      </p>
    </div>
  );
}
