import { useState } from 'react';
import { CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS, USER_OPTIONS } from '../constants';
import { COL } from '../lib/records';

// 表示中の月の記録一覧。行の編集状態はこのコンポーネント内で完結する
// （このセクションはページを切り替えても表示され続けるため、状態が消えることはない）。
function RecordsTable({ records, hasActiveFilters, onSave, onDelete }) {
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
    const saved = await onSave(editingRow.rowNumber, editedRecord);
    if (saved) cancelEdit();
  };

  return (
    <div className="records-table">
      <table>
        <thead>
          <tr>
            <th>日付</th><th>カテゴリ</th><th>利用者</th><th>支払方法</th><th>金額</th><th>内容</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            editingRow && editingRow.rowNumber === record.rowNumber ? (
              <tr key={record.rowNumber} className="editing-row">
                <td><input type="date" value={editedRecord[COL.DATE]} onChange={e => changeField(COL.DATE, e.target.value)} /></td>
                <td>
                  <select value={editedRecord[COL.CATEGORY]} onChange={e => changeField(COL.CATEGORY, e.target.value)}>
                    {CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </td>
                <td>
                  <select value={editedRecord[COL.USER]} onChange={e => changeField(COL.USER, e.target.value)}>
                    {USER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </td>
                <td>
                  <select value={editedRecord[COL.PAYMENT]} onChange={e => changeField(COL.PAYMENT, e.target.value)}>
                    {PAYMENT_METHOD_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </td>
                <td><input type="number" value={editedRecord[COL.AMOUNT]} onChange={e => changeField(COL.AMOUNT, e.target.value)} className="amount-input" /></td>
                <td><input type="text" value={editedRecord[COL.DESCRIPTION]} onChange={e => changeField(COL.DESCRIPTION, e.target.value)} /></td>
                <td>
                  <button onClick={save} className="action-button save-button">✔️</button>
                  <button onClick={cancelEdit} className="action-button cancel-button">✖️</button>
                </td>
              </tr>
            ) : (
              <tr key={record.rowNumber}>
                <td>{new Date(record.data[COL.DATE]).toLocaleDateString()}</td>
                <td>{record.data[COL.CATEGORY]}</td>
                <td>{record.data[COL.USER]}</td>
                <td>{record.data[COL.PAYMENT]}</td>
                <td>{Number(record.data[COL.AMOUNT] || 0).toLocaleString()} 円</td>
                <td>{record.data[COL.DESCRIPTION]}</td>
                <td>
                  <button onClick={() => startEdit(record)} className="action-button edit-button">✏️</button>
                  <button onClick={() => onDelete(record)} className="action-button delete-button">🗑️</button>
                </td>
              </tr>
            )
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan={7} className="records-empty">
                {hasActiveFilters ? '絞り込み条件に一致する記録がありません' : 'この月の記録はありません'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default RecordsTable;
