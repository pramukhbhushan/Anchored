"use client";

import { CircleAlert, LoaderCircle, X } from "lucide-react";
import type { PhotoPicker } from "@/components/chat/photo-upload";
import styles from "./chat.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The photos waiting to go out with the owner's next chat message: a row of
// thumbnails above the text box, each uploading, ready or failed, with a button
// to take it out. A failed photo says why, in the owner's words.

/** Render the picked photos and their upload state, or nothing when none are picked. */
export function PhotoTray({ picker, disabled }: { readonly picker: PhotoPicker; readonly disabled: boolean }) {
  if (picker.photos.length === 0 && picker.notice === null) return null;
  const failed = picker.photos.find((p) => p.status === "failed");
  return (
    <div className={styles.tray}>
      {picker.photos.length > 0 && (
        <ul className={styles.trayList} aria-label={`Photos for your post, ${picker.photos.length} added`}>
          {picker.photos.map((photo, index) => (
            <li key={photo.key} className={styles.trayItem} data-status={photo.status}>
              {/* A local preview of the owner's own file, so next/image has nothing to optimize. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.preview} alt={`Photo ${index + 1}: ${photo.name}`} className={styles.trayThumb} />
              {photo.status === "uploading" && (
                <span className={styles.trayState} role="status">
                  <LoaderCircle size={16} aria-hidden="true" className={styles.spin} />
                  <span className={styles.srOnly}>Uploading photo {index + 1}</span>
                </span>
              )}
              {photo.status === "failed" && (
                <span className={styles.trayState}>
                  <CircleAlert size={16} aria-hidden="true" />
                  <span className={styles.srOnly}>Photo {index + 1} didn&apos;t upload</span>
                </span>
              )}
              <button type="button" className={styles.trayRemove} onClick={() => picker.remove(photo.key)} disabled={disabled} aria-label={`Remove photo ${index + 1}`}>
                <X size={14} strokeWidth={2.6} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {failed && (
        <p className={styles.trayNote} role="alert">
          {failed.error ?? "A photo didn't upload."} Remove it to send the rest.
        </p>
      )}
      {picker.notice !== null && <p className={styles.trayNote}>{picker.notice}</p>}
    </div>
  );
}
