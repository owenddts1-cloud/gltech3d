'use client';

/** Vertical section indicator on the right edge. Highlights the active story
 *  section and lets the user jump to any of them. Hidden while off-story. */
export function ProgressRail({
  count,
  active,
  visible,
}: {
  count: number;
  active: number;
  visible: boolean;
}) {
  return (
    <div
      className={`fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col gap-3 transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          onClick={() => document.getElementById(`story-${i}`)?.scrollIntoView({ behavior: 'smooth' })}
          aria-label={`Ir para seção ${i + 1}`}
          className="group flex items-center justify-end"
        >
          <span
            className={`block rounded-full transition-all duration-300 ${
              i === active ? 'w-8 h-2 bg-[#A6815C]' : 'w-2 h-2 bg-[#D1C7B7] group-hover:bg-[#A6815C]'
            }`}
          />
        </button>
      ))}
    </div>
  );
}
