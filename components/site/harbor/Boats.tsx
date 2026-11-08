import type { CSSProperties } from "react";
import type { CoreAgentId } from "@/lib/domain/types";
import styles from "@/components/site/harbor/harbor.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The landing page's line art as SVG <symbol>s, drawn once in `BoatDefs` and
// placed with `<use>`: one boat per core agent, the captain at the helm for
// the hero, and the anchor for the closing call to action. Colors come from
// the `.harbor` tokens, so every drawing follows light and dark mode.

/** The symbol id for each core agent's boat. */
export const BOAT_SYMBOL: Readonly<Record<CoreAgentId, string>> = {
  frontdesk: "boat-frontdesk",
  followup: "boat-followup",
  books: "boat-books",
  content: "boat-content",
  internal: "boat-internal",
};

/** The kind of boat each agent is drawn as. */
export const BOAT_KIND: Readonly<Record<CoreAgentId, string>> = {
  frontdesk: "Harbor launch",
  followup: "Sloop",
  books: "Cargo barge",
  content: "Catamaran",
  internal: "Lighthouse tender",
};

/** The pennant color token for each agent. */
export function pennant(id: CoreAgentId): string {
  return `var(--p-${id})`;
}

// The helm wheel's eight spokes, from the hub to just past the rim.
const SPOKES = Array.from({ length: 8 }, (_, k) => {
  const a = (k * Math.PI) / 4;
  const p = (r: number) => `${(206 + r * Math.cos(a)).toFixed(1)} ${(262 + r * Math.sin(a)).toFixed(1)}`;
  return `M${p(7)} L${p(40)}`;
}).join(" ");

