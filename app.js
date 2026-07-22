/* ===================== STATE & STORAGE ===================== */

var STORAGE_KEY = 'finapp_v1';

var PALETTE = ['#6C5CE7','#00B894','#0984E3','#E17055','#FDCB6E','#E84393','#00CEC9','#D63031','#A29BFE','#636E72','#00A8FF','#F8A5C2'];

var DEFAULT_STATE = {
  transactions: [],
  categories: {
    income: [
      { name: 'מכירות', color: '#00B894' },
      { name: 'שירותים', color: '#0984E3' },
      { name: 'קארד קום', color: '#6C5CE7' },
      { name: 'החזרים', color: '#00CEC9' },
      { name: 'אחר', color: '#636E72' }
    ],
    expense: [
      { name: 'שכירות', color: '#D63031' },
      { name: 'שכר עבודה', color: '#E17055' },
      { name: 'ציוד ומלאי', color: '#FDCB6E' },
      { name: 'שיווק ופרסום', color: '#E84393' },
      { name: 'מיסים ואגרות', color: '#A29BFE' },
      { name: 'ספקים', color: '#00A8FF' },
      { name: 'הוצאות משרד', color: '#0984E3' },
      { name: 'אחר', color: '#636E72' }
    ]
  },
  importHistory: []
};

var state = null;

function loadState() {
  var raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    return;
  }
  try {
    state = JSON.parse(raw);
    if (!state.transactions) state.transactions = [];
    if (!state.categories) state.categories = DEFAULT_STATE.categories;
    if (!state.importHistory) state.importHistory = [];
  } catch (e) {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ===================== UTILITIES ===================== */

function uid() { return 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }

function fmtCurrency(n) {
  n = Number(n) || 0;
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '';
  var parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

var MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function monthKey(iso) { return iso ? iso.slice(0, 7) : ''; }

function monthLabel(key) {
  var parts = key.split('-');
  var y = parts[0], m = parseInt(parts[1], 10) - 1;
  return MONTH_NAMES[m] + ' ' + y;
}

function todayIso() {
  var d = new Date();
  return d.toISOString().slice(0, 10);
}

function categoryColor(type, name) {
  var list = state.categories[type] || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].name === name) return list[i].color;
  }
  return '#636E72';
}

function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function () { t.classList.remove('show'); }, 2200);
}

/* ===================== NAVIGATION ===================== */

function initNav() {
  document.querySelectorAll('.nav-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var view = btn.getAttribute('data-view');
      document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
      document.getElementById('view-' + view).classList.add('active');
      renderView(view);
    });
  });
}

function renderView(view) {
  if (view === 'dashboard') renderDashboard();
  else if (view === 'income') renderTxTable('income');
  else if (view === 'expense') renderTxTable('expense');
  else if (view === 'pnl') renderPnl();
  else if (view === 'import') renderImportHistory();
  else if (view === 'reports') renderReportTable();
  else if (view === 'settings') renderSettings();
}

/* ===================== AGGREGATIONS ===================== */

function getTx(type) {
  return state.transactions.filter(function (t) { return t.type === type; });
}

function totalOf(list) {
  return list.reduce(function (s, t) { return s + Number(t.amount); }, 0);
}

function monthlyBreakdown() {
  var map = {};
  state.transactions.forEach(function (t) {
    var k = monthKey(t.date);
    if (!map[k]) map[k] = { income: 0, expense: 0 };
    map[k][t.type] += Number(t.amount);
  });
  var keys = Object.keys(map).sort();
  return keys.map(function (k) {
    return { key: k, label: monthLabel(k), income: map[k].income, expense: map[k].expense, net: map[k].income - map[k].expense };
  });
}

function categoryBreakdown(type) {
  var map = {};
  getTx(type).forEach(function (t) {
    map[t.category] = (map[t.category] || 0) + Number(t.amount);
  });
  return Object.keys(map).map(function (name) {
    return { name: name, value: map[name], color: categoryColor(type, name) };
  });
}

