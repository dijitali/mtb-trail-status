/**
 * Small colour helpers (no dependencies).
 */

function parseHex(hex) {
  let h = String(hex).trim().replace(/^#/, "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`Not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
}

function toHex(rgb) {
  return "#" + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
}

/** Linear blend of two hex colours; amount 0 returns `a`, 1 returns `b`. */
export function mix(a, b, amount) {
  const ca = parseHex(a);
  const cb = parseHex(b);
  return toHex(ca.map((v, i) => v + (cb[i] - v) * amount));
}

/** Neutral the muted colours are pulled towards: a soft grey that still reads on the map. */
export const MUTE_NEUTRAL = "#a3a8a5";

/**
 * Faded version of a colour, used for closed trails: keeps the hue recognisable
 * (so the grade still reads) while clearly losing saturation.
 */
export function muted(hex, amount = 0.5) {
  return mix(hex, MUTE_NEUTRAL, amount);
}
