const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data');
if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });

const FILES = {
  users: path.join(DB_PATH, 'users.json'),
  investments: path.join(DB_PATH, 'investments.json'),
  benchmarks: path.join(DB_PATH, 'benchmarks.json'),
  customColumns: path.join(DB_PATH, 'customColumns.json'),
  activeBenchmarks: path.join(DB_PATH, 'activeBenchmarks.json'),
  auditLog: path.join(DB_PATH, 'auditLog.json'),
};

function read(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─── SEED DATA ───────────────────────────────────────────────────────────────
const INDIAN_BENCHMARKS = [
  { id: "nifty50", name: "NIFTY 50", exchange: "NSE", category: "Broad Market" },
  { id: "nifty100", name: "NIFTY 100", exchange: "NSE", category: "Broad Market" },
  { id: "nifty200", name: "NIFTY 200", exchange: "NSE", category: "Broad Market" },
  { id: "nifty500", name: "NIFTY 500", exchange: "NSE", category: "Broad Market" },
  { id: "nifty_midcap50", name: "NIFTY Midcap 50", exchange: "NSE", category: "Mid Cap" },
  { id: "nifty_midcap100", name: "NIFTY Midcap 100", exchange: "NSE", category: "Mid Cap" },
  { id: "nifty_midcap150", name: "NIFTY Midcap 150", exchange: "NSE", category: "Mid Cap" },
  { id: "nifty_smallcap50", name: "NIFTY Smallcap 50", exchange: "NSE", category: "Small Cap" },
  { id: "nifty_smallcap100", name: "NIFTY Smallcap 100", exchange: "NSE", category: "Small Cap" },
  { id: "nifty_smallcap250", name: "NIFTY Smallcap 250", exchange: "NSE", category: "Small Cap" },
  { id: "nifty_microcap250", name: "NIFTY Microcap 250", exchange: "NSE", category: "Micro Cap" },
  { id: "nifty_bank", name: "NIFTY Bank", exchange: "NSE", category: "Sectoral" },
  { id: "nifty_it", name: "NIFTY IT", exchange: "NSE", category: "Sectoral" },
  { id: "nifty_fmcg", name: "NIFTY FMCG", exchange: "NSE", category: "Sectoral" },
  { id: "nifty_pharma", name: "NIFTY Pharma", exchange: "NSE", category: "Sectoral" },
  { id: "nifty_auto", name: "NIFTY Auto", exchange: "NSE", category: "Sectoral" },
  { id: "nifty_metal", name: "NIFTY Metal", exchange: "NSE", category: "Sectoral" },
  { id: "nifty_realty", name: "NIFTY Realty", exchange: "NSE", category: "Sectoral" },
  { id: "nifty_energy", name: "NIFTY Energy", exchange: "NSE", category: "Sectoral" },
  { id: "nifty_infra", name: "NIFTY Infrastructure", exchange: "NSE", category: "Thematic" },
  { id: "nifty_psu_bank", name: "NIFTY PSU Bank", exchange: "NSE", category: "Sectoral" },
  { id: "nifty_pvt_bank", name: "NIFTY Private Bank", exchange: "NSE", category: "Sectoral" },
  { id: "nifty_fin_service", name: "NIFTY Financial Services", exchange: "NSE", category: "Sectoral" },
  { id: "nifty_india_mfg", name: "NIFTY India Manufacturing", exchange: "NSE", category: "Thematic" },
  { id: "nifty_cpse", name: "NIFTY CPSE", exchange: "NSE", category: "Thematic" },
  { id: "nifty_mncl", name: "NIFTY MNC", exchange: "NSE", category: "Thematic" },
  { id: "nifty_alpha_50", name: "NIFTY Alpha 50", exchange: "NSE", category: "Strategy" },
  { id: "nifty_quality_30", name: "NIFTY Quality 30", exchange: "NSE", category: "Strategy" },
  { id: "nifty_value_20", name: "NIFTY Value 20", exchange: "NSE", category: "Strategy" },
  { id: "nifty_low_vol_50", name: "NIFTY100 Low Volatility 30", exchange: "NSE", category: "Strategy" },
  { id: "nifty_eq_weight", name: "NIFTY50 Equal Weight", exchange: "NSE", category: "Strategy" },
  { id: "nifty_dividend_opp", name: "NIFTY Dividend Opportunities 50", exchange: "NSE", category: "Strategy" },
  { id: "nifty_composite_debt", name: "NIFTY Composite Debt Index", exchange: "NSE", category: "Debt" },
  { id: "nifty_gsec_10yr", name: "NIFTY 10 Yr Benchmark G-Sec", exchange: "NSE", category: "Debt" },
  { id: "nifty_short_duration", name: "NIFTY Short Duration Debt Index", exchange: "NSE", category: "Debt" },
  { id: "nifty_corporate_bond", name: "NIFTY AAA Corporate Bond", exchange: "NSE", category: "Debt" },
  { id: "sensex", name: "S&P BSE SENSEX", exchange: "BSE", category: "Broad Market" },
  { id: "bse100", name: "S&P BSE 100", exchange: "BSE", category: "Broad Market" },
  { id: "bse200", name: "S&P BSE 200", exchange: "BSE", category: "Broad Market" },
  { id: "bse500", name: "S&P BSE 500", exchange: "BSE", category: "Broad Market" },
  { id: "bse_midcap", name: "S&P BSE MidCap", exchange: "BSE", category: "Mid Cap" },
  { id: "bse_smallcap", name: "S&P BSE SmallCap", exchange: "BSE", category: "Small Cap" },
  { id: "bse_largecap", name: "S&P BSE LargeCap", exchange: "BSE", category: "Large Cap" },
  { id: "bse_bankex", name: "S&P BSE BANKEX", exchange: "BSE", category: "Sectoral" },
  { id: "bse_it", name: "S&P BSE IT", exchange: "BSE", category: "Sectoral" },
  { id: "bse_healthcare", name: "S&P BSE Healthcare", exchange: "BSE", category: "Sectoral" },
  { id: "bse_consumer_disc", name: "S&P BSE Consumer Discretionary", exchange: "BSE", category: "Sectoral" },
  { id: "bse_fmcg", name: "S&P BSE FMCG", exchange: "BSE", category: "Sectoral" },
  { id: "bse_metal", name: "S&P BSE Metal", exchange: "BSE", category: "Sectoral" },
  { id: "bse_realty", name: "S&P BSE Realty", exchange: "BSE", category: "Sectoral" },
  { id: "bse_energy", name: "S&P BSE Energy", exchange: "BSE", category: "Sectoral" },
  { id: "bse_capital_goods", name: "S&P BSE Capital Goods", exchange: "BSE", category: "Sectoral" },
  { id: "bse_auto", name: "S&P BSE Auto", exchange: "BSE", category: "Sectoral" },
  { id: "bse_teck", name: "S&P BSE TECK", exchange: "BSE", category: "Sectoral" },
  { id: "bse_sensex_nxt50", name: "S&P BSE SENSEX Next 50", exchange: "BSE", category: "Broad Market" },
  { id: "bse_dividend_stab", name: "S&P BSE Dividend Stability Index", exchange: "BSE", category: "Strategy" },
  { id: "bse_momentum", name: "S&P BSE Momentum Index", exchange: "BSE", category: "Strategy" },
  { id: "bse_quality", name: "S&P BSE Quality Index", exchange: "BSE", category: "Strategy" },
  { id: "bse_low_vol", name: "S&P BSE Low Volatility Index", exchange: "BSE", category: "Strategy" },
  { id: "bse_india_bond", name: "S&P BSE India Bond Index", exchange: "BSE", category: "Debt" },
  { id: "bse_india_gsec", name: "S&P BSE India Government Bond", exchange: "BSE", category: "Debt" },
];

const SAMPLE_INVESTMENTS = {
  equity_public_funds: [
    { id: "epf1", fundName: "Mirae Asset Large Cap Fund - Dir Growth", manager: "Mirae Asset", strategy: "Large Cap", nav: "124.56", units: "5000", costPrice: "89.40", currentMTM: "622800", unrealisedPL: "175200", xirr: "8.7", benchmark: "nifty100", managementFee: "0.52", aum: "38420", vintage: "2019", currency: "INR", notes: "" },
    { id: "epf2", fundName: "Parag Parikh Flexi Cap Fund - Dir Growth", manager: "PPFAS", strategy: "Flexi Cap", nav: "82.31", units: "8200", costPrice: "55.20", currentMTM: "674942", unrealisedPL: "222302", xirr: "14.2", benchmark: "nifty500", managementFee: "0.63", aum: "68340", vintage: "2018", currency: "INR", notes: "" },
  ],
  equity_public_direct: [
    { id: "epd1", company: "Reliance Industries Ltd", sector: "Energy", exchange: "NSE", ticker: "RELIANCE", quantity: "500", avgCost: "2340", cmp: "2885", currentMTM: "1442500", unrealisedPL: "272500", xirr: "11.3", brokerName: "Zerodha", notes: "" },
    { id: "epd2", company: "HDFC Bank Ltd", sector: "Banking", exchange: "NSE", ticker: "HDFCBANK", quantity: "1200", avgCost: "1420", cmp: "1680", currentMTM: "2016000", unrealisedPL: "312000", xirr: "9.1", brokerName: "Zerodha", notes: "" },
  ],
  equity_private_funds: [
    { id: "epvf1", fundName: "Multiples PE Fund IV", manager: "Multiples Alternate Asset Mgmt", strategy: "Buyout / Growth", vintage: "2021", committed: "50000000", called: "35000000", uncalled: "15000000", nav: "42000000", dpi: "0.22", tvpi: "1.31", rvpi: "1.09", carry: "20", hurdleRate: "8", managementFee: "2.0", benchmark: "nifty500", currency: "INR", notes: "" },
  ],
  equity_private_direct: [
    { id: "epvd1", company: "Zetwerk Manufacturing", sector: "B2B Manufacturing", stage: "Growth / Pre-IPO", dateOfInvestment: "2022-03-15", costOfAcquisition: "25000000", currentMTM: "38500000", unrealisedPL: "13500000", ownershipPct: "0.8", dilutedOwnership: "0.72", carry: "0", benchmark: "nifty_india_mfg", notes: "Series F co-invest" },
  ],
  debt_public_funds: [
    { id: "dpf1", fundName: "HDFC Short Term Debt Fund - Dir Growth", manager: "HDFC AMC", strategy: "Short Duration", nav: "28.45", units: "175000", costPrice: "24.10", currentMTM: "4978750", unrealisedPL: "760750", yieldToMaturity: "7.4", duration: "2.8", creditRating: "AAA/AA+", managementFee: "0.25", benchmark: "nifty_short_duration", currency: "INR", notes: "" },
  ],
  debt_public_direct: [
    { id: "dpd1", issuer: "NTPC Limited", isin: "INE733E07BQ3", faceValue: "1000", couponRate: "7.25", maturityDate: "2028-09-15", ytm: "7.45", currentPrice: "985", currentMTM: "4925000", unrealisedPL: "-375000", creditRating: "AAA", exchange: "BSE", settlementDate: "T+1", notes: "5000 bonds" },
  ],
  debt_private_funds: [
    { id: "dpvf1", fundName: "Edelweiss Alternative Credit Fund", manager: "Edelweiss Alternatives", strategy: "Special Situations / Performing Credit", vintage: "2022", committed: "30000000", called: "22000000", uncalled: "8000000", nav: "24800000", yield: "14.5", irr: "15.2", carry: "10", hurdleRate: "10", managementFee: "1.5", creditRating: "Mixed", benchmark: "nifty_corporate_bond", currency: "INR", notes: "" },
  ],
  debt_private_direct: [
    { id: "dpvd1", borrower: "IndiGrid InvIT", instrumentType: "Secured NCD", disbursementDate: "2023-06-01", tenor: "36 months", couponRate: "11.5", outstanding: "10000000", currentMTM: "10420000", irr: "11.5", security: "First charge on project assets", creditRating: "AA", carry: "0", maturityDate: "2026-06-01", notes: "" },
  ],
  treasury_liquid: [
    { id: "tl1", instrument: "Overnight Fund - SBI", issuer: "SBI AMC", amount: "50000000", yield: "6.8", maturityDate: "Rolling", creditRating: "AAA", notes: "Sweep account linked" },
  ],
  treasury_fixedDeposit: [
    { id: "tfd1", bank: "HDFC Bank", amount: "25000000", interestRate: "7.25", startDate: "2024-01-15", maturityDate: "2025-01-15", tenor: "12 months", interestType: "Cumulative", tds: "Yes", notes: "" },
    { id: "tfd2", bank: "ICICI Bank", amount: "15000000", interestRate: "7.10", startDate: "2024-03-01", maturityDate: "2025-03-01", tenor: "12 months", interestType: "Quarterly Payout", tds: "Yes", notes: "" },
  ],
  treasury_gsec: [
    { id: "tg1", instrument: "6.54% GS 2032", isin: "IN0020210053", faceValue: "1000", couponRate: "6.54", ytm: "7.12", maturityDate: "2032-01-17", currentMTM: "9650000", exchange: "NSE", notes: "10000 units" },
  ],
  treasury_mf: [
    { id: "tmf1", fundName: "Nippon India Liquid Fund - Dir Growth", manager: "Nippon India AMC", nav: "6024.55", units: "830", costPrice: "5780.20", currentMTM: "5000376", unrealisedPL: "202829", managementFee: "0.17", benchmark: "nifty_composite_debt", notes: "" },
  ],
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function initDB() {
  if (!read(FILES.users)) {
    const adminHash = await bcrypt.hash('Admin@123', 10);
    const u1Hash = await bcrypt.hash('User1@123', 10);
    const u2Hash = await bcrypt.hash('User2@123', 10);
    const u3Hash = await bcrypt.hash('User3@123', 10);
    const u4Hash = await bcrypt.hash('User4@123', 10);
    const u5Hash = await bcrypt.hash('User5@123', 10);

    write(FILES.users, [
      { id: 'admin', name: 'Admin', email: 'admin@familyoffice.in', passwordHash: adminHash, role: 'admin', permissions: { equity: true, debt: true, treasury: true }, active: true, createdAt: new Date().toISOString() },
      { id: 'u1', name: 'User 1', email: 'user1@familyoffice.in', passwordHash: u1Hash, role: 'user', permissions: { equity: true, debt: true, treasury: false }, active: true, createdAt: new Date().toISOString() },
      { id: 'u2', name: 'User 2', email: 'user2@familyoffice.in', passwordHash: u2Hash, role: 'user', permissions: { equity: true, debt: false, treasury: false }, active: true, createdAt: new Date().toISOString() },
      { id: 'u3', name: 'User 3', email: 'user3@familyoffice.in', passwordHash: u3Hash, role: 'user', permissions: { equity: false, debt: true, treasury: false }, active: true, createdAt: new Date().toISOString() },
      { id: 'u4', name: 'User 4', email: 'user4@familyoffice.in', passwordHash: u4Hash, role: 'user', permissions: { equity: false, debt: false, treasury: true }, active: false, createdAt: new Date().toISOString() },
      { id: 'u5', name: 'User 5', email: 'user5@familyoffice.in', passwordHash: u5Hash, role: 'user', permissions: { equity: false, debt: false, treasury: false }, active: false, createdAt: new Date().toISOString() },
    ]);
    console.log('✓ Users seeded');
  }

  if (!read(FILES.investments)) {
    write(FILES.investments, SAMPLE_INVESTMENTS);
    console.log('✓ Sample investments seeded');
  }

  if (!read(FILES.benchmarks)) {
    write(FILES.benchmarks, INDIAN_BENCHMARKS);
    console.log('✓ Benchmarks seeded (', INDIAN_BENCHMARKS.length, 'indices)');
  }

  if (!read(FILES.customColumns)) {
    write(FILES.customColumns, {});
    console.log('✓ Custom columns init');
  }

  if (!read(FILES.activeBenchmarks)) {
    write(FILES.activeBenchmarks, ['nifty50', 'sensex', 'nifty500']);
    console.log('✓ Active benchmarks init');
  }

  if (!read(FILES.auditLog)) {
    write(FILES.auditLog, []);
  }
}

// ─── AUDIT ────────────────────────────────────────────────────────────────────
function logAudit(userId, action, details) {
  const log = read(FILES.auditLog) || [];
  log.unshift({ id: Date.now().toString(), userId, action, details, timestamp: new Date().toISOString() });
  write(FILES.auditLog, log.slice(0, 500)); // keep last 500
}

// ─── USER OPS ─────────────────────────────────────────────────────────────────
function getUsers() { return read(FILES.users) || []; }
function getUserById(id) { return getUsers().find(u => u.id === id); }
function getUserByEmail(email) { return getUsers().find(u => u.email === email); }

async function createUser({ name, email, password, role, permissions, active }) {
  const users = getUsers();
  if (users.find(u => u.email === email)) throw new Error('Email already exists');
  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: 'u' + Date.now(), name, email, passwordHash, role: role || 'user', permissions: permissions || { equity: false, debt: false, treasury: false }, active: active !== false, createdAt: new Date().toISOString() };
  write(FILES.users, [...users, user]);
  return user;
}

async function updateUser(id, updates) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) throw new Error('User not found');
  if (updates.password) {
    updates.passwordHash = await bcrypt.hash(updates.password, 10);
    delete updates.password;
  }
  users[idx] = { ...users[idx], ...updates, id };
  write(FILES.users, users);
  return users[idx];
}

