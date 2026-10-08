'use client';

import { motion } from 'motion/react';

export interface TabItem {
  id: string;
  label: string;
  description?: string;
}

interface MotionTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onSelect: (id: string) => void;
  className?: string;
}

export function MotionTabs({
  tabs,
  activeTab,
  onSelect,
  className = '',
}: MotionTabsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            data-active={isActive ? 'true' : 'false'}
            onClick={() => onSelect(tab.id)}
            className={`relative rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              isActive ? 'text-white' : 'text-[#6B5E55] hover:text-[#2D241E]'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activePresetPill"
                className="absolute inset-0 rounded-full bg-[#7A5C3E] shadow-sm"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
            {tab.description && (
              <span
                className={`relative z-10 ml-2 text-[11px] font-medium ${
                  isActive ? 'text-white/80' : 'text-[#A6815C]'
                }`}
              >
                {tab.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
