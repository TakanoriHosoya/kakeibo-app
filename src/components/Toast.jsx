import { useEffect } from 'react';

// 画面下部に一定時間だけ出る通知。alert() と違って操作を止めない。
// エラーは読み終える前に消えないよう、成功通知より長く出す。
const DURATION_MS = { success: 2500, error: 6000 };

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onClose, DURATION_MS[toast.type] ?? DURATION_MS.success);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className={`toast toast--${toast.type}`} role="status" aria-live="polite">
      <span className="toast-icon" aria-hidden="true">{toast.type === 'error' ? '⚠️' : '✓'}</span>
      <span className="toast-message">{toast.message}</span>
      <button type="button" className="toast-close" onClick={onClose} aria-label="通知を閉じる">×</button>
    </div>
  );
}

export default Toast;