// ─── INVESTMENT OPS ───────────────────────────────────────────────────────────
function getInvestments() { return read(FILES.investments) || {}; }

function getInvestmentsByKey(key) {
  const all = getInvestments();
  return all[key] || [];
}

function updateInvestmentKey(key, data) {
  const all = getInvestments();
  all[key] = data;
  write(FILES.investments, all);
  return data;
}

function addInvestmentRow(key, row) {
  const rows = getInvestmentsByKey(key);
  const newRow = { ...row, id: row.id || 'r' + Date.now() };
  rows.push(newRow);
  updateInvestmentKey(key, rows);
  return newRow;
}

function updateInvestmentRow(key, rowId, updates) {
  const rows = getInvestmentsByKey(key);
  const idx = rows.findIndex(r => r.id === rowId);
  if (idx === -1) throw new Error('Row not found');
  rows[idx] = { ...rows[idx], ...updates, id: rowId };
  updateInvestmentKey(key, rows);
  return rows[idx];
}

function deleteInvestmentRow(key, rowId) {
  const rows = getInvestmentsByKey(key).filter(r => r.id !== rowId);
  updateInvestmentKey(key, rows);
}

// ─── SCHEMA OPS ───────────────────────────────────────────────────────────────
function getCustomColumns() { return read(FILES.customColumns) || {}; }
function addCustomColumn(path, colKey, label) {
  const cols = getCustomColumns();
  if (!cols[path]) cols[path] = [];
  if (!cols[path].includes(colKey)) cols[path].push(colKey);
  write(FILES.customColumns, cols);
  return cols;
}

