// src/App.js

import React, { useState, useEffect } from 'react';
// googleLogoutを追加でインポートします
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import './App.css';

// ▼▼▼ あなたの正しいスプレッドシートIDをここに設定してください ▼▼▼
const SPREADSHEET_ID = '1ELmgy9DzOWgwMFYgxN567yLQPpM9-NFOFq6N4pRDJeA';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [records, setRecords] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('食費');
  const [isLoading, setIsLoading] = useState(true);

  // GAPIクライアントを初期化する関数
  const initializeGapiClient = async (token) => {
    await window.gapi.client.init({
      discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
    });
    window.gapi.client.setToken(token);
    setIsLoggedIn(true);
    await loadRecords();
  };
  
  // Googleログイン処理
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      // ★ポイント1: 取得した認証情報をlocalStorageに保存
      localStorage.setItem('googleAuthToken', JSON.stringify(tokenResponse));
      initializeGapiClient(tokenResponse);
    },
    onError: (error) => console.log('Login Failed:', error),
    scope: SCOPES,
  });

  // ログアウト処理
  const handleLogout = () => {
    googleLogout(); // Googleのセッションからログアウト
    // ★ポイント2: localStorageから認証情報を削除
    localStorage.removeItem('googleAuthToken');
    setIsLoggedIn(false);
    setRecords([]); // 画面の記録もクリア
  };

  // データの読み込み関数（変更なし）
  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'data!A:D', // シート名はご自身のものに合わせてください
      });

      // ヘッダー行を除いた、すべてのレコードを取得
      const allRecords = response.result.values ? response.result.values.slice(1) : [];

      // ▼▼▼ ここからが今回追加したフィルタリング処理です ▼▼▼

      // 1. 今日の日付から、現在の「年」と「月」を取得します
      const today = new Date();
      const currentYear = today.getFullYear(); // 例: 2025
      const currentMonth = today.getMonth();   // 例: 6月の場合、5 (0から始まるため)

      // 2. 全レコードを1行ずつチェックし、今月のものだけを抽出します
      const thisMonthRecords = allRecords.filter(record => {
        // record[0] には '2025/6/22' のような日付文字列が入っています
        if (!record || !record[0]) {
          return false; // 日付がない行は除外
        }
        
        // 日付文字列からDateオブジェクトを生成
        const recordDate = new Date(record[0]);

        // レコードの「年」と「月」が、現在の「年」と「月」に一致するかを判定
        return recordDate.getFullYear() === currentYear && recordDate.getMonth() === currentMonth;
      });

      // ▲▲▲ フィルタリング処理ここまで ▲▲▲

      // 3. フィルタリング後の「今月のデータ」だけを画面表示用のstateにセットします
      //    (reverse()で日付の新しいものが上に来るようにしています)
      setRecords(thisMonthRecords.reverse());

    } catch (err) {
      console.error("Error loading records", err);
    } finally {
      setIsLoading(false);
    }
  };

  // データの書き込み関数（変更なし）
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount) return;
    const newRecord = [ new Date().toLocaleDateString('ja-JP'), category, amount ];
    try {
      await window.gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'data!A1', // シンプルなシート名 'data' になっていることを確認
        valueInputOption: 'USER_ENTERED',
        resource: { values: [newRecord] },
      });
      alert('保存しました！');
      setAmount('');
      await loadRecords();
    } catch (err) {
      console.error("Error saving record", err);
      alert('保存に失敗しました。');
    }
  };

  // ★ポイント3: アプリ起動時に実行される処理
  useEffect(() => {
    const loadGapiAndRestoreLogin = async () => {
      // GAPIクライアントライブラリの読み込みを待つ
      await new Promise((resolve) => window.gapi.load('client', resolve));
      
      // localStorageに保存された認証情報があるかチェック
      const storedToken = localStorage.getItem('googleAuthToken');
      if (storedToken) {
        // 保存された情報を使ってログイン状態を復元
        await initializeGapiClient(JSON.parse(storedToken));
      }
      setIsLoading(false); // ローディング完了
    };
    
    loadGapiAndRestoreLogin();
  }, []); // この空の配列 [] は、この処理が最初に一度だけ実行されることを意味します

  return (
    <div className="container">
      <header>
        <h1>React 家計簿</h1>
        {/* ログイン中のみログアウトボタンを表示 */}
        {isLoggedIn && (
          <button onClick={handleLogout} className="logout-button">
            ログアウト
          </button>
        )}
      </header>
      
      {isLoading ? (
        <p>読み込み中...</p>
      ) : !isLoggedIn ? (
        <div className="login-container">
          <button onClick={() => login()} className="login-button">
            Googleアカウントでログイン
          </button>
        </div>
      ) : (
        <main>
          <form onSubmit={handleSubmit} className="entry-form">
            <h3>データ入力</h3>
            <div className="form-group">
              <label>カテゴリ</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                <option>食費</option>
                <option>交通費</option>
                <option>日用品</option>
                <option>趣味・娯楽</option>
                <option>交際費</option>
                <option>その他</option>
              </select>
            </div>
            <div className="form-group">
              <label>金額 (円)</label>
              <input 
                type="number"
                placeholder="例: 1500" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                required 
              />
            </div>
            <button type="submit">保存する</button>
          </form>

          <section className="records-section">
            <h3>記録一覧</h3>
            {/* ... 記録一覧の表示部分は変更なし ... */}
            <div className="records-table">
                <table>
                  <thead>
                    <tr>
                      <th>日付</th>
                      <th>カテゴリ</th>
                      <th>金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((row, index) => (
                      <tr key={index}>
                        <td>{row[0]}</td>
                        <td>{row[1]}</td>
                        <td>{Number(row[2]).toLocaleString()} 円</td>
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