import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google'; // インポート
import App from './App';
import './index.css';

// GCPで取得したあなたのクライアントIDをここに設定
const GOOGLE_CLIENT_ID = "1011725008302-opcfhk10p96bkqvsgrdv11i2g0ek5sof.apps.googleusercontent.com";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* GoogleOAuthProviderでAppを囲む */}
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);