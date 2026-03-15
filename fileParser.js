const path = require('path');

// ── Parse uploaded file into raw data ────────────────────────────────────────
async function parseFile(buffer, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.pdf') {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return { text: data.text, type: 'pdf', pages: data.numpages };
    } catch (e) {
      return { text: buffer.toString('utf8', 0, 50000), type: 'pdf', error: e.message };
    }
  }

  if (['.xlsx','.xls','.csv'].includes(ext)) {
    try {
      const XLSX = require('xlsx');
      const wb = XLSX.read(buffer, { type:'buffer' });
      let text = '';
      const sheets = {};
      wb.SheetNames.forEach(name => {
        const ws = wb.Sheets[name];
        sheets[name] = XLSX.utils.sheet_to_json(ws, { defval:'' });
        text += `\n=== Sheet: ${name} ===\n${XLSX.utils.sheet_to_csv(ws)}\n`;
      });
      return { text, type: ext.replace('.',''), sheets, sheetNames: wb.SheetNames };
    } catch (e) {
      return { text:'', type: ext.replace('.',''), error: e.message };
    }
  }

  if (['.docx','.doc'].includes(ext)) {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value, type:'docx' };
    } catch (e) {
      return { text:'', type:'docx', error: e.message };
    }
  }

  return { text: buffer.toString('utf8', 0, 10000), type: ext.replace('.','') };
}

// ── Extract single-investment fields from text ────────────────────────────────
function extractFields(text) {
  const num = (patterns) => {
    for (const p of patterns) {
      const m = text.match(new RegExp(p + '[\\s:=₹Rs.]*([\\d,]+(?:\\.\\d{1,4})?)', 'i'));
      if (m) return m[1].replace(/,/g,'');
    }
    return '';
  };
  const str = (patterns) => {
    for (const p of patterns) {
      const m = text.match(new RegExp(p + '[\\s:=]*([\\w\\s\\.\\-&()]+?)(?:\\n|,|\\|)', 'i'));
      if (m) return m[1].trim().slice(0,100);
    }
    return '';
  };

  return {
    fundName:        str(['Fund Name','Scheme Name','Fund:','Name of Fund','Scheme:']),
    manager:         str(['Asset Management','AMC','Investment Manager','Manager:']),
    nav:             num(['NAV','Net Asset Value per unit','Unit NAV']),
    units:           num(['Units held','No\\.? of units','Balance Units','Units:']),
    amountInvested:  num(['Amount Invested','Purchase Amount','Invested Amount','Total Investment','Cost']),
    currentMTM:      num(['Current Value','Market Value','Portfolio Value','Current Market','MTM']),
    unrealisedPL:    num(['Unrealised','Unrealized','Gain','P&L']),
    managementFeeAmt:num(['Management Fee','Advisory Fee']),
    carryAmt:        num(['Carry','Performance Fee','Profit Share']),
    brokerageAmt:    num(['Brokerage','Commission']),
    otherFeesAmt:    num(['Other Fee','Misc Fee','Stamp Duty']),
    committed:       num(['Committed Capital','Total Commitment','Commitment']),
    called:          num(['Called Capital','Capital Called','Paid-in','Drawdown']),
    uncalled:        num(['Uncalled','Undrawn','Remaining Commitment']),
    realisedValue:   num(['Realised','Distributed','Distribution Amount','Proceeds']),
    dpi:             num(['DPI']),
    tvpi:            num(['TVPI','Investment Multiple']),
    moic:            num(['MOIC','Multiple']),
    irr:             num(['IRR','Net IRR','Internal Rate']),
    xirr:            num(['XIRR']),
    couponRate:      num(['Coupon','Rate of Interest','Interest Rate']),
    interestReceived:num(['Interest Received','Interest Income','Coupon Received']),
    principalReceived:num(['Principal Received','Principal Repaid','Principal Repayment']),
    creditRating:    str(['Rating','Credit Rating','Rated']),
    currency:        (text.match(/\b(INR|USD|EUR|GBP|SGD)\b/)||[])[1]||'INR',
    maturityDate:    (text.match(/[Mm]aturity[^:]*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}-\d{2}-\d{2})/)||[])[1]||'',
    purchaseDate:    (text.match(/(?:Purchase|Investment|Trade)[^:]*Date[^:]*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}-\d{2}-\d{2})/i)||[])[1]||'',
  };
}

