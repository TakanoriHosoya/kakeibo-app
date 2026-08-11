import { render, screen, fireEvent } from '@testing-library/react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';

// スプレッドシートの読み書きは本物の Google 認証が必要なため、
// gapi を差し替えて「読み込んだ記録が画面に出るところ」までを確認する。
// 保存・更新・削除の実際の書き込みは手動確認に委ねている。

const today = new Date();
const day = (d) => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const SHEET_VALUES = [
  ['登録日時', '日付', 'カテゴリ', '支払方法', '利用者', '金額', '内容'],
  ['2026-01-01T00:00:00.000Z', day(5), '食費', '現金', 'ママ', '1200', 'スーパー'],
  ['2026-01-01T00:00:00.000Z', day(6), '日用品', 'PayPay', 'パパ', '800', 'ドラッグストア'],
  ['2026-01-01T00:00:00.000Z', '2020-03-03', '交通費', '現金', '家族', '5000', '先月以前の記録'],
];

const renderApp = () => render(
  <GoogleOAuthProvider clientId="test-client-id">
    <App />
  </GoogleOAuthProvider>
);

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  window.gapi = { load: (_name, { callback }) => callback() };
});

afterEach(() => {
  vi.restoreAllMocks();
});

// 保存済みトークンがある状態を作る
const signedIn = () => {
  localStorage.setItem('googleAuthToken', JSON.stringify({ access_token: 'dummy-token' }));
  window.gapi = {
    load: (_name, { callback }) => callback(),
    client: {
      init: async () => {},
      setToken: () => {},
      sheets: {
        spreadsheets: {
          values: { get: async () => ({ result: { values: SHEET_VALUES } }) },
        },
      },
    },
  };
};

test('未ログインならログインボタンが表示される', async () => {
  renderApp();

  expect(
    await screen.findByRole('button', { name: 'Googleアカウントでログイン' })
  ).toBeInTheDocument();
});

test('保存済みトークンがあれば当月の記録が一覧に出る', async () => {
  signedIn();
  renderApp();

  expect(await screen.findByText('スーパー')).toBeInTheDocument();
  expect(screen.getByText('ドラッグストア')).toBeInTheDocument();
  // 当月以外は月別リストに出ない
  expect(screen.queryByText('先月以前の記録')).not.toBeInTheDocument();
});

test('絞り込むと該当する記録だけが残り、件数と合計が出る', async () => {
  signedIn();
  renderApp();
  await screen.findByText('スーパー');

  fireEvent.change(screen.getByDisplayValue('カテゴリ：すべて'), { target: { value: '食費' } });

  expect(screen.getByText('スーパー')).toBeInTheDocument();
  expect(screen.queryByText('ドラッグストア')).not.toBeInTheDocument();
  expect(screen.getByText(/1件/)).toBeInTheDocument();
  expect(screen.getByText('1,200円')).toBeInTheDocument();
});

test('絞り込みをリセットすると全件に戻る', async () => {
  signedIn();
  renderApp();
  await screen.findByText('スーパー');

  fireEvent.change(screen.getByDisplayValue('カテゴリ：すべて'), { target: { value: '食費' } });
  expect(screen.queryByText('ドラッグストア')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'リセット' }));
  expect(screen.getByText('ドラッグストア')).toBeInTheDocument();
});

test('履歴ページにカテゴリ別の集計が出る', async () => {
  signedIn();
  renderApp();
  await screen.findByText('スーパー');

  fireEvent.click(screen.getByRole('button', { name: '履歴' }));

  expect(screen.getByText('カテゴリ別集計')).toBeInTheDocument();
  // 当月の総合計 1200 + 800
  expect(screen.getAllByText('2,000 円').length).toBeGreaterThan(0);
});

test('月を戻すと当月の記録が消える', async () => {
  signedIn();
  renderApp();
  await screen.findByText('スーパー');

  fireEvent.click(screen.getByRole('button', { name: '< 先月' }));

  expect(screen.queryByText('スーパー')).not.toBeInTheDocument();
  expect(screen.getByText('この月の記録はありません')).toBeInTheDocument();
});