// ─── BENCHMARK OPS ────────────────────────────────────────────────────────────
function getBenchmarks() { return read(FILES.benchmarks) || []; }
function getActiveBenchmarks() { return read(FILES.activeBenchmarks) || []; }
function setActiveBenchmarks(ids) { write(FILES.activeBenchmarks, ids); return ids; }

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────
function getAuditLog(limit = 100) { return (read(FILES.auditLog) || []).slice(0, limit); }

module.exports = {
  DB_PATH,
  initDB, logAudit,
  getUsers, getUserById, getUserByEmail, createUser, updateUser,
  getInvestments, getInvestmentsByKey, updateInvestmentKey, addInvestmentRow, updateInvestmentRow, deleteInvestmentRow,
  getCustomColumns, addCustomColumn,
  getBenchmarks, getActiveBenchmarks, setActiveBenchmarks,
  getAuditLog,
};

// ─── NAVIGATION LABELS ────────────────────────────────────────────────────────
const NAV_LABELS_FILE = path.join(DB_PATH, 'navLabels.json');

const DEFAULT_NAV_LABELS = {
  equity: 'Equity',
  equity_public: 'Public Equity',
  equity_public_funds: 'Funds',
  equity_public_direct: 'Direct / Listed',
  equity_private: 'Private Equity',
  equity_private_funds: 'PE Funds',
  equity_private_direct: 'Direct / Co-invest',
  debt: 'Debt',
  debt_public: 'Public Debt',
  debt_public_funds: 'Debt Mutual Funds',
  debt_public_direct: 'Direct / Listed Bonds',
  debt_private: 'Private Debt',
  debt_private_funds: 'Private Credit Funds',
  debt_private_direct: 'Direct Lending / NCDs',
  treasury: 'Treasury',
  treasury_liquid: 'Liquid / Overnight',
  treasury_fixedDeposit: 'Fixed Deposits',
  treasury_gsec: 'G-Secs / T-Bills',
  treasury_mf: 'Liquid / Arbitrage MF',
};

