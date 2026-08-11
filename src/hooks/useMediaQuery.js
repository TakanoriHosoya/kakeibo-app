import { useCallback, useMemo, useSyncExternalStore } from 'react';

// スマホ表示に切り替える幅。App.css のメディアクエリと同じ値にすること。
export const MOBILE_QUERY = '(max-width: 768px)';

// メディアクエリに一致しているかを返す。画面回転やウィンドウ幅の変更にも追従する。
export function useMediaQuery(query) {
  const mql = useMemo(
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query) : null),
    [query]
  );

  const subscribe = useCallback((onChange) => {
    if (!mql) return () => {};
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [mql]);

  return useSyncExternalStore(subscribe, () => (mql ? mql.matches : false), () => false);
}

export function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY);
}
