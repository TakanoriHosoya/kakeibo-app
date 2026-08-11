import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CATEGORY_OPTIONS } from '../constants';

// 月別の合計とカテゴリ別内訳の折れ線グラフ。
// 表示するカテゴリの選択は App が持つ（ページを切り替えても選択が残るようにするため）。
function GraphSection({ graphData, visibleCategories, onToggleCategory }) {
  return (
    <section className="graph-section">
      <h3>月別支出合計グラフ</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={graphData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
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
        <LineChart data={graphData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
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
