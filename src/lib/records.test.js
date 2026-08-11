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
  toggleFilterValue,
  rowsMatch,
} from './records';

// テスト用のレコードを組み立てる（列の並びは COL に対応）
const rec = (rowNumber, date, category, payment, user, amount, description = '') => ({
  data: ['2026-08-01T00:00:00.000Z', date, category, payment, user, amount, description],
  rowNumber,
});

const CATEGORIES = ['食費', '日用品', '交通費'];

describe('rowsMatch', () => {
  const row = ['2026-08-01T00:00:00.000Z', '2026-08-05', '食費', '現金', 'ママ', '1200', 'スーパー'];

  test('同じ内容なら true', () => {
    expect(rowsMatch(row, [...row])).toBe(true);
  });

  test('1列でも違えば false', () => {
    const changed = [...row];
    changed[COL.AMOUNT] = '1300';
    expect(rowsMatch(row, changed)).toBe(false);
  });

  test('末尾の空セルが省略されていても同じ内容とみなす', () => {
    const withEmptyDescription = ['2026-08-01T00:00:00.000Z', '2026-08-05', '食費', '現金', 'ママ', '1200', ''];
    const omitted = withEmptyDescription.slice(0, 6);
    expect(rowsMatch(withEmptyDescription, omitted)).toBe(true);
  });

  test('行が消えて空になっていれば false', () => {
    expect(rowsMatch(row, [])).toBe(false);
  });
});

describe('buildRecordRow', () => {
  const input = {
    date: '2026-08-11',
    category: '食費',
    paymentMethod: '楽天Pay',
    user: 'ママ',
    amount: '1500',
    description: 'スーパーでの買い物',
  };

  test('入力内容を列の並びどおりに配置する', () => {
    const row = buildRecordRow(input, new Date('2026-08-11T12:34:56.000Z'));
    expect(row).toEqual([
      '2026-08-11T12:34:56.000Z',
      '2026-08-11',
      '食費',
      '楽天Pay',
      'ママ',
      '1500',
      'スーパーでの買い物',
    ]);
  });

  test('登録日時は ISO 文字列で入る', () => {
    const row = buildRecordRow(input, new Date('2026-08-11T12:34:56.000Z'));
    expect(row[COL.TIMESTAMP]).toBe('2026-08-11T12:34:56.000Z');
  });

  test('内容が空でも列は詰めない', () => {
    const row = buildRecordRow({ ...input, description: '' });
    expect(row).toHaveLength(7);
    expect(row[COL.DESCRIPTION]).toBe('');
  });
});

describe('filterRecordsByMonth', () => {
  const records = [
    rec(2, '2026-07-10', '食費', '現金', 'ママ', '1000'),
    rec(3, '2026-08-05', '食費', '現金', 'パパ', '2000'),
    rec(4, '2026-08-20', '日用品', 'PayPay', 'ママ', '3000'),
    rec(5, '2026-09-01', '交通費', '現金', '家族', '4000'),
  ];

  test('指定した年月の記録だけを返す', () => {
    const result = filterRecordsByMonth(records, new Date(2026, 7, 15)); // 2026年8月
    expect(result.map(r => r.rowNumber)).toEqual([4, 3]);
  });

  test('日付の新しい順に並べる', () => {
    const result = filterRecordsByMonth(records, new Date(2026, 7, 15));
    expect(result[0].data[COL.DATE]).toBe('2026-08-20');
    expect(result[1].data[COL.DATE]).toBe('2026-08-05');
  });

  test('年が違えば同じ月でも除外する', () => {
    const result = filterRecordsByMonth(records, new Date(2025, 7, 15));
    expect(result).toEqual([]);
  });

  test('日付が空・不正・null の行は除外する', () => {
    const broken = [
      rec(2, '', '食費', '現金', 'ママ', '1000'),
      rec(3, 'これは日付ではない', '食費', '現金', 'ママ', '1000'),
      null,
      rec(4, '2026-08-05', '食費', '現金', 'ママ', '1000'),
    ];
    const result = filterRecordsByMonth(broken, new Date(2026, 7, 15));
    expect(result.map(r => r.rowNumber)).toEqual([4]);
  });

  test('元の配列を書き換えない', () => {
    const original = [...records];
    filterRecordsByMonth(records, new Date(2026, 7, 15));
    expect(records).toEqual(original);
  });
});

