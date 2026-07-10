'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

const textVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
} as const;

/** Reveal wrapper: fade + slide up when it enters the viewport. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      variants={textVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount: 0.6 }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A full-viewport story panel. Reports itself active when it crosses the
 * viewport center (drives the fixed MediaStage). `side` positions the text
 * column left/right so the pinned product stays readable.
 */
export function StorySection({
  id,
  index,
  onActivate,
  side = 'left',
  children,
}: {
  id: string;
  index: number;
  onActivate: (index: number) => void;
  side?: 'left' | 'right';
  children: ReactNode;
}) {
  return (
    <motion.section
      id={id}
      className={`relative z-20 min-h-screen flex items-center px-8 md:px-20 ${
        side === 'right' ? 'justify-end text-right' : 'justify-start text-left'
      }`}
      onViewportEnter={() => onActivate(index)}
      viewport={{ amount: 0.55 }}
    >
      <div className="max-w-md">{children}</div>
    </motion.section>
  );
}