/* ===================== DASHBOARD ===================== */

var charts = {};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function renderDashboard() {
  var income = getTx('income');
  var expense = getTx('expense');
  var totalIncome = totalOf(income);
  var totalExpense = totalOf(expense);
  var net = totalIncome - totalExpense;

  var thisMonth = todayIso().slice(0, 7);
  var monthIncome = totalOf(income.filter(function (t) { return monthKey(t.date) === thisMonth; }));
  var monthExpense = totalOf(expense.filter(function (t) { return monthKey(t.date) === thisMonth; }));

  document.getElementById('kpi-total-income').textContent = fmtCurrency(totalIncome);
  document.getElementById('kpi-total-expenses').textContent = fmtCurrency(totalExpense);
  document.getElementById('kpi-net-profit').textContent = fmtCurrency(net);
  document.getElementById('kpi-month-profit').textContent = fmtCurrency(monthIncome - monthExpense);

  var monthly = monthlyBreakdown().slice(-12);

  destroyChart('monthly');
  charts.monthly = new Chart(document.getElementById('chart-monthly'), {
    type: 'bar',
    data: {
      labels: monthly.map(function (m) { return m.label; }),
      datasets: [
        { label: 'הכנסות', data: monthly.map(function (m) { return m.income; }), backgroundColor: '#00B894', borderRadius: 6 },
        { label: 'הוצאות', data: monthly.map(function (m) { return m.expense; }), backgroundColor: '#D63031', borderRadius: 6 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });

  var expCat = categoryBreakdown('expense');
  destroyChart('expenseCat');
  charts.expenseCat = new Chart(document.getElementById('chart-expense-cat'), {
    type: 'doughnut',
    data: {
      labels: expCat.map(function (c) { return c.name; }),
      datasets: [{ data: expCat.map(function (c) { return c.value; }), backgroundColor: expCat.map(function (c) { return c.color; }) }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });

  var incCat = categoryBreakdown('income');
  destroyChart('incomeCat');
  charts.incomeCat = new Chart(document.getElementById('chart-income-cat'), {
    type: 'doughnut',
    data: {
      labels: incCat.map(function (c) { return c.name; }),
      datasets: [{ data: incCat.map(function (c) { return c.value; }), backgroundColor: incCat.map(function (c) { return c.color; }) }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });

  var all = monthlyBreakdown();
  var cumulative = 0;
  var cumData = all.map(function (m) { cumulative += m.net; return cumulative; });
  destroyChart('cumulative');
  charts.cumulative = new Chart(document.getElementById('chart-cumulative'), {
    type: 'line',
    data: {
      labels: all.map(function (m) { return m.label; }),
      datasets: [{ label: 'רווח מצטבר', data: cumData, borderColor: '#6C5CE7', backgroundColor: 'rgba(108,92,231,0.15)', fill: true, tension: 0.3 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });
}

/* ===================== INCOME / EXPENSE TABLES ===================== */

var activeFilters = { income: {}, expense: {} };

function renderFilterBar(type) {
  var container = document.getElementById('filter-' + type);
  var cats = state.categories[type];
  container.innerHTML =
    '<input type="date" id="filter-from-' + type + '"> ' +
    '<input type="date" id="filter-to-' + type + '"> ' +
    '<select id="filter-cat-' + type + '"><option value="">כל הקטגוריות</option>' +
    cats.map(function (c) { return '<option value="' + c.name + '">' + c.name + '</option>'; }).join('') +
    '</select>' +
    '<input type="text" id="filter-search-' + type + '" placeholder="חיפוש בתיאור">';

  ['filter-from-', 'filter-to-', 'filter-cat-', 'filter-search-'].forEach(function (prefix) {
    document.getElementById(prefix + type).addEventListener('input', function () { renderTxTable(type); });
  });
}

function filteredTx(type) {
  var from = document.getElementById('filter-from-' + type) ? document.getElementById('filter-from-' + type).value : '';
  var to = document.getElementById('filter-to-' + type) ? document.getElementById('filter-to-' + type).value : '';
  var cat = document.getElementById('filter-cat-' + type) ? document.getElementById('filter-cat-' + type).value : '';
  var search = document.getElementById('filter-search-' + type) ? document.getElementById('filter-search-' + type).value.trim().toLowerCase() : '';

  return getTx(type).filter(function (t) {
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    if (cat && t.category !== cat) return false;
    if (search && (t.description || '').toLowerCase().indexOf(search) === -1) return false;
    return true;
  }).sort(function (a, b) { return b.date.localeCompare(a.date); });
}

function renderTxTable(type) {
  var filterBar = document.getElementById('filter-' + type);
  if (filterBar && !filterBar.hasChildNodes()) renderFilterBar(type);

  var list = filteredTx(type);
  var tbody = document.querySelector('#table-' + type + ' tbody');
  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">אין רשומות להצגה</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(function (t) {
    var color = categoryColor(type, t.category);
    return '<tr>' +
      '<td>' + fmtDate(t.date) + '</td>' +
      '<td><span class="cat-badge" style="background:' + color + '">' + t.category + '</span></td>' +
      '<td>' + (t.description || '') + '</td>' +
      '<td>' + (t.source === 'cardcom' ? 'קארד קום' : 'ידני') + '</td>' +
      '<td class="amount-' + type + '">' + fmtCurrency(t.amount) + '</td>' +
      '<td class="row-actions">' +
        '<button title="עריכה" onclick="editTx(\'' + t.id + '\')">✏️</button>' +
        '<button title="מחיקה" onclick="deleteTx(\'' + t.id + '\')">🗑️</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

/* ===================== TX MODAL (ADD/EDIT) ===================== */

function openTxModal(type, id) {
  document.getElementById('modal-title').textContent = (id ? 'עריכת ' : 'הוספת ') + (type === 'income' ? 'הכנסה' : 'הוצאה');
  document.getElementById('tx-type').value = type;
  document.getElementById('tx-id').value = id || '';

  var catSelect = document.getElementById('tx-category');
  catSelect.innerHTML = state.categories[type].map(function (c) { return '<option value="' + c.name + '">' + c.name + '</option>'; }).join('');

  if (id) {
    var tx = state.transactions.find(function (t) { return t.id === id; });
    document.getElementById('tx-date').value = tx.date;
    document.getElementById('tx-amount').value = tx.amount;
    catSelect.value = tx.category;
    document.getElementById('tx-description').value = tx.description || '';
  } else {
    document.getElementById('tx-date').value = todayIso();
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-description').value = '';
  }
  document.getElementById('modal-overlay').classList.add('active');
}

function closeTxModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

function editTx(id) {
  var tx = state.transactions.find(function (t) { return t.id === id; });
  if (tx) openTxModal(tx.type, id);
}

function deleteTx(id) {
  if (!confirm('למחוק את הרשומה?')) return;
  state.transactions = state.transactions.filter(function (t) { return t.id !== id; });
  saveState();
  renderTxTable('income');
  renderTxTable('expense');
  toast('הרשומה נמחקה');
}

function saveTx() {
  var type = document.getElementById('tx-type').value;
  var id = document.getElementById('tx-id').value;
  var date = document.getElementById('tx-date').value;
  var amount = parseFloat(document.getElementById('tx-amount').value);
  var category = document.getElementById('tx-category').value;
  var description = document.getElementById('tx-description').value.trim();

  if (!date || isNaN(amount) || amount <= 0) {
    toast('נא למלא תאריך וסכום תקין');
    return;
  }

  if (id) {
    var tx = state.transactions.find(function (t) { return t.id === id; });
    tx.date = date; tx.amount = amount; tx.category = category; tx.description = description;
  } else {
    state.transactions.push({ id: uid(), type: type, date: date, amount: amount, category: category, description: description, source: 'manual' });
  }
  saveState();
  closeTxModal();
  renderTxTable(type);
  toast('נשמר בהצלחה');
}

/* ===================== P&L ===================== */

function renderPnl() {
  var monthly = monthlyBreakdown();
  var tbody = document.querySelector('#table-pnl tbody');
  if (monthly.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">אין נתונים עדיין</td></tr>';
  } else {
    var cumulative = 0;
    tbody.innerHTML = monthly.map(function (m) {
      cumulative += m.net;
      var netClass = m.net >= 0 ? 'amount-income' : 'amount-expense';
      var cumClass = cumulative >= 0 ? 'amount-income' : 'amount-expense';
      return '<tr>' +
        '<td>' + m.label + '</td>' +
        '<td class="amount-income">' + fmtCurrency(m.income) + '</td>' +
        '<td class="amount-expense">' + fmtCurrency(m.expense) + '</td>' +
        '<td class="' + netClass + '">' + fmtCurrency(m.net) + '</td>' +
        '<td class="' + cumClass + '">' + fmtCurrency(cumulative) + '</td>' +
      '</tr>';
    }).join('');
  }

  destroyChart('pnl');
  charts.pnl = new Chart(document.getElementById('chart-pnl'), {
    type: 'bar',
    data: {
      labels: monthly.map(function (m) { return m.label; }),
      datasets: [{
        label: 'רווח/הפסד',
        data: monthly.map(function (m) { return m.net; }),
        backgroundColor: monthly.map(function (m) { return m.net >= 0 ? '#00B894' : '#D63031'; }),
        borderRadius: 6
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });
}

/* ===================== CARDCOM IMPORT ===================== */

var importParsed = { headers: [], rows: [] };

function initImport() {
  var dropZone = document.getElementById('drop-zone');
  var fileInput = document.getElementById('file-input');

  dropZone.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function (e) {
    if (e.target.files[0]) handleImportFile(e.target.files[0]);
  });
  dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('dragover'); });
  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleImportFile(e.dataTransfer.files[0]);
  });
}

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;

  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\r') {
      // ignore, \n handles line break
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
}

function handleImportFile(file) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var rows;
    try {
      rows = parseCSV(String(e.target.result));
    } catch (err) {
      toast('לא ניתן לקרוא את הקובץ');
      return;
    }
    if (rows.length < 2) {
      toast('הקובץ ריק או לא תקין');
      return;
    }
    var headers = rows[0].map(function (h) { return String(h).trim(); });
    var dataRows = rows.slice(1);
    importParsed = { headers: headers, rows: dataRows, fileName: file.name };
    showImportMapping();
  };
  reader.readAsText(file, 'UTF-8');
}

function showImportMapping() {
  document.getElementById('import-mapping').style.display = 'block';

  var fields = [
    { key: 'date', label: 'תאריך' },
    { key: 'amount', label: 'סכום' },
    { key: 'description', label: 'תיאור / שם לקוח' },
    { key: 'reference', label: 'מספר אסמכתא (למניעת כפילויות)' }
  ];

  var guesses = {
    date: findHeaderGuess(['תאריך', 'date']),
    amount: findHeaderGuess(['סכום', 'amount', 'total', 'סה"כ']),
    description: findHeaderGuess(['לקוח', 'תיאור', 'name', 'description', 'שם']),
    reference: findHeaderGuess(['אסמכתא', 'מספר עסקה', 'reference', 'id', 'מספר'])
  };

  var container = document.getElementById('mapping-fields');
  container.innerHTML = fields.map(function (f) {
    var options = '<option value="">— לא רלוונטי —</option>' + importParsed.headers.map(function (h, i) {
      return '<option value="' + i + '"' + (guesses[f.key] === i ? ' selected' : '') + '>' + h + '</option>';
    }).join('');
    return '<div class="field-col"><label>' + f.label + '</label><select id="map-' + f.key + '">' + options + '</select></div>';
  }).join('');

  var catSelect = document.getElementById('import-category');
  var typeSelect = document.getElementById('import-type');
  function refreshCategoryOptions() {
    var type = typeSelect.value;
    catSelect.innerHTML = state.categories[type].map(function (c) { return '<option value="' + c.name + '">' + c.name + '</option>'; }).join('');
  }
  typeSelect.onchange = refreshCategoryOptions;
  refreshCategoryOptions();

  renderImportPreview();
  container.querySelectorAll('select').forEach(function (s) { s.addEventListener('change', renderImportPreview); });
}

function findHeaderGuess(keywords) {
  for (var i = 0; i < importParsed.headers.length; i++) {
    var h = importParsed.headers[i].toLowerCase();
    for (var j = 0; j < keywords.length; j++) {
      if (h.indexOf(keywords[j].toLowerCase()) !== -1) return i;
    }
  }
  return -1;
}

function renderImportPreview() {
  var thead = document.querySelector('#preview-table thead');
  var tbody = document.querySelector('#preview-table tbody');
  thead.innerHTML = '<tr>' + importParsed.headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>';
  tbody.innerHTML = importParsed.rows.slice(0, 5).map(function (r) {
    return '<tr>' + importParsed.headers.map(function (_, i) { return '<td>' + (r[i] !== undefined ? r[i] : '') + '</td>'; }).join('') + '</tr>';
  }).join('');
}

function parseAmount(v) {
  if (v === undefined || v === null) return NaN;
  var cleaned = String(v).replace(/[^\d.\-]/g, '');
  return parseFloat(cleaned);
}

function parseDateValue(v) {
  if (!v) return '';
  var s = String(v).trim();
  var m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})$/);
  if (m) {
    var y = m[3].length === 2 ? '20' + m[3] : m[3];
    return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  }
  var m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return m2[0].slice(0, 10);
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

function runImport() {
  var dateIdx = document.getElementById('map-date').value;
  var amountIdx = document.getElementById('map-amount').value;
  var descIdx = document.getElementById('map-description').value;
  var refIdx = document.getElementById('map-reference').value;
  var type = document.getElementById('import-type').value;
  var category = document.getElementById('import-category').value;

  if (amountIdx === '' || dateIdx === '') {
    toast('חובה לשייך עמודות תאריך וסכום');
    return;
  }

  var existingRefs = {};
  state.transactions.forEach(function (t) { if (t.refNumber) existingRefs[t.refNumber] = true; });

  var imported = 0, skipped = 0;
  var batchId = uid();

  importParsed.rows.forEach(function (r) {
    var date = parseDateValue(r[dateIdx]);
    var amount = parseAmount(r[amountIdx]);
    if (!date || isNaN(amount) || amount === 0) { skipped++; return; }
    var ref = refIdx !== '' ? String(r[refIdx]) : (date + '_' + amount);
    if (existingRefs[ref]) { skipped++; return; }
    existingRefs[ref] = true;

    state.transactions.push({
      id: uid(),
      type: type,
      date: date,
      amount: Math.abs(amount),
      category: category,
      description: descIdx !== '' ? String(r[descIdx]) : 'ייבוא מקארד קום',
      source: 'cardcom',
      refNumber: ref,
      importBatchId: batchId
    });
    imported++;
  });

  state.importHistory.push({ id: batchId, date: todayIso(), fileName: importParsed.fileName, type: type, count: imported });
  saveState();

  document.getElementById('import-result').textContent = 'יובאו ' + imported + ' רשומות, דולגו ' + skipped + ' (כפילויות/שגויות)';
  renderImportHistory();
  toast('הייבוא הושלם: ' + imported + ' רשומות');
}

function renderImportHistory() {
  var tbody = document.querySelector('#table-import-history tbody');
  if (state.importHistory.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">אין היסטוריית ייבוא</td></tr>';
    return;
  }
  tbody.innerHTML = state.importHistory.slice().reverse().map(function (h) {
    return '<tr>' +
      '<td>' + fmtDate(h.date) + '</td>' +
      '<td>' + h.fileName + '</td>' +
      '<td>' + (h.type === 'income' ? 'הכנסה' : 'הוצאה') + '</td>' +
      '<td>' + h.count + '</td>' +
      '<td class="row-actions"><button title="ביטול ייבוא זה" onclick="undoImport(\'' + h.id + '\')">↩️</button></td>' +
    '</tr>';
  }).join('');
}

function undoImport(batchId) {
  if (!confirm('להסיר את כל הרשומות שיובאו באצווה הזו?')) return;
  state.transactions = state.transactions.filter(function (t) { return t.importBatchId !== batchId; });
  state.importHistory = state.importHistory.filter(function (h) { return h.id !== batchId; });
  saveState();
  renderImportHistory();
  toast('הייבוא בוטל');
}

/* ===================== REPORTS / EXPORT ===================== */

function reportFilteredTx() {
  var from = document.getElementById('report-from').value;
  var to = document.getElementById('report-to').value;
  var type = document.getElementById('report-type').value;

  return state.transactions.filter(function (t) {
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    if (type !== 'all' && t.type !== type) return false;
    return true;
  }).sort(function (a, b) { return a.date.localeCompare(b.date); });
}

function renderReportTable() {
  ['report-from', 'report-to', 'report-type'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el.dataset.bound) {
      el.addEventListener('change', renderReportTable);
      el.dataset.bound = '1';
    }
  });

  var list = reportFilteredTx();
  var tbody = document.querySelector('#table-report tbody');
  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">אין רשומות בטווח שנבחר</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(function (t) {
    return '<tr>' +
      '<td>' + fmtDate(t.date) + '</td>' +
      '<td>' + (t.type === 'income' ? 'הכנסה' : 'הוצאה') + '</td>' +
      '<td>' + t.category + '</td>' +
      '<td>' + (t.description || '') + '</td>' +
      '<td>' + (t.source === 'cardcom' ? 'קארד קום' : 'ידני') + '</td>' +
      '<td class="amount-' + t.type + '">' + fmtCurrency(t.amount) + '</td>' +
    '</tr>';
  }).join('');
}

