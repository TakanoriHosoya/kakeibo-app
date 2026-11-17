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
import {
  loadGapi,
  initClient,
  fetchRecords,
  fetchRow,
  appendRecord,
  updateRecord,
  deleteRecord,
  fetchFixedExpenses,
  fetchFixedRow,
  appendFixedExpense,
  updateFixedExpense,
  deleteFixedExpense,
} from './lib/sheets';
import { buildFixedRow, parseFixedRow, fixedRowsMatch } from './lib/fixedExpenses';
import { saveToken, loadToken, clearToken } from './lib/auth';
import EntryForm from './components/EntryForm';
import SummaryTable from './components/SummaryTable';
import GraphSection from './components/GraphSection';
import MonthNavigator from './components/MonthNavigator';
import FilterPanel from './components/FilterPanel';
import RecordsTable from './components/RecordsTable';
import FixedExpensesPage from './components/FixedExpensesPage';
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
  const [fixedExpenses, setFixedExpenses] = useState([]);
  // 'loading' | 'ready' | 'missing'（fixed シートが無い） | 'error'
  const [fixedStatus, setFixedStatus] = useState('loading');
  const [fixedDeleteTarget, setFixedDeleteTarget] = useState(null);

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
    setFixedExpenses([]);
    setFixedStatus('loading');
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
    await Promise.all([reloadRecords(), reloadFixedExpenses()]);
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

  const reloadFixedExpenses = async () => {
    try {
      const items = await fetchFixedExpenses();
      setFixedExpenses(items || []);
      setFixedStatus(items ? 'ready' : 'missing');
    } catch (err) {
      setFixedStatus('error');
      handleApiError(err);
    }
  };

  // 対象行が画面に表示している内容のままかを確かめる。
  // ずれていたら書き込まずに中断し、最新の状態を読み込み直す。
  // 既定は data シートの記録。固定費のときは照合方法と読み直し先を差し替える。
  const isRowUnchanged = async (record, {
    fetchCurrentRow = fetchRow,
    matches = rowsMatch,
    reload = reloadRecords,
  } = {}) => {
    const currentRow = await fetchCurrentRow(record.rowNumber);
    if (matches(currentRow, record.data)) return true;

    showToast('他の端末で変更されたため操作を中止しました。最新の状態に更新します。', 'error');
    await reload();
    return false;
  };
  const isFixedRowUnchanged = (item) => isRowUnchanged(item, {
    fetchCurrentRow: fetchFixedRow,
    matches: fixedRowsMatch,
    reload: reloadFixedExpenses,
  });

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

  // --- 毎月の固定費 ---
  // 追加・更新は保存できたかを返す（FixedExpensesPage が入力カードを閉じる判断に使う）

  const handleAddFixedExpense = async (values) => {
    if (!hasValidToken()) return false;

    try {
      await appendFixedExpense(buildFixedRow(values));
      showToast('固定費を追加しました');
      await reloadFixedExpenses();
      return true;
    } catch (err) {
      handleApiError(err);
      return false;
    }
  };

  const handleUpdateFixedExpense = async (item, values) => {
    if (!hasValidToken()) return false;

    try {
      // 中断時に true を返す理由は handleUpdateRecord と同じ
      if (!await isFixedRowUnchanged(item)) return true;

      await updateFixedExpense(item.rowNumber, buildFixedRow(values));
      showToast('固定費を更新しました');
      await reloadFixedExpenses();
      return true;
    } catch (err) {
      handleApiError(err);
      return false;
    }
  };

  const confirmDeleteFixedExpense = async () => {
    const item = fixedDeleteTarget;
    setFixedDeleteTarget(null);
    if (!item || !hasValidToken()) return;

    try {
      if (!await isFixedRowUnchanged(item)) return;

      await deleteFixedExpense(item.rowNumber);
      showToast('固定費を削除しました');
      await reloadFixedExpenses();
    } catch (err) { handleApiError(err); }
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
            <button onClick={() => setPage('Fixed')} className={page === 'Fixed' ? 'active' : ''}>固定費</button>
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

            {page === 'Fixed' && (
              <FixedExpensesPage
                items={fixedExpenses}
                status={fixedStatus}
                onAdd={handleAddFixedExpense}
                onUpdate={handleUpdateFixedExpense}
                onDelete={setFixedDeleteTarget}
                onReload={reloadFixedExpenses}
                onNotify={showToast}
              />
            )}

            {/* 月別リスト（固定費の設定ページ以外で共通） */}
            {page !== 'Fixed' && (
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
            )}
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

      <ConfirmDialog
        open={fixedDeleteTarget !== null}
        title="この固定費を削除しますか？"
        description={fixedDeleteTarget && (() => {
          const { description, amount } = parseFixedRow(fixedDeleteTarget.data);
          return `${description}　${Number(amount || 0).toLocaleString()}円（次回の登録から記録されなくなります）`;
        })()}
        confirmLabel="削除する"
        onConfirm={confirmDeleteFixedExpense}
        onCancel={() => setFixedDeleteTarget(null)}
      />
    </div>
  );
}

export default App;
