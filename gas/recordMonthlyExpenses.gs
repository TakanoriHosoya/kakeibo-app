/**
 * 家計簿スプレッドシートの Apps Script。
 * このファイルはリポジトリでの控え。実際に動くのは、スプレッドシートの
 * 「拡張機能」→「Apps Script」に貼り付けたもの（変更したら両方を揃えること）。
 *
 * 固定費の一覧は「fixed」シートに置き、アプリの「固定費」ページから編集する。
 * recordMonthlyExpenses が毎月1日のトリガーでそれを読み、「data」シートへ記録する。
 *
 * 列の並びはアプリ側（src/lib/fixedExpenses.js の FIXED_COL、src/lib/records.js の COL）と揃えてある。
 */

const DATA_SHEET_NAME = 'data';
const FIXED_SHEET_NAME = 'fixed';

// fixed シートの列：A カテゴリ / B 支払方法 / C 利用者 / D 金額 / E 内容
const FIXED_HEADER = ['カテゴリ', '支払方法', '利用者', '金額', '内容'];

/**
 * fixed シートの固定費を、data シートの末尾にまとめて記録する。
 * 既存のトリガーがこの関数名を呼んでいるので、名前は変えないこと。
 */
function recordMonthlyExpenses() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = spreadsheet.getSheetByName(DATA_SHEET_NAME);
  const fixedSheet = spreadsheet.getSheetByName(FIXED_SHEET_NAME);

  // 失敗は握りつぶさずに投げる。トリガー実行が失敗すると Google からメールで通知が届く
  if (!dataSheet) throw new Error(`シート「${DATA_SHEET_NAME}」が見つかりません。`);
  if (!fixedSheet) throw new Error(`シート「${FIXED_SHEET_NAME}」が見つかりません。setupFixedSheet を実行してください。`);

  const lastRow = fixedSheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('固定費が1件も登録されていないため、何も記録しませんでした。');
    return;
  }

  const items = fixedSheet.getRange(2, 1, lastRow - 1, FIXED_HEADER.length).getValues()
    // 中身を消しただけの空行は飛ばす
    .filter(row => row.some(cell => String(cell).trim() !== ''));

  if (items.length === 0) {
    Logger.log('固定費が1件も登録されていないため、何も記録しませんでした。');
    return;
  }

  const now = new Date();
  const newRows = items.map(([category, paymentMethod, user, amount, description]) => [
    now,              // A列: 登録日時（実行日時）
    now,              // B列: 日付
    category,         // C列: カテゴリ
    paymentMethod,    // D列: 支払方法
    user,             // E列: 利用者
    Number(amount),   // F列: 金額
    description,      // G列: 内容
  ]);

  // 1件ずつ appendRow すると途中で失敗したときに半端に記録されるので、まとめて書き込む
  dataSheet.getRange(dataSheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);

  Logger.log(`合計 ${newRows.length} 件の固定費をシート「${DATA_SHEET_NAME}」に記録しました。`);
}

/**
 * 【最初に1回だけ実行】fixed シートを作り、これまでコードに直接書いていた固定費を移す。
 * すでに fixed シートがある場合は、上書きしないよう何もせずにエラーにする。
 */
function setupFixedSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (spreadsheet.getSheetByName(FIXED_SHEET_NAME)) {
    throw new Error(`シート「${FIXED_SHEET_NAME}」はすでにあります。中身を確認してください。`);
  }

  // 旧コードの dataToRecordList と同じ内容。
  // ただし AppleMusic のカテゴリ「食費趣味・娯楽」は打ち間違いと判断し「趣味・娯楽」に直した。
  const initialItems = [
    ['家賃', '銀行引き落とし', '家族', 90000, '今月分の家賃・駐車場'],
    ['保険', '銀行引き落とし', '家族', 5830, '東京海藤日動火災保険'],
    ['保険', '銀行引き落とし', '家族', 13581, '学資：圭佑'],
    ['保険', '銀行引き落とし', '家族', 12538, '学資：芽衣'],
    ['保険', '銀行引き落とし', '家族', 14859, '生命：パパ'],
    ['保険', '銀行引き落とし', '家族', 1391, '生命：ママ'],
    ['保険', '銀行引き落とし', '家族', 2000, '都民共済：ママ'],
    ['習い事', '銀行引き落とし', '家族', 9000, 'ダンス：芽衣'],
    ['習い事', '銀行引き落とし', '家族', 18150, '塾：芽衣'],
    ['習い事', '銀行引き落とし', '家族', 10050, 'サッカー：圭佑'],
    ['習い事', '現金', '家族', 5000, 'ピアノ：芽衣'],
    ['食費', '楽天カード', '家族', 7280, 'ウォーターサーバー'],
    ['趣味・娯楽', 'Amazonカード', 'パパ', 1680, 'AppleMusic'],
    ['趣味・娯楽', 'Amazonカード', 'パパ', 980, '少年ジャンプ'],
    ['趣味・娯楽', 'Amazonカード', 'パパ', 980, 'ポケポケ'],
  ];

  const sheet = spreadsheet.insertSheet(FIXED_SHEET_NAME);
  sheet.getRange(1, 1, 1, FIXED_HEADER.length).setValues([FIXED_HEADER]).setFontWeight('bold');
  sheet.getRange(2, 1, initialItems.length, FIXED_HEADER.length).setValues(initialItems);
  sheet.setFrozenRows(1);

  Logger.log(`シート「${FIXED_SHEET_NAME}」を作成し、${initialItems.length} 件の固定費を登録しました。`);
}
