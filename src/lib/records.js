// 記録の集計・絞り込みロジック。
// Google API に依存しない純粋関数だけを置く（テストで挙動を固定するため）。

// スプレッドシート1行の列位置。records は { data: [...], rowNumber } の形で扱う。
export const COL = {
  TIMESTAMP: 0,
  DATE: 1,
  CATEGORY: 2,
  PAYMENT: 3,
  USER: 4,
  AMOUNT: 5,
  DESCRIPTION: 6,
};

// 絞り込みの初期値。各項目は選んだ値の配列で、空配列が「絞り込まない」を表す
export const NO_FILTERS = { category: [], user: [], payment: [] };

// 入力フォームの内容をスプレッドシート1行分の配列に組み立てる
export function buildRecordRow({ date, category, paymentMethod, user, amount, description }, timestamp = new Date()) {
  const row = [];
  row[COL.TIMESTAMP] = timestamp.toISOString();
  row[COL.DATE] = date;
  row[COL.CATEGORY] = category;
  row[COL.PAYMENT] = paymentMethod;
  row[COL.USER] = user;
  row[COL.AMOUNT] = amount;
  row[COL.DESCRIPTION] = description;
  return row;
}

// 2つの行が同じ内容か。編集・削除は行番号を頼りに書き込むため、
// 他端末やスプレッドシート直編集で行がずれていないかをこれで照合する。
// 末尾の空セルは省略されて返ることがあるので、長さではなく列ごとに比べる。
export function rowsMatch(a, b) {
  const cell = (row, index) => String(row?.[index] ?? '').trim();
  return Object.values(COL).every(index => cell(a, index) === cell(b, index));
}

// 指定した年月の記録だけを、日付の新しい順に返す
export function filterRecordsByMonth(records, viewingDate) {
  const targetYear = viewingDate.getFullYear();
  const targetMonth = viewingDate.getMonth();

  return records
    .filter(record => {
      if (!record || !record.data[COL.DATE]) return false;
      const recordDate = new Date(record.data[COL.DATE]);
      if (isNaN(recordDate.getTime())) return false;
      return recordDate.getFullYear() === targetYear && recordDate.getMonth() === targetMonth;
    })
    .sort((a, b) => new Date(b.data[COL.DATE]) - new Date(a.data[COL.DATE]));
}

// カテゴリ別・利用者別・カテゴリ×利用者の合計を求める
export function summarizeRecords(records) {
  const categoryTotals = {};
  const userTotals = {};
  const categoryUserTotals = {};

  records.forEach(record => {
    const cat = record.data[COL.CATEGORY];
    const usr = record.data[COL.USER];
    const amt = Number(record.data[COL.AMOUNT] || 0);

    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    userTotals[usr] = (userTotals[usr] || 0) + amt;
    if (!categoryUserTotals[cat]) categoryUserTotals[cat] = {};
    categoryUserTotals[cat][usr] = (categoryUserTotals[cat][usr] || 0) + amt;
  });

  return { categoryTotals, userTotals, categoryUserTotals };
}

// 月ごとの合計とカテゴリ別内訳を、月の昇順で返す（グラフ用）
export function generateGraphData(records, categoryOptions) {
  const monthlyData = {};

  records.forEach(record => {
    if (!record || !record.data[COL.DATE]) return;
    const recordDate = new Date(record.data[COL.DATE]);
    if (isNaN(recordDate.getTime())) return;

    const yearMonth = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
    const cat = record.data[COL.CATEGORY];
    const amt = Number(record.data[COL.AMOUNT] || 0);

    if (!monthlyData[yearMonth]) {
      monthlyData[yearMonth] = { date: yearMonth, total: 0 };
      categoryOptions.forEach(c => { monthlyData[yearMonth][c] = 0; });
    }
    monthlyData[yearMonth].total += amt;
    // 選択肢に無いカテゴリ（スプレッドシート直編集など）は合計にだけ反映する
    if (monthlyData[yearMonth][cat] !== undefined) {
      monthlyData[yearMonth][cat] += amt;
    }
  });

  return Object.values(monthlyData).sort((a, b) => a.date.localeCompare(b.date));
}

// カテゴリ・利用者・支払方法の3条件で絞り込む。
// 各条件は選んだ値のいずれかに一致すれば通り（OR）、条件どうしは両方満たす必要がある（AND）。
export function applyFilters(records, { category, user, payment }) {
  return records.filter(record => (
    matchesAny(category, record.data[COL.CATEGORY]) &&
    matchesAny(user, record.data[COL.USER]) &&
    matchesAny(payment, record.data[COL.PAYMENT])
  ));
}

// 何も選んでいなければ絞り込まない
function matchesAny(selected, value) {
  return selected.length === 0 || selected.includes(value);
}

// 選択肢の並び順を保ったまま、値の選択・解除を切り替える
export function toggleFilterValue(selected, value, options) {
  if (selected.includes(value)) return selected.filter(v => v !== value);
  return options.filter(option => option === value || selected.includes(option));
}

// 金額の合計
export function sumAmount(records) {
  return records.reduce((sum, record) => sum + Number(record.data[COL.AMOUNT] || 0), 0);
}

// 絞り込み中の条件の数（0 ならフィルタ未使用）
export function countActiveFilters({ category, user, payment }) {
  return [category, user, payment].filter(selected => selected.length > 0).length;
}
