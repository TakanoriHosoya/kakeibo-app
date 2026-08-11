import { render, screen } from '@testing-library/react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';

// 未ログイン状態でアプリが描画できることだけを確かめるスモークテスト。
// スプレッドシートの読み書きは本物の Google 認証が必要なため自動テストの対象外で、手動確認に委ねている。
beforeEach(() => {
  // gapi の読み込みだけ差し替える。保存済みトークンが無いので、以降の API 呼び出しは走らない。
  window.gapi = { load: (_name, { callback }) => callback() };
  localStorage.clear();
});

test('未ログインならログインボタンが表示される', async () => {
  render(
    <GoogleOAuthProvider clientId="test-client-id">
      <App />
    </GoogleOAuthProvider>
  );

  expect(
    await screen.findByRole('button', { name: 'Googleアカウントでログイン' })
  ).toBeInTheDocument();
});
