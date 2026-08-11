import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CATEGORY_OPTIONS } from '../constants';
import { FILTER_ALL } from '../lib/records';

// 目盛りは「100000」だと横幅を食って読みにくいので万単位に丸める（スマホ対策）
const formatTick = (value) => {
  if (Math.abs(value) < 10000) return value.toLocaleString();
  const man = value / 10000;
  return `${Number.isInteger(man) ? man : man.toFixed(1)}万`;
};

// 吹き出しの中は丸めずに実額を出す
const formatTooltip = (value) => `${Number(value).toLocaleString()} 円`;

// 月別の合計とカテゴリ別内訳の折れ線グラフ。
// 表示するカテゴリの選択は App が持つ（ページを切り替えても選択が残るようにするため）。
function GraphSection({ graphData, filters, visibleCategories, onToggleCategory }) {
  const activeFilters = Object.values(filters).filter(value => value !== FILTER_ALL);

  return (
    <section className="graph-section">
      {activeFilters.length > 0 && (
        <p className="graph-filter-note">
          絞り込み中（{activeFilters.join('・')}）— 該当する記録だけを全期間分集計しています
        </p>
      )}

      <h3>月別支出合計グラフ</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={graphData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatTick} tick={{ fontSize: 12 }} width={48} />
          <Tooltip formatter={formatTooltip} />
          <Legend />
          <Line type="monotone" dataKey="total" stroke="#8884d8" name="月別合計" />
        </LineChart>
      </ResponsiveContainer>

      <h3>カテゴリ別支出合計グラフ</h3>
      <div className="category-toggles">
        {CATEGORY_OPTIONS.map(cat => (
          <button
            key={cat}
            className={`category-toggle ${visibleCategories.has(cat) ? 'active' : 'inactive'}`}
            onClick={() => onToggleCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={graphData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatTick} tick={{ fontSize: 12 }} width={48} />
          <Tooltip formatter={formatTooltip} />
          <Legend />
          {CATEGORY_OPTIONS.map((cat, index) => (
            visibleCategories.has(cat) && (
              <Line key={cat} type="monotone" dataKey={cat} stroke={`hsl(${(index * 25) % 360}, 70%, 50%)`} name={cat} />
            )
          ))}
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

export default GraphSection;
