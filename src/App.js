// src/App.js (完全版)

import React, { useState, useEffect } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import './App.css';

// --- 定数設定 ---
const SPREADSHEET_ID = '1ELmgy9DzOWgwMFYgxN567yLQPpM9-NFOFq6N4pRDJeA';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

// プルダウンの選択肢
const CATEGORY_OPTIONS = ['食費', '日用品', '交通費', '趣味・娯楽', '交際費', '衣服・美容', '健康・医療', '住居・家具', '水道・光熱費', '通信費', '保険', '税金・社会保険', 'その他'];
const PAYMENT_METHOD_OPTIONS = ['楽天Pay', '現金', '楽天カード', 'PayPay', 'Amazonカード', 'セゾンカード', '京王パスポート', 'その他'];
const USER_OPTIONS = ['ママ', 'パパ', '家族'];

function App() {
  // --- State管理 ---
  const todayString = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD形式

  const [date, setDate] = useState(todayString);
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [paymentMethod, setPaymentMethod] = useState('楽天Pay');
  const [user, setUser] = useState('ママ');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- 関数定義 ---

  const resetForm = () => {
    setDate(todayString);
    setCategory(CATEGORY_OPTIONS[0]);
    setPaymentMethod('楽天Pay');
    setUser('ママ');
    setAmount('');
    setDescription('');
  };

  const initializeGapiClient = async (token) => {
    await window.gapi.client.init({
      discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
    });
    window.gapi.client.setToken(token);
    setIsLoggedIn(true);
    await loadRecords();
  };

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      localStorage.setItem('googleAuthToken', JSON.stringify(tokenResponse));
      initializeGapiClient(tokenResponse);
    },
    onError: (error) => {
      console.log('Login Failed:', error);
      alert('ログインに失敗しました。');
    },
    scope: SCOPES,
  });

  const handleLogout = () => {
    googleLogout();
    localStorage.removeItem('googleAuthToken');
    setIsLoggedIn(false);
    setRecords([]);
  };

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'data!A:G',
      });
      const allRecords = response.result.values ? response.result.values.slice(1) : [];
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      const thisMonthRecords = allRecords.filter(record => {
        if (!record || !record[1]) return false;
        const recordDate = new Date(record[1]);
        if (isNaN(recordDate.getTime())) return false; // 無効な日付を除外
        return recordDate.getFullYear() === currentYear && recordDate.getMonth() === currentMonth;
      });
      setRecords(thisMonthRecords.reverse());
    } catch (err) {
      console.error("Error loading records:", err);
      alert('データの読み込みに失敗しました。詳細はコンソールを確認してください。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount) {
      alert('金額を入力してください。');
      return;
    }
    const newRecord = [
      new Date().toISOString(), date, category, paymentMethod, user, amount, description,
    ];
    try {
      await window.gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'data!A1',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [newRecord] },
      });
      alert('保存しました！');
      resetForm();
      await loadRecords();
    } catch (err) {
      console.error("Error saving record:", err);
      alert('保存に失敗しました。詳細はコンソールを確認してください。');
    }
  };

  // アプリ起動時の初期化処理
  useEffect(() => {
    const loadGapiAndRestoreLogin = async () => {
      try {
        await new Promise((resolve) => window.gapi.load('client', resolve));
        const storedToken = localStorage.getItem('googleAuthToken');
        if (storedToken) {
          await initializeGapiClient(JSON.parse(storedToken));
        }
      } catch (error) {
        console.error("アプリの初期化に失敗しました:", error);
        alert('アプリの初期化に失敗しました。リロードしてみてください。');
      } finally {
        // 成功しても失敗しても、必ずローディングを解除
        setIsLoading(false);
      }
    };
    loadGapiAndRestoreLogin();
  }, []); // 空の配列[]は、この処理が最初に一度だけ実行されることを保証します

  // --- JSX (画面描画) ---
  return (
    <div className="container">
      <header>
        <h1>React 家計簿</h1>
        {isLoggedIn && (<button onClick={handleLogout} className="logout-button">ログアウト</button>)}
      </header>
      
      {isLoading ? (
        <div className="loading-container"><p>読み込み中...</p></div>
      ) : !isLoggedIn ? (
        <div className="login-container">
          <button onClick={() => login()} className="login-button">Googleアカウントでログイン</button>
        </div>
      ) : (
        <main>
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

          <section className="records-section">
            <h3>今月の記録</h3>
            <div className="records-table">
                <table>
                  <thead><tr><th>日付</th><th>カテゴリ</th><th>支払方法</th><th>金額</th><th>内容</th></tr></thead>
                  <tbody>
                    {records.map((row, index) => (
                      <tr key={index}>
                        <td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td>
                        <td>{Number(row[5]).toLocaleString()} 円</td><td>{row[6]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </section>
        </main>
      )}
    </div>
  );
}

export default App;