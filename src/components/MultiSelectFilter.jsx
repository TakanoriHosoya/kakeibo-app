import { useEffect, useRef } from 'react';
import { toggleFilterValue } from '../lib/records';

function SelectArrow() {
  return (
    <svg className="filter-select-arrow" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// 複数選べる絞り込み。閉じている間は今までのドロップダウンと同じ見た目・高さになる。
// 開閉の状態は FilterPanel が持つ（同時に開くのは1つだけにするため）。
function MultiSelectFilter({ label, options, selected, isOpen, onToggleOpen, onChange }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    // 外を触ったら閉じる
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) onToggleOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onToggleOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onToggleOpen]);

  // 1件だけならその名前を、複数なら件数を出す（幅に収めるため）
  const summary = selected.length === 0 ? 'すべて'
    : selected.length === 1 ? selected[0]
    : `${selected.length}件選択`;

  return (
    <div className="filter-select-wrap" ref={containerRef}>
      <button
        type="button"
        className={`filter-select ${selected.length > 0 ? 'filter-select--active' : ''}`}
        onClick={() => onToggleOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        {label}：{summary}
      </button>
      <SelectArrow />

      {isOpen && (
        <div className="filter-options" role="group" aria-label={`${label}で絞り込む`}>
          {options.map(option => (
            <label key={option} className="filter-option">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => onChange(toggleFilterValue(selected, option, options))}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default MultiSelectFilter;
