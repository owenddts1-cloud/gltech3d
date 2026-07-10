'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { RocketExploded } from './RocketExploded';
import { ParticleHero } from '@/components/marketing/ParticleHero';

/* ────────────────────────────────────────────────────────────────────────────
   RocketVideoScrub — full-bleed cinematic hero video for the landing.

   The rocket render's grey studio palette becomes the ENTIRE hero background
   (object-cover, edge to edge) so there is no floating "card" and the page reads
   as one cohesive graphite + tan palette. The video autoplays on loop (reliable
   motion), with a subtle tan particle layer floating on top (cursor-reactive).

   Fallback: if the MP4 is missing/broken it renders the SVG <RocketExploded />
   plus the particle overlay — safe to ship before the video exists.
   ──────────────────────────────────────────────────────────────────────────── */

const DEFAULT_SRC = '/videos/rocket/gl-rocket-explode.mp4';
const METADATA_TIMEOUT_MS = 4000;

interface RocketVideoScrubProps {
  visible: boolean;
  src?: string;
  poster?: string;
  className?: string;
}

export function RocketVideoScrub(props: RocketVideoScrubProps): JSX.Element {
  const { visible, src = DEFAULT_SRC, poster, className } = props;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);

  /* prefers-reduced-motion */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      setVideoFailed(true);
      return;
    }
    setReady(true);
  }, []);

  /* Watchdog: if metadata never arrives, fall back to the SVG. */
  useEffect(() => {
    if (ready || videoFailed) return;
    const video = videoRef.current;
    if (video && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      handleLoadedMetadata();
      return;
    }
    const id = window.setTimeout(() => setVideoFailed(true), METADATA_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [ready, videoFailed, handleLoadedMetadata]);

  /* Pause when reduced motion is on (park on the first frame). */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ready) return;
    if (reduced) {
      video.pause();
      video.currentTime = 0;
    } else {
      void video.play().catch(() => {
        /* autoplay may be blocked; the poster/first frame still shows */
      });
    }
  }, [reduced, ready]);

  if (videoFailed) {
    return (
      <>
        <RocketExploded visible={visible} className={className} />
        <ParticleOverlay visible={visible} />
      </>
    );
  }

  return (
    <motion.div
      aria-hidden
      className={`fixed inset-0 z-[5] pointer-events-none overflow-hidden ${className ?? ''}`}
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    >
      {/* Grey base so nothing flashes cream before the video paints */}
      <div className="absolute inset-0 cine-studio-sweep" />

      {/* Full-bleed cinematic video — its studio grey IS the hero background */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted
        loop
        autoPlay={!reduced}
        playsInline
        controls={false}
        onLoadedMetadata={handleLoadedMetadata}
        onError={() => setVideoFailed(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Readability scrim: lighten the far-left/right where the section copy sits */}
      <div className="absolute inset-0 cine-hero-scrim" />

      {/* 9D layer: cursor-reactive tan particles tie the brand accent into the grey */}
      <ParticleHero className="absolute inset-0 opacity-50" />
    </motion.div>
  );
}

/** Fixed particle overlay used with the SVG fallback so the reactive "9D"
 *  depth layer shows even before the video exists. */
function ParticleOverlay({ visible }: { visible: boolean }): JSX.Element {
  return (
    <motion.div
      aria-hidden
      className="fixed inset-0 z-[6] pointer-events-none overflow-hidden"
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    >
      <ParticleHero className="absolute inset-0 opacity-60" />
    </motion.div>
  );
}
