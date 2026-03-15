require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const db = require('./db');
const { signToken, requireAuth, requireAdmin } = require('./auth');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL === '*' ? true : (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:3000', 'http://localhost:3001']),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword','text/plain','text/csv'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|xlsx|xls|docx|doc|txt|csv)$/i)) cb(null, true);
    else cb(new Error('Unsupported file type. Use PDF, Excel, Word, or CSV.'));
  },
});

// Serve static uploads
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
app.use('/uploads', requireAuth, express.static(UPLOADS_DIR));

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = db.getUserByEmail(email);
    if (!user || !user.active) return res.status(401).json({ error: 'Invalid credentials or account inactive' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user.id);
    db.logAudit(user.id, 'LOGIN', { email });

    const { passwordHash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const { passwordHash, ...safe } = req.user;
  res.json(safe);
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const valid = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect' });
    await db.updateUser(req.user.id, { password: newPassword });
    db.logAudit(req.user.id, 'CHANGE_PASSWORD', {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── USER ROUTES (admin only for mutations) ───────────────────────────────────
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  res.json(db.getUsers().map(({ passwordHash, ...u }) => u));
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await db.createUser(req.body);
    db.logAudit(req.user.id, 'CREATE_USER', { targetEmail: req.body.email });
    const { passwordHash, ...safe } = user;
    res.json(safe);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const updated = await db.updateUser(req.params.id, req.body);
    db.logAudit(req.user.id, 'UPDATE_USER', { targetId: req.params.id });
    const { passwordHash, ...safe } = updated;
    res.json(safe);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── INVESTMENT ROUTES ────────────────────────────────────────────────────────
app.get('/api/investments', requireAuth, (req, res) => {
  const all = db.getInvestments();
  const perms = req.user.permissions;
  const filtered = {};

  const allowed = (key) => {
    if (key.startsWith('equity')) return perms.equity;
    if (key.startsWith('debt')) return perms.debt;
    if (key.startsWith('treasury')) return perms.treasury;
    return false;
  };

  Object.keys(all).forEach(k => {
    if (allowed(k)) filtered[k] = all[k];
  });

  // Admin sees all
  if (req.user.role === 'admin') return res.json(all);
  res.json(filtered);
});

app.get('/api/investments/:key', requireAuth, (req, res) => {
  const { key } = req.params;
  const perms = req.user.permissions;
  const allowed = (req.user.role === 'admin') ||
    (key.startsWith('equity') && perms.equity) ||
    (key.startsWith('debt') && perms.debt) ||
    (key.startsWith('treasury') && perms.treasury);

  if (!allowed) return res.status(403).json({ error: 'No permission for this asset class' });
  // Log view for non-admin users
  if (req.user.role !== 'admin') db.logView(req.user.id, key, { action: 'viewed_table' });
  res.json(db.getInvestmentsByKey(key));
});

app.post('/api/investments/:key', requireAuth, requireAdmin, (req, res) => {
  try {
    const row = db.addInvestmentRow(req.params.key, req.body);
    db.logAudit(req.user.id, 'ADD_ROW', { key: req.params.key, rowId: row.id });
    res.json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/investments/:key/:rowId', requireAuth, requireAdmin, (req, res) => {
  try {
    const row = db.updateInvestmentRow(req.params.key, req.params.rowId, req.body);
    db.logAudit(req.user.id, 'UPDATE_ROW', { key: req.params.key, rowId: req.params.rowId });
    res.json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/investments/:key/:rowId', requireAuth, requireAdmin, (req, res) => {
  try {
    db.deleteInvestmentRow(req.params.key, req.params.rowId);
    db.logAudit(req.user.id, 'DELETE_ROW', { key: req.params.key, rowId: req.params.rowId });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bulk replace a key (for full sync)
app.put('/api/investments/:key', requireAuth, requireAdmin, (req, res) => {
  try {
    const data = db.updateInvestmentKey(req.params.key, req.body);
    db.logAudit(req.user.id, 'BULK_UPDATE', { key: req.params.key, count: req.body.length });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── PDF UPLOAD & PARSE ───────────────────────────────────────────────────────
app.post('/api/upload/pdf', requireAuth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

    let text = '';
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(req.file.buffer);
      text = data.text || '';
    } catch (e) {
      text = req.file.buffer.toString('utf8', 0, Math.min(req.file.buffer.length, 50000));
    }

    // Save file
    const filename = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer);

    // Extract fields
    const extracted = extractFromText(text);
    extracted.filename = filename;
    extracted.originalName = req.file.originalname;
    extracted.uploadedAt = new Date().toISOString();
    extracted.uploadedBy = req.user.id;

    db.logAudit(req.user.id, 'PDF_UPLOAD', { filename: req.file.originalname });
    res.json({ extracted, rawTextSample: text.slice(0, 1000) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function extractNum(text, patterns) {
  for (const p of patterns) {
    const regex = new RegExp(p + '[\\s:=₹Rs.]*([\\d,]+(?:\\.\\d{1,4})?)', 'i');
    const m = text.match(regex);
    if (m) return m[1].replace(/,/g, '');
  }
  return '';
}

function extractStr(text, patterns) {
  for (const p of patterns) {
    const regex = new RegExp(p + '[\\s:=]*([\\w\\s\\.\\-&]+?)(?:\\n|,|\\|)', 'i');
    const m = text.match(regex);
    if (m) return m[1].trim().slice(0, 100);
  }
  return '';
}

function extractFromText(text) {
  return {
    fundName: extractStr(text, ['Fund Name', 'Scheme Name', 'Fund:', 'Name of Fund']),
    manager: extractStr(text, ['Asset Management', 'AMC', 'Investment Manager']),
    nav: extractNum(text, ['NAV', 'Net Asset Value per unit', 'Unit NAV']),
    units: extractNum(text, ['Units held', 'No\\.? of units', 'Balance Units']),
    costPrice: extractNum(text, ['Purchase NAV', 'Avg Cost', 'Average Cost']),
    currentMTM: extractNum(text, ['Current Value', 'Market Value', 'Portfolio Value']),
    unrealisedPL: extractNum(text, ['Unrealised', 'Unrealized', 'P&L', 'Gain']),
    managementFee: extractNum(text, ['Management Fee', 'TER', 'Total Expense Ratio']),
    carry: extractNum(text, ['Carry', 'Performance Fee', 'Profit Share']),
    committed: extractNum(text, ['Committed Capital', 'Total Commitment']),
    called: extractNum(text, ['Called Capital', 'Capital Called', 'Paid-in Capital']),
    uncalled: extractNum(text, ['Uncalled', 'Undrawn', 'Remaining Commitment']),
    dpi: extractNum(text, ['DPI']),
    tvpi: extractNum(text, ['TVPI', 'Investment Multiple']),
    irr: extractNum(text, ['IRR', 'Net IRR', 'Gross IRR']),
    xirr: extractNum(text, ['XIRR']),
    couponRate: extractNum(text, ['Coupon', 'Rate of Interest']),
    creditRating: extractStr(text, ['Rating', 'Credit Rating', 'Rated']),
    currency: (text.match(/\b(INR|USD|EUR|GBP|SGD)\b/) || [])[1] || 'INR',
    vintage: extractNum(text, ['Vintage', 'Inception Year']),
    maturityDate: (text.match(/[Mm]aturity[^:]*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}-\d{2}-\d{2})/) || [])[1] || '',
  };
}

// ─── SCHEMA / CUSTOM COLUMNS ──────────────────────────────────────────────────
app.get('/api/schema/columns', requireAuth, (req, res) => {
  res.json(db.getCustomColumns());
});

app.post('/api/schema/columns', requireAuth, requireAdmin, (req, res) => {
  try {
    const { path: colPath, colKey, label } = req.body;
    if (!colPath || !colKey) return res.status(400).json({ error: 'path and colKey required' });
    const cols = db.addCustomColumn(colPath, colKey, label);
    db.logAudit(req.user.id, 'ADD_COLUMN', { colPath, colKey });
    res.json(cols);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── BENCHMARK ROUTES ─────────────────────────────────────────────────────────
app.get('/api/benchmarks', requireAuth, (req, res) => {
  res.json(db.getBenchmarks());
});

app.get('/api/benchmarks/active', requireAuth, (req, res) => {
  res.json(db.getActiveBenchmarks());
});

app.put('/api/benchmarks/active', requireAuth, requireAdmin, (req, res) => {
  try {
    const ids = db.setActiveBenchmarks(req.body);
    db.logAudit(req.user.id, 'UPDATE_BENCHMARKS', { count: ids.length });
    res.json(ids);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────
app.get('/api/audit', requireAuth, requireAdmin, (req, res) => {
  res.json(db.getAuditLog(200));
});


// ─── NAV LABEL ROUTES ─────────────────────────────────────────────────────────
app.get('/api/nav-labels', requireAuth, (req, res) => {
  res.json(db.getNavLabels());
});

app.put('/api/nav-labels/:key', requireAuth, requireAdmin, (req, res) => {
  try {
    const { label } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'Label cannot be empty' });
    const labels = db.updateNavLabel(req.params.key, label.trim());
    db.logAudit(req.user.id, 'UPDATE_NAV_LABEL', { key: req.params.key, label });
    res.json(labels);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/nav-labels/reset', requireAuth, requireAdmin, (req, res) => {
  const labels = db.resetNavLabels();
  db.logAudit(req.user.id, 'RESET_NAV_LABELS', {});
  res.json(labels);
});

// ─── INVITE ROUTES ────────────────────────────────────────────────────────────
const { sendInviteEmail } = require('./email');

app.get('/api/invites', requireAuth, requireAdmin, (req, res) => {
  res.json(db.getInvites());
});

app.post('/api/invites', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, name, role, permissions } = req.body;

    // Validate against allowed domains
    const { domains: allowedDoms } = getAllowedDomains();
    const emailLower = email.toLowerCase();
    if (!allowedDoms.some(d => emailLower.endsWith('@' + d.toLowerCase()))) {
      return res.status(400).json({ error: `Email must be from: ${allowedDoms.map(d=>'@'+d).join(', ')}` });
    }

    // Check if user already exists
    const existing = db.getUserByEmail(email);
    if (existing) return res.status(400).json({ error: 'A user with this email already exists' });

    const inviter = db.getUserById(req.user.id);
    const invite = db.createInvite({ email, name, role, permissions, invitedBy: req.user.id });

    await sendInviteEmail({
      to: email,
      name,
      inviterName: inviter?.name || 'Admin',
      token: invite.token,
      permissions,
    });

    db.logAudit(req.user.id, 'SEND_INVITE', { email });
    res.json({ ok: true, invite: { id: invite.id, email: invite.email, name: invite.name, status: invite.status, createdAt: invite.createdAt, expiresAt: invite.expiresAt } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/invites/:id', requireAuth, requireAdmin, (req, res) => {
  db.revokeInvite(req.params.id);
  db.logAudit(req.user.id, 'REVOKE_INVITE', { inviteId: req.params.id });
  res.json({ ok: true });
});

// Public: validate token (GET — called when user clicks email link)
app.get('/api/invites/accept/:token', (req, res) => {
  const invite = db.getInviteByToken(req.params.token);
  if (!invite) return res.status(404).json({ error: 'Invalid or expired invitation link' });
  if (new Date(invite.expiresAt) < new Date()) return res.status(410).json({ error: 'This invitation has expired. Ask your admin to resend.' });
  res.json({ email: invite.email, name: invite.name, expiresAt: invite.expiresAt });
});

// Public: accept invite and set password
app.post('/api/invites/accept/:token', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const user = await db.acceptInvite(req.params.token, password);
    const { signToken } = require('./auth');
    const token = signToken(user.id);
    const { passwordHash, ...safe } = user;
    db.logAudit(user.id, 'ACCEPTED_INVITE', { email: user.email });
    res.json({ token, user: safe });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── PDF → INVESTMENT AUTO-CAPTURE ───────────────────────────────────────────
// After PDF parse, client sends extracted data + targetKey to save directly
app.post('/api/upload/pdf-and-save', requireAuth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF uploaded' });
    const targetKey = req.body.targetKey || 'equity_public_funds';

    let text = '';
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(req.file.buffer);
      text = data.text || '';
    } catch {
      text = req.file.buffer.toString('utf8', 0, 50000);
    }

    // Save file
    const filename = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    require('fs').writeFileSync(require('path').join(__dirname, 'uploads', filename), req.file.buffer);

    const extracted = extractFromText(text);
    extracted.filename = filename;
    extracted.originalName = req.file.originalname;
    extracted.uploadedAt = new Date().toISOString();
    extracted.source = 'pdf_upload';

    // Clean: only keep fields with values
    const row = {};
    Object.entries(extracted).forEach(([k, v]) => { if (v) row[k] = v; });

    // Apply any manual overrides sent from client
    let overrides = {};
    try { overrides = JSON.parse(req.body.overrides || '{}'); } catch {}
    Object.assign(row, overrides);

    const saved = db.addInvestmentRow(targetKey, row);
    db.logAudit(req.user.id, 'PDF_AUTO_SAVE', { filename: req.file.originalname, targetKey, rowId: saved.id });

    res.json({ row: saved, rawTextSample: text.slice(0, 500) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── MULTI-FORMAT UPLOAD ──────────────────────────────────────────────────────
app.post('/api/upload/file', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { parseFile, extractFields, detectTableData } = require('./fileParser');
    const targetKey = req.body.targetKey || 'equity_public_funds';
    const autoSave = req.body.autoSave === 'true';

    const parsed = await parseFile(req.file.buffer, req.file.originalname);
    const extracted = extractFields(parsed.text || '');
    const tables = detectTableData(parsed.sheets);

    // Save file to disk
    const filename = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    require('fs').writeFileSync(require('path').join(__dirname,'uploads',filename), req.file.buffer);

    let savedRow = null;
    if (autoSave) {
      const row = {};
      Object.entries(extracted).forEach(([k,v]) => { if (v) row[k] = v; });
      try { const overrides = JSON.parse(req.body.overrides || '{}'); Object.assign(row, overrides); } catch {}
      row.source = 'file_upload';
      row.originalFile = req.file.originalname;
      if (Object.keys(row).length > 2) {
        savedRow = db.addInvestmentRow(targetKey, row);
      }
    }

    db.logAudit(req.user.id, 'FILE_UPLOAD', { filename: req.file.originalname, type: parsed.type, targetKey });

    res.json({
      extracted,
      tables,
      type: parsed.type,
      pages: parsed.pages,
      sheetNames: parsed.sheetNames,
      filename,
      rawTextSample: (parsed.text || '').slice(0, 800),
      savedRow,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── DOCUMENT DATABASE ROUTES ────────────────────────────────────────────────

// Folders
app.get('/api/docdb/folders', requireAuth, (req, res) => {
  const { entityId } = req.query;
  res.json(db.getFolders(entityId || null));
});

app.post('/api/docdb/folders', requireAuth, requireAdmin, (req, res) => {
  try {
    const folder = db.createFolder({ ...req.body, createdBy: req.user.id });
    db.logAudit(req.user.id, 'CREATE_FOLDER', { name: req.body.name });
    res.json(folder);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/docdb/folders/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const folder = db.updateFolder(req.params.id, req.body);
    res.json(folder);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/docdb/folders/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    db.deleteFolder(req.params.id);
    db.logAudit(req.user.id, 'DELETE_FOLDER', { folderId: req.params.id });
    res.json({ ok: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// Files within folders
app.get('/api/docdb/folders/:folderId/files', requireAuth, (req, res) => {
  res.json(db.getFilesInFolder(req.params.folderId));
});

// Upload a file into a folder (with optional data extraction)
app.post('/api/docdb/folders/:folderId/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const { readData, notes, period, targetInvKey } = req.body;

    const { parseFile, extractFields } = require('./fileParser');
    const parsed = await parseFile(req.file.buffer, req.file.originalname);

    let extracted = null;
    if (readData === 'true') {
      extracted = extractFields(parsed.text || '');
      extracted.type = parsed.type;
      extracted.sheetNames = parsed.sheetNames;

      // If targetInvKey given, auto-save to investments
      if (targetInvKey) {
        const row = {};
        Object.entries(extracted).forEach(([k,v]) => { if (v && typeof v === 'string') row[k] = v; });
        row.source = 'docdb_upload';
        row.originalFile = req.file.originalname;
        row.period = period || '';
        if (Object.keys(row).length > 3) {
          db.addInvestmentRow(targetInvKey, row);
          db.logAudit(req.user.id, 'DOCDB_AUTO_IMPORT', { folderId: req.params.folderId, targetInvKey });
        }
      }
    }

    // Save file to disk
    const filename = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    require('fs').writeFileSync(require('path').join(__dirname,'uploads',filename), req.file.buffer);

    const fileRecord = db.addFileRecord({
      folderId: req.params.folderId,
      filename, originalName: req.file.originalname,
      size: req.file.size, uploadedBy: req.user.id,
      readData: readData === 'true',
      extractedData: extracted,
      notes: notes || '', period: period || '',
    });

    db.logAudit(req.user.id, 'DOCDB_UPLOAD', { folderId: req.params.folderId, filename: req.file.originalname, readData });
    res.json({ file: fileRecord, extracted, rawTextSample: (parsed.text || '').slice(0, 400) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/docdb/files/:id', requireAuth, requireAdmin, (req, res) => {
  try { res.json(db.updateFileRecord(req.params.id, req.body)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/docdb/files/:id', requireAuth, requireAdmin, (req, res) => {
  try { db.deleteFileRecord(req.params.id); res.json({ ok: true }); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

// Serve uploaded file
app.get('/api/docdb/files/:id/download', requireAuth, (req, res) => {
  try {
    const files = db.getAllFiles();
    const file = files.find(f => f.id === req.params.id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    const fp = require('path').join(__dirname, 'uploads', file.filename);
    if (!require('fs').existsSync(fp)) return res.status(404).json({ error: 'File not on disk' });
    res.download(fp, file.originalName);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── PORTFOLIO SNAPSHOTS (for date-range returns) ────────────────────────────
app.get('/api/snapshots', requireAuth, (req, res) => {
  res.json(db.getSnapshots().map(s => ({ id: s.id, date: s.date, note: s.note, capturedBy: s.capturedBy })));
});

app.get('/api/snapshots/:date', requireAuth, (req, res) => {
  const snap = db.getSnapshotByDate(req.params.date);
  if (!snap) return res.status(404).json({ error: 'No snapshot found for this date' });
  res.json(snap);
});

app.post('/api/snapshots', requireAuth, requireAdmin, (req, res) => {
  try {
    // If no investments passed, snapshot current state
    const investments = req.body.investments || db.getInvestments();
    const snap = db.addSnapshot({ date: req.body.date || new Date().toISOString().slice(0,10), investments, capturedBy: req.user.id, note: req.body.note || '' });
    db.logAudit(req.user.id, 'CREATE_SNAPSHOT', { date: snap.date });
    res.json(snap);
  } catch(e) { res.status(400).json({ error: e.message }); }
});


// ─── VIEW LOGGING ─────────────────────────────────────────────────────────────
app.post('/api/log/view', requireAuth, (req, res) => {
  const { section, details } = req.body;
  db.logView(req.user.id, section, details || {});
  res.json({ ok: true });
});

// ─── PENDING DELETIONS ────────────────────────────────────────────────────────
app.get('/api/deletions/pending', requireAuth, (req, res) => {
  if (req.user.role === 'admin') {
    res.json(db.getPendingDeletions().filter(d => d.status === 'pending'));
  } else {
    res.json(db.getPendingDeletionsForUser(req.user.id));
  }
});

app.post('/api/deletions/request', requireAuth, requireAdmin, (req, res) => {
  try {
    const { itemType, itemKey, itemId, itemLabel, itemData } = req.body;
    const users = db.getUsers().filter(u => u.active && u.role !== 'admin');
    if (users.length === 0) {
      // No sub-users — execute immediately
      if (itemType === 'investment_row') db.deleteInvestmentRow(itemKey, itemId);
      db.logAudit(req.user.id, 'DELETE_ROW', { key: itemKey, rowId: itemId, immediate: true });
      return res.json({ status: 'approved', immediate: true });
    }
    const req2 = db.requestDeletion({ requestedBy: req.user.id, itemType, itemKey, itemId, itemLabel, itemData });
    res.json(req2);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/deletions/:id/respond', requireAuth, (req, res) => {
  try {
    const { approve } = req.body;
    const result = db.respondToDeletion(req.params.id, req.user.id, !!approve);
    db.logAudit(req.user.id, approve ? 'DELETE_APPROVED' : 'DELETE_REJECTED', { deletionId: req.params.id });
    res.json(result);
  } catch(e) { res.status(400).json({ error: e.message }); }
});


// ─── FORGOT / RESET PASSWORD ─────────────────────────────────────────────────
const crypto = require('crypto');
const RESET_TOKENS_FILE = require('path').join(require('./db').DB_PATH || __dirname + '/data', 'resetTokens.json');

function getResetTokens() {
  try { return JSON.parse(require('fs').readFileSync(RESET_TOKENS_FILE,'utf8')||'[]'); } catch { return []; }
}
function saveResetTokens(tokens) {
  require('fs').writeFileSync(RESET_TOKENS_FILE, JSON.stringify(tokens));
}

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = db.getUserByEmail(email);
    // Always return success to prevent email enumeration
    if (!user) return res.json({ ok: true });

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 3600000; // 1 hour

    const tokens = getResetTokens().filter(t => t.userId !== user.id); // clear old tokens
    tokens.push({ token, userId: user.id, expiry });
    saveResetTokens(tokens);

    // Send email if configured, else log to console (dev mode)
    try {
      const { sendPasswordResetEmail } = require('./email');
      await sendPasswordResetEmail({ to: user.email, name: user.name, token });
    } catch(emailErr) {
      console.log('\n[DEV] Password reset link (email not configured):');
      const resetUrl = (process.env.FRONTEND_URL || 'http://localhost:3000') + '/reset-password?token=' + token;
      console.log(resetUrl + '\n');
    }

    db.logAudit(user.id, 'FORGOT_PASSWORD', { email });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 6)
      return res.status(400).json({ error: 'Invalid request' });

    const tokens = getResetTokens();
    const rec = tokens.find(t => t.token === token && t.expiry > Date.now());
    if (!rec) return res.status(400).json({ error: 'Reset link expired or invalid. Please request a new one.' });

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    await db.updateUser(rec.userId, { password: hash });

    // Invalidate token
    saveResetTokens(tokens.filter(t => t.token !== token));
    db.logAudit(rec.userId, 'RESET_PASSWORD', {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/validate-reset-token/:token', (req, res) => {
  const tokens = getResetTokens();
  const rec = tokens.find(t => t.token === req.params.token && t.expiry > Date.now());
  if (!rec) return res.status(400).json({ valid: false, error: 'Expired or invalid link' });
  const user = db.getUserById(rec.userId);
  res.json({ valid: true, name: user?.name || '', email: user?.email || '' });
});


// ─── MULTI-FUND SMART UPLOAD ─────────────────────────────────────────────────
// Parses a statement, detects multiple investment rows, groups drawdowns,
// handles debt components, and returns candidates for admin confirmation.
app.post('/api/upload/smart-parse', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { targetKey, groupDrawdowns: doGroup } = req.body;
    const { parseFile, extractMultipleRows, groupDrawdowns, extractDebtComponents, extractFields } = require('./fileParser');

    const parsed = await parseFile(req.file.buffer, req.file.originalname);
    const isDebt = targetKey && targetKey.includes('debt');
    const isEquityPrivate = targetKey && targetKey.includes('private');

    let result = {};

    if (parsed.sheets && Object.keys(parsed.sheets).length > 0) {
      // Excel / CSV — try multi-row extraction
      const extracted = extractMultipleRows(parsed.sheets, targetKey);
      let candidates = extracted.candidates;

      // Group drawdowns for private equity
      if (isEquityPrivate && doGroup !== 'false') {
        candidates = groupDrawdowns(candidates);
      }

      // Enhance debt rows with component detection
      if (isDebt) {
        candidates = extractDebtComponents(candidates);
      }

      result = {
        type: 'multi',
        fileType: parsed.type,
        sheetNames: parsed.sheetNames,
        candidates,
        unknownColumns: extracted.unknownColumns,
        warnings: extracted.unknownColumns.length > 0
          ? [`${extracted.unknownColumns.length} column(s) not recognised: ${extracted.unknownColumns.slice(0,5).join(', ')}. These will be stored as-is.`]
          : [],
        errors: [],
      };
    } else {
      // PDF / Word — single investment extraction
      const fields = extractFields(parsed.text || '');
      if (isDebt) {
        const enhanced = extractDebtComponents([fields]);
        result = { type: 'single', candidate: enhanced[0], rawTextSample: (parsed.text||'').slice(0,400) };
      } else {
        result = { type: 'single', candidate: fields, rawTextSample: (parsed.text||'').slice(0,400) };
      }
    }

    db.logAudit(req.user.id, 'SMART_PARSE', { filename: req.file.originalname, targetKey, candidates: result.candidates?.length });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Confirm and save multiple candidates
app.post('/api/upload/confirm-multi', requireAuth, requireAdmin, (req, res) => {
  try {
    const { targetKey, rows } = req.body;
    if (!targetKey || !Array.isArray(rows)) return res.status(400).json({ error: 'Invalid payload' });
    const saved = [];
    for (const row of rows) {
      const cleanRow = {};
      Object.entries(row).forEach(([k,v]) => {
        if (!['_sourceSheet','_sourceRow','_trancheCount','_tranches'].includes(k)) cleanRow[k] = v;
      });
      // Store tranche summary if available
      if (row._trancheCount > 1) cleanRow.notes = `${row._trancheCount} drawdowns; ${row.notes||''}`.trim();
      if (row._tranches) cleanRow._trancheDetail = JSON.stringify(row._tranches);
      const newRow = db.addInvestmentRow(targetKey, cleanRow);
      saved.push(newRow.id);
    }
    db.logAudit(req.user.id, 'CONFIRM_MULTI_UPLOAD', { targetKey, count: saved.length });
    res.json({ ok: true, saved: saved.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// ─── ALLOWED DOMAINS SETTINGS ────────────────────────────────────────────────
const DOMAINS_FILE = require('path').join(__dirname, 'data', 'allowedDomains.json');

function getAllowedDomains() {
  try { return JSON.parse(require('fs').readFileSync(DOMAINS_FILE,'utf8')); }
  catch { return { domains: ['jjfo.com', 'familyoffice.in'] }; }
}
function saveAllowedDomains(obj) {
  require('fs').writeFileSync(DOMAINS_FILE, JSON.stringify(obj, null, 2));
}

app.get('/api/settings/domains', requireAuth, (req, res) => {
  res.json(getAllowedDomains());
});
app.post('/api/settings/domains', requireAuth, requireAdmin, (req, res) => {
  const { domain } = req.body;
  if (!domain || !domain.includes('.')) return res.status(400).json({ error: 'Invalid domain' });
  const data = getAllowedDomains();
  const clean = domain.trim().toLowerCase().replace(/^@/,'');
  if (data.domains.includes(clean)) return res.status(400).json({ error: 'Domain already exists' });
  data.domains.push(clean);
  saveAllowedDomains(data);
  db.logAudit(req.user.id, 'ADD_DOMAIN', { domain: clean });
  res.json(data);
});
app.delete('/api/settings/domains/:domain', requireAuth, requireAdmin, (req, res) => {
  const data = getAllowedDomains();
  if (data.domains.length <= 1) return res.status(400).json({ error: 'Cannot remove last domain' });
  data.domains = data.domains.filter(d => d !== req.params.domain);
  saveAllowedDomains(data);
  db.logAudit(req.user.id, 'REMOVE_DOMAIN', { domain: req.params.domain });
  res.json(data);
});

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' });
});

// ─── SERVE REACT BUILD (for production) ──────────────────────────────────────
// Support both local dev structure AND Railway (single-folder deploy)
const FRONTEND_BUILD = fs.existsSync(path.join(__dirname, 'build'))
  ? path.join(__dirname, 'build')
  : path.join(__dirname, '..', 'investos', 'build');
if (fs.existsSync(FRONTEND_BUILD)) {
  app.use(express.static(FRONTEND_BUILD));
  app.get('/{*path}', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(FRONTEND_BUILD, 'index.html'));
    }
  });
  console.log('✓ Serving React build from', FRONTEND_BUILD);
}

// ─── START ────────────────────────────────────────────────────────────────────
db.initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 InvestOS Backend running on port ${PORT}`);
    console.log(`   API: http://localhost:${PORT}/api/health`);
    console.log(`   Frontend: http://localhost:${PORT}`);
    console.log(`\n   Default credentials:`);
    console.log(`   Admin: admin@familyoffice.in / Admin@123`);
    console.log(`   User1: user1@familyoffice.in / User1@123\n`);
  });
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
