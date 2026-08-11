import { saveToken, loadToken, clearToken, isExpired } from './auth';

const HOUR_MS = 60 * 60 * 1000;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('saveToken / loadToken', () => {
  test('expires_in から期限を付けて保存し、そのまま読み戻せる', () => {
    const now = Date.now();
    saveToken({ access_token: 'abc', expires_in: 3599 }, now);

    const token = loadToken(now);
    expect(token.access_token).toBe('abc');
    expect(token.expiresAt).toBe(now + 3599 * 1000);
  });

  test('localStorage ではなく sessionStorage に保存する', () => {
    saveToken({ access_token: 'abc', expires_in: 3599 });

    expect(sessionStorage.getItem('googleAuthToken')).toContain('abc');
    expect(localStorage.getItem('googleAuthToken')).toBeNull();
  });

  test('期限を過ぎていれば null を返し、保存済みの値も破棄する', () => {
    const now = Date.now();
    saveToken({ access_token: 'abc', expires_in: 3599 }, now);

    expect(loadToken(now + 2 * HOUR_MS)).toBeNull();
    expect(sessionStorage.getItem('googleAuthToken')).toBeNull();
  });

  test('期限の1分前を切ったら、まだ残っていても期限切れとして扱う', () => {
    const now = Date.now();
    saveToken({ access_token: 'abc', expires_in: 3599 }, now);

    // 残り 90 秒ならまだ使える
    expect(loadToken(now + 3599 * 1000 - 90 * 1000)).not.toBeNull();
    // 残り 30 秒なら操作の途中で切れうるので使わせない
    expect(loadToken(now + 3599 * 1000 - 30 * 1000)).toBeNull();
  });

  test('expires_in が無いトークンは期限不明として使い続ける（401 が返るまで）', () => {
    const now = Date.now();
    saveToken({ access_token: 'abc' }, now);

    expect(loadToken(now + 10 * HOUR_MS).access_token).toBe('abc');
  });

  test('保存が無い・壊れている場合は null', () => {
    expect(loadToken()).toBeNull();

    sessionStorage.setItem('googleAuthToken', '{壊れたJSON');
    expect(loadToken()).toBeNull();
    expect(sessionStorage.getItem('googleAuthToken')).toBeNull();
  });

  test('access_token が入っていなければ null', () => {
    sessionStorage.setItem('googleAuthToken', JSON.stringify({ expiresAt: Date.now() + HOUR_MS }));
    expect(loadToken()).toBeNull();
  });
});

test('clearToken は旧バージョンが localStorage に残したトークンも消す', () => {
  localStorage.setItem('googleAuthToken', JSON.stringify({ access_token: 'old' }));
  saveToken({ access_token: 'abc', expires_in: 3599 });

  clearToken();

  expect(sessionStorage.getItem('googleAuthToken')).toBeNull();
  expect(localStorage.getItem('googleAuthToken')).toBeNull();
});

describe('isExpired', () => {
  test('expiresAt を持たないトークンは期限切れ扱いにしない', () => {
    expect(isExpired({ access_token: 'abc' })).toBe(false);
    expect(isExpired({ access_token: 'abc', expiresAt: null })).toBe(false);
  });

  test('トークンが無ければ期限切れ扱いにしない（未ログインとして扱うのは呼び出し側）', () => {
    expect(isExpired(null)).toBe(false);
  });
});
