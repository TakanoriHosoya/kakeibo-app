// Google スプレッドシートとのやり取り。
// gapi 本体は index.html の script タグで読み込まれ、window.gapi として参照する。

import { SPREADSHEET_ID, SHEET_NAME } from '../constants';

const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

// data シートの内部 ID。シート名から引いた結果を保持する（0 も有効な値なので null で未取得を表す）
let dataSheetId = null;

// gapi のクライアントモジュールを読み込む
export function loadGapi() {
  return new Promise((resolve, reject) => (
    window.gapi.load('client', { callback: resolve, onerror: reject })
  ));
}

// 取得済みのアクセストークンで API クライアントを初期化する
export async function initClient(token) {
  await window.gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
  window.gapi.client.setToken(token);
}

// 見出し行を除いた全記録を、スプレッドシート上の行番号付きで返す
export async function fetchRecords() {
  const response = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:G`,
  });

  const headerRows = 1;
  return (response.result.values || []).slice(headerRows).map((row, index) => ({
    data: row,
    rowNumber: index + headerRows + 1,
  }));
}

// 指定した1行の現在の内容を返す（書き込み前の照合用）。空行なら空配列
export async function fetchRow(rowNumber) {
  const response = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${rowNumber}:G${rowNumber}`,
  });
  return (response.result.values || [])[0] || [];
}

// 末尾に1行追加する
export async function appendRecord(values) {
  await window.gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [values] },
  });
}

// 指定した行を丸ごと書き換える
export async function updateRecord(rowNumber, values) {
  await window.gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${rowNumber}:G${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [values] },
  });
}

// 指定した行を削除する
export async function deleteRecord(rowNumber) {
  const sheetId = await getDataSheetId();
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

// シート名から実際の sheetId を取得する（初回のみ問い合わせ、以降はキャッシュ）。
// 決め打ちにすると、data シートが先頭でない場合に別シートの行を消してしまう。
async function getDataSheetId() {
  if (dataSheetId !== null) return dataSheetId;

  const response = await window.gapi.client.sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties(sheetId,title)',
  });
  const dataSheet = (response.result.sheets || []).find(s => s.properties.title === SHEET_NAME);
  if (!dataSheet) throw new Error(`シート「${SHEET_NAME}」が見つかりませんでした。`);

  dataSheetId = dataSheet.properties.sheetId;
  return dataSheetId;
}