describe('summarizeRecords', () => {
  const records = [
    rec(2, '2026-08-05', '食費', '現金', 'ママ', '1000'),
    rec(3, '2026-08-06', '食費', '現金', 'パパ', '2000'),
    rec(4, '2026-08-07', '食費', '現金', 'ママ', '500'),
    rec(5, '2026-08-08', '日用品', 'PayPay', '家族', '3000'),
  ];

  test('カテゴリ別に合計する', () => {
    const { categoryTotals } = summarizeRecords(records);
    expect(categoryTotals).toEqual({ 食費: 3500, 日用品: 3000 });
  });

  test('利用者別に合計する', () => {
    const { userTotals } = summarizeRecords(records);
    expect(userTotals).toEqual({ ママ: 1500, パパ: 2000, 家族: 3000 });
  });

  test('カテゴリ×利用者で合計する', () => {
    const { categoryUserTotals } = summarizeRecords(records);
    expect(categoryUserTotals).toEqual({
      食費: { ママ: 1500, パパ: 2000 },
      日用品: { 家族: 3000 },
    });
  });

  test('金額が空欄なら0として扱う', () => {
    const { categoryTotals } = summarizeRecords([
      rec(2, '2026-08-05', '食費', '現金', 'ママ', ''),
      rec(3, '2026-08-06', '食費', '現金', 'ママ', '1000'),
    ]);
    expect(categoryTotals).toEqual({ 食費: 1000 });
  });

  test('記録が無ければ空のオブジェクトを返す', () => {
    expect(summarizeRecords([])).toEqual({
      categoryTotals: {},
      userTotals: {},
      categoryUserTotals: {},
    });
  });
});

