import styles from "@/components/business/visuals.module.css";
import { FIT_BAND_LABEL, fitBand } from "@/components/business/tool-visuals";

// =============================================================================
// Module Overview
// =============================================================================
// `FitRing`, a tool's fit score as a ring that fills to the score, with the
// number inside and the ring colored by band. The image carries its own label,
// such as "Fit 69 out of 100, good fit".

/** Render the fit ring for a score out of 100. */
export function FitRing({ total }: { readonly total: number }) {
  const band = fitBand(total);
  return (
    <span className={styles.ring} data-band={band} role="img" aria-label={`Fit ${total} out of 100, ${FIT_BAND_LABEL[band]}`}>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle className={styles.ringTrack} cx="22" cy="22" r="19" />
        {/* `pathLength` makes the dash pattern read in score points, so the arc is `total` of 100 */}
        <circle className={styles.ringArc} cx="22" cy="22" r="19" pathLength={100} strokeDasharray={`${total} 100`} />
      </svg>
      <span className={styles.ringNum} aria-hidden="true">
        {total}
      </span>
    </span>
  );
}
