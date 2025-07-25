// src/App.js (全ての機能を統合した最終・完全版)

import React, { useState, useEffect } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import './App.css';

// --- 定数設定 ---
const SPREADSHEET_ID = '1ELmgy9DzOWgwMFYgxN567yLQPpM9-NFOFq6N4pRDJeA';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const CATEGORY_OPTIONS = ['食費', '日用品', '交通費', '趣味・娯楽', '交際費', '衣服・美容', '健康・医療', '住居・家具', '家賃', '水道・光熱費', '通信費', '保険', '習い事', '税金・社会保険', 'その他'];
const PAYMENT_METHOD_OPTIONS = ['楽天Pay', '現金', '楽天カード', 'PayPay', 'Amazonカード', 'セゾンカード', '京王パスポート', 'その他'];
const USER_OPTIONS = ['ママ', 'パパ', '家族'];

function App() {
  // --- State管理 ---
  const todayString = new Date().toLocaleDateString('sv-SE');
  const [date, setDate] = useState(todayString);
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [paymentMethod, setPaymentMethod] = useState('楽天Pay');
  const [user, setUser] = useState('ママ');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allRecords, setAllRecords] = useState([]);
  const [viewingDate, setViewingDate] = useState(new Date());
  const [editingRow, setEditingRow] = useState(null);
  const [editedRecord, setEditedRecord] = useState(null);

  const [page, setPage] = useState('Home'); // 'Home' or 'History'
  const [summary, setSummary] = useState({}); // カテゴリ別集計
  const [userSummary, setUserSummary] = useState({}); // 利用者別集計
  const [categoryUserSummary, setCategoryUserSummary] = useState({}); // カテゴリ×利用者集計


  // --- 関数定義 ---

  const handleApiError = (err) => {
    console.error("API Error:", err);
    if (err.status === 401) {
      alert('認証の有効期限が切れました。安全のため、再度ログインしてください。');
      handleLogout();
    } else {
      alert('処理中にエラーが発生しました。詳細はコンソールを確認してください。');
    }
  };
  
  const handleLogout = () => {
    googleLogout();
    localStorage.removeItem('googleAuthToken');
    setIsLoggedIn(false);
    setRecords([]);
    setAllRecords([]);
    setEditingRow(null);
    setEditedRecord(null);
  };

  const initializeGapiClient = async (token) => {
    await window.gapi.client.init({ discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'] });
    window.gapi.client.setToken(token);
    setIsLoggedIn(true);
    await loadRecords();
  };

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      localStorage.setItem('googleAuthToken', JSON.stringify(tokenResponse));
      initializeGapiClient(tokenResponse);
    },
    onError: (error) => { console.log('Login Failed:', error); alert('ログインに失敗しました。'); },
    scope: SCOPES,
  });

  const loadRecords = async () => {
    try {
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: 'data!A:G',
      });
      const headerRows = 1;
      const loadedRecords = (response.result.values || []).slice(headerRows).map((row, index) => ({
        data: row, rowNumber: index + headerRows + 1,
      }));
      setAllRecords(loadedRecords);
    } catch (err) { handleApiError(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount) { alert('金額を入力してください。'); return; }
    const newRecord = [ new Date().toISOString(), date, category, paymentMethod, user, amount, description ];
    try {
      await window.gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID, range: 'data!A1', valueInputOption: 'USER_ENTERED', resource: { values: [newRecord] },
      });
      alert('保存しました！');
      setAmount(''); setDescription('');
      await loadRecords();
    } catch (err) { handleApiError(err); }
  };

  const handleDelete = async (recordToDelete) => {
    if (!window.confirm(`【削除確認】\n日付: ${recordToDelete.data[1]}\n金額: ${recordToDelete.data[5]}円\n\nこのデータを本当に削除しますか？`)) return;
    try {
      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID, resource: { requests: [{ deleteDimension: { range: { sheetId: 0, dimension: 'ROWS', startIndex: recordToDelete.rowNumber - 1, endIndex: recordToDelete.rowNumber }}}] },
      });
      alert('削除しました。');
      await loadRecords();
    } catch (error) { handleApiError(error); }
  };
  
  const handleSave = async () => {
    try {
      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: `data!A${editingRow.rowNumber}:G${editingRow.rowNumber}`, valueInputOption: 'USER_ENTERED', resource: { values: [editedRecord] },
      });
      alert('更新しました。');
      setEditingRow(null); setEditedRecord(null);
      await loadRecords();
    } catch (error) { handleApiError(error); }
  };
  
  const handleEdit = (record) => {
    setEditingRow(record);
    const editableData = [...record.data];
    try { editableData[1] = new Date(record.data[1]).toLocaleDateString('sv-SE'); } catch (e) { console.error(e); }
    setEditedRecord(editableData);
  };
  const handleEditChange = (e, index) => { const newEditedRecord = [...editedRecord]; newEditedRecord[index] = e.target.value; setEditedRecord(newEditedRecord); };
  const handleCancel = () => { setEditingRow(null); setEditedRecord(null); };
  const handlePrevMonth = () => { const newDate = new Date(viewingDate); newDate.setMonth(newDate.getMonth() - 1); setViewingDate(newDate); };
  const handleNextMonth = () => { const newDate = new Date(viewingDate); newDate.setMonth(newDate.getMonth() + 1); setViewingDate(newDate); };
  const isNextMonthDisabled = () => { const today = new Date(); return viewingDate.getFullYear() > today.getFullYear() || (viewingDate.getFullYear() === today.getFullYear() && viewingDate.getMonth() >= today.getMonth()); };

  // --- Effectフック ---
  useEffect(() => {
    const loadGapiAndRestoreLogin = async () => {
      try {
        await new Promise((resolve, reject) => window.gapi.load('client', { callback: resolve, onerror: reject }));
        const storedToken = localStorage.getItem('googleAuthToken');
        if (storedToken) {
          await initializeGapiClient(JSON.parse(storedToken));
        }
      } catch (error) { console.error("アプリの初期化に失敗しました:", error); } finally { setIsLoading(false); }
    };
    loadGapiAndRestoreLogin();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const targetYear = viewingDate.getFullYear(); const targetMonth = viewingDate.getMonth();
    
    // 表示用レコードのフィルタリング
    const filteredRecords = allRecords.filter(record => {
      if (!record || !record.data[1]) return false;
      const recordDate = new Date(record.data[1]);
      if (isNaN(recordDate.getTime())) return false;
      return recordDate.getFullYear() === targetYear && recordDate.getMonth() === targetMonth;
    });

    // ▼▼▼ 日付で新しい順（降順）にソート ▼▼▼
    filteredRecords.sort((a, b) => {
      const dateA = new Date(a.data[1]);
      const dateB = new Date(b.data[1]);
      return dateB - dateA;
    });

    setRecords(filteredRecords);

    const categoryTotals = {};
    const userTotals = {};
    const categoryUserTotals = {};
    filteredRecords.forEach(record => {
      const category = record.data[2];
      const user = record.data[4];
      const amount = Number(record.data[5] || 0);

      // カテゴリ集計
      if (category in categoryTotals) {
        categoryTotals[category] += amount;
      } else {
        categoryTotals[category] = amount;
      }

      // 利用者集計
      if (user in userTotals) {
        userTotals[user] += amount;
      } else {
        userTotals[user] = amount;
      }

      // カテゴリ×利用者集計
      if (!categoryUserTotals[category]) categoryUserTotals[category] = {};
      if (!categoryUserTotals[category][user]) categoryUserTotals[category][user] = 0;
      categoryUserTotals[category][user] += amount;
    });
    setSummary(categoryTotals);
    setUserSummary(userTotals);
    setCategoryUserSummary(categoryUserTotals);

  }, [allRecords, viewingDate, isLoggedIn]);

  // --- JSX (画面描画) ---
  return (
    <div className="container">
      <header><h1>細矢さん 家計簿</h1>{isLoggedIn && (<button onClick={handleLogout} className="logout-button">ログアウト</button>)}</header>
      
      {isLoading ? (
        <div className="loading-container"><p>読み込み中...</p></div>
      ) : !isLoggedIn ? (
        <div className="login-container"><button onClick={() => login()} className="login-button">Googleアカウントでログイン</button></div>
      ) : (
        <>
          <nav className="main-nav">
            <button onClick={() => setPage('Home')} className={page === 'Home' ? 'active' : ''}>Home</button>
            <button onClick={() => setPage('History')} className={page === 'History' ? 'active' : ''}>履歴</button>
          </nav>
          
          <main>
            {page === 'Home' && (
              <form onSubmit={handleSubmit} className="entry-form">
                <h3>データ入力</h3>
                <div className="form-group"><label htmlFor="date">日付</label><input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
                <div className="form-group"><label htmlFor="category">支出カテゴリ</label><select id="category" value={category} onChange={e => setCategory(e.target.value)}>{CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                <div className="form-group"><label htmlFor="paymentMethod">支払方法</label><select id="paymentMethod" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>{PAYMENT_METHOD_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                <div className="form-group"><label htmlFor="user">利用者</label><select id="user" value={user} onChange={e => setUser(e.target.value)}>{USER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                <div className="form-group"><label htmlFor="amount">金額 (円)</label><input type="number" inputMode="numeric" pattern="[0-9]*" id="amount" placeholder="例: 1500" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
                <div className="form-group"><label htmlFor="description">内容 (任意)</label><input type="text" id="description" placeholder="例: スーパー〇〇での買い物" value={description} onChange={e => setDescription(e.target.value)} /></div>
                <button type="submit">この内容で保存する</button>
              </form>
            )}

            {page === 'History' && (
              <section className="summary-section">
                <h3>カテゴリ別集計</h3>
                <div className="summary-table">
                  <table>
                    <thead>
                      <tr>
                        <th>カテゴリ</th>
                        <th>合計金額</th>
                        {/* ▼▼▼ 利用者ごとにヘッダーを表示 ▼▼▼ */}
                        {USER_OPTIONS.map(user => (
                          <th key={user}>{user}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* ▼▼▼ カテゴリの並び順をCATEGORY_OPTIONS通りに修正 ▼▼▼ */}
                      {CATEGORY_OPTIONS.map(category => (
                        summary[category] !== undefined ? (
                          <tr key={category}>
                            <td>{category}</td>
                            <td>{summary[category].toLocaleString()} 円</td>
                            {/* ▼▼▼ 各利用者の金額を表示 ▼▼▼ */}
                            {USER_OPTIONS.map(user => (
                              <td key={user}>
                                {categoryUserSummary[category] && categoryUserSummary[category][user]
                                  ? categoryUserSummary[category][user].toLocaleString()
                                  : 0
                                } 円
                              </td>
                            ))}
                          </tr>
                        ) : null
                      ))}
                      <tr className="summary-total">
                        <td><strong>総合計</strong></td>
                        <td>
                          <strong>
                            {Object.values(summary).reduce((acc, cur) => acc + cur, 0).toLocaleString()} 円
                          </strong>
                        </td>
                        {/* ▼▼▼ 利用者ごとの総合計 ▼▼▼ */}
                        {USER_OPTIONS.map(user => (
                          <td key={user}>
                            <strong>
                              {userSummary[user] ? userSummary[user].toLocaleString() : 0} 円
                            </strong>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="records-section">
              <div className="month-navigator">
                <button onClick={handlePrevMonth}>&lt; 先月</button>
                <h3>{viewingDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })} の記録</h3>
                <button onClick={handleNextMonth} disabled={isNextMonthDisabled()}>翌月 &gt;</button>
              </div>
              <div className="records-table">
                  <table>
                    {/* ▼▼▼ テーブルヘッダーに「利用者」を追加 ▼▼▼ */}
                    <thead><tr><th>日付</th><th>カテゴリ</th><th>利用者</th><th>支払方法</th><th>金額</th><th>内容</th><th>操作</th></tr></thead>
                    <tbody>
                      {records.map((record) => (
                        editingRow && editingRow.rowNumber === record.rowNumber ? (
                          <tr key={record.rowNumber} className="editing-row">
                            <td><input type="date" value={editedRecord[1]} onChange={(e) => handleEditChange(e, 1)} /></td>
                            <td><select value={editedRecord[2]} onChange={(e) => handleEditChange(e, 2)}>{CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></td>
                            {/* ▼▼▼ 編集中フォームに「利用者」を追加 ▼▼▼ */}
                            <td><select value={editedRecord[4]} onChange={(e) => handleEditChange(e, 4)}>{USER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></td>
                            <td><select value={editedRecord[3]} onChange={(e) => handleEditChange(e, 3)}>{PAYMENT_METHOD_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></td>
                            <td><input type="number" value={editedRecord[5]} onChange={(e) => handleEditChange(e, 5)} className="amount-input" /></td>
                            <td><input type="text" value={editedRecord[6]} onChange={(e) => handleEditChange(e, 6)} /></td>
                            <td><button onClick={handleSave} className="action-button save-button">✔️</button><button onClick={handleCancel} className="action-button cancel-button">✖️</button></td>
                          </tr>
                        ) : (
                          <tr key={record.rowNumber}>
                            <td>{new Date(record.data[1]).toLocaleDateString()}</td>
                            <td>{record.data[2]}</td>
                            {/* ▼▼▼ 表示に「利用者」を追加 ▼▼▼ */}
                            <td>{record.data[4]}</td>
                            <td>{record.data[3]}</td>
                            <td>{Number(record.data[5] || 0).toLocaleString()} 円</td>
                            <td>{record.data[6]}</td>
                            <td><button onClick={() => handleEdit(record)} className="action-button edit-button">✏️</button><button onClick={() => handleDelete(record)} className="action-button delete-button">🗑️</button></td>
                          </tr>
                        )
                      ))}
                    </tbody>
                  </table>
                </div>
            </section>
          </main>
        </>
      )}
    </div>
  );
}

export default App;
