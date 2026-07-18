'use client';

import { useState } from 'react';
import type { ProductVariationGroup } from '@/lib/landing/types';

/**
 * Non-transactional variation selector for the public product page: the visitor
 * explores the available options (size, color…); the purchase itself happens on
 * the marketplace links. Internal `observations` never reach this page — the
 * landing repository does not even select that column.
 */
export default function VariationPicker({ groups }: { groups: ProductVariationGroup[] }) {
  const [selected, setSelected] = useState<Record<string, string>>({});

  return (
    <div className="p-4 rounded-2xl bg-white border border-[#E8E2D9] space-y-4">
      {groups.map((group) => (
        <div key={group.name}>
          <div className="text-[10px] text-[#6B5E55] uppercase tracking-wider font-bold mb-3">
            {group.name}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const isSelected = selected[group.name] === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() =>
                    setSelected((prev) => ({
                      ...prev,
                      // Clicking the active option deselects it.
                      [group.name]: isSelected ? '' : option,
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    isSelected
                      ? 'border-[#A6815C] bg-[#E8E2D9] text-[#8E6D4D]'
                      : 'border-[#E8E2D9] hover:border-[#A6815C] hover:text-[#8E6D4D]'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
