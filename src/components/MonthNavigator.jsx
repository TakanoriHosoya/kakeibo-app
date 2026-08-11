// 表示中の月の切り替え。未来の月は見られないよう「翌月」を止める。
function MonthNavigator({ viewingDate, onPrevMonth, onNextMonth }) {
  const today = new Date();
  const isNextMonthDisabled =
    viewingDate.getFullYear() > today.getFullYear() ||
    (viewingDate.getFullYear() === today.getFullYear() && viewingDate.getMonth() >= today.getMonth());

  return (
    <div className="month-navigator">
      <button onClick={onPrevMonth}>&lt; 先月</button>
      <h3>{viewingDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })} の記録</h3>
      <button onClick={onNextMonth} disabled={isNextMonthDisabled}>翌月 &gt;</button>
    </div>
  );
}

export default MonthNavigator;
