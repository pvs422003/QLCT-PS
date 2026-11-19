import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  formatVND,
  parseVND,
  groupTransactionsByDate,
  getPeriodRange,
  filterTransactionsByRange,
  computeStats,
  exportTransactionsToCSV,
  validateImportPayload,
} from './script.js';

test('CATEGORIES.expense includes Đi chơi', () => {
  assert.ok(CATEGORIES.expense.includes('Đi chơi'));
});

test('formatVND and parseVND handle Vietnamese thousand separators', () => {
  assert.equal(formatVND(1250000), '1.250.000 đ');
  assert.equal(formatVND(50000, true), '+50.000 đ');
  assert.equal(formatVND(-45000, true), '-45.000 đ');
  assert.equal(parseVND('1.250.000 đ'), 1250000);
  assert.equal(parseVND(''), 0);
});

test('groupTransactionsByDate sorts newest first and totals income/expense', () => {
  const groups = groupTransactionsByDate([
    { id: '1', type: 'expense', category: 'Ăn', amount: 40000, date: '2026-11-17', createdAt: 1 },
    { id: '2', type: 'income', category: 'Grab', amount: 300000, date: '2026-11-18', createdAt: 2 },
    { id: '3', type: 'expense', category: 'Uống', amount: 25000, date: '2026-11-18', createdAt: 3 },
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].date, '2026-11-18');
  assert.equal(groups[0].income, 300000);
  assert.equal(groups[0].expense, 25000);
  assert.equal(groups[1].date, '2026-11-17');
  assert.equal(groups[1].expense, 40000);
});

test('getPeriodRange and filterTransactionsByRange work for week/month/year', () => {
  const ref = new Date(2026, 10, 18); // Wed Nov 18, 2026
  const week = getPeriodRange('week', 0, ref);
  assert.equal(week.start, '2026-11-16');
  assert.equal(week.end, '2026-11-22');

  const month = getPeriodRange('month', 0, ref);
  assert.equal(month.start, '2026-11-01');
  assert.equal(month.end, '2026-11-30');

  const year = getPeriodRange('year', 0, ref);
  assert.equal(year.start, '2026-01-01');
  assert.equal(year.end, '2026-12-31');

  const filtered = filterTransactionsByRange(
    [
      { date: '2026-11-18', amount: 100 },
      { date: '2026-10-01', amount: 200 },
    ],
    week.start,
    week.end
  );
  assert.equal(filtered.length, 1);
});

test('computeStats calculates net balance and category percentages', () => {
  const stats = computeStats(
    [
      { type: 'income', category: 'Dạy', amount: 500000 },
      { type: 'expense', category: 'Ăn', amount: 150000 },
      { type: 'expense', category: 'Đổ xăng', amount: 50000 },
    ],
    'expense'
  );

  assert.equal(stats.income, 500000);
  assert.equal(stats.expense, 200000);
  assert.equal(stats.net, 300000);
  assert.equal(stats.breakdown[0].category, 'Ăn');
  assert.equal(stats.breakdown[0].percent, 75);
  assert.equal(stats.breakdown[1].category, 'Đổ xăng');
  assert.equal(stats.breakdown[1].percent, 25);
});

test('exportTransactionsToCSV and validateImportPayload handle backup/restore', () => {
  const csv = exportTransactionsToCSV([
    { id: '1', type: 'expense', category: 'Ăn', amount: 45000, date: '2026-11-18', note: 'Cơm, canh' },
  ]);
  assert.ok(csv.includes('Ngày,Loại,Danh mục,Số tiền (VNĐ),Ghi chú'));
  assert.ok(csv.includes('"Cơm, canh"'));

  const valid = validateImportPayload({
    transactions: [
      { id: 'a', type: 'income', category: 'Grab', amount: 120000, date: '2026-11-18', note: '' },
    ],
  });
  assert.equal(valid.ok, true);
  assert.ok(valid.transactions);
  assert.equal(valid.transactions.length, 1);

  const invalid = validateImportPayload({ foo: 'bar' });
  assert.equal(invalid.ok, false);
});
