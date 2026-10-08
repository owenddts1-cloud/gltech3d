/**
 * Decision logic for the hero's static fallback (pendência 14).
 *
 * The scroll-scrubbed hero video can fail in ways that never fire a useful
 * event: a 404 on /videos, a CDN that hangs, a mobile data saver that refuses
 * to preload. Before this, the section sat on "Carregando…" forever. Now, if
 * the video is not playable (readyState < HAVE_CURRENT_DATA) after a short
 * grace period, or it errored/stalled, the hero swaps to a static image.
 *
 * Pure on purpose so it can be unit-tested without a <video> element.
 */

/** HTMLMediaElement.HAVE_CURRENT_DATA — the first frame can be painted. */
export const HAVE_CURRENT_DATA = 2;

/** Grace period before giving up on the video. */
export const HERO_VIDEO_TIMEOUT_MS = 2500;

/** Poster shipped in /public — first frame of the desktop scrub video. */
export const HERO_VIDEO_POSTER = "/videos/gl-rocket-poster.jpg";

export function shouldUseFallback(
  readyState: number,
  elapsedMs: number,
  errored: boolean,
  timeoutMs: number = HERO_VIDEO_TIMEOUT_MS,
): boolean {
  if (errored) return true;
  if (readyState >= HAVE_CURRENT_DATA) return false;
  return elapsedMs >= timeoutMs;
}

/**
 * Images to try, in order, in place of the video: the Landing Edit banner
 * wins, then the video poster. The component advances to the next one on
 * `<img onError>`; once the list is exhausted, the section's studio gradient
 * (always rendered underneath) is the last resort.
 */
export function heroImageCandidates(banner: string | null | undefined): string[] {
  const trimmed = banner?.trim();
  return trimmed && trimmed !== HERO_VIDEO_POSTER ? [trimmed, HERO_VIDEO_POSTER] : [HERO_VIDEO_POSTER];
}