// ── Detect and extract MULTIPLE investment rows from Excel ────────────────────
// Returns array of candidate rows ready for admin confirmation
function extractMultipleRows(sheets, targetSchema) {
  if (!sheets) return { candidates: [], unknownColumns: [] };

  const candidates = [];
  const unknownColumns = new Set();
  const allErrors = [];

  // Column name mappings (what fund statements call things)
  const COL_MAP = {
    // Identity
    'scheme name':  'fundName', 'fund name': 'fundName', 'name': 'fundName',
    'company': 'fundName', 'security': 'fundName', 'stock': 'fundName',
    'isin': 'isin', 'ticker': 'ticker', 'symbol': 'ticker',
    // Dates
    'purchase date': 'purchaseDate', 'investment date': 'purchaseDate', 'trade date': 'purchaseDate',
    'date': 'purchaseDate', 'nav date': 'purchaseDate',
    'maturity date': 'maturityDate', 'maturity': 'maturityDate',
    // Amounts
    'amount invested': 'amountInvested', 'invested amount': 'amountInvested',
    'purchase amount': 'amountInvested', 'cost': 'amountInvested', 'cost value': 'amountInvested',
    'total investment': 'amountInvested', 'principal': 'amountInvested',
    'current value': 'currentMTM', 'market value': 'currentMTM', 'portfolio value': 'currentMTM',
    'current market value': 'currentMTM', 'mtm': 'currentMTM', 'nav value': 'currentMTM',
    'gain': 'unrealisedPL', 'unrealised gain': 'unrealisedPL', 'p&l': 'unrealisedPL',
    'unrealized gain': 'unrealisedPL', 'gain/loss': 'unrealisedPL',
    'realised': 'realisedValue', 'distributed': 'realisedValue', 'proceeds': 'realisedValue',
    'committed': 'committed', 'commitment': 'committed',
    'called': 'called', 'drawdown': 'called', 'capital called': 'called',
    // Units/NAV
    'units': 'units', 'units held': 'units', 'balance units': 'units', 'quantity': 'quantity',
    'nav': 'nav', 'unit nav': 'nav', 'net asset value': 'nav',
    'avg cost': 'avgCost', 'average cost': 'avgCost', 'cost price': 'avgCost',
    // Returns
    'irr': 'irr', 'net irr': 'irr', 'xirr': 'xirr',
    'moic': 'moic', 'tvpi': 'tvpi', 'dpi': 'dpi',
    // Fees
    'management fee': 'managementFeeAmt', 'ter': 'managementFeeAmt', 'advisory fee': 'managementFeeAmt',
    'carry': 'carryAmt', 'performance fee': 'carryAmt',
    'brokerage': 'brokerageAmt', 'commission': 'brokerageAmt',
    // Debt specific
    'coupon': 'couponRate', 'coupon rate': 'couponRate', 'rate of interest': 'couponRate',
    'interest received': 'interestReceived', 'interest income': 'interestReceived',
    'principal received': 'principalReceived', 'principal repaid': 'principalReceived',
    'credit rating': 'creditRating', 'rating': 'creditRating',
    'outstanding': 'outstanding',
    // Other
    'manager': 'manager', 'amc': 'manager', 'fund house': 'manager',
    'sector': 'sector', 'asset class': 'strategy', 'strategy': 'strategy',
    'currency': 'currency', 'notes': 'notes', 'remarks': 'notes',
  };

  Object.entries(sheets).forEach(([sheetName, rows]) => {
    if (!Array.isArray(rows) || rows.length === 0) return;

    // Map columns
    const headers = Object.keys(rows[0] || {});
    const colMapping = {};
    headers.forEach(h => {
      const lower = h.toLowerCase().trim();
      if (COL_MAP[lower]) {
        colMapping[h] = COL_MAP[lower];
      } else {
        unknownColumns.add(h);
      }
    });

    // Check if this sheet looks like investment data
    const mappedCount = Object.keys(colMapping).length;
    if (mappedCount < 2) return; // too few recognized columns

    rows.forEach((row, idx) => {
      if (!row || Object.values(row).every(v => !v)) return; // skip empty rows

      const mapped = { _sourceSheet: sheetName, _sourceRow: idx + 2 };
      let hasIdentifier = false;

      Object.entries(row).forEach(([col, val]) => {
        const target = colMapping[col];
        if (target && val !== '' && val !== null && val !== undefined) {
          // Clean numeric values
          if (['amountInvested','currentMTM','unrealisedPL','realisedValue','committed','called',
               'nav','units','irr','xirr','moic','tvpi','dpi','managementFeeAmt','carryAmt',
               'brokerageAmt','couponRate','outstanding','interestReceived','principalReceived',
               'quantity','avgCost'].includes(target)) {
            const cleaned = String(val).replace(/[₹,\s%x]/g,'');
            const num = parseFloat(cleaned);
            mapped[target] = isNaN(num) ? '' : String(num);
          } else {
            mapped[target] = String(val).trim();
          }
          if (['fundName','company','isin','ticker'].includes(target)) hasIdentifier = true;
        }
      });

      if (hasIdentifier || mapped.amountInvested || mapped.currentMTM) {
        candidates.push(mapped);
      }
    });
  });

  return {
    candidates,
    unknownColumns: Array.from(unknownColumns),
    errors: allErrors,
  };
}

