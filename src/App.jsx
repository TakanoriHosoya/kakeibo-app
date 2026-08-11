import React, { useState, useEffect, useRef } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  SPREADSHEET_ID,
  SHEET_NAME,
  SCOPES,
  CATEGORY_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  USER_OPTIONS,
} from './constants';
import {
  FILTER_ALL,
  filterRecordsByMonth,
  summarizeRecords,
  generateGraphData,
  applyFilters,
  sumAmount,
  countActiveFilters,
} from './lib/records';
import './App.css';

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

  const [page, setPage] = useState('Home');

  // ★ フィルター state（3種類）
  const [filterCategory, setFilterCategory] = useState(FILTER_ALL);
  const [filterUser, setFilterUser] = useState(FILTER_ALL);
  const [filterPayment, setFilterPayment] = useState(FILTER_ALL);

  const [summary, setSummary] = useState({});
  const [userSummary, setUserSummary] = useState({});
  const [categoryUserSummary, setCategoryUserSummary] = useState({});
  const [graphData, setGraphData] = useState([]);
  const [visibleCategories, setVisibleCategories] = useState(new Set(CATEGORY_OPTIONS));

  // 'data' シートの内部 ID。シート名から引いて保持する（0 も有効な値なので null で未取得を表す）
  const dataSheetIdRef = useRef(null);


  // --- 関数定義 ---

  const handleApiError = (err) => {
    console.error("API Error:", err);
    if (err.status === 401) {
      alert('認証の有効期限が切れました。安全のため、再度ログインしてください。');
      handleLogout();
    } else if (err instanceof Error) {
      alert(`処理中にエラーが発生しました。\n${err.message}`);
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

  // シート名から実際の sheetId を取得する（初回のみ問い合わせ、以降はキャッシュ）
  const getDataSheetId = async () => {
    if (dataSheetIdRef.current !== null) return dataSheetIdRef.current;
    const response = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID, fields: 'sheets.properties(sheetId,title)',
    });
    const dataSheet = (response.result.sheets || []).find(s => s.properties.title === SHEET_NAME);
    if (!dataSheet) throw new Error(`シート「${SHEET_NAME}」が見つかりませんでした。`);
    dataSheetIdRef.current = dataSheet.properties.sheetId;
    return dataSheetIdRef.current;
  };

  const loadRecords = async () => {
    try {
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A:G`,
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
        spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [newRecord] },
      });
      alert('保存しました！');
      setAmount(''); setDescription('');
      await loadRecords();
    } catch (err) { handleApiError(err); }
  };

  const handleDelete = async (recordToDelete) => {
    if (!window.confirm(`【削除確認】\n日付: ${recordToDelete.data[1]}\n金額: ${recordToDelete.data[5]}円\n\nこのデータを本当に削除しますか？`)) return;
    try {
      const sheetId = await getDataSheetId();
      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID, resource: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: recordToDelete.rowNumber - 1, endIndex: recordToDelete.rowNumber }}}] },
      });
      alert('削除しました。');
      await loadRecords();
    } catch (error) { handleApiError(error); }
  };
  
  const handleSave = async () => {
    try {
      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A${editingRow.rowNumber}:G${editingRow.rowNumber}`, valueInputOption: 'USER_ENTERED', resource: { values: [editedRecord] },
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

  // フィルターをすべてリセット
  const resetFilters = () => {
    setFilterCategory(FILTER_ALL);
    setFilterUser(FILTER_ALL);
    setFilterPayment(FILTER_ALL);
  };

  // アクティブなフィルター数（リセットリンクの表示判定用）
  const activeFilterCount = countActiveFilters({
    category: filterCategory, user: filterUser, payment: filterPayment,
  });

  const toggleCategory = (cat) => {
    const next = new Set(visibleCategories);
    if (next.has(cat)) {
      next.clear();
      next.add(cat);
    } else {
      CATEGORY_OPTIONS.forEach(c => next.add(c));
    }
    setVisibleCategories(next);
  };

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

    const monthRecords = filterRecordsByMonth(allRecords, viewingDate);
    setRecords(monthRecords);

    const { categoryTotals, userTotals, categoryUserTotals } = summarizeRecords(monthRecords);
    setSummary(categoryTotals);
    setUserSummary(userTotals);
    setCategoryUserSummary(categoryUserTotals);
    setGraphData(generateGraphData(allRecords, CATEGORY_OPTIONS));
  }, [allRecords, viewingDate, isLoggedIn]);

  // ★ 3つのフィルターを組み合わせて絞り込み
  const filteredRecords = applyFilters(records, {
    category: filterCategory, user: filterUser, payment: filterPayment,
  });

  const filteredTotal = sumAmount(filteredRecords);

  // --- JSX (画面描画) ---
  return (
    <div className="container">
      <header>
        <h1>細矢さん 家計簿</h1>
        {isLoggedIn && (<button onClick={handleLogout} className="logout-button">ログアウト</button>)}
      </header>
      
      {isLoading ? (
        <div className="loading-container"><p>読み込み中...</p></div>
      ) : !isLoggedIn ? (
        <div className="login-container"><button onClick={() => login()} className="login-button">Googleアカウントでログイン</button></div>
      ) : (
        <>
          <nav className="main-nav">
            <button onClick={() => setPage('Home')} className={page === 'Home' ? 'active' : ''}>Home</button>
            <button onClick={() => setPage('History')} className={page === 'History' ? 'active' : ''}>履歴</button>
            <button onClick={() => setPage('Graph')} className={page === 'Graph' ? 'active' : ''}>グラフ</button>
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
                        {USER_OPTIONS.map(u => <th key={u}>{u}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {CATEGORY_OPTIONS.map(cat => (
                        summary[cat] !== undefined ? (
                          <tr key={cat}>
                            <td>{cat}</td>
                            <td>{summary[cat].toLocaleString()} 円</td>
                            {USER_OPTIONS.map(u => (
                              <td key={u}>
                                {categoryUserSummary[cat] && categoryUserSummary[cat][u]
                                  ? categoryUserSummary[cat][u].toLocaleString() : 0} 円
                              </td>
                            ))}
                          </tr>
                        ) : null
                      ))}
                      <tr className="summary-total">
                        <td><strong>総合計</strong></td>
                        <td><strong>{Object.values(summary).reduce((acc, cur) => acc + cur, 0).toLocaleString()} 円</strong></td>
                        {USER_OPTIONS.map(u => (
                          <td key={u}><strong>{userSummary[u] ? userSummary[u].toLocaleString() : 0} 円</strong></td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {page === 'Graph' && (
              <section className="graph-section">
                <h3>月別支出合計グラフ</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={graphData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#8884d8" name="月別合計" />
                  </LineChart>
                </ResponsiveContainer>

                <h3>カテゴリ別支出合計グラフ</h3>
                <div className="category-toggles">
                  {CATEGORY_OPTIONS.map(cat => (
                    <button
                      key={cat}
                      className={`category-toggle ${visibleCategories.has(cat) ? 'active' : 'inactive'}`}
                      onClick={() => toggleCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={graphData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {CATEGORY_OPTIONS.map((cat, index) => (
                      visibleCategories.has(cat) && (
                        <Line key={cat} type="monotone" dataKey={cat} stroke={`hsl(${(index * 25) % 360}, 70%, 50%)`} name={cat} />
                      )
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </section>
            )}

            {/* 月別リスト（全ページ共通） */}
            <section className="records-section">
              <div className="month-navigator">
                <button onClick={handlePrevMonth}>&lt; 先月</button>
                <h3>{viewingDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })} の記録</h3>
                <button onClick={handleNextMonth} disabled={isNextMonthDisabled()}>翌月 &gt;</button>
              </div>

              {/* ★ フィルターパネル */}
              <div className="filter-panel">
                <div className="filter-panel-header">
                  <span className="filter-panel-title">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{flexShrink:0, marginRight:5, verticalAlign:'middle'}}>
                      <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    絞り込み
                  </span>
                  {activeFilterCount > 0 && (
                    <button className="filter-reset-btn" onClick={resetFilters}>リセット</button>
                  )}
                </div>

                <div className="filter-selects">
                  <div className="filter-select-wrap">
                    <select
                      className={`filter-select ${filterCategory !== FILTER_ALL ? 'filter-select--active' : ''}`}
                      value={filterCategory}
                      onChange={e => setFilterCategory(e.target.value)}
                    >
                      <option value={FILTER_ALL}>カテゴリ：すべて</option>
                      {CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    <svg className="filter-select-arrow" width="10" height="10" viewBox="0 0 10 10">
                      <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  <div className="filter-select-wrap">
                    <select
                      className={`filter-select ${filterUser !== FILTER_ALL ? 'filter-select--active' : ''}`}
                      value={filterUser}
                      onChange={e => setFilterUser(e.target.value)}
                    >
                      <option value={FILTER_ALL}>利用者：すべて</option>
                      {USER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    <svg className="filter-select-arrow" width="10" height="10" viewBox="0 0 10 10">
                      <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  <div className="filter-select-wrap">
                    <select
                      className={`filter-select ${filterPayment !== FILTER_ALL ? 'filter-select--active' : ''}`}
                      value={filterPayment}
                      onChange={e => setFilterPayment(e.target.value)}
                    >
                      <option value={FILTER_ALL}>支払方法：すべて</option>
                      {PAYMENT_METHOD_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    <svg className="filter-select-arrow" width="10" height="10" viewBox="0 0 10 10">
                      <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {/* アクティブフィルタータグ＋件数合計 */}
                {activeFilterCount > 0 && (
                  <div className="filter-status">
                    <div className="filter-tags">
                      {filterCategory !== FILTER_ALL && (
                        <span className="filter-tag">
                          {filterCategory}
                          <button className="filter-tag-remove" onClick={() => setFilterCategory(FILTER_ALL)}>×</button>
                        </span>
                      )}
                      {filterUser !== FILTER_ALL && (
                        <span className="filter-tag">
                          {filterUser}
                          <button className="filter-tag-remove" onClick={() => setFilterUser(FILTER_ALL)}>×</button>
                        </span>
                      )}
                      {filterPayment !== FILTER_ALL && (
                        <span className="filter-tag">
                          {filterPayment}
                          <button className="filter-tag-remove" onClick={() => setFilterPayment(FILTER_ALL)}>×</button>
                        </span>
                      )}
                    </div>
                    <div className="filter-result-summary">
                      {filteredRecords.length}件 ／ <span className="filter-result-total">{filteredTotal.toLocaleString()}円</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="records-table">
                <table>
                  <thead>
                    <tr>
                      <th>日付</th><th>カテゴリ</th><th>利用者</th><th>支払方法</th><th>金額</th><th>内容</th><th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record) => (
                      editingRow && editingRow.rowNumber === record.rowNumber ? (
                        <tr key={record.rowNumber} className="editing-row">
                          <td><input type="date" value={editedRecord[1]} onChange={(e) => handleEditChange(e, 1)} /></td>
                          <td><select value={editedRecord[2]} onChange={(e) => handleEditChange(e, 2)}>{CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></td>
                          <td><select value={editedRecord[4]} onChange={(e) => handleEditChange(e, 4)}>{USER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></td>
                          <td><select value={editedRecord[3]} onChange={(e) => handleEditChange(e, 3)}>{PAYMENT_METHOD_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></td>
                          <td><input type="number" value={editedRecord[5]} onChange={(e) => handleEditChange(e, 5)} className="amount-input" /></td>
                          <td><input type="text" value={editedRecord[6]} onChange={(e) => handleEditChange(e, 6)} /></td>
                          <td>
                            <button onClick={handleSave} className="action-button save-button">✔️</button>
                            <button onClick={handleCancel} className="action-button cancel-button">✖️</button>
                          </td>
                        </tr>
                      ) : (
                        <tr key={record.rowNumber}>
                          <td>{new Date(record.data[1]).toLocaleDateString()}</td>
                          <td>{record.data[2]}</td>
                          <td>{record.data[4]}</td>
                          <td>{record.data[3]}</td>
                          <td>{Number(record.data[5] || 0).toLocaleString()} 円</td>
                          <td>{record.data[6]}</td>
                          <td>
                            <button onClick={() => handleEdit(record)} className="action-button edit-button">✏️</button>
                            <button onClick={() => handleDelete(record)} className="action-button delete-button">🗑️</button>
                          </td>
                        </tr>
                      )
                    ))}
                    {filteredRecords.length === 0 && (
                      <tr>
                        <td colSpan={7} className="records-empty">
                          {activeFilterCount > 0 ? '絞り込み条件に一致する記録がありません' : 'この月の記録はありません'}
                        </td>
                      </tr>
                    )}
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
