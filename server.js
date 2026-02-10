const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 8000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const ROOT = __dirname;
const USERS_FILE = path.join(ROOT, 'users.json');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 10 * 1024;
const AUTH_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  maxAttempts: 30
};

const sessions = new Map();
const authAttempts = new Map();

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-XSS-Protection', '0');
}

function sendJson(res, statusCode, payload) {
  setSecurityHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sendNoContent(res) {
  setSecurityHeaders(res);
  res.statusCode = 204;
  res.end();
}

function safeReadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const text = fs.readFileSync(USERS_FILE, 'utf8');
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function safeWriteUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseCookies(header) {
  const output = {};
  if (!header) return output;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = decodeURIComponent(part.slice(idx + 1));
    output[key] = value;
  });
  return output;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let body = '';

    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error('Request too large.'));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON body.'));
      }
    });

    req.on('error', reject);
  });
}

function generateId() {
  return crypto.randomBytes(24).toString('hex');
}

function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, encoded) {
  const [salt, expected] = String(encoded || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function now() {
  return Date.now();
}

function sessionCookieValue(sessionId) {
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(sessionId).digest('hex');
  return `${sessionId}.${sig}`;
}

function validateSessionCookie(cookieValue) {
  if (!cookieValue || !cookieValue.includes('.')) return null;
  const [sessionId, sig] = cookieValue.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(sessionId).digest('hex');
  const sigA = Buffer.from(sig, 'hex');
  const sigB = Buffer.from(expected, 'hex');
  if (sigA.length !== sigB.length) return null;
  if (!crypto.timingSafeEqual(sigA, sigB)) return null;
  return sessionId;
}

function setSessionCookie(res, sessionId) {
  const secure = NODE_ENV === 'production' ? '; Secure' : '';
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const value = encodeURIComponent(sessionCookieValue(sessionId));
  res.setHeader('Set-Cookie', `at.sid=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

function clearSessionCookie(res) {
  const secure = NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `at.sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
}

function createSession(res, userId) {
  const sessionId = generateId();
  sessions.set(sessionId, { userId, expiresAt: now() + SESSION_TTL_MS });
  setSessionCookie(res, sessionId);
}

function getCurrentUserFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const rawSid = cookies['at.sid'];
  const sessionId = validateSessionCookie(rawSid);
  if (!sessionId) return null;

  const sess = sessions.get(sessionId);
  if (!sess) return null;
  if (sess.expiresAt < now()) {
    sessions.delete(sessionId);
    return null;
  }

  sess.expiresAt = now() + SESSION_TTL_MS;
  const users = safeReadUsers();
  const user = users.find((u) => u.id === sess.userId);
  if (!user) return null;

  return {
    sessionId,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt
    }
  };
}

function isRateLimited(req) {
  const ip = (req.socket && req.socket.remoteAddress) || 'unknown';
  const key = `${ip}`;
  const entry = authAttempts.get(key) || { count: 0, start: now() };

  if (now() - entry.start > AUTH_RATE_LIMIT.windowMs) {
    entry.count = 0;
    entry.start = now();
  }

  entry.count += 1;
  authAttempts.set(key, entry);
  return entry.count > AUTH_RATE_LIMIT.maxAttempts;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res, pathname) {
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.normalize(path.join(ROOT, cleanPath));

  if (!fullPath.startsWith(ROOT)) {
    sendJson(res, 403, { error: 'Forbidden.' });
    return;
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      sendJson(res, 404, { error: 'Not found.' });
      return;
    }

    setSecurityHeaders(res);
    const ext = path.extname(fullPath).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(content);
  });
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const current = getCurrentUserFromRequest(req);
    if (!current) return sendJson(res, 401, { error: 'Not authenticated.' });
    return sendJson(res, 200, { user: current.user });
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const current = getCurrentUserFromRequest(req);
    if (current) {
      sessions.delete(current.sessionId);
    }
    clearSessionCookie(res);
    return sendNoContent(res);
  }

  if ((pathname === '/api/auth/login' || pathname === '/api/auth/register') && req.method === 'POST') {
    if (isRateLimited(req)) {
      return sendJson(res, 429, { error: 'Too many authentication attempts. Please try again later.' });
    }
  }

  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const firstName = String(body.firstName || '').trim();
      const lastName = String(body.lastName || '').trim();
      const email = normalizeEmail(body.email);
      const phone = String(body.phone || '').trim();
      const password = String(body.password || '');

      if (!firstName || !lastName || !email || !phone || !password) {
        return sendJson(res, 400, { error: 'Please fill in all fields.' });
      }
      if (!isEmail(email)) {
        return sendJson(res, 400, { error: 'Please provide a valid email.' });
      }
      if (password.length < 8) {
        return sendJson(res, 400, { error: 'Password must be at least 8 characters.' });
      }

      const users = safeReadUsers();
      if (users.some((u) => u.email === email)) {
        return sendJson(res, 409, { error: 'An account with this email already exists.' });
      }

      const user = {
        id: generateId(),
        firstName,
        lastName,
        email,
        phone,
        passwordHash: passwordHash(password),
        createdAt: new Date().toISOString()
      };

      users.push(user);
      safeWriteUsers(users);
      createSession(res, user.id);

      return sendJson(res, 201, {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Invalid request.' });
    }
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');

      if (!email || !password) {
        return sendJson(res, 400, { error: 'Please fill in all fields.' });
      }

      const users = safeReadUsers();
      const user = users.find((u) => u.email === email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return sendJson(res, 401, { error: 'Invalid email or password.' });
      }

      createSession(res, user.id);
      return sendJson(res, 200, {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Invalid request.' });
    }
  }

  return sendJson(res, 404, { error: 'Not found.' });
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsed.pathname;

  if (pathname.startsWith('/api/')) {
    return handleApi(req, res, pathname);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`AutoTransformers server running at http://localhost:${PORT}`);
});
