// Google スプレッドシートとのやり取り。
// gapi 本体は index.html の script タグで読み込まれ、window.gapi として参照する。

import { SPREADSHEET_ID, SHEET_NAME, FIXED_SHEET_NAME } from '../constants';
import { isBlankFixedRow } from './fixedExpenses';

const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

// 扱うシートごとの名前と最終列。行の読み書きはこの範囲で行う
const DATA_SHEET = { name: SHEET_NAME, lastCol: 'G' };
const FIXED_SHEET = { name: FIXED_SHEET_NAME, lastCol: 'E' };

const HEADER_ROWS = 1;

// シート名 → 内部 ID の対応。一度問い合わせた結果を保持する
let sheetIdCache = null;

// gapi のクライアントモジュールを読み込む
export function loadGapi() {
  return new Promise((resolve, reject) => (
    window.gapi.load('client', { callback: resolve, onerror: reject })
  ));
}

// 取得済みのアクセストークンで API クライアントを初期化する。
// ログインし直したときはシート構成が変わっている可能性があるので、シート ID の控えも捨てる
export async function initClient(token) {
  sheetIdCache = null;
  await window.gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
  window.gapi.client.setToken(token);
}

// --- シート共通の操作 ---

// 見出し行を除いた全行を、スプレッドシート上の行番号付きで返す
async function fetchAllRows(sheet) {
  const response = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet.name}!A:${sheet.lastCol}`,
  });
  return (response.result.values || []).slice(HEADER_ROWS).map((row, index) => ({
    data: row,
    rowNumber: index + HEADER_ROWS + 1,
  }));
}

// 指定した1行の現在の内容を返す（書き込み前の照合用）。空行なら空配列
async function fetchSingleRow(sheet, rowNumber) {
  const response = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet.name}!A${rowNumber}:${sheet.lastCol}${rowNumber}`,
  });
  return (response.result.values || [])[0] || [];
}

async function appendRow(sheet, values) {
  await window.gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet.name}!A1`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [values] },
  });
}

async function updateRow(sheet, rowNumber, values) {
  await window.gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet.name}!A${rowNumber}:${sheet.lastCol}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [values] },
  });
}

async function deleteRow(sheet, rowNumber) {
  const sheetId = await findSheetId(sheet.name);
  if (sheetId === null) throw new Error(`シート「${sheet.name}」が見つかりませんでした。`);

  await window.gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber },
        },
      }],
    },
  });
}

// シート名から実際の sheetId を引く。無ければ null。
// 決め打ちにすると、data シートが先頭でない場合に別シートの行を消してしまう。
// 見つかった結果はキャッシュするが、見つからなかったときは毎回問い合わせ直す
// （アプリを開いたまま GAS でシートを作った場合にも追従するため）。
async function findSheetId(title) {
  if (sheetIdCache?.has(title)) return sheetIdCache.get(title);

  const response = await window.gapi.client.sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties(sheetId,title)',
  });
  sheetIdCache = new Map(
    (response.result.sheets || []).map(s => [s.properties.title, s.properties.sheetId])
  );
  return sheetIdCache.has(title) ? sheetIdCache.get(title) : null;
}

// --- 家計簿の記録（data シート） ---

export const fetchRecords = () => fetchAllRows(DATA_SHEET);
export const fetchRow = (rowNumber) => fetchSingleRow(DATA_SHEET, rowNumber);
export const appendRecord = (values) => appendRow(DATA_SHEET, values);
export const updateRecord = (rowNumber, values) => updateRow(DATA_SHEET, rowNumber, values);
export const deleteRecord = (rowNumber) => deleteRow(DATA_SHEET, rowNumber);

// --- 毎月の固定費（fixed シート） ---

// 固定費の一覧を返す。シートがまだ無ければ null（GAS の setupFixedSheet が未実行）
export async function fetchFixedExpenses() {
  if (await findSheetId(FIXED_SHEET.name) === null) return null;
  const rows = await fetchAllRows(FIXED_SHEET);
  return rows.filter(row => !isBlankFixedRow(row.data));
}

export const fetchFixedRow = (rowNumber) => fetchSingleRow(FIXED_SHEET, rowNumber);
export const appendFixedExpense = (values) => appendRow(FIXED_SHEET, values);
export const updateFixedExpense = (rowNumber, values) => updateRow(FIXED_SHEET, rowNumber, values);
export const deleteFixedExpense = (rowNumber) => deleteRow(FIXED_SHEET, rowNumber);
