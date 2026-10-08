import { describe, expect, it } from "vitest";
import {
  HAVE_CURRENT_DATA,
  HERO_VIDEO_POSTER,
  HERO_VIDEO_TIMEOUT_MS,
  heroImageCandidates,
  shouldUseFallback,
} from "./hero-video-fallback";

describe("shouldUseFallback", () => {
  it("falls back immediately on error, whatever the readyState", () => {
    expect(shouldUseFallback(0, 0, true)).toBe(true);
    expect(shouldUseFallback(4, 0, true)).toBe(true);
  });

  it("keeps the video while it is paintable", () => {
    expect(shouldUseFallback(HAVE_CURRENT_DATA, HERO_VIDEO_TIMEOUT_MS * 10, false)).toBe(false);
    expect(shouldUseFallback(4, HERO_VIDEO_TIMEOUT_MS * 10, false)).toBe(false);
  });

  it("waits for the grace period before giving up on a slow video", () => {
    expect(shouldUseFallback(0, HERO_VIDEO_TIMEOUT_MS - 1, false)).toBe(false);
    expect(shouldUseFallback(1, HERO_VIDEO_TIMEOUT_MS - 1, false)).toBe(false);
    expect(shouldUseFallback(0, HERO_VIDEO_TIMEOUT_MS, false)).toBe(true);
    // Metadata only (HAVE_METADATA) is not enough to paint a frame.
    expect(shouldUseFallback(1, HERO_VIDEO_TIMEOUT_MS + 500, false)).toBe(true);
  });

  it("honors a custom timeout", () => {
    expect(shouldUseFallback(0, 999, false, 1000)).toBe(false);
    expect(shouldUseFallback(0, 1000, false, 1000)).toBe(true);
  });
});

describe("heroImageCandidates", () => {
  it("uses the poster when there is no banner", () => {
    expect(heroImageCandidates(undefined)).toEqual([HERO_VIDEO_POSTER]);
    expect(heroImageCandidates(null)).toEqual([HERO_VIDEO_POSTER]);
    expect(heroImageCandidates("   ")).toEqual([HERO_VIDEO_POSTER]);
  });

  it("tries the banner first, then the poster", () => {
    expect(heroImageCandidates(" https://x.supabase.co/a.jpg ")).toEqual([
      "https://x.supabase.co/a.jpg",
      HERO_VIDEO_POSTER,
    ]);
  });

  it("does not list the poster twice", () => {
    expect(heroImageCandidates(HERO_VIDEO_POSTER)).toEqual([HERO_VIDEO_POSTER]);
  });
});