function getNavLabels() {
  return read(NAV_LABELS_FILE) || DEFAULT_NAV_LABELS;
}

function updateNavLabel(key, label) {
  const labels = getNavLabels();
  labels[key] = label;
  write(NAV_LABELS_FILE, labels);
  return labels;
}

function resetNavLabels() {
  write(NAV_LABELS_FILE, DEFAULT_NAV_LABELS);
  return DEFAULT_NAV_LABELS;
}

// ─── EMAIL INVITATIONS ────────────────────────────────────────────────────────
const INVITES_FILE = path.join(DB_PATH, 'invites.json');

function getInvites() { return read(INVITES_FILE) || []; }

function createInvite({ email, name, role, permissions, invitedBy }) {
  const invites = getInvites();
  const existing = invites.find(i => i.email === email && i.status === 'pending');
  if (existing) {
    // Refresh token
    existing.token = require('crypto').randomBytes(32).toString('hex');
    existing.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    write(INVITES_FILE, invites);
    return existing;
  }
  const invite = {
    id: 'inv_' + Date.now(),
    email, name, role: role || 'user',
    permissions: permissions || { equity: false, debt: false, treasury: false },
    invitedBy,
    token: require('crypto').randomBytes(32).toString('hex'),
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  };
  invites.push(invite);
  write(INVITES_FILE, invites);
  return invite;
}

