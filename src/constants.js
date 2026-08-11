// --- Google スプレッドシート ---
// .env.local で上書きできる（別のシートで試したいとき用）。未設定なら本番のシートを見る。
// なお値はビルド成果物に埋め込まれるので、環境変数にしても秘匿はされない。
// アクセス制御を担っているのはスプレッドシート側の共有設定であって、この ID の秘匿性ではない。
export const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID || '1ELmgy9DzOWgwMFYgxN567yLQPpM9-NFOFq6N4pRDJeA';
export const SHEET_NAME = import.meta.env.VITE_SHEET_NAME || 'data';
export const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

// --- 入力の選択肢 ---
export const CATEGORY_OPTIONS = ['食費', '日用品', '交通費', '趣味・娯楽', '交際費', '衣服・美容', '健康・医療', '住居・家具', '家賃', '水道・光熱費', '通信費', '保険', '習い事', '税金・社会保険', 'その他'];
export const PAYMENT_METHOD_OPTIONS = ['楽天Pay', '現金', '楽天カード', 'PayPay', 'Amazonカード', 'セゾンカード', '京王パスポート', 'その他'];
export const USER_OPTIONS = ['ママ', 'パパ', '家族'];
