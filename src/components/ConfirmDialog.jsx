import { useEffect, useRef } from 'react';

// 画面内の確認ダイアログ。window.confirm の置き換え。
// 開いている間は背面をスクロールさせない（スマホで背景が動くと誤操作しやすいため）。
function ConfirmDialog({ open, title, description, confirmLabel = 'OK', onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    // 開いた直後は「キャンセル」に合わせる。誤って確定させないため
    cancelRef.current?.focus();
    document.body.classList.add('dialog-open');

    const handleKeyDown = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('dialog-open');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={e => e.stopPropagation()}
      >
        <h4 className="dialog-title" id="confirm-dialog-title">{title}</h4>
        {description && <p className="dialog-description">{description}</p>}
        <div className="dialog-actions">
          <button type="button" className="dialog-button dialog-button--cancel" ref={cancelRef} onClick={onCancel}>
            キャンセル
          </button>
          <button type="button" className="dialog-button dialog-button--confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
