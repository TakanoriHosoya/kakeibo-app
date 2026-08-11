import { useState } from 'react';
import { CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS, USER_OPTIONS } from '../constants';
import { countActiveFilters } from '../lib/records';
import MultiSelectFilter from './MultiSelectFilter';

// 絞り込みの3項目。filters のキーと表示順はここで決まる。
const FILTER_FIELDS = [
  { key: 'category', label: 'カテゴリ', options: CATEGORY_OPTIONS },
  { key: 'user', label: '利用者', options: USER_OPTIONS },
  { key: 'payment', label: '支払方法', options: PAYMENT_METHOD_OPTIONS },
];

// 履歴リストの絞り込みパネル。各項目は複数選べる。絞り込み中は該当件数と合計金額も出す。
function FilterPanel({ filters, onChange, onReset, resultCount, resultTotal }) {
  // 開くのは1項目だけ。重なって表示されないようにする
  const [openKey, setOpenKey] = useState(null);
  const activeFilterCount = countActiveFilters(filters);

  const removeValue = (key, value) => onChange(key, filters[key].filter(v => v !== value));

  return (
    <div className="filter-panel">
      <div className="filter-panel-header">
        <span className="filter-panel-title">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{flexShrink:0, marginRight:5, verticalAlign:'middle'}}>
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          絞り込み
        </span>
        {activeFilterCount > 0 && (
          <button type="button" className="filter-reset-btn" onClick={onReset}>リセット</button>
        )}
      </div>

      <div className="filter-selects">
        {FILTER_FIELDS.map(({ key, label, options }) => (
          <MultiSelectFilter
            key={key}
            label={label}
            options={options}
            selected={filters[key]}
            isOpen={openKey === key}
            onToggleOpen={open => setOpenKey(open ? key : null)}
            onChange={values => onChange(key, values)}
          />
        ))}
      </div>

      {/* 選択中の値をタグで並べる。× で1つずつ外せる */}
      {activeFilterCount > 0 && (
        <div className="filter-status">
          <div className="filter-tags">
            {FILTER_FIELDS.map(({ key }) => (
              filters[key].map(value => (
                <span className="filter-tag" key={`${key}-${value}`}>
                  {value}
                  <button
                    type="button"
                    className="filter-tag-remove"
                    onClick={() => removeValue(key, value)}
                    aria-label={`${value}の絞り込みを外す`}
                  >
                    ×
                  </button>
                </span>
              ))
            ))}
          </div>
          <div className="filter-result-summary">
            {resultCount}件 ／ <span className="filter-result-total">{resultTotal.toLocaleString()}円</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterPanel;
