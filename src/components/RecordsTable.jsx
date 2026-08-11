import { useState } from 'react';
import { CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS, USER_OPTIONS } from '../constants';
import { COL } from '../lib/records';
import { useIsMobile } from '../hooks/useMediaQuery';

// 編集フォームの項目。表の列順と同じ並びにしてある（表示・編集で同じ順序になるように）。
const EDIT_FIELDS = [
  { col: COL.DATE, label: '日付', type: 'date' },
  { col: COL.CATEGORY, label: 'カテゴリ', options: CATEGORY_OPTIONS },
  { col: COL.USER, label: '利用者', options: USER_OPTIONS },
  { col: COL.PAYMENT, label: '支払方法', options: PAYMENT_METHOD_OPTIONS },
  { col: COL.AMOUNT, label: '金額', type: 'number' },
  { col: COL.DESCRIPTION, label: '内容', type: 'text' },
];

// 1項目分の入力欄。表の中でもカードの中でも同じものを使う
function EditField({ field, value, onChange }) {
  if (field.options) {
    return (
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} aria-label={field.label}>
        {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }
  return (
    <input
      type={field.type}
      inputMode={field.type === 'number' ? 'numeric' : undefined}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      aria-label={field.label}
      className={field.type === 'number' ? 'amount-input' : undefined}
    />
  );
}

function RowActions({ onEdit, onDelete }) {
  return (
    <>
      <button type="button" onClick={onEdit} className="action-button edit-button" aria-label="編集">✏️</button>
      <button type="button" onClick={onDelete} className="action-button delete-button" aria-label="削除">🗑️</button>
    </>
  );
}

function EditActions({ onSave, onCancel }) {
  return (
    <>
      <button type="button" onClick={onSave} className="action-button save-button" aria-label="保存">✔️</button>
      <button type="button" onClick={onCancel} className="action-button cancel-button" aria-label="キャンセル">✖️</button>
    </>
  );
}

const formatDate = (value) => new Date(value).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
const formatAmount = (value) => `${Number(value || 0).toLocaleString()} 円`;

// 表示中の月の記録一覧。行の編集状態はこのコンポーネント内で完結する
// （このセクションはページを切り替えても表示され続けるため、状態が消えることはない）。
// スマホでは表だと7列が収まらず横スクロールが要るので、1件1カードで並べる。
function RecordsTable({ records, hasActiveFilters, onSave, onDelete }) {
  const isMobile = useIsMobile();
  const [editingRow, setEditingRow] = useState(null);
  const [editedRecord, setEditedRecord] = useState(null);

  const startEdit = (record) => {
    setEditingRow(record);
    const editableData = [...record.data];
    // date 入力欄が受け付ける YYYY-MM-DD 形式へ直す
    try {
      editableData[COL.DATE] = new Date(record.data[COL.DATE]).toLocaleDateString('sv-SE');
    } catch (e) { console.error(e); }
    setEditedRecord(editableData);
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditedRecord(null);
  };

  const changeField = (index, value) => {
    const next = [...editedRecord];
    next[index] = value;
    setEditedRecord(next);
  };

  const save = async () => {
    const saved = await onSave(editingRow, editedRecord);
    if (saved) cancelEdit();
  };

  const isEditing = (record) => editingRow && editingRow.rowNumber === record.rowNumber;

  const emptyMessage = hasActiveFilters
    ? '絞り込み条件に一致する記録がありません'
    : 'この月の記録はありません';

  if (isMobile) {
    return (
      <div className="record-cards">
        {records.map(record => (
          isEditing(record) ? (
            <div key={record.rowNumber} className="record-card record-card--editing">
              {EDIT_FIELDS.map(field => (
                <label key={field.col} className="record-card-field">
                  <span className="record-card-field-label">{field.label}</span>
                  <EditField field={field} value={editedRecord[field.col]} onChange={v => changeField(field.col, v)} />
                </label>
              ))}
              <div className="record-card-actions">
                <EditActions onSave={save} onCancel={cancelEdit} />
              </div>
            </div>
          ) : (
            <div key={record.rowNumber} className="record-card">
              <div className="record-card-head">
                <span className="record-card-date">{formatDate(record.data[COL.DATE])}</span>
                <span className="record-card-amount">{formatAmount(record.data[COL.AMOUNT])}</span>
              </div>
              <div className="record-card-meta">
                <span className="record-card-category">{record.data[COL.CATEGORY]}</span>
                <span className="record-card-sub">{record.data[COL.USER]}</span>
                <span className="record-card-sub">{record.data[COL.PAYMENT]}</span>
              </div>
              {record.data[COL.DESCRIPTION] && (
                <p className="record-card-description">{record.data[COL.DESCRIPTION]}</p>
              )}
              <div className="record-card-actions">
                <RowActions onEdit={() => startEdit(record)} onDelete={() => onDelete(record)} />
              </div>
            </div>
          )
        ))}
        {records.length === 0 && <p className="records-empty">{emptyMessage}</p>}
      </div>
    );
  }

  return (
    <div className="records-table">
      <table>
        <thead>
          <tr>
            <th>日付</th><th>カテゴリ</th><th>利用者</th><th>支払方法</th><th>金額</th><th>内容</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          {records.map(record => (
            isEditing(record) ? (
              <tr key={record.rowNumber} className="editing-row">
                {EDIT_FIELDS.map(field => (
                  <td key={field.col}>
                    <EditField field={field} value={editedRecord[field.col]} onChange={v => changeField(field.col, v)} />
                  </td>
                ))}
                <td><EditActions onSave={save} onCancel={cancelEdit} /></td>
              </tr>
            ) : (
              <tr key={record.rowNumber}>
                <td>{new Date(record.data[COL.DATE]).toLocaleDateString()}</td>
                <td>{record.data[COL.CATEGORY]}</td>
                <td>{record.data[COL.USER]}</td>
                <td>{record.data[COL.PAYMENT]}</td>
                <td>{formatAmount(record.data[COL.AMOUNT])}</td>
                <td>{record.data[COL.DESCRIPTION]}</td>
                <td><RowActions onEdit={() => startEdit(record)} onDelete={() => onDelete(record)} /></td>
              </tr>
            )
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan={7} className="records-empty">{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default RecordsTable;