function getInviteByToken(token) {
  return getInvites().find(i => i.token === token && i.status === 'pending');
}

async function acceptInvite(token, password) {
  const invites = getInvites();
  const idx = invites.findIndex(i => i.token === token && i.status === 'pending');
  if (idx === -1) throw new Error('Invite not found or already used');
  const invite = invites[idx];
  if (new Date(invite.expiresAt) < new Date()) throw new Error('Invite has expired');

  // Create user
  const user = await createUser({
    name: invite.name,
    email: invite.email,
    password,
    role: invite.role,
    permissions: invite.permissions,
    active: true,
  });

  invites[idx].status = 'accepted';
  invites[idx].acceptedAt = new Date().toISOString();
  write(INVITES_FILE, invites);
  return user;
}

function revokeInvite(id) {
  const invites = getInvites();
  const idx = invites.findIndex(i => i.id === id);
  if (idx !== -1) { invites[idx].status = 'revoked'; write(INVITES_FILE, invites); }
}


module.exports = {
  DB_PATH,
  initDB, logAudit,
  getUsers, getUserById, getUserByEmail, createUser, updateUser,
  getInvestments, getInvestmentsByKey, updateInvestmentKey, addInvestmentRow, updateInvestmentRow, deleteInvestmentRow,
  getCustomColumns, addCustomColumn,
  getBenchmarks, getActiveBenchmarks, setActiveBenchmarks,
  getAuditLog,
  getNavLabels, updateNavLabel, resetNavLabels,
  getInvites, createInvite, getInviteByToken, acceptInvite, revokeInvite,
};