function exportCSV() {
  var list = reportFilteredTx();
  if (list.length === 0) { toast('אין נתונים לייצוא'); return; }

  var header = ['תאריך', 'סוג', 'קטגוריה', 'תיאור', 'מקור', 'סכום'];
  var lines = [header.join(',')];
  list.forEach(function (t) {
    var row = [
      fmtDate(t.date),
      t.type === 'income' ? 'הכנסה' : 'הוצאה',
      t.category,
      '"' + (t.description || '').replace(/"/g, '""') + '"',
      t.source === 'cardcom' ? 'קארד קום' : 'ידני',
      t.amount
    ];
    lines.push(row.join(','));
  });

  var csv = '﻿' + lines.join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'דוח_פיננסי_' + todayIso() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('הדוח יוצא בהצלחה');
}

function printReport() {
  var list = reportFilteredTx();
  var totalIncome = totalOf(list.filter(function (t) { return t.type === 'income'; }));
  var totalExpense = totalOf(list.filter(function (t) { return t.type === 'expense'; }));

  var win = window.open('', '_blank');
  var rowsHtml = list.map(function (t) {
    return '<tr>' +
      '<td>' + fmtDate(t.date) + '</td>' +
      '<td>' + (t.type === 'income' ? 'הכנסה' : 'הוצאה') + '</td>' +
      '<td>' + t.category + '</td>' +
      '<td>' + (t.description || '') + '</td>' +
      '<td>' + fmtCurrency(t.amount) + '</td>' +
    '</tr>';
  }).join('');

  win.document.write(
    '<html dir="rtl" lang="he"><head><meta charset="UTF-8"><title>דוח פיננסי</title>' +
    '<style>body{font-family:Arial;padding:30px;} h1{margin-bottom:0;} table{width:100%;border-collapse:collapse;margin-top:20px;} ' +
    'th,td{border:1px solid #ccc;padding:8px;text-align:right;} th{background:#f0f0f0;} .summary{margin-top:16px;font-size:15px;}</style>' +
    '</head><body>' +
    '<h1>דוח פיננסי</h1><p>הופק בתאריך ' + fmtDate(todayIso()) + '</p>' +
    '<div class="summary"><b>סה"כ הכנסות:</b> ' + fmtCurrency(totalIncome) + ' &nbsp;&nbsp; ' +
    '<b>סה"כ הוצאות:</b> ' + fmtCurrency(totalExpense) + ' &nbsp;&nbsp; ' +
    '<b>רווח נקי:</b> ' + fmtCurrency(totalIncome - totalExpense) + '</div>' +
    '<table><thead><tr><th>תאריך</th><th>סוג</th><th>קטגוריה</th><th>תיאור</th><th>סכום</th></tr></thead>' +
    '<tbody>' + rowsHtml + '</tbody></table>' +
    '</body></html>'
  );
  win.document.close();
  win.focus();
  setTimeout(function () { win.print(); }, 300);
}

/* ===================== SETTINGS ===================== */

function renderSettings() {
  renderCategoryList('income');
  renderCategoryList('expense');
}

function renderCategoryList(type) {
  var container = document.getElementById('cat-list-' + type);
  container.innerHTML = state.categories[type].map(function (c, i) {
    return '<span class="cat-badge" style="background:' + c.color + ';margin:3px;display:inline-flex;align-items:center;gap:6px">' +
      c.name + ' <button onclick="removeCategory(\'' + type + '\', ' + i + ')" style="background:none;border:none;color:#fff;cursor:pointer;font-weight:bold">×</button></span>';
  }).join('');
}

function addCategory(type) {
  var input = document.getElementById('new-cat-' + type);
  var name = input.value.trim();
  if (!name) return;
  if (state.categories[type].some(function (c) { return c.name === name; })) { toast('קטגוריה כבר קיימת'); return; }
  var color = PALETTE[state.categories[type].length % PALETTE.length];
  state.categories[type].push({ name: name, color: color });
  saveState();
  input.value = '';
  renderCategoryList(type);
  toast('קטגוריה נוספה');
}

function removeCategory(type, index) {
  var cat = state.categories[type][index];
  var inUse = state.transactions.some(function (t) { return t.type === type && t.category === cat.name; });
  if (inUse && !confirm('הקטגוריה "' + cat.name + '" בשימוש ברשומות קיימות. למחוק בכל זאת?')) return;
  state.categories[type].splice(index, 1);
  saveState();
  renderCategoryList(type);
}

function backupData() {
  var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'גיבוי_פיננסי_' + todayIso() + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('הגיבוי הורד בהצלחה');
}

function initRestore() {
  document.getElementById('restore-input').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    if (!confirm('שחזור גיבוי יחליף את כל הנתונים הנוכחיים. להמשיך?')) { e.target.value = ''; return; }
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var data = JSON.parse(ev.target.result);
        state = data;
        saveState();
        toast('השחזור הושלם');
        renderView(document.querySelector('.nav-btn.active').getAttribute('data-view'));
      } catch (err) {
        toast('קובץ הגיבוי אינו תקין');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

function resetAllData() {
  if (!confirm('פעולה זו תמחק את כל הנתונים לצמיתות. להמשיך?')) return;
  if (!confirm('אישור אחרון: למחוק את כל ההכנסות, ההוצאות וההיסטוריה?')) return;
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  saveState();
  toast('כל הנתונים אופסו');
  renderView(document.querySelector('.nav-btn.active').getAttribute('data-view'));
}

/* ===================== INIT ===================== */

document.addEventListener('DOMContentLoaded', function () {
  loadState();
  initNav();
  initImport();
  initRestore();

  var to = todayIso();
  var from = new Date();
  from.setMonth(from.getMonth() - 1);
  document.getElementById('report-from').value = from.toISOString().slice(0, 10);
  document.getElementById('report-to').value = to;

  renderDashboard();
});
