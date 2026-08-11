import { CATEGORY_OPTIONS, USER_OPTIONS } from '../constants';

// 表示中の月のカテゴリ別集計表（利用者ごとの内訳付き）
function SummaryTable({ summary, userSummary, categoryUserSummary }) {
  const grandTotal = Object.values(summary).reduce((acc, cur) => acc + cur, 0);

  return (
    <section className="summary-section">
      <h3>カテゴリ別集計</h3>
      <div className="summary-table">
        <table>
          <thead>
            <tr>
              <th>カテゴリ</th>
              <th>合計金額</th>
              {USER_OPTIONS.map(u => <th key={u}>{u}</th>)}
            </tr>
          </thead>
          <tbody>
            {/* 記録があるカテゴリだけを、選択肢の並び順で表示する */}
            {CATEGORY_OPTIONS.map(cat => (
              summary[cat] !== undefined ? (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td>{summary[cat].toLocaleString()} 円</td>
                  {USER_OPTIONS.map(u => (
                    <td key={u}>
                      {categoryUserSummary[cat] && categoryUserSummary[cat][u]
                        ? categoryUserSummary[cat][u].toLocaleString() : 0} 円
                    </td>
                  ))}
                </tr>
              ) : null
            ))}
            <tr className="summary-total">
              <td><strong>総合計</strong></td>
              <td><strong>{grandTotal.toLocaleString()} 円</strong></td>
              {USER_OPTIONS.map(u => (
                <td key={u}><strong>{userSummary[u] ? userSummary[u].toLocaleString() : 0} 円</strong></td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default SummaryTable;
