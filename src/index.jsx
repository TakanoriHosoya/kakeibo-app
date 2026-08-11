import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import './index.css';

// GCP プロジェクト household-account-book-463700 のクライアント ID。
// .env.local で上書きできる。Client ID は公開前提の値で、他人による流用は
// GCP の「承認済みの JavaScript 生成元」で防ぐ。
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1011725008302-opcfhk10p96bkqvsgrdv11i2g0ek5sof.apps.googleusercontent.com';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);