import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
  sessionStorage.clear();
  window.gapi = { load: (_name, { callback }) => callback() };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const HOUR_MS = 60 * 60 * 1000;

// 書き込み系の API。呼ばれたか・何を渡されたかを確かめる
let batchUpdate;
let append;
let update;

// 保存済みトークンがある状態を作る。
// expiresAt で期限切れの状態を、rowOverride で「シート側の行が変わっている」状態を作れる。
// fixedValues を渡すと fixed シート（固定費）がある状態になる。null ならシート自体が無い。
const signedIn = ({ expiresAt = Date.now() + HOUR_MS, rowOverride = null, fixedValues = null } = {}) => {
  sessionStorage.setItem('googleAuthToken', JSON.stringify({ access_token: 'dummy-token', expiresAt }));
  batchUpdate = vi.fn(async () => ({}));
  append = vi.fn(async () => ({}));
  update = vi.fn(async () => ({}));

  const sheets = [{ properties: { sheetId: 42, title: 'data' } }];
  if (fixedValues) sheets.push({ properties: { sheetId: 7, title: 'fixed' } });

  window.gapi = {
    load: (_name, { callback }) => callback(),
    client: {
      init: async () => {},
      setToken: () => {},
      sheets: {
        spreadsheets: {
          get: async () => ({ result: { sheets } }),
          batchUpdate,
          values: {
            append,
            update,
            get: async ({ range }) => {
              if (range.startsWith('fixed!')) {
                const singleFixedRow = range.match(/!A(\d+):E\d+$/);
                if (!singleFixedRow) return { result: { values: fixedValues } };
                return { result: { values: [fixedValues[Number(singleFixedRow[1]) - 1]] } };
              }

              // 単一行の取得（書き込み前の照合）と全件取得を range で見分ける
              const singleRow = range.match(/!A(\d+):G\d+$/);
              if (!singleRow) return { result: { values: SHEET_VALUES } };

              const row = rowOverride || SHEET_VALUES[Number(singleRow[1]) - 1];
              return { result: { values: [row] } };
            },
          },
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

// 絞り込み中に出る「◯件 ／ ◯円」。ボタン側にも「2件選択」と出るので要素を特定して読む
const resultSummary = () => document.querySelector('.filter-result-summary').textContent;

// 絞り込みのドロップダウンを開いて、選択肢のチェックを切り替える
const toggleFilter = (fieldLabel, ...values) => {
  const groupName = `${fieldLabel}で絞り込む`;
  // 開いているボタンをもう一度押すと閉じてしまうので、閉じているときだけ押す
  if (!screen.queryByRole('group', { name: groupName })) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${fieldLabel}：`) }));
  }
  const options = screen.getByRole('group', { name: groupName });
  values.forEach(value => fireEvent.click(within(options).getByRole('checkbox', { name: value })));
};

test('絞り込むと該当する記録だけが残り、件数と合計が出る', async () => {
  signedIn();
  renderApp();
  await screen.findByText('スーパー');

  toggleFilter('カテゴリ', '食費');

  expect(screen.getByText('スーパー')).toBeInTheDocument();
  expect(screen.queryByText('ドラッグストア')).not.toBeInTheDocument();
  expect(resultSummary()).toContain('1件');
  expect(resultSummary()).toContain('1,200円');
});

test('同じ項目で2つ選ぶと、どちらも残る', async () => {
  signedIn();
  renderApp();
  await screen.findByText('スーパー');

  toggleFilter('カテゴリ', '食費');
  expect(screen.queryByText('ドラッグストア')).not.toBeInTheDocument();

  // 開いたまま2つ目を選ぶ
  toggleFilter('カテゴリ', '日用品');

  expect(screen.getByText('スーパー')).toBeInTheDocument();
  expect(screen.getByText('ドラッグストア')).toBeInTheDocument();
  expect(resultSummary()).toContain('2件');
  expect(resultSummary()).toContain('2,000円');
});

test('選び直して外すと、その条件だけ解除される', async () => {
  signedIn();
  renderApp();
  await screen.findByText('スーパー');

  toggleFilter('カテゴリ', '食費', '食費');

  expect(screen.getByText('スーパー')).toBeInTheDocument();
  expect(screen.getByText('ドラッグストア')).toBeInTheDocument();
});

test('別々の項目を選ぶと両方を満たすものだけが残る', async () => {
  signedIn();
  renderApp();
  await screen.findByText('スーパー');

  toggleFilter('カテゴリ', '食費');
  toggleFilter('利用者', 'パパ');

  // 食費はママの記録なので、両方を満たすものは無い
  expect(screen.queryByText('スーパー')).not.toBeInTheDocument();
  expect(screen.getByText('絞り込み条件に一致する記録がありません')).toBeInTheDocument();
});

test('絞り込みをリセットすると全件に戻る', async () => {
  signedIn();
  renderApp();
  await screen.findByText('スーパー');

  toggleFilter('カテゴリ', '食費');
  expect(screen.queryByText('ドラッグストア')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'リセット' }));
  expect(screen.getByText('ドラッグストア')).toBeInTheDocument();
});

test('タグの × で選択を1つずつ外せる', async () => {
  signedIn();
  renderApp();
  await screen.findByText('スーパー');

  toggleFilter('カテゴリ', '食費', '日用品');
  expect(resultSummary()).toContain('2件');

  fireEvent.click(screen.getByRole('button', { name: '日用品の絞り込みを外す' }));

  expect(screen.getByText('スーパー')).toBeInTheDocument();
  expect(screen.queryByText('ドラッグストア')).not.toBeInTheDocument();
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

test('期限切れのトークンではログインを復元しない', async () => {
  signedIn({ expiresAt: Date.now() - 1000 });
  renderApp();

  expect(
    await screen.findByRole('button', { name: 'Googleアカウントでログイン' })
  ).toBeInTheDocument();
  expect(sessionStorage.getItem('googleAuthToken')).toBeNull();
});

test('localStorage に残った古いトークンではログインを復元しない', async () => {
  // sessionStorage へ移す前のバージョンが保存したトークンを想定
  localStorage.setItem('googleAuthToken', JSON.stringify({ access_token: 'old-token' }));
  renderApp();

  expect(
    await screen.findByRole('button', { name: 'Googleアカウントでログイン' })
  ).toBeInTheDocument();
});

// 削除ボタンを押し、確認ダイアログの「削除する」まで進める
const requestDelete = async () => {
  fireEvent.click(screen.getAllByRole('button', { name: '削除' })[0]);
  fireEvent.click(await screen.findByRole('button', { name: '削除する' }));
};

test('シート側で行が変わっていたら削除せずに中断する', async () => {
  // 表示中の行が、シート上では別の記録に置き換わっている状態
  signedIn({ rowOverride: ['2026-01-01T00:00:00.000Z', day(5), '家賃', '現金', 'パパ', '90000', '別の記録'] });
  renderApp();
  await screen.findByText('スーパー');

  await requestDelete();

  expect(await screen.findByText(/操作を中止しました/)).toBeInTheDocument();
  expect(batchUpdate).not.toHaveBeenCalled();
});

test('行が変わっていなければ削除が実行される', async () => {
  signedIn();
  renderApp();
  await screen.findByText('スーパー');

  await requestDelete();

  await waitFor(() => expect(batchUpdate).toHaveBeenCalled());
  expect(await screen.findByText('削除しました')).toBeInTheDocument();
});

test('確認ダイアログでキャンセルすると削除されない', async () => {
  signedIn();
  renderApp();
  await screen.findByText('スーパー');

  fireEvent.click(screen.getAllByRole('button', { name: '削除' })[0]);
  fireEvent.click(await screen.findByRole('button', { name: 'キャンセル' }));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(batchUpdate).not.toHaveBeenCalled();
});

test('スマホ幅では履歴を表ではなくカードで並べる', async () => {
  // 768px 以下にいることにする（jsdom は matchMedia を持たないので生やす）
  vi.stubGlobal('matchMedia', query => ({
    matches: query.includes('max-width: 768px'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  signedIn();
  renderApp();

  await screen.findByText('スーパー');

  // 横スクロールの原因だった表が無く、当月の2件がカードとして並んでいる
  expect(screen.queryByRole('table')).not.toBeInTheDocument();

  // 並びは表と同じく日付の新しい順
  const cards = document.querySelectorAll('.record-card');
  expect(cards).toHaveLength(2);
  expect(cards[0].querySelector('.record-card-category').textContent).toBe('日用品');
  expect(cards[0].querySelector('.record-card-amount').textContent).toBe('800 円');
  expect(cards[1].querySelector('.record-card-category').textContent).toBe('食費');
  expect(cards[1].querySelector('.record-card-amount').textContent).toBe('1,200 円');
});

test('絞り込み中はグラフにその条件が反映されていることを示す', async () => {
  signedIn();
  renderApp();
  await screen.findByText('スーパー');

  toggleFilter('カテゴリ', '食費', '日用品');
  fireEvent.click(screen.getByRole('button', { name: 'グラフ' }));

  expect(screen.getByText(/絞り込み中（食費・日用品）/)).toBeInTheDocument();
});

// --- 毎月の固定費ページ ---

const FIXED_VALUES = [
  ['カテゴリ', '支払方法', '利用者', '金額', '内容'],
  ['家賃', '銀行引き落とし', '家族', '90000', '今月分の家賃・駐車場'],
  ['', '', '', '', ''],
  ['趣味・娯楽', 'Amazonカード', 'パパ', '980', '少年ジャンプ'],
];

const openFixedPage = async () => {
  await screen.findByText('スーパー');
  fireEvent.click(screen.getByRole('button', { name: '固定費' }));
};

test('固定費ページに fixed シートの項目と合計が出て、空行は飛ばされる', async () => {
  signedIn({ fixedValues: FIXED_VALUES });
  renderApp();
  await openFixedPage();

  expect(screen.getByText('今月分の家賃・駐車場')).toBeInTheDocument();
  expect(screen.getByText('少年ジャンプ')).toBeInTheDocument();
  expect(document.querySelectorAll('.fixed-list .record-card')).toHaveLength(2);
  expect(document.querySelector('.fixed-total').textContent).toContain('2件');
  expect(document.querySelector('.fixed-total').textContent).toContain('90,980円');
  // 設定ページなので月別の記録一覧は出さない
  expect(screen.queryByText('スーパー')).not.toBeInTheDocument();
});

test('fixed シートが無ければ作り方を案内する', async () => {
  signedIn();
  renderApp();
  await openFixedPage();

  expect(screen.getByText(/setupFixedSheet/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '再読み込み' })).toBeInTheDocument();
});

test('固定費を追加すると fixed シートに1行書き込まれる', async () => {
  signedIn({ fixedValues: FIXED_VALUES });
  renderApp();
  await openFixedPage();

  fireEvent.click(screen.getByRole('button', { name: '＋ 固定費を追加' }));
  fireEvent.change(screen.getByLabelText('内容'), { target: { value: 'Netflix' } });
  fireEvent.change(screen.getByLabelText('金額 (円)'), { target: { value: '1490' } });
  fireEvent.click(screen.getByRole('button', { name: '追加する' }));

  expect(await screen.findByText('固定費を追加しました')).toBeInTheDocument();
  expect(append).toHaveBeenCalledTimes(1);
  const request = append.mock.calls[0][0];
  expect(request.range).toBe('fixed!A1');
  // 既定は 食費・銀行引き落とし・家族
  expect(request.resource.values).toEqual([['食費', '銀行引き落とし', '家族', '1490', 'Netflix']]);
});

test('金額が空のままでは固定費を追加しない', async () => {
  signedIn({ fixedValues: FIXED_VALUES });
  renderApp();
  await openFixedPage();

  fireEvent.click(screen.getByRole('button', { name: '＋ 固定費を追加' }));
  fireEvent.change(screen.getByLabelText('内容'), { target: { value: 'Netflix' } });
  fireEvent.click(screen.getByRole('button', { name: '追加する' }));

  expect(await screen.findByText(/金額を1円以上/)).toBeInTheDocument();
  expect(append).not.toHaveBeenCalled();
});

test('固定費を編集すると、その行が書き換わる', async () => {
  signedIn({ fixedValues: FIXED_VALUES });
  renderApp();
  await openFixedPage();

  fireEvent.click(screen.getByRole('button', { name: '少年ジャンプを編集' }));
  fireEvent.change(screen.getByLabelText('金額 (円)'), { target: { value: '1080' } });
  fireEvent.click(screen.getByRole('button', { name: '保存する' }));

  expect(await screen.findByText('固定費を更新しました')).toBeInTheDocument();
  const request = update.mock.calls[0][0];
  // 見出し・家賃・空行の次なので4行目
  expect(request.range).toBe('fixed!A4:E4');
  expect(request.resource.values).toEqual([['趣味・娯楽', 'Amazonカード', 'パパ', '1080', '少年ジャンプ']]);
});

test('固定費を削除すると fixed シートの該当行が消える', async () => {
  signedIn({ fixedValues: FIXED_VALUES });
  renderApp();
  await openFixedPage();

  fireEvent.click(screen.getByRole('button', { name: '少年ジャンプを削除' }));
  fireEvent.click(await screen.findByRole('button', { name: '削除する' }));

  expect(await screen.findByText('固定費を削除しました')).toBeInTheDocument();
  const range = batchUpdate.mock.calls[0][0].resource.requests[0].deleteDimension.range;
  // data シート（42）ではなく fixed シート（7）の4行目
  expect(range).toEqual({ sheetId: 7, dimension: 'ROWS', startIndex: 3, endIndex: 4 });
});
