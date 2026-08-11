import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS, USER_OPTIONS, SCOPES } from './constants';
import {
  COL,
  NO_FILTERS,
  buildRecordRow,
  filterRecordsByMonth,
  summarizeRecords,
  generateGraphData,
  applyFilters,
  sumAmount,
  countActiveFilters,
  rowsMatch,
} from './lib/records';
import { loadGapi, initClient, fetchRecords, fetchRow, appendRecord, updateRecord, deleteRecord } from './lib/sheets';
import { saveToken, loadToken, clearToken } from './lib/auth';
import EntryForm from './components/EntryForm';
import SummaryTable from './components/SummaryTable';
import GraphSection from './components/GraphSection';
import MonthNavigator from './components/MonthNavigator';
import FilterPanel from './components/FilterPanel';
import RecordsTable from './components/RecordsTable';
import Toast from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';
import './App.css';

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
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // --- 画面内の通知 ---
  // id を付けて毎回別オブジェクトにする（同じ文言が続いても表示し直すため）。
  // Toast 側のタイマーが張り直されないよう、関数の同一性は保つ。
  const showToast = useCallback((message, type = 'success') => {
    setToast({ id: Date.now(), message, type });
  }, []);
  const hideToast = useCallback(() => setToast(null), []);

  // --- 表示用の派生データ ---
  const monthRecords = useMemo(() => filterRecordsByMonth(allRecords, viewingDate), [allRecords, viewingDate]);
  const summaries = useMemo(() => summarizeRecords(monthRecords), [monthRecords]);
  const filteredRecords = useMemo(() => applyFilters(monthRecords, filters), [monthRecords, filters]);

  // グラフは月をまたぐ推移を見るものなので、月ナビとは連動させず絞り込み条件だけを反映する
  const graphData = useMemo(
    () => generateGraphData(applyFilters(allRecords, filters), CATEGORY_OPTIONS),
    [allRecords, filters]
  );

  const filteredTotal = sumAmount(filteredRecords);
  const activeFilterCount = countActiveFilters(filters);

  // --- 認証 ---

  const handleApiError = (err) => {
    console.error('API Error:', err);
    if (err.status === 401) {
      showToast('認証の有効期限が切れました。再度ログインしてください。', 'error');
      handleLogout();
    } else if (err instanceof Error) {
      showToast(`処理中にエラーが発生しました。${err.message}`, 'error');
    } else {
      showToast('処理中にエラーが発生しました。詳細はコンソールを確認してください。', 'error');
    }
  };

  const handleLogout = () => {
    googleLogout();
    clearToken();
    setIsLoggedIn(false);
    setAllRecords([]);
  };

  // 期限切れのトークンで API を叩くと 401 が返るだけなので、その前に再ログインへ誘導する
  const hasValidToken = () => {
    if (loadToken()) return true;
    showToast('認証の有効期限が切れました。再度ログインしてください。', 'error');
    handleLogout();
    return false;
  };

  const signIn = async (token) => {
    await initClient(token);
    setIsLoggedIn(true);
    await reloadRecords();
  };

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      saveToken(tokenResponse);
      signIn(tokenResponse);
    },
    onError: (error) => { console.error('Login Failed:', error); showToast('ログインに失敗しました。', 'error'); },
    scope: SCOPES,
  });

  // --- スプレッドシートの操作 ---

  const reloadRecords = async () => {
    try {
      setAllRecords(await fetchRecords());
    } catch (err) { handleApiError(err); }
  };

  // 対象行が画面に表示している内容のままかを確かめる。
  // ずれていたら書き込まずに中断し、最新の状態を読み込み直す。
  const isRowUnchanged = async (record) => {
    const currentRow = await fetchRow(record.rowNumber);
    if (rowsMatch(currentRow, record.data)) return true;

    showToast('他の端末で変更されたため操作を中止しました。最新の状態に更新します。', 'error');
    await reloadRecords();
    return false;
  };

  const handleAddRecord = async () => {
    if (!hasValidToken()) return;

    try {
      await appendRecord(buildRecordRow(formValues));
      showToast('保存しました');
      setFormValues(prev => ({ ...prev, amount: '', description: '' }));
      await reloadRecords();
    } catch (err) { handleApiError(err); }
  };

  // 更新できたかどうかを返す（RecordsTable が編集モードを抜ける判断に使う）
  const handleUpdateRecord = async (record, values) => {
    if (!hasValidToken()) return false;

    try {
      // 中断時に true を返すのは、読み込み直した一覧に対して古い編集内容を
      // 開いたままにしないため（RecordsTable は true で編集モードを閉じる）
      if (!await isRowUnchanged(record)) return true;

      await updateRecord(record.rowNumber, values);
      showToast('更新しました');
      await reloadRecords();
      return true;
    } catch (error) {
      handleApiError(error);
      return false;
    }
  };

  // 削除は確認ダイアログを挟む。実際の削除は confirmDelete の側で行う
  const handleDeleteRecord = (record) => setDeleteTarget(record);

  const confirmDelete = async () => {
    const record = deleteTarget;
    setDeleteTarget(null);
    if (!record || !hasValidToken()) return;

    try {
      if (!await isRowUnchanged(record)) return;

      await deleteRecord(record.rowNumber);
      showToast('削除しました');
      await reloadRecords();
    } catch (error) { handleApiError(error); }
  };

  // --- 画面の操作 ---

  const changeFormValue = (key, value) => setFormValues(prev => ({ ...prev, [key]: value }));
  const changeFilter = (key, values) => setFilters(prev => ({ ...prev, [key]: values }));
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
        const storedToken = loadToken();
        if (storedToken) {
          await signIn(storedToken);
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
              <EntryForm
                values={formValues}
                onChange={changeFormValue}
                onSubmit={handleAddRecord}
                onNotify={showToast}
              />
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
                filters={filters}
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

      <Toast toast={toast} onClose={hideToast} />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="この記録を削除しますか？"
        description={deleteTarget && `${new Date(deleteTarget.data[COL.DATE]).toLocaleDateString('ja-JP')}　${deleteTarget.data[COL.CATEGORY]}　${Number(deleteTarget.data[COL.AMOUNT] || 0).toLocaleString()}円`}
        confirmLabel="削除する"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default App;
