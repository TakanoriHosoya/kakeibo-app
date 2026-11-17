import {
  FIXED_COL,
  buildFixedRow,
  parseFixedRow,
  fixedRowsMatch,
  isBlankFixedRow,
  sumFixedAmount,
  validateFixedExpense,
} from './fixedExpenses';

const values = {
  category: '保険',
  paymentMethod: '銀行引き落とし',
  user: '家族',
  amount: '13581',
  description: '学資：圭佑',
};

describe('buildFixedRow / parseFixedRow', () => {
  test('GAS が読む列の並び（カテゴリ・支払方法・利用者・金額・内容）で組み立てる', () => {
    expect(buildFixedRow(values)).toEqual(['保険', '銀行引き落とし', '家族', '13581', '学資：圭佑']);
  });

  test('組み立てた行を読み戻すと元の値になる', () => {
    expect(parseFixedRow(buildFixedRow(values))).toEqual(values);
  });

  test('桁区切りや円記号付きで返ってきた金額は数字だけにする', () => {
    const row = buildFixedRow({ ...values, amount: '¥90,000' });
    expect(parseFixedRow(row).amount).toBe('90000');
  });

  test('末尾の空セルが省略された行でも読める', () => {
    const row = ['保険', '銀行引き落とし', '家族', '2000'];
    expect(parseFixedRow(row).description).toBe('');
  });
});

describe('fixedRowsMatch', () => {
  test('同じ内容なら一致', () => {
    const row = buildFixedRow(values);
    expect(fixedRowsMatch(row, [...row])).toBe(true);
  });

  test('金額が違えば不一致', () => {
    const row = buildFixedRow(values);
    const changed = [...row];
    changed[FIXED_COL.AMOUNT] = '99999';
    expect(fixedRowsMatch(row, changed)).toBe(false);
  });

  test('行が消えて空になっていれば不一致', () => {
    expect(fixedRowsMatch(buildFixedRow(values), [])).toBe(false);
  });
});

describe('isBlankFixedRow', () => {
  test('中身を消しただけの行は空行', () => {
    expect(isBlankFixedRow([])).toBe(true);
    expect(isBlankFixedRow(['', ' ', '', '', ''])).toBe(true);
  });

  test('どれか1つでも値があれば空行ではない', () => {
    expect(isBlankFixedRow(['', '', '', '980'])).toBe(false);
  });
});

describe('sumFixedAmount', () => {
  test('全項目の金額を合計する', () => {
    const items = [
      { data: buildFixedRow({ ...values, amount: '90000' }), rowNumber: 2 },
      { data: buildFixedRow({ ...values, amount: '1,680' }), rowNumber: 3 },
      { data: buildFixedRow({ ...values, amount: '' }), rowNumber: 4 },
    ];
    expect(sumFixedAmount(items)).toBe(91680);
  });
});

describe('validateFixedExpense', () => {
  test('内容と金額があれば問題なし', () => {
    expect(validateFixedExpense(values)).toBeNull();
  });

  test('内容が空ならエラー', () => {
    expect(validateFixedExpense({ ...values, description: '  ' })).toMatch(/内容/);
  });

  test.each(['', '0', '-500', '12.5', 'abc'])('金額「%s」はエラー', (amount) => {
    expect(validateFixedExpense({ ...values, amount })).toMatch(/金額/);
  });
});
