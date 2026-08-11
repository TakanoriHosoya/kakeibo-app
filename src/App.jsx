import { useState, useEffect, useMemo } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS, USER_OPTIONS, SCOPES } from './constants';
import {
  COL,
  FILTER_ALL,
  buildRecordRow,
  filterRecordsByMonth,
  summarizeRecords,
  generateGraphData,
  applyFilters,
  sumAmount,
  countActiveFilters,
} from './lib/records';
import { loadGapi, initClient, fetchRecords, appendRecord, updateRecord, deleteRecord } from './lib/sheets';
import EntryForm from './components/EntryForm';
import SummaryTable from './components/SummaryTable';
import GraphSection from './components/GraphSection';
import MonthNavigator from './components/MonthNavigator';
import FilterPanel from './components/FilterPanel';
import RecordsTable from './components/RecordsTable';
import './App.css';

const NO_FILTERS = { category: FILTER_ALL, user: FILTER_ALL, payment: FILTER_ALL };

const emptyForm = () => ({
  date: new Date().toLocaleDateString('sv-SE'),
  category: CATEGORY_OPTIONS[0],
  paymentMethod: PAYMENT_METHOD_OPTIONS[0],
  user: USER_OPTIONS[0],
  amount: '',
  description: '',
});

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [allRecords, setAllRecords] = useState([]);
  const [viewingDate, setViewingDate] = useState(new Date());
  const [page, setPage] = useState('Home');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [formValues, setFormValues] = useState(emptyForm);
  const [visibleCategories, setVisibleCategories] = useState(new Set(CATEGORY_OPTIONS));

  // --- 表示用の派生データ ---
  const monthRecords = useMemo(() => filterRecordsByMonth(allRecords, viewingDate), [allRecords, viewingDate]);
  const summaries = useMemo(() => summarizeRecords(monthRecords), [monthRecords]);
  const graphData = useMemo(() => generateGraphData(allRecords, CATEGORY_OPTIONS), [allRecords]);
  const filteredRecords = useMemo(() => applyFilters(monthRecords, filters), [monthRecords, filters]);
  const filteredTotal = sumAmount(filteredRecords);
  const activeFilterCount = countActiveFilters(filters);

  // --- 認証 ---

  const handleApiError = (err) => {
    console.error('API Error:', err);
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
    setAllRecords([]);
  };

  const signIn = async (token) => {
    await initClient(token);
    setIsLoggedIn(true);
    await reloadRecords();
  };

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      localStorage.setItem('googleAuthToken', JSON.stringify(tokenResponse));
      signIn(tokenResponse);
    },
    onError: (error) => { console.log('Login Failed:', error); alert('ログインに失敗しました。'); },
    scope: SCOPES,
  });

  // --- スプレッドシートの操作 ---

  const reloadRecords = async () => {
    try {
      setAllRecords(await fetchRecords());
    } catch (err) { handleApiError(err); }
  };

  const handleAddRecord = async () => {
    try {
      await appendRecord(buildRecordRow(formValues));
      alert('保存しました！');
      setFormValues(prev => ({ ...prev, amount: '', description: '' }));
      await reloadRecords();
    } catch (err) { handleApiError(err); }
  };

  // 更新できたかどうかを返す（RecordsTable が編集モードを抜ける判断に使う）
  const handleUpdateRecord = async (rowNumber, values) => {
    try {
      await updateRecord(rowNumber, values);
      alert('更新しました。');
      await reloadRecords();
      return true;
    } catch (error) {
      handleApiError(error);
      return false;
    }
  };

  const handleDeleteRecord = async (record) => {
    const message = `【削除確認】\n日付: ${record.data[COL.DATE]}\n金額: ${record.data[COL.AMOUNT]}円\n\nこのデータを本当に削除しますか？`;
    if (!window.confirm(message)) return;

    try {
      await deleteRecord(record.rowNumber);
      alert('削除しました。');
      await reloadRecords();
    } catch (error) { handleApiError(error); }
  };

  // --- 画面の操作 ---

  const changeFormValue = (key, value) => setFormValues(prev => ({ ...prev, [key]: value }));
  const changeFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const resetFilters = () => setFilters(NO_FILTERS);

  const changeMonth = (diff) => {
    setViewingDate(prev => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + diff);
      return next;
    });
  };

  // 表示中のカテゴリを押すとそれだけを表示、非表示のカテゴリを押すと全表示に戻す
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

  // --- 起動時にログイン状態を復元する ---
  useEffect(() => {
    const restoreLogin = async () => {
      try {
        await loadGapi();
        const storedToken = localStorage.getItem('googleAuthToken');
        if (storedToken) {
          await signIn(JSON.parse(storedToken));
        }
      } catch (error) {
        console.error('アプリの初期化に失敗しました:', error);
      } finally {
        setIsLoading(false);
      }
    };
    restoreLogin();
  }, []);

  return (
    <div className="container">
      <header>
        <h1>細矢さん 家計簿</h1>
        {isLoggedIn && (<button onClick={handleLogout} className="logout-button">ログアウト</button>)}
      </header>

      {isLoading ? (
        <div className="loading-container"><p>読み込み中...</p></div>
      ) : !isLoggedIn ? (
        <div className="login-container">
          <button onClick={() => login()} className="login-button">Googleアカウントでログイン</button>
        </div>
      ) : (
        <>
          <nav className="main-nav">
            <button onClick={() => setPage('Home')} className={page === 'Home' ? 'active' : ''}>Home</button>
            <button onClick={() => setPage('History')} className={page === 'History' ? 'active' : ''}>履歴</button>
            <button onClick={() => setPage('Graph')} className={page === 'Graph' ? 'active' : ''}>グラフ</button>
          </nav>

          <main>
            {page === 'Home' && (
              <EntryForm values={formValues} onChange={changeFormValue} onSubmit={handleAddRecord} />
            )}

            {page === 'History' && (
              <SummaryTable
                summary={summaries.categoryTotals}
                userSummary={summaries.userTotals}
                categoryUserSummary={summaries.categoryUserTotals}
              />
            )}

            {page === 'Graph' && (
              <GraphSection
                graphData={graphData}
                visibleCategories={visibleCategories}
                onToggleCategory={toggleCategory}
              />
            )}

            {/* 月別リスト（全ページ共通） */}
            <section className="records-section">
              <MonthNavigator
                viewingDate={viewingDate}
                onPrevMonth={() => changeMonth(-1)}
                onNextMonth={() => changeMonth(1)}
              />
              <FilterPanel
                filters={filters}
                onChange={changeFilter}
                onReset={resetFilters}
                resultCount={filteredRecords.length}
                resultTotal={filteredTotal}
              />
              <RecordsTable
                records={filteredRecords}
                hasActiveFilters={activeFilterCount > 0}
                onSave={handleUpdateRecord}
                onDelete={handleDeleteRecord}
              />
            </section>
          </main>
        </>
      )}
    </div>
  );
}

export default App;
