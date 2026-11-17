import { useState } from 'react';
import { CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS, USER_OPTIONS, FIXED_SHEET_NAME } from '../constants';
import { parseFixedRow, sumFixedAmount, validateFixedExpense } from '../lib/fixedExpenses';

// 新規追加時の初期値。固定費は口座引き落としで家族の支出が多いので、それを既定にする
const pick = (options, preferred) => (options.includes(preferred) ? preferred : options[0]);
const emptyFixedExpense = () => ({
  description: '',
  amount: '',
  category: CATEGORY_OPTIONS[0],
  paymentMethod: pick(PAYMENT_METHOD_OPTIONS, '銀行引き落とし'),
  user: pick(USER_OPTIONS, '家族'),
});

const SELECT_FIELDS = [
  { key: 'category', label: 'カテゴリ', options: CATEGORY_OPTIONS },
  { key: 'paymentMethod', label: '支払方法', options: PAYMENT_METHOD_OPTIONS },
  { key: 'user', label: '利用者', options: USER_OPTIONS },
];

const formatAmount = (value) => `${Number(value || 0).toLocaleString()} 円`;

// 1件分の入力カード（追加・編集で共通）
function FixedExpenseEditor({ initialValues, submitLabel, onSubmit, onCancel, onNotify }) {
  const [values, setValues] = useState(initialValues);
  const [isSaving, setIsSaving] = useState(false);

  const change = (key, value) => setValues(prev => ({ ...prev, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    const error = validateFixedExpense(values);
    if (error) { onNotify(error, 'error'); return; }

    // 二度押しで同じ固定費が2件登録されると毎月二重に記録されてしまうので、保存中は押せなくする
    setIsSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="record-card record-card--editing fixed-editor">
      <label className="record-card-field">
        <span className="record-card-field-label">内容</span>
        <input type="text" value={values.description} placeholder="例: 家賃・駐車場" onChange={e => change('description', e.target.value)} />
      </label>
      <label className="record-card-field">
        <span className="record-card-field-label">金額 (円)</span>
        <input type="number" inputMode="numeric" pattern="[0-9]*" min="1" value={values.amount} placeholder="例: 90000" onChange={e => change('amount', e.target.value)} />
      </label>
      {SELECT_FIELDS.map(field => (
        <label key={field.key} className="record-card-field">
          <span className="record-card-field-label">{field.label}</span>
          <select value={values[field.key]} onChange={e => change(field.key, e.target.value)}>
            {/* スプレッドシート直編集などで選択肢に無い値が入っていても、勝手に別の値へ変わらないよう残す */}
            {!field.options.includes(values[field.key]) && (
              <option value={values[field.key]}>{values[field.key] || '（未設定）'}</option>
            )}
            {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </label>
      ))}
      <div className="fixed-editor-actions">
        <button type="button" className="fixed-button fixed-button--secondary" onClick={onCancel} disabled={isSaving}>キャンセル</button>
        <button type="submit" className="fixed-button fixed-button--primary" disabled={isSaving}>
          {isSaving ? '保存中…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function FixedExpenseCard({ item, onEdit, onDelete }) {
  const values = parseFixedRow(item.data);
  return (
    <div className="record-card">
      <div className="record-card-head">
        <span className="fixed-card-name">{values.description}</span>
        <span className="record-card-amount">{formatAmount(values.amount)}</span>
      </div>
      {/* 15件前後が並ぶので、操作ボタンは分類と同じ行に置いてカードを低く保つ */}
      <div className="fixed-card-foot">
        <div className="record-card-meta">
          <span className="record-card-category">{values.category}</span>
          <span className="record-card-sub">{values.user}</span>
          <span className="record-card-sub">{values.paymentMethod}</span>
        </div>
        <div className="fixed-card-actions">
        <button type="button" onClick={onEdit} className="action-button edit-button" aria-label={`${values.description}を編集`}>✏️</button>
        <button type="button" onClick={onDelete} className="action-button delete-button" aria-label={`${values.description}を削除`}>🗑️</button>
        </div>
      </div>
    </div>
  );
}

// 毎月の固定費の設定ページ。
// ここで管理する一覧（fixed シート）を、GAS が毎月1日に data シートへ記録する。
// onAdd / onUpdate は保存できたかを返す（true なら入力カードを閉じる）。
function FixedExpensesPage({ items, status, onAdd, onUpdate, onDelete, onReload, onNotify }) {
  // null: 一覧表示のみ / 'new': 追加中 / 数値: その行番号を編集中
  const [editing, setEditing] = useState(null);

  const closeEditor = () => setEditing(null);
  const submitNew = async (values) => { if (await onAdd(values)) closeEditor(); };
  const submitEdit = (item) => async (values) => { if (await onUpdate(item, values)) closeEditor(); };
  // 削除すると以降の行番号がずれ、開いている編集カードが別の項目を指してしまうので閉じておく
  const requestDelete = (item) => { closeEditor(); onDelete(item); };

  if (status === 'loading') {
    return <section className="fixed-section"><p className="records-empty">読み込み中...</p></section>;
  }

  if (status !== 'ready') {
    return (
      <section className="fixed-section">
        <h3>毎月の固定費</h3>
        {status === 'missing' ? (
          <p className="fixed-notice">
            スプレッドシートに「{FIXED_SHEET_NAME}」シートがまだありません。
            Apps Script で <code>setupFixedSheet</code> を一度実行してから、再読み込みしてください。
          </p>
        ) : (
          <p className="fixed-notice">固定費を読み込めませんでした。</p>
        )}
        <button type="button" className="fixed-button fixed-button--secondary" onClick={onReload}>再読み込み</button>
      </section>
    );
  }

  return (
    <section className="fixed-section">
      <div className="fixed-header">
        <h3>毎月の固定費</h3>
        <p className="fixed-total">
          {items.length}件 ／ <strong>{sumFixedAmount(items).toLocaleString()}円</strong>
        </p>
      </div>
      <p className="fixed-description">
        毎月1日に、ここにある項目が自動で記録されます。変更は次回の登録から反映されます。
      </p>

      {editing === 'new' ? (
        <FixedExpenseEditor
          initialValues={emptyFixedExpense()}
          submitLabel="追加する"
          onSubmit={submitNew}
          onCancel={closeEditor}
          onNotify={onNotify}
        />
      ) : (
        <button type="button" className="fixed-add-button" onClick={() => setEditing('new')}>＋ 固定費を追加</button>
      )}

      <div className="record-cards fixed-list">
        {items.map(item => (
          editing === item.rowNumber ? (
            <FixedExpenseEditor
              key={item.rowNumber}
              initialValues={parseFixedRow(item.data)}
              submitLabel="保存する"
              onSubmit={submitEdit(item)}
              onCancel={closeEditor}
              onNotify={onNotify}
            />
          ) : (
            <FixedExpenseCard
              key={item.rowNumber}
              item={item}
              onEdit={() => setEditing(item.rowNumber)}
              onDelete={() => requestDelete(item)}
            />
          )
        ))}
        {items.length === 0 && <p className="records-empty">固定費はまだ登録されていません</p>}
      </div>
    </section>
  );
}

export default FixedExpensesPage;
