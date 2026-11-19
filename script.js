/* ==========================================================================
   Sổ Chi Tiêu Cá Nhân — Pure Vanilla JavaScript
   ========================================================================== */

export const STORAGE_KEY = 'so_chi_tieu_transactions_v1';

export const CATEGORIES = {
  expense: ['Ăn', 'Uống', 'Đổ xăng', 'Net', 'Mua đồ', 'Đi chơi'],
  income: ['Grab', 'Tiền tip', 'Dạy'],
};

const CATEGORY_COLORS = {
  'Ăn': '#e11d48',
  'Uống': '#f97316',
  'Đổ xăng': '#eab308',
  'Net': '#6366f1',
  'Mua đồ': '#8b5cf6',
  'Đi chơi': '#ec4899',
  'Grab': '#059669',
  'Tiền tip': '#0d9488',
  'Dạy': '#2563eb',
};

/* ==========================================================================
   Pure Formatting, Date & Calculation Helpers (Unit-Tested)
   ========================================================================== */

export function formatNumberWithDots(num) {
  const n = Math.round(Math.abs(Number(num) || 0));
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatVND(amount, showSign = false) {
  const value = Number(amount) || 0;
  const formatted = `${formatNumberWithDots(value)} đ`;
  if (!showSign) {
    return value < 0 ? `-${formatted}` : formatted;
  }
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function parseVND(input) {
  const digits = String(input || '').replace(/[^\d]/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10);
}

export function toISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatVietnameseDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const todayIso = toISODate(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayIso = toISODate(yesterdayDate);

  const weekdays = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const dayStr = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;

  if (isoDate === todayIso) return `Hôm nay, ${dayStr}`;
  if (isoDate === yesterdayIso) return `Hôm qua, ${dayStr}`;
  return `${weekdays[date.getDay()]}, ${dayStr}`;
}

export function groupTransactionsByDate(transactions) {
  const map = new Map();
  for (const tx of transactions) {
    if (!map.has(tx.date)) {
      map.set(tx.date, {
        date: tx.date,
        income: 0,
        expense: 0,
        items: [],
      });
    }
    const group = map.get(tx.date);
    group.items.push(tx);
    if (tx.type === 'income') {
      group.income += tx.amount;
    } else {
      group.expense += tx.amount;
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    }));
}

export function getPeriodRange(period, offset = 0, referenceDate = new Date()) {
  const base = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  if (period === 'week') {
    const day = base.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(base);
    start.setDate(base.getDate() + diffToMonday + offset * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const fmt = (dt) =>
      `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const label =
      offset === 0
        ? `Tuần này (${fmt(start)} - ${fmt(end)})`
        : `${fmt(start)} - ${fmt(end)}/${end.getFullYear()}`;

    return { start: toISODate(start), end: toISODate(end), label };
  }

  if (period === 'month') {
    const start = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const label = `Tháng ${start.getMonth() + 1}/${start.getFullYear()}`;
    return { start: toISODate(start), end: toISODate(end), label };
  }

  const year = base.getFullYear() + offset;
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  return { start: toISODate(start), end: toISODate(end), label: `Năm ${year}` };
}

export function filterTransactionsByRange(transactions, startIso, endIso) {
  return transactions.filter((tx) => tx.date >= startIso && tx.date <= endIso);
}

export function computeStats(transactions, breakdownType = 'expense') {
  let income = 0;
  let expense = 0;
  const categoryTotals = new Map();

  for (const tx of transactions) {
    if (tx.type === 'income') {
      income += tx.amount;
    } else {
      expense += tx.amount;
    }

    if (tx.type === breakdownType) {
      categoryTotals.set(tx.category, (categoryTotals.get(tx.category) || 0) + tx.amount);
    }
  }

  const totalForType = breakdownType === 'income' ? income : expense;
  const breakdown = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percent: totalForType > 0 ? Math.round((amount / totalForType) * 1000) / 10 : 0,
      color: CATEGORY_COLORS[category] || '#475569',
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    income,
    expense,
    net: income - expense,
    totalForType,
    breakdown,
  };
}

export function exportTransactionsToCSV(transactions) {
  const header = ['Ngày', 'Loại', 'Danh mục', 'Số tiền (VNĐ)', 'Ghi chú'];
  const escapeCell = (val) => {
    const s = String(val ?? '');
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((tx) => [
      tx.date,
      tx.type === 'income' ? 'Thu nhập' : 'Chi phí',
      tx.category,
      tx.amount,
      tx.note || '',
    ]);

  return [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
}

export function validateImportPayload(raw) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.transactions) ? raw.transactions : null;
  if (!list) {
    return { ok: false, error: 'File JSON không đúng định dạng sao lưu.' };
  }

  const cleaned = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const type = item.type === 'income' ? 'income' : item.type === 'expense' ? 'expense' : null;
    const amount = Number(item.amount);
    const date = typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : null;
    const category = typeof item.category === 'string' && item.category.trim() ? item.category.trim() : null;

    if (!type || !Number.isFinite(amount) || amount <= 0 || !date || !category) {
      continue;
    }

    cleaned.push({
      id: typeof item.id === 'string' && item.id ? item.id : createId(),
      type,
      amount: Math.round(amount),
      category,
      date,
      note: typeof item.note === 'string' ? item.note.slice(0, 80) : '',
      createdAt: Number(item.createdAt) || Date.now(),
    });
  }

  if (cleaned.length === 0 && list.length > 0) {
    return { ok: false, error: 'Không tìm thấy giao dịch hợp lệ trong file.' };
  }

  return { ok: true, transactions: cleaned };
}

function createId() {
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createSeedTransactions() {
  const today = new Date();
  const offsetIso = (daysAgo) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    return toISODate(d);
  };

  const now = Date.now();
  return [
    {
      id: 'seed_1',
      type: 'income',
      category: 'Grab',
      amount: 320000,
      date: offsetIso(0),
      note: 'Chạy ca sáng + trưa',
      createdAt: now - 1000,
    },
    {
      id: 'seed_2',
      type: 'expense',
      category: 'Ăn',
      amount: 45000,
      date: offsetIso(0),
      note: 'Cơm tấm sườn bì',
      createdAt: now - 2000,
    },
    {
      id: 'seed_3',
      type: 'expense',
      category: 'Uống',
      amount: 25000,
      date: offsetIso(0),
      note: 'Cà phê sữa đá',
      createdAt: now - 3000,
    },
    {
      id: 'seed_4',
      type: 'income',
      category: 'Dạy',
      amount: 400000,
      date: offsetIso(1),
      note: 'Gia sư Toán tối',
      createdAt: now - 4000,
    },
    {
      id: 'seed_5',
      type: 'expense',
      category: 'Đổ xăng',
      amount: 70000,
      date: offsetIso(1),
      note: 'Đổ đầy bình RON 95',
      createdAt: now - 5000,
    },
    {
      id: 'seed_6',
      type: 'income',
      category: 'Tiền tip',
      amount: 50000,
      date: offsetIso(2),
      note: 'Khách thưởng giao nhanh',
      createdAt: now - 6000,
    },
    {
      id: 'seed_7',
      type: 'expense',
      category: 'Net',
      amount: 35000,
      date: offsetIso(2),
      note: 'Chơi game cùng bạn',
      createdAt: now - 7000,
    },
    {
      id: 'seed_8',
      type: 'expense',
      category: 'Mua đồ',
      amount: 185000,
      date: offsetIso(4),
      note: 'Mua áo thun & tất',
      createdAt: now - 8000,
    },
  ];
}

/* ==========================================================================
   DOM Application Controller
   ========================================================================== */

if (typeof document !== 'undefined') {
  const state = {
    transactions: [],
    activeTab: 'home',
    statsPeriod: 'week',
    statsOffset: 0,
    statsBreakdownType: 'expense',
    formType: 'expense',
    formCategory: CATEGORIES.expense[0],
    selectedDayIso: null,
    pendingConfirm: null,
  };

  const els = {
    pageTitle: document.getElementById('pageTitle'),
    headerDateLabel: document.getElementById('headerDateLabel'),
    totalBalance: document.getElementById('totalBalance'),
    totalIncome: document.getElementById('totalIncome'),
    totalExpense: document.getElementById('totalExpense'),
    txCountLabel: document.getElementById('txCountLabel'),
    dayList: document.getElementById('dayList'),
    homeEmptyState: document.getElementById('homeEmptyState'),

    viewHome: document.getElementById('viewHome'),
    viewStats: document.getElementById('viewStats'),
    viewBackup: document.getElementById('viewBackup'),

    statsPeriodLabel: document.getElementById('statsPeriodLabel'),
    statsIncome: document.getElementById('statsIncome'),
    statsExpense: document.getElementById('statsExpense'),
    statsNet: document.getElementById('statsNet'),
    stackedBarWrap: document.getElementById('stackedBarWrap'),
    stackedBar: document.getElementById('stackedBar'),
    breakdownList: document.getElementById('breakdownList'),
    statsEmptyState: document.getElementById('statsEmptyState'),
    btnPrevPeriod: document.getElementById('btnPrevPeriod'),
    btnNextPeriod: document.getElementById('btnNextPeriod'),

    btnExportJson: document.getElementById('btnExportJson'),
    btnExportCsv: document.getElementById('btnExportCsv'),
    btnImportJson: document.getElementById('btnImportJson'),
    inputImportJson: document.getElementById('inputImportJson'),
    btnClearAll: document.getElementById('btnClearAll'),
    storageSummary: document.getElementById('storageSummary'),

    btnOpenAdd: document.getElementById('btnOpenAdd'),
    txSheetBackdrop: document.getElementById('txSheetBackdrop'),
    txSheetTitle: document.getElementById('txSheetTitle'),
    btnCloseTxSheet: document.getElementById('btnCloseTxSheet'),
    txForm: document.getElementById('txForm'),
    txId: document.getElementById('txId'),
    txAmount: document.getElementById('txAmount'),
    txAmountError: document.getElementById('txAmountError'),
    categoryGrid: document.getElementById('categoryGrid'),
    txCategoryError: document.getElementById('txCategoryError'),
    txDate: document.getElementById('txDate'),
    txNote: document.getElementById('txNote'),
    btnSaveTx: document.getElementById('btnSaveTx'),
    btnDeleteTx: document.getElementById('btnDeleteTx'),

    daySheetBackdrop: document.getElementById('daySheetBackdrop'),
    daySheetTitle: document.getElementById('daySheetTitle'),
    daySheetSummary: document.getElementById('daySheetSummary'),
    dayDetailList: document.getElementById('dayDetailList'),
    btnCloseDaySheet: document.getElementById('btnCloseDaySheet'),
    btnAddForDay: document.getElementById('btnAddForDay'),

    confirmBackdrop: document.getElementById('confirmBackdrop'),
    confirmTitle: document.getElementById('confirmTitle'),
    confirmMessage: document.getElementById('confirmMessage'),
    btnConfirmCancel: document.getElementById('btnConfirmCancel'),
    btnConfirmOk: document.getElementById('btnConfirmOk'),

    toast: document.getElementById('toast'),
  };

  let toastTimer = null;

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2600);
  }

  function loadTransactions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          state.transactions = parsed;
          return;
        }
      }
    } catch {
      // Fallback to seed data if storage is corrupted
    }
    state.transactions = createSeedTransactions();
    saveTransactions();
  }

  function saveTransactions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
    } catch {
      showToast('Không thể lưu vào bộ nhớ trình duyệt.');
    }
  }

  function renderHeader() {
    const titles = {
      home: 'Sổ Chi Tiêu',
      stats: 'Thống Kê',
      backup: 'Sao Lưu & Khôi Phục',
    };
    els.pageTitle.textContent = titles[state.activeTab];
    const now = new Date();
    els.headerDateLabel.textContent = `${String(now.getDate()).padStart(2, '0')}/${String(
      now.getMonth() + 1
    ).padStart(2, '0')}/${now.getFullYear()}`;
  }

  function renderHome() {
    let income = 0;
    let expense = 0;
    for (const tx of state.transactions) {
      if (tx.type === 'income') income += tx.amount;
      else expense += tx.amount;
    }
    const balance = income - expense;

    els.totalBalance.textContent = formatVND(balance, false);
    els.totalIncome.textContent = formatVND(income, true);
    els.totalExpense.textContent = formatVND(-expense, true);
    els.txCountLabel.textContent = `${state.transactions.length} khoản`;

    const groups = groupTransactionsByDate(state.transactions);
    els.dayList.innerHTML = '';

    if (groups.length === 0) {
      els.homeEmptyState.hidden = false;
      return;
    }

    els.homeEmptyState.hidden = true;

    for (const group of groups) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'day-card';
      card.setAttribute('aria-label', `Xem chi tiết ngày ${formatVietnameseDate(group.date)}`);
      card.addEventListener('click', () => openDayDetail(group.date));

      const top = document.createElement('div');
      top.className = 'day-card-top';

      const dateEl = document.createElement('span');
      dateEl.className = 'day-card-date';
      dateEl.textContent = formatVietnameseDate(group.date);

      const countEl = document.createElement('span');
      countEl.className = 'day-card-count';
      countEl.textContent = `${group.items.length} khoản`;

      top.append(dateEl, countEl);

      const totals = document.createElement('div');
      totals.className = 'day-card-totals';

      if (group.income > 0) {
        const inc = document.createElement('span');
        inc.className = 'day-total-income';
        inc.textContent = `Thu ${formatVND(group.income, true)}`;
        totals.appendChild(inc);
      }

      if (group.expense > 0) {
        const exp = document.createElement('span');
        exp.className = 'day-total-expense';
        exp.textContent = `Chi ${formatVND(-group.expense, true)}`;
        totals.appendChild(exp);
      }

      const previewList = document.createElement('div');
      previewList.className = 'day-preview-list';

      const previewItems = group.items.slice(0, 3);
      for (const item of previewItems) {
        const row = document.createElement('div');
        row.className = 'day-preview-row';

        const left = document.createElement('div');
        left.className = 'day-preview-left';

        const cat = document.createElement('span');
        cat.className = 'day-preview-cat';
        cat.textContent = item.category;
        left.appendChild(cat);

        if (item.note) {
          const note = document.createElement('span');
          note.className = 'day-preview-note';
          note.textContent = `· ${item.note}`;
          left.appendChild(note);
        }

        const amt = document.createElement('span');
        amt.className = `day-preview-amount ${item.type === 'income' ? 'is-income' : 'is-expense'}`;
        amt.textContent = formatVND(item.type === 'income' ? item.amount : -item.amount, true);

        row.append(left, amt);
        previewList.appendChild(row);
      }

      card.append(top, totals, previewList);

      if (group.items.length > 3) {
        const more = document.createElement('span');
        more.className = 'day-card-more';
        more.textContent = `Xem thêm ${group.items.length - 3} khoản khác`;
        card.appendChild(more);
      }

      els.dayList.appendChild(card);
    }
  }

  function renderStats() {
    const range = getPeriodRange(state.statsPeriod, state.statsOffset);
    els.statsPeriodLabel.textContent = range.label;

    const inPeriod = filterTransactionsByRange(state.transactions, range.start, range.end);
    const stats = computeStats(inPeriod, state.statsBreakdownType);

    els.statsIncome.textContent = formatVND(stats.income, true);
    els.statsExpense.textContent = formatVND(-stats.expense, true);
    els.statsNet.textContent = formatVND(stats.net, true);
    els.statsNet.className = `stat-tile-value ${stats.net >= 0 ? 'is-income' : 'is-expense'}`;

    els.stackedBar.innerHTML = '';
    els.breakdownList.innerHTML = '';

    if (stats.breakdown.length === 0) {
      els.stackedBarWrap.hidden = true;
      els.statsEmptyState.hidden = false;
      return;
    }

    els.stackedBarWrap.hidden = false;
    els.statsEmptyState.hidden = true;

    for (const item of stats.breakdown) {
      const seg = document.createElement('div');
      seg.className = 'stacked-segment';
      seg.style.width = `${Math.max(item.percent, 2)}%`;
      seg.style.backgroundColor = item.color;
      els.stackedBar.appendChild(seg);

      const card = document.createElement('div');
      card.className = 'breakdown-item';

      const top = document.createElement('div');
      top.className = 'breakdown-top';

      const left = document.createElement('div');
      const name = document.createElement('span');
      name.className = 'breakdown-name';
      name.textContent = item.category;

      const pct = document.createElement('span');
      pct.className = 'breakdown-meta';
      pct.textContent = ` · ${item.percent}%`;

      left.append(name, pct);

      const amt = document.createElement('strong');
      amt.className = 'breakdown-amount';
      amt.textContent = formatVND(item.amount, false);

      top.append(left, amt);

      const track = document.createElement('div');
      track.className = 'progress-track';

      const fill = document.createElement('div');
      fill.className = 'progress-fill';
      fill.style.width = `${item.percent}%`;
      fill.style.backgroundColor = item.color;

      track.appendChild(fill);
      card.append(top, track);
      els.breakdownList.appendChild(card);
    }
  }

  function renderBackup() {
    els.storageSummary.textContent = `Đang lưu ${state.transactions.length} giao dịch tự động trong localStorage của trình duyệt.`;
  }

  function renderAll() {
    renderHeader();
    renderHome();
    renderStats();
    renderBackup();
    if (state.selectedDayIso && !els.daySheetBackdrop.hidden) {
      renderDayDetail(state.selectedDayIso);
    }
  }

  /* ==========================================================================
     Navigation
     ========================================================================== */

  function switchTab(tab) {
    state.activeTab = tab;
    els.viewHome.hidden = tab !== 'home';
    els.viewStats.hidden = tab !== 'stats';
    els.viewBackup.hidden = tab !== 'backup';

    document.querySelectorAll('.nav-item').forEach((btn) => {
      const active = btn.dataset.nav === tab;
      btn.classList.toggle('is-active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });

    renderHeader();
    if (tab === 'stats') renderStats();
    if (tab === 'backup') renderBackup();
  }

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.nav));
  });

  /* ==========================================================================
     Add / Edit Transaction Sheet
     ========================================================================== */

  function renderCategoryButtons() {
    const list = CATEGORIES[state.formType];
    if (!list.includes(state.formCategory)) {
      state.formCategory = list[0];
    }

    els.categoryGrid.innerHTML = '';
    for (const cat of list) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `category-btn ${state.formType === 'income' ? 'is-income' : 'is-expense'}`;
      const selected = cat === state.formCategory;
      if (selected) btn.classList.add('is-selected');
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(selected));
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        state.formCategory = cat;
        els.txCategoryError.hidden = true;
        renderCategoryButtons();
      });
      els.categoryGrid.appendChild(btn);
    }
  }

  function setFormType(type) {
    state.formType = type;
    document.querySelectorAll('.type-tab').forEach((btn) => {
      const active = btn.dataset.txType === type;
      btn.classList.toggle('is-active', active);
      btn.classList.toggle('is-expense', active && type === 'expense');
      btn.classList.toggle('is-income', active && type === 'income');
      btn.setAttribute('aria-selected', String(active));
    });
    renderCategoryButtons();
  }

  function openTxSheet(options = {}) {
    const { transaction = null, presetDate = null } = options;
    els.txAmountError.hidden = true;
    els.txCategoryError.hidden = true;

    if (transaction) {
      els.txSheetTitle.textContent = 'Chỉnh sửa giao dịch';
      els.txId.value = transaction.id;
      els.txAmount.value = formatNumberWithDots(transaction.amount);
      els.txDate.value = transaction.date;
      els.txNote.value = transaction.note || '';
      state.formCategory = transaction.category;
      setFormType(transaction.type);
      els.btnSaveTx.textContent = 'Cập nhật giao dịch';
      els.btnDeleteTx.hidden = false;
    } else {
      els.txSheetTitle.textContent = 'Thêm giao dịch';
      els.txId.value = '';
      els.txAmount.value = '';
      els.txDate.value = presetDate || toISODate(new Date());
      els.txNote.value = '';
      state.formCategory = CATEGORIES.expense[0];
      setFormType('expense');
      els.btnSaveTx.textContent = 'Lưu giao dịch';
      els.btnDeleteTx.hidden = true;
    }

    els.txSheetBackdrop.hidden = false;
    setTimeout(() => els.txAmount.focus(), 60);
  }

  function closeTxSheet() {
    els.txSheetBackdrop.hidden = true;
  }

  els.btnOpenAdd.addEventListener('click', () => openTxSheet());
  els.btnCloseTxSheet.addEventListener('click', closeTxSheet);
  els.txSheetBackdrop.addEventListener('click', (e) => {
    if (e.target === els.txSheetBackdrop) closeTxSheet();
  });

  document.querySelectorAll('.type-tab').forEach((btn) => {
    btn.addEventListener('click', () => setFormType(btn.dataset.txType));
  });

  els.txAmount.addEventListener('input', () => {
    const numeric = parseVND(els.txAmount.value);
    els.txAmount.value = numeric > 0 ? formatNumberWithDots(numeric) : '';
    if (numeric > 0) {
      els.txAmountError.hidden = true;
    }
  });

  els.txForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseVND(els.txAmount.value);
    if (!amount || amount <= 0) {
      els.txAmountError.textContent = 'Vui lòng nhập số tiền lớn hơn 0.';
      els.txAmountError.hidden = false;
      els.txAmount.focus();
      return;
    }

    if (!state.formCategory) {
      els.txCategoryError.textContent = 'Vui lòng chọn danh mục.';
      els.txCategoryError.hidden = false;
      return;
    }

    const date = els.txDate.value || toISODate(new Date());
    const note = els.txNote.value.trim();
    const existingId = els.txId.value;

    if (existingId) {
      state.transactions = state.transactions.map((tx) =>
        tx.id === existingId
          ? { ...tx, type: state.formType, amount, category: state.formCategory, date, note }
          : tx
      );
      showToast('Đã cập nhật giao dịch.');
    } else {
      state.transactions.push({
        id: createId(),
        type: state.formType,
        amount,
        category: state.formCategory,
        date,
        note,
        createdAt: Date.now(),
      });
      showToast('Đã thêm giao dịch mới.');
    }

    saveTransactions();
    closeTxSheet();
    renderAll();
  });

  els.btnDeleteTx.addEventListener('click', () => {
    const id = els.txId.value;
    if (!id) return;
    openConfirm(
      'Xóa giao dịch?',
      'Khoản giao dịch này sẽ bị xóa vĩnh viễn khỏi sổ chi tiêu.',
      () => {
        state.transactions = state.transactions.filter((tx) => tx.id !== id);
        saveTransactions();
        closeTxSheet();
        renderAll();
        showToast('Đã xóa giao dịch.');
      }
    );
  });

  /* ==========================================================================
     Day Detail Sheet
     ========================================================================== */

  function renderDayDetail(isoDate) {
    const items = state.transactions
      .filter((tx) => tx.date === isoDate)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    els.daySheetTitle.textContent = formatVietnameseDate(isoDate);

    if (items.length === 0) {
      closeDayDetail();
      return;
    }

    let inc = 0;
    let exp = 0;
    for (const tx of items) {
      if (tx.type === 'income') inc += tx.amount;
      else exp += tx.amount;
    }
    els.daySheetSummary.textContent = `Thu ${formatVND(inc, true)} · Chi ${formatVND(-exp, true)}`;

    els.dayDetailList.innerHTML = '';
    for (const item of items) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'detail-row';
      row.setAttribute('aria-label', `Chỉnh sửa ${item.category} ${formatVND(item.amount)}`);
      row.addEventListener('click', () => openTxSheet({ transaction: item }));

      const main = document.createElement('div');
      main.className = 'detail-row-main';

      const cat = document.createElement('span');
      cat.className = 'detail-row-cat';
      cat.textContent = item.category;
      main.appendChild(cat);

      const note = document.createElement('span');
      note.className = 'detail-row-note';
      note.textContent = item.note || (item.type === 'income' ? 'Thu nhập' : 'Chi phí');
      main.appendChild(note);

      const right = document.createElement('div');
      right.className = 'detail-row-right';

      const amt = document.createElement('span');
      amt.className = `detail-row-amount ${item.type === 'income' ? 'is-income' : 'is-expense'}`;
      amt.textContent = formatVND(item.type === 'income' ? item.amount : -item.amount, true);

      right.appendChild(amt);
      row.append(main, right);
      els.dayDetailList.appendChild(row);
    }
  }

  function openDayDetail(isoDate) {
    state.selectedDayIso = isoDate;
    renderDayDetail(isoDate);
    els.daySheetBackdrop.hidden = false;
  }

  function closeDayDetail() {
    els.daySheetBackdrop.hidden = true;
    state.selectedDayIso = null;
  }

  els.btnCloseDaySheet.addEventListener('click', closeDayDetail);
  els.daySheetBackdrop.addEventListener('click', (e) => {
    if (e.target === els.daySheetBackdrop) closeDayDetail();
  });

  els.btnAddForDay.addEventListener('click', () => {
    const presetDate = state.selectedDayIso || toISODate(new Date());
    openTxSheet({ presetDate });
  });

  /* ==========================================================================
     Statistics Controls
     ========================================================================== */

  document.querySelectorAll('.segment-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.statsPeriod = btn.dataset.period;
      state.statsOffset = 0;
      document.querySelectorAll('.segment-btn').forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', String(active));
      });
      renderStats();
    });
  });

  els.btnPrevPeriod.addEventListener('click', () => {
    state.statsOffset -= 1;
    renderStats();
  });

  els.btnNextPeriod.addEventListener('click', () => {
    state.statsOffset += 1;
    renderStats();
  });

  document.querySelectorAll('.mini-switch-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.statsBreakdownType = btn.dataset.statType;
      document.querySelectorAll('.mini-switch-btn').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      renderStats();
    });
  });

  /* ==========================================================================
     Backup & Restore
     ========================================================================== */

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  els.btnExportJson.addEventListener('click', () => {
    const payload = {
      app: 'SoChiTieuCaNhan',
      exportedAt: new Date().toISOString(),
      transactions: state.transactions,
    };
    downloadFile(
      JSON.stringify(payload, null, 2),
      `so-chi-tieu-${toISODate(new Date())}.json`,
      'application/json;charset=utf-8'
    );
    showToast('Đã xuất file sao lưu JSON.');
  });

  els.btnExportCsv.addEventListener('click', () => {
    const csv = '\uFEFF' + exportTransactionsToCSV(state.transactions);
    downloadFile(
      csv,
      `so-chi-tieu-${toISODate(new Date())}.csv`,
      'text/csv;charset=utf-8'
    );
    showToast('Đã xuất file CSV.');
  });

  els.btnImportJson.addEventListener('click', () => {
    els.inputImportJson.value = '';
    els.inputImportJson.click();
  });

  els.inputImportJson.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = validateImportPayload(parsed);
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      state.transactions = result.transactions;
      saveTransactions();
      renderAll();
      showToast(`Đã khôi phục ${result.transactions.length} giao dịch.`);
    } catch {
      showToast('Không thể đọc file JSON. Vui lòng kiểm tra lại.');
    }
  });

  els.btnClearAll.addEventListener('click', () => {
    openConfirm(
      'Xóa toàn bộ dữ liệu?',
      'Tất cả giao dịch đã lưu sẽ bị xóa. Hãy xuất file JSON trước nếu bạn muốn giữ lại.',
      () => {
        state.transactions = [];
        saveTransactions();
        renderAll();
        showToast('Đã xóa toàn bộ dữ liệu.');
      }
    );
  });

  /* ==========================================================================
     Confirm Dialog & Keyboard Escape
     ========================================================================== */

  function openConfirm(title, message, onConfirm) {
    els.confirmTitle.textContent = title;
    els.confirmMessage.textContent = message;
    state.pendingConfirm = onConfirm;
    els.confirmBackdrop.hidden = false;
  }

  function closeConfirm() {
    els.confirmBackdrop.hidden = true;
    state.pendingConfirm = null;
  }

  els.btnConfirmCancel.addEventListener('click', closeConfirm);
  els.btnConfirmOk.addEventListener('click', () => {
    const fn = state.pendingConfirm;
    closeConfirm();
    if (fn) fn();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!els.confirmBackdrop.hidden) closeConfirm();
    else if (!els.txSheetBackdrop.hidden) closeTxSheet();
    else if (!els.daySheetBackdrop.hidden) closeDayDetail();
  });

  /* ==========================================================================
     Initialize App
     ========================================================================== */

  loadTransactions();
  renderAll();
}