// ─── DOCUMENT DATABASE ────────────────────────────────────────────────────────
// Structure:
//   docDb.json = {
//     folders: [ { id, name, entityId, entityType, entityLabel, createdBy, createdAt, description } ],
//     files:   [ { id, folderId, filename, originalName, size, uploadedAt, uploadedBy,
//                  readData: bool, extractedData: {}, notes, tags } ]
//   }

const DOC_DB_FILE = path.join(DB_PATH, 'docDb.json');

function getDocDb() {
  return read(DOC_DB_FILE) || { folders: [], files: [] };
}
function saveDocDb(db) { write(DOC_DB_FILE, db); }

// Folders
function getFolders(entityId) {
  const db = getDocDb();
  return entityId ? db.folders.filter(f => f.entityId === entityId) : db.folders;
}

function createFolder({ name, entityId, entityType, entityLabel, createdBy, description }) {
  const db = getDocDb();
  const folder = {
    id: 'folder_' + Date.now(),
    name, entityId, entityType, entityLabel,
    createdBy, description: description || '',
    createdAt: new Date().toISOString(),
    fileCount: 0,
  };
  db.folders.push(folder);
  saveDocDb(db);
  return folder;
}

function updateFolder(id, patch) {
  const db = getDocDb();
  const idx = db.folders.findIndex(f => f.id === id);
  if (idx === -1) throw new Error('Folder not found');
  db.folders[idx] = { ...db.folders[idx], ...patch };
  saveDocDb(db);
  return db.folders[idx];
}

function deleteFolder(id) {
  const db = getDocDb();
  // Delete all files in folder first
  db.files = db.files.filter(f => f.folderId !== id);
  db.folders = db.folders.filter(f => f.id !== id);
  saveDocDb(db);
}

// Files
function getFilesInFolder(folderId) {
  const db = getDocDb();
  return db.files.filter(f => f.folderId === folderId);
}

function getAllFiles() {
  return getDocDb().files;
}

function addFileRecord({ folderId, filename, originalName, size, uploadedBy, readData, extractedData, notes, tags, period }) {
  const db = getDocDb();
  const file = {
    id: 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    folderId, filename, originalName, size,
    uploadedAt: new Date().toISOString(), uploadedBy,
    readData: !!readData,
    extractedData: extractedData || null,
    notes: notes || '',
    tags: tags || [],
    period: period || '',  // e.g. "2024-01", "Q1 2024"
  };
  db.files.push(file);
  // Update folder file count
  const fi = db.folders.findIndex(f => f.id === folderId);
  if (fi !== -1) db.folders[fi].fileCount = db.files.filter(f => f.folderId === folderId).length;
  saveDocDb(db);
  return file;
}

function updateFileRecord(id, patch) {
  const db = getDocDb();
  const idx = db.files.findIndex(f => f.id === id);
  if (idx === -1) throw new Error('File not found');
  db.files[idx] = { ...db.files[idx], ...patch };
  saveDocDb(db);
  return db.files[idx];
}

function deleteFileRecord(id) {
  const db = getDocDb();
  db.files = db.files.filter(f => f.id !== id);
  saveDocDb(db);
}

// ─── HISTORICAL SNAPSHOTS (for date-range returns) ───────────────────────────
// snapshots.json = [ { id, date, investments: {...}, capturedBy, note } ]
const SNAPSHOTS_FILE = path.join(DB_PATH, 'snapshots.json');

function getSnapshots() { return read(SNAPSHOTS_FILE) || []; }

function addSnapshot({ date, investments, capturedBy, note }) {
  const snaps = getSnapshots();
  const snap = {
    id: 'snap_' + Date.now(),
    date: date || new Date().toISOString().slice(0,10),
    investments,
    capturedBy,
    note: note || '',
    createdAt: new Date().toISOString(),
  };
  snaps.push(snap);
  // Keep last 365 snapshots
  snaps.sort((a,b) => a.date.localeCompare(b.date));
  write(SNAPSHOTS_FILE, snaps.slice(-365));
  return snap;
}

function getSnapshotByDate(date) {
  const snaps = getSnapshots();
  // Find closest snapshot on or before date
  const before = snaps.filter(s => s.date <= date);
  return before.length ? before[before.length - 1] : null;
}


// ─── PENDING DELETIONS (require all-user approval) ───────────────────────────
const PENDING_DEL_FILE = path.join(DB_PATH, 'pendingDeletions.json');

function getPendingDeletions() { return read(PENDING_DEL_FILE) || []; }

function requestDeletion({ requestedBy, itemType, itemKey, itemId, itemLabel, itemData }) {
  const users = getUsers().filter(u => u.active && u.role !== 'admin');
  const pending = getPendingDeletions();
  const req = {
    id: 'del_' + Date.now(),
    requestedBy, itemType, itemKey, itemId,
    itemLabel: itemLabel || itemId,
    itemData,
    status: 'pending',
    requiredApprovals: users.map(u => u.id),
    approvals: [],        // userIds who approved
    rejections: [],       // userIds who rejected
    createdAt: new Date().toISOString(),
  };
  pending.push(req);
  write(PENDING_DEL_FILE, pending);
  logAudit(requestedBy, 'DELETE_REQUESTED', { itemType, itemKey, itemId, itemLabel: req.itemLabel });
  return req;
}

function respondToDeletion(deletionId, userId, approve) {
  const pending = getPendingDeletions();
  const idx = pending.findIndex(d => d.id === deletionId && d.status === 'pending');
  if (idx === -1) throw new Error('Deletion request not found or already resolved');
  const req = pending[idx];
  // Remove from both lists first, then add to correct one
  req.approvals = req.approvals.filter(id => id !== userId);
  req.rejections = req.rejections.filter(id => id !== userId);
  if (approve) req.approvals.push(userId); else req.rejections.push(userId);

  // Check if all required users have responded
  const allResponded = req.requiredApprovals.every(uid =>
    req.approvals.includes(uid) || req.rejections.includes(uid)
  );

  if (req.rejections.length > 0) {
    req.status = 'rejected';
    logAudit(userId, 'DELETE_REJECTED', { deletionId, itemLabel: req.itemLabel });
  } else if (allResponded && req.approvals.length === req.requiredApprovals.length) {
    req.status = 'approved';
    logAudit(userId, 'DELETE_APPROVED', { deletionId, itemLabel: req.itemLabel });
    // Execute the deletion
    if (req.itemType === 'investment_row') {
      deleteInvestmentRow(req.itemKey, req.itemId);
    }
  }
  write(PENDING_DEL_FILE, pending);
  return req;
}

function getPendingDeletionsForUser(userId) {
  return getPendingDeletions().filter(d =>
    d.status === 'pending' &&
    d.requiredApprovals.includes(userId) &&
    !d.approvals.includes(userId) &&
    !d.rejections.includes(userId)
  );
}

// ─── VIEW LOGGING ─────────────────────────────────────────────────────────────
function logView(userId, section, details) {
  logAudit(userId, 'VIEW', { section, ...details });
}

module.exports = {
  DB_PATH,
  ...module.exports,
  getPendingDeletions, requestDeletion, respondToDeletion, getPendingDeletionsForUser, logView,
  getFolders, createFolder, updateFolder, deleteFolder,
  getFilesInFolder, getAllFiles, addFileRecord, updateFileRecord, deleteFileRecord,
  getSnapshots, addSnapshot, getSnapshotByDate,
};