describe('generateGraphData', () => {
  test('月ごとに合計し、月の昇順で返す', () => {
    const records = [
      rec(2, '2026-09-01', '食費', '現金', 'ママ', '300'),
      rec(3, '2026-07-10', '食費', '現金', 'ママ', '100'),
      rec(4, '2026-08-05', '食費', '現金', 'ママ', '200'),
    ];
    const result = generateGraphData(records, CATEGORIES);
    expect(result.map(d => d.date)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(result.map(d => d.total)).toEqual([100, 200, 300]);
  });

  test('同じ月の中でカテゴリ別に振り分ける', () => {
    const records = [
      rec(2, '2026-08-05', '食費', '現金', 'ママ', '1000'),
      rec(3, '2026-08-06', '日用品', '現金', 'ママ', '2000'),
      rec(4, '2026-08-07', '食費', '現金', 'ママ', '500'),
    ];
    const [august] = generateGraphData(records, CATEGORIES);
    expect(august.食費).toBe(1500);
    expect(august.日用品).toBe(2000);
    expect(august.交通費).toBe(0); // 該当が無いカテゴリは0で埋める
    expect(august.total).toBe(3500);
  });

  test('選択肢に無いカテゴリは合計にだけ反映する', () => {
    const records = [rec(2, '2026-08-05', '謎のカテゴリ', '現金', 'ママ', '1000')];
    const [august] = generateGraphData(records, CATEGORIES);
    expect(august.total).toBe(1000);
    expect(august.謎のカテゴリ).toBeUndefined();
  });

  test('日付が空・不正・null の行は無視する', () => {
    const records = [
      rec(2, '', '食費', '現金', 'ママ', '1000'),
      rec(3, 'これは日付ではない', '食費', '現金', 'ママ', '1000'),
      null,
      rec(4, '2026-08-05', '食費', '現金', 'ママ', '700'),
    ];
    const result = generateGraphData(records, CATEGORIES);
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(700);
  });

  test('月は2桁ゼロ埋めする', () => {
    const result = generateGraphData([rec(2, '2026-01-05', '食費', '現金', 'ママ', '100')], CATEGORIES);
    expect(result[0].date).toBe('2026-01');
  });
});

describe('applyFilters', () => {
  const records = [
    rec(2, '2026-08-05', '食費', '現金', 'ママ', '1000'),
    rec(3, '2026-08-06', '食費', 'PayPay', 'パパ', '2000'),
    rec(4, '2026-08-07', '日用品', '現金', 'ママ', '3000'),
  ];
  test('すべて未指定なら全件返す', () => {
    expect(applyFilters(records, NO_FILTERS)).toHaveLength(3);
  });

  test('カテゴリで絞り込む', () => {
    const result = applyFilters(records, { ...NO_FILTERS, category: ['食費'] });
    expect(result.map(r => r.rowNumber)).toEqual([2, 3]);
  });

  test('利用者で絞り込む', () => {
    const result = applyFilters(records, { ...NO_FILTERS, user: ['ママ'] });
    expect(result.map(r => r.rowNumber)).toEqual([2, 4]);
  });

  test('支払方法で絞り込む', () => {
    const result = applyFilters(records, { ...NO_FILTERS, payment: ['現金'] });
    expect(result.map(r => r.rowNumber)).toEqual([2, 4]);
  });

  test('同じ項目で複数選ぶと、そのいずれかに一致するものを返す', () => {
    const result = applyFilters(records, { ...NO_FILTERS, category: ['食費', '日用品'] });
    expect(result.map(r => r.rowNumber)).toEqual([2, 3, 4]);

    const byUser = applyFilters(records, { ...NO_FILTERS, user: ['ママ', 'パパ'] });
    expect(byUser.map(r => r.rowNumber)).toEqual([2, 3, 4]);
  });

  test('別々の項目どうしは AND で効く', () => {
    const result = applyFilters(records, { category: ['食費'], user: ['ママ'], payment: ['現金'] });
    expect(result.map(r => r.rowNumber)).toEqual([2]);
  });

  test('複数選択と AND の組み合わせ', () => {
    // 「食費 か 日用品」かつ「現金払い」
    const result = applyFilters(records, { ...NO_FILTERS, category: ['食費', '日用品'], payment: ['現金'] });
    expect(result.map(r => r.rowNumber)).toEqual([2, 4]);
  });

  test('一致するものが無ければ空を返す', () => {
    const result = applyFilters(records, { ...NO_FILTERS, category: ['食費'], user: ['家族'] });
    expect(result).toEqual([]);
  });
});

describe('toggleFilterValue', () => {
  const options = ['食費', '日用品', '交通費'];

  test('未選択の値を選ぶと追加される', () => {
    expect(toggleFilterValue([], '日用品', options)).toEqual(['日用品']);
  });

  test('選択済みの値を選ぶと外れる', () => {
    expect(toggleFilterValue(['食費', '日用品'], '食費', options)).toEqual(['日用品']);
  });

  test('選んだ順ではなく選択肢の並び順を保つ', () => {
    const afterFirst = toggleFilterValue([], '交通費', options);
    const afterSecond = toggleFilterValue(afterFirst, '食費', options);
    expect(afterSecond).toEqual(['食費', '交通費']);
  });

  test('元の配列を書き換えない', () => {
    const selected = ['食費'];
    toggleFilterValue(selected, '日用品', options);
    expect(selected).toEqual(['食費']);
  });
});

describe('sumAmount', () => {
  test('金額を合計する', () => {
    const records = [
      rec(2, '2026-08-05', '食費', '現金', 'ママ', '1000'),
      rec(3, '2026-08-06', '食費', '現金', 'ママ', '2500'),
    ];
    expect(sumAmount(records)).toBe(3500);
  });

  test('空欄は0として扱う', () => {
    expect(sumAmount([rec(2, '2026-08-05', '食費', '現金', 'ママ', '')])).toBe(0);
  });

  test('記録が無ければ0', () => {
    expect(sumAmount([])).toBe(0);
  });
});

describe('countActiveFilters', () => {
  test('未指定の数は数えない', () => {
    expect(countActiveFilters(NO_FILTERS)).toBe(0);
  });

  test('値を選んでいる項目の数を返す（選んだ値の数ではない）', () => {
    expect(countActiveFilters({ category: ['食費'], user: [], payment: ['現金'] })).toBe(2);
    expect(countActiveFilters({ category: ['食費', '日用品', '交通費'], user: [], payment: [] })).toBe(1);
    expect(countActiveFilters({ category: ['食費'], user: ['ママ'], payment: ['現金'] })).toBe(3);
  });
});