/** Render the hidden SVG that holds every symbol. Place it once per page. */
export function BoatDefs() {
  const { f, s, pn, inkFill, signalFill } = styles;
  const fs = `${f} ${s}`;
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="boat-frontdesk" viewBox="0 0 200 140">
          <path className={fs} d="M18 98 L184 98 L170 122 Q100 126 36 122 Z" />
          <rect className={fs} x="62" y="66" width="70" height="32" rx="3" />
          <rect className={s} x="72" y="74" width="16" height="12" rx="1" />
          <rect className={s} x="94" y="74" width="16" height="12" rx="1" />
          <path className={s} d="M132 76 L150 76 L156 98" />
          <path className={s} d="M97 66 L97 30" />
          <path className={pn} d="M97 30 L126 37 L97 44 Z" />
          <circle className={s} cx="160" cy="108" r="4" />
        </symbol>
        <symbol id="boat-followup" viewBox="0 0 200 140">
          <path className={fs} d="M22 104 Q100 110 182 100 L160 122 Q100 128 48 122 Z" />
          <path className={s} d="M102 104 L102 12" />
          <path className={fs} d="M98 16 L98 98 L38 98 Q60 52 98 16 Z" />
          <path className={fs} d="M106 26 L106 98 L162 98 Z" />
          <path className={pn} d="M102 12 L130 18 L102 24 Z" />
        </symbol>
        <symbol id="boat-books" viewBox="0 0 200 140">
          <path className={fs} d="M10 98 L190 98 L180 122 L22 122 Z" />
          <rect className={fs} x="22" y="76" width="30" height="22" />
          <rect className={fs} x="54" y="76" width="30" height="22" />
          <rect className={fs} x="86" y="76" width="30" height="22" />
          <rect className={fs} x="38" y="54" width="30" height="22" />
          <rect className={fs} x="70" y="54" width="30" height="22" />
          <rect className={fs} x="140" y="66" width="34" height="32" rx="2" />
          <rect className={s} x="148" y="72" width="18" height="10" />
          <path className={s} d="M157 66 L157 34" />
          <path className={pn} d="M157 34 L184 40 L157 46 Z" />
        </symbol>
        <symbol id="boat-content" viewBox="0 0 200 140">
          <path className={fs} d="M14 110 L96 110 L86 124 L24 124 Z" />
          <path className={fs} d="M104 110 L186 110 L176 124 L114 124 Z" />
          <rect className={fs} x="22" y="102" width="156" height="8" rx="2" />
          <path className={s} d="M100 102 L100 10" />
          <path className={fs} d="M104 14 L104 98 Q150 90 172 98 Q156 52 104 14 Z" />
          <path className={s} d="M104 40 Q130 44 150 52 M104 66 Q140 68 162 76" opacity=".45" />
          <path className={pn} d="M100 10 L72 16 L100 22 Z" />
        </symbol>
        <symbol id="boat-internal" viewBox="0 0 200 140">
          <path className={fs} d="M16 100 L186 100 L172 122 L34 122 Z" />
          <path className={fs} d="M46 100 L46 74 L118 74 L126 100" />
          <rect className={s} x="56" y="80" width="12" height="10" />
          <rect className={s} x="74" y="80" width="12" height="10" />
          <rect className={s} x="92" y="80" width="12" height="10" />
          <path className={s} d="M84 74 L84 18 M70 34 L98 34 M74 48 L94 48" />
          <circle className={pn} cx="84" cy="18" r="6" />
          <path className={s} d="M70 18 L58 14 M98 18 L110 14 M70 18 L58 22 M98 18 L110 22" opacity=".6" />
          <path className={s} d="M140 100 L140 84 L160 84" />
          <circle className={s} cx="164" cy="84" r="4" />
        </symbol>
        <symbol id="boat-helm" viewBox="0 0 640 420">
          <path className={s} d="M440 318 L440 26" style={{ strokeWidth: 2.4 }} />
          <path className={fs} d="M434 38 L434 304 L322 304 Q352 168 434 38 Z" style={{ strokeWidth: 2.2 }} />
          <path className={fs} d="M448 58 L448 304 L584 304 Z" style={{ strokeWidth: 2.2 }} />
          <path className={s} d="M434 110 Q394 140 360 196 M434 190 Q380 214 340 262" opacity=".35" />
          <path className={pn} d="M440 26 L484 36 L440 46 Z" style={{ strokeWidth: 1.6 }} />
          <path className={fs} d="M40 318 Q320 338 600 306 L556 372 Q320 390 96 372 Z" style={{ strokeWidth: 2.2 }} />
          <path className={s} d="M60 338 Q320 356 586 326" opacity=".45" />
          <text className={inkFill} x="360" y="358" fontFamily="var(--font-archivo), sans-serif" fontWeight="800" fontSize="20" letterSpacing="6" opacity=".85">
            ANCHORED
          </text>
          <path className={inkFill} d="M212 262 L216 196 Q250 180 284 196 L290 262 Z" />
          <path className={fs} d="M238 186 L250 214 L262 186 Q250 181 238 186 Z" />
          <circle className={signalFill} cx="243" cy="226" r="3" />
          <circle className={signalFill} cx="257" cy="226" r="3" />
          <circle className={signalFill} cx="243" cy="243" r="3" />
          <circle className={signalFill} cx="257" cy="243" r="3" />
          <circle className={fs} cx="250" cy="154" r="19" />
          <path className={inkFill} opacity=".88" d="M232 154 Q233 178 250 180 Q267 178 268 154 Q262 166 250 166 Q238 166 232 154 Z" />
          <path className={inkFill} d="M221 134 Q223 110 250 108 Q277 110 280 134 Z" />
          <path className={inkFill} d="M214 134 Q250 142 287 134 L285 140 Q250 148 216 140 Z" />
          <circle className={signalFill} cx="251" cy="122" r="5" />
          <path className={s} d="M282 202 Q312 222 318 198" style={{ strokeWidth: 13 }} />
          <rect className={fs} x="309" y="160" width="22" height="36" rx="3" />
          <rect className={signalFill} x="313" y="166" width="14" height="10" rx="1" />
          <circle className={fs} cx="320" cy="198" r="7" />
          <rect className={fs} x="150" y="262" width="170" height="56" rx="3" />
          <circle className={s} cx="292" cy="288" r="9" />
          <path className={s} d="M292 288 L298 282 M164 282 L232 282 M164 296 L218 296" opacity=".6" />
          <path className={s} d="M206 296 L206 318" style={{ strokeWidth: 5 }} />
          <circle className={s} cx="206" cy="262" r="30" style={{ strokeWidth: 4 }} />
          <path className={s} d={SPOKES} style={{ strokeWidth: 3.4 }} />
          <circle className={signalFill} cx="206" cy="262" r="7" style={{ stroke: "var(--ink)", strokeWidth: 2 }} />
          <path className={s} d="M220 202 Q200 226 196 246" style={{ strokeWidth: 13 }} />
          <circle className={fs} cx="195" cy="248" r="7" />
        </symbol>
        <symbol id="boat-anchor" viewBox="0 0 120 150">
          <circle className={signalFill} cx="60" cy="16" r="11" style={{ stroke: "var(--ink)", strokeWidth: 3 }} />
          <path
            className={s}
            style={{ strokeWidth: 4 }}
            d="M60 27 L60 132 M36 48 L84 48 M14 96 Q18 130 60 132 Q102 130 106 96 M6 104 L14 92 L24 102 M114 104 L106 92 L96 102"
          />
        </symbol>
      </defs>
    </svg>
  );
}

/** Place one symbol. `color` sets the pennant. */
export function Boat({ symbol, viewBox, color, className }: { readonly symbol: string; readonly viewBox: string; readonly color?: string; readonly className?: string }) {
  return (
    <svg className={className} viewBox={viewBox} aria-hidden="true" focusable="false" style={color === undefined ? undefined : ({ "--pc": color } as CSSProperties)}>
      <use href={`#${symbol}`} />
    </svg>
  );
}
