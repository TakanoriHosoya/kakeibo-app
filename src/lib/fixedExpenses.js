// 毎月の固定費（fixed シート）の行の組み立て・読み取り。
// Google API に依存しない純粋関数だけを置く。
// 実際に data シートへ記録するのは GAS（gas/recordMonthlyExpenses.gs）で、列の並びはそちらと揃えてある。

import { rowsMatch } from './records';

// fixed シート1行の列位置。items は records と同じく { data: [...], rowNumber } の形で扱う。
export const FIXED_COL = {
  CATEGORY: 0,
  PAYMENT: 1,
  USER: 2,
  AMOUNT: 3,
  DESCRIPTION: 4,
};

// 入力内容を fixed シート1行分の配列に組み立てる
export function buildFixedRow({ category, paymentMethod, user, amount, description }) {
  const row = [];
  row[FIXED_COL.CATEGORY] = category;
  row[FIXED_COL.PAYMENT] = paymentMethod;
  row[FIXED_COL.USER] = user;
  row[FIXED_COL.AMOUNT] = amount;
  row[FIXED_COL.DESCRIPTION] = description;
  return row;
}

// シートの1行を編集フォーム用の値に戻す（buildFixedRow の逆）
export function parseFixedRow(row) {
  const cell = (index) => String(row?.[index] ?? '');
  return {
    category: cell(FIXED_COL.CATEGORY),
    paymentMethod: cell(FIXED_COL.PAYMENT),
    user: cell(FIXED_COL.USER),
    // 表示形式によっては「90,000」のように区切り付きで返るので数字だけにする
    amount: cell(FIXED_COL.AMOUNT).replace(/[^\d]/g, ''),
    description: cell(FIXED_COL.DESCRIPTION),
  };
}

// 2つの行が同じ内容か（編集・削除前の行ズレ検知用）
export function fixedRowsMatch(a, b) {
  return rowsMatch(a, b, Object.values(FIXED_COL));
}

// 空行（スプレッドシートで行の中身だけ消した場合など）は固定費として扱わない
export function isBlankFixedRow(row) {
  return Object.values(FIXED_COL).every(index => String(row?.[index] ?? '').trim() === '');
}

// 毎月かかる金額の合計
export function sumFixedAmount(items) {
  return items.reduce((sum, item) => sum + Number(parseFixedRow(item.data).amount || 0), 0);
}

// 入力内容の不備を文言で返す。問題なければ null
export function validateFixedExpense({ amount, description }) {
  if (!String(description ?? '').trim()) return '内容を入力してください。';
  if (!/^\d+$/.test(String(amount ?? '')) || Number(amount) <= 0) return '金額を1円以上の数字で入力してください。';
  return null;
}
