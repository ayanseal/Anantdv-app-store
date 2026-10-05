'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface PlatformOption {
  value: string;
  label: string;
  emoji: string;
  badgeClass: string;
}

const PLATFORMS: PlatformOption[] = [
  { value: '', label: 'All platforms', emoji: '🌐', badgeClass: 'all' },
  { value: 'Android', label: 'Android', emoji: '🤖', badgeClass: 'android' },
  { value: 'iOS', label: 'iOS', emoji: '🍎', badgeClass: 'ios' },
  { value: 'Windows', label: 'Windows', emoji: '🪟', badgeClass: 'windows' },
  { value: 'macOS', label: 'macOS', emoji: '🍏', badgeClass: 'macos' },
  { value: 'Linux', label: 'Linux', emoji: '🐧', badgeClass: 'linux' },
  { value: 'Other', label: 'Other', emoji: '📦', badgeClass: 'other' },
];

export function PlatformSelect({ defaultValue = '' }: { defaultValue?: string }) {
  const [selected, setSelected] = useState<string>(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Synchronize when defaultValue changes from external navigation
  useEffect(() => {
    setSelected(defaultValue);
  }, [defaultValue]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currentOption = PLATFORMS.find(p => p.value === selected) || PLATFORMS[0];

  const handleSelect = (val: string) => {
    setSelected(val);
    setIsOpen(false);
  };

  return (
    <div className="custom-platform-picker" ref={containerRef}>
      {/* Hidden input for standard GET form submission */}
      <input type="hidden" name="platform" value={selected} />

      <button
        type="button"
        className={`custom-picker-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Filter by platform"
      >
        <span className="picker-trigger-content">
          <span className="picker-emoji">{currentOption.emoji}</span>
          <span className="picker-label">{currentOption.label}</span>
        </span>
        <ChevronDown size={15} className={`picker-chevron ${isOpen ? 'rotate' : ''}`} />
      </button>

      {isOpen && (
        <div className="custom-picker-menu" role="listbox" tabIndex={-1}>
          {PLATFORMS.map(option => {
            const isSelected = option.value === selected;
            return (
              <div
                key={option.value || 'all'}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                className={`custom-picker-option ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(option.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(option.value);
                  }
                }}
              >
                <div className="picker-opt-left">
                  <span className="picker-opt-emoji">{option.emoji}</span>
                  <span className={`picker-opt-tag ${option.badgeClass}`}>{option.label}</span>
                </div>
                {isSelected && <Check size={14} className="picker-check-icon" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
