'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

interface NumberTickerProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  durationMs?: number;
  className?: string;
}

export function NumberTicker({
  value,
  prefix = '',
  suffix = '',
  decimals = 2,
  durationMs = 300,
  className = '',
}: NumberTickerProps) {
  const reducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (reducedMotion || durationMs <= 0) {
      setDisplayValue(value);
      return;
    }

    const startValue = displayValue;
    const diff = value - startValue;
    if (Math.abs(diff) < 0.001) {
      setDisplayValue(value);
      return;
    }

    const startTime = performance.now();
    let frameId: number;

    const tick = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Easing out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + diff * eased;

      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        setDisplayValue(value);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value, durationMs, reducedMotion]);

  const formatted = displayValue.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={`inline-flex items-baseline tabular-nums ${className}`}>
      {prefix && <span>{prefix}</span>}
      <span>{formatted}</span>
      {suffix && <span>{suffix}</span>}
    </span>
  );
}
