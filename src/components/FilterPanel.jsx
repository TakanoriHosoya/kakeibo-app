import { CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS, USER_OPTIONS } from '../constants';
import { FILTER_ALL, countActiveFilters } from '../lib/records';

// 絞り込みの3項目。filters のキーと表示順はここで決まる。
const FILTER_FIELDS = [
  { key: 'category', label: 'カテゴリ', options: CATEGORY_OPTIONS },
  { key: 'user', label: '利用者', options: USER_OPTIONS },
  { key: 'payment', label: '支払方法', options: PAYMENT_METHOD_OPTIONS },
];

function SelectArrow() {
  return (
    <svg className="filter-select-arrow" width="10" height="10" viewBox="0 0 10 10">
      <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// 履歴リストの絞り込みパネル。絞り込み中は該当件数と合計金額も出す。
function FilterPanel({ filters, onChange, onReset, resultCount, resultTotal }) {
  const activeFilterCount = countActiveFilters(filters);

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
          <button className="filter-reset-btn" onClick={onReset}>リセット</button>
        )}
      </div>

      <div className="filter-selects">
        {FILTER_FIELDS.map(({ key, label, options }) => (
          <div className="filter-select-wrap" key={key}>
            <select
              className={`filter-select ${filters[key] !== FILTER_ALL ? 'filter-select--active' : ''}`}
              value={filters[key]}
              onChange={e => onChange(key, e.target.value)}
            >
              <option value={FILTER_ALL}>{label}：すべて</option>
              {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <SelectArrow />
          </div>
        ))}
      </div>

      {/* アクティブフィルタータグ＋件数合計 */}
      {activeFilterCount > 0 && (
        <div className="filter-status">
          <div className="filter-tags">
            {FILTER_FIELDS.map(({ key }) => (
              filters[key] !== FILTER_ALL && (
                <span className="filter-tag" key={key}>
                  {filters[key]}
                  <button className="filter-tag-remove" onClick={() => onChange(key, FILTER_ALL)}>×</button>
                </span>
              )
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
