import { CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS, USER_OPTIONS } from '../constants';

// 支出の入力フォーム。
// 入力値は App が持つ（ページを切り替えても入力途中の内容が消えないようにするため）。
function EntryForm({ values, onChange, onSubmit, onNotify }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!values.amount) { onNotify('金額を入力してください。', 'error'); return; }
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="entry-form">
      <h3>データ入力</h3>
      <div className="form-group">
        <label htmlFor="date">日付</label>
        <input type="date" id="date" value={values.date} onChange={e => onChange('date', e.target.value)} required />
      </div>
      <div className="form-group">
        <label htmlFor="category">支出カテゴリ</label>
        <select id="category" value={values.category} onChange={e => onChange('category', e.target.value)}>
          {CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="paymentMethod">支払方法</label>
        <select id="paymentMethod" value={values.paymentMethod} onChange={e => onChange('paymentMethod', e.target.value)}>
          {PAYMENT_METHOD_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="user">利用者</label>
        <select id="user" value={values.user} onChange={e => onChange('user', e.target.value)}>
          {USER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="amount">金額 (円)</label>
        <input type="number" inputMode="numeric" pattern="[0-9]*" id="amount" placeholder="例: 1500" value={values.amount} onChange={e => onChange('amount', e.target.value)} required />
      </div>
      <div className="form-group">
        <label htmlFor="description">内容 (任意)</label>
        <input type="text" id="description" placeholder="例: スーパー〇〇での買い物" value={values.description} onChange={e => onChange('description', e.target.value)} />
      </div>
      <button type="submit">この内容で保存する</button>
    </form>
  );
}

export default EntryForm;