// ── Detect drawdown tranches (same fund, multiple dates) ─────────────────────
// Groups rows by fundName/company and returns consolidated + tranche detail
function groupDrawdowns(rows) {
  const groups = {};

  rows.forEach(row => {
    const key = row.fundName || row.company || row.borrower || row.issuer || 'Unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });

  const consolidated = [];
  Object.entries(groups).forEach(([key, tranches]) => {
    if (tranches.length === 1) {
      consolidated.push({ ...tranches[0], _trancheCount: 1 });
      return;
    }
    // Consolidate multiple tranches into one row with tranche details
    const base = { ...tranches[0] };
    const totalInvested = tranches.reduce((s, r) => s + (parseFloat(r.amountInvested||r.called||'0')||0), 0);
    const totalCurrent  = tranches.reduce((s, r) => s + (parseFloat(r.currentMTM||'0')||0), 0);
    const totalPL       = tranches.reduce((s, r) => s + (parseFloat(r.unrealisedPL||'0')||0), 0);
    const latestDate    = tranches.map(r => r.purchaseDate||'').sort().pop();

    consolidated.push({
      ...base,
      amountInvested: totalInvested > 0 ? String(totalInvested) : base.amountInvested,
      currentMTM:     totalCurrent  > 0 ? String(totalCurrent)  : base.currentMTM,
      unrealisedPL:   totalPL !== 0     ? String(totalPL)        : base.unrealisedPL,
      purchaseDate:   latestDate || base.purchaseDate,
      _trancheCount:  tranches.length,
      _tranches:      tranches.map(t => ({
        date: t.purchaseDate, amount: t.amountInvested || t.called,
        nav: t.nav, units: t.units, notes: t.notes,
      })),
    });
  });

  return consolidated;
}

// ── Detect debt warrant / fee components ─────────────────────────────────────
function extractDebtComponents(rows) {
  return rows.map(row => {
    const enhanced = { ...row };

    // Warrant: detect if row has warrant-related text
    const hasWarrant = ['warrant','warrants','OCPS','OCD','convertible','debentures'].some(kw =>
      JSON.stringify(row).toLowerCase().includes(kw)
    );
    if (hasWarrant && !row.hasWarrant) enhanced.hasWarrant = 'yes';

    // Compute total fees
    const mgmtFee   = parseFloat(row.managementFeeAmt || '0') || 0;
    const carry     = parseFloat(row.carryAmt || '0') || 0;
    const brokerage = parseFloat(row.brokerageAmt || '0') || 0;
    const other     = parseFloat(row.otherFeesAmt || '0') || 0;
    const totalFees = mgmtFee + carry + brokerage + other;
    if (totalFees > 0) enhanced.totalFeesAmt = String(totalFees);

    return enhanced;
  });
}

module.exports = { parseFile, extractFields, extractMultipleRows, groupDrawdowns, extractDebtComponents, detectTableData: (sheets) => {
  if (!sheets) return [];
  return Object.entries(sheets).map(([sheetName, rows]) => ({
    sheetName, rows: Array.isArray(rows)?rows:[], rowCount: Array.isArray(rows)?rows.length:0,
    columns: Object.keys((Array.isArray(rows)&&rows[0])||{}),
  }));
}};
