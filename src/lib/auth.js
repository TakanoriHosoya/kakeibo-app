// アクセストークンの保存と有効期限の管理。
//
// 保存先が sessionStorage なのは、TakanoriHosoya.github.io が全リポジトリで同一オリジンのため。
// localStorage はオリジン単位で共有されるので、同じアカウントで別プロジェクトを Pages 公開すると
// そのサイトの JS からこのトークンを読めてしまう。sessionStorage はタブ単位なので読まれない。
// 代わりにタブを閉じると再ログインが必要になる。

const STORAGE_KEY = 'googleAuthToken';

// 操作の途中で期限が切れないよう、この時間だけ手前で「切れた」と判断する
const EXPIRY_MARGIN_MS = 60 * 1000;

// トークンに有効期限を付けて保存する
export function saveToken(tokenResponse, now = Date.now()) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...tokenResponse,
    expiresAt: calcExpiresAt(tokenResponse, now),
  }));
}

// 保存済みトークンを返す。無い・壊れている・期限切れなら破棄して null を返す
export function loadToken(now = Date.now()) {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  let stored;
  try {
    stored = JSON.parse(raw);
  } catch {
    clearToken();
    return null;
  }

  if (!stored || !stored.access_token || isExpired(stored, now)) {
    clearToken();
    return null;
  }
  return stored;
}

export function clearToken() {
  sessionStorage.removeItem(STORAGE_KEY);
  // sessionStorage へ移す前のバージョンが残したトークンも消す
  localStorage.removeItem(STORAGE_KEY);
}

// 期限切れかどうか。expiresAt を持たないトークンは判定できないので、
// 従来どおり 401 が返るまで使わせる（ここで切ると再ログインできなくなる方が困る）。
export function isExpired(token, now = Date.now()) {
  if (!token || typeof token.expiresAt !== 'number') return false;
  return token.expiresAt - EXPIRY_MARGIN_MS <= now;
}

// expires_in（秒）から期限の時刻を求める。値が無ければ null（＝期限不明）
function calcExpiresAt(tokenResponse, now) {
  const expiresIn = Number(tokenResponse?.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) return null;
  return now + expiresIn * 1000;
}
