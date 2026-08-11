// 見た目の確認用。Google 認証なしでモックデータのまま画面を描画する。
// 本番のビルドには含まれない（index.html から参照していない）。
//   ?page=Home|History|Graph   最初に開くページ
//   ?overlay=toast|dialog      通知・確認ダイアログを重ねて表示
import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import Toast from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';
import './index.css';

const today = new Date();
const day = (d) => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 12).toLocaleDateString('sv-SE');

const SHEET_VALUES = [
  ['登録日時', '日付', 'カテゴリ', '支払方法', '利用者', '金額', '内容'],
  ['2026-01-01T00:00:00.000Z', day(3), '食費', '楽天Pay', 'ママ', '4280', 'スーパーまとめ買い'],
  ['2026-01-01T00:00:00.000Z', day(5), '日用品', 'PayPay', 'パパ', '1180', 'ドラッグストア'],
  ['2026-01-01T00:00:00.000Z', day(8), '水道・光熱費', '楽天カード', '家族', '12450', ''],
  ['2026-01-01T00:00:00.000Z', day(9), '趣味・娯楽', '現金', 'パパ', '3600', '映画とポップコーン代'],
  ['2026-01-01T00:00:00.000Z', day(11), '交通費', '京王パスポート', 'ママ', '780', ''],
  ['2026-01-01T00:00:00.000Z', lastMonth, '家賃', '楽天カード', '家族', '98000', '先月分'],
];

window.gapi = {
  load: (_name, { callback }) => callback(),
  client: {
    init: async () => {},
    setToken: () => {},
    sheets: {
      spreadsheets: {
        get: async () => ({ result: { sheets: [{ properties: { sheetId: 42, title: 'data' } }] } }),
        batchUpdate: async () => ({}),
        values: {
          get: async () => ({ result: { values: SHEET_VALUES } }),
          append: async () => ({}),
          update: async () => ({}),
        },
      },
    },
  },
};

sessionStorage.setItem('googleAuthToken', JSON.stringify({
  access_token: 'preview-token',
  expiresAt: Date.now() + 60 * 60 * 1000,
}));

const params = new URLSearchParams(window.location.search);
const overlay = params.get('overlay');
const page = params.get('page');

// 描画が終わってからボタンを押す
const clickWhenReady = (selector, matcher) => {
  const tryClick = () => {
    const target = [...document.querySelectorAll(selector)].find(matcher);
    if (target) target.click();
    else setTimeout(tryClick, 50);
  };
  setTimeout(tryClick, 50);
};

// 指定されたページのタブを押しておく
if (page && page !== 'Home') {
  const label = { History: '履歴', Graph: 'グラフ' }[page];
  clickWhenReady('.main-nav button', b => b.textContent === label);
}

// 1件目を編集中の状態にする
if (params.get('edit')) {
  clickWhenReady('.edit-button', () => true);
}

// 絞り込みを操作した状態にする。?filter=open なら一覧を開いたまま、?filter=tags なら閉じる
const filterState = params.get('filter');
if (filterState) {
  clickWhenReady('.filter-select', b => b.textContent.startsWith('カテゴリ'));
  setTimeout(() => {
    document.querySelectorAll('.filter-option input').forEach((input, index) => {
      if (index === 0 || index === 3) input.click();
    });
    if (filterState === 'tags') {
      document.querySelector('.filter-select').click();
    }
  }, 300);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId="preview-client-id">
      <App />
      {overlay === 'toast' && (
        <Toast toast={{ id: 1, message: '保存しました', type: 'success' }} onClose={() => {}} />
      )}
      {overlay === 'dialog' && (
        <ConfirmDialog
          open
          title="この記録を削除しますか？"
          description={`${new Date(day(5)).toLocaleDateString('ja-JP')}　日用品　1,180円`}
          confirmLabel="削除する"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      )}
    </GoogleOAuthProvider>
  </React.StrictMode>
);
