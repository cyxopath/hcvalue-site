/* ──────────────────────────────────────────────────────────────────
   HC Values – server.js
   Lightweight Node/Express backend — run: node server.js
   ────────────────────────────────────────────────────────────────── */

try { require('dotenv').config(); } catch (_) {}

const express = require('express');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');

const app  = express();
const PORT = process.env.PORT || 8000;
const ADMIN_USER_ID = 1945506007;
const DATA_ACCESS_COOKIE = 'hc_data_session';
const SESSION_COOKIE_NAME = 'hc_session_token';
const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

app.disable('x-powered-by');

/* ── File paths (supports persistent volumes like Railway /data) ─── */
let DATA_DIR = __dirname;
try {
    if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
        const customDir = path.resolve(process.env.DATA_DIR.trim());
        if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true });
        fs.accessSync(customDir, fs.constants.W_OK);
        DATA_DIR = customDir;
    } else if (fs.existsSync('/data')) {
        fs.accessSync('/data', fs.constants.W_OK);
        DATA_DIR = '/data';
    }
} catch (e) {
    console.warn('[Storage] Volume directory not writable, falling back to __dirname:', e.message);
    DATA_DIR = __dirname;
}

if (DATA_DIR !== __dirname) {
    try {
        const seedFiles = [
            'stats.json', 'blocklist.json', 'data.json', 'trending.json',
            'sessions.json', 'prices-whitelist.json', 'price-suggestions.json',
            'verify-words.json', 'discord-links.json', 'votes.json'
        ];
        seedFiles.forEach(f => {
            const dest = path.join(DATA_DIR, f);
            const src  = path.join(__dirname, f);
            if (!fs.existsSync(dest) && fs.existsSync(src)) {
                try { fs.copyFileSync(src, dest); } catch (_) {}
            }
        });
        console.log(`[Storage] Using persistent storage at: ${DATA_DIR}`);
    } catch (e) {
        console.warn(`[Storage] Failed to seed files to ${DATA_DIR}:`, e);
    }
}

const STATS_FILE             = path.join(DATA_DIR, 'stats.json');
const BLOCKLIST_FILE         = path.join(DATA_DIR, 'blocklist.json');
const DATA_FILE              = path.join(DATA_DIR, 'data.json');
const TRENDING_FILE          = path.join(DATA_DIR, 'trending.json');
const SESSIONS_FILE          = path.join(DATA_DIR, 'sessions.json');
const PRICES_WHITELIST_FILE  = path.join(DATA_DIR, 'prices-whitelist.json');
const PRICE_SUGGESTIONS_FILE = path.join(DATA_DIR, 'price-suggestions.json');
const VERIFY_WORDS_FILE      = path.join(DATA_DIR, 'verify-words.json');
const DISCORD_LINKS_FILE     = path.join(DATA_DIR, 'discord-links.json');
const VOTES_FILE             = path.join(DATA_DIR, 'votes.json');

const BLOCKED_DIRECT_FILES = new Set([
    'data.json', 'stats.json', 'blocklist.json', 'sessions.json',
    'users.json', 'trending.json', 'price-suggestions.json',
    'prices-whitelist.json', 'config.yml', 'config-maintenance.yml',
    'package.json', 'server.js', 'votes.json', 'discord-links.json',
    '.env', '.env.example'
]);

/* ── Middleware ──────────────────────────────────────────────────── */
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googlesyndication.com https://pagead2.googlesyndication.com https://adservice.google.com https://www.googletagservices.com https://tpc.googlesyndication.com https://*.doubleclick.net https://*.googleadservices.com https://*.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; media-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https: wss:; frame-src 'self' https://*.googlesyndication.com https://tpc.googlesyndication.com https://*.doubleclick.net https://www.google.com https://googleads.g.doubleclick.net https://*.google.com; object-src 'none'; base-uri 'self'; form-action 'self';");
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    next();
});

function getDataAccessCookie(req) {
    const cookieHeader = req.headers.cookie || '';
    const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
        const [key, ...rest] = c.trim().split('=');
        return [key, rest.join('=')];
    }));
    return cookies[DATA_ACCESS_COOKIE] || null;
}

function issueDataAccessCookie(req, res) {
    if (getDataAccessCookie(req)) return;
    const token = crypto.randomBytes(24).toString('hex');
    res.cookie(DATA_ACCESS_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        maxAge: 1000 * 60 * 60 * 24 * 7
    });
}

function requireDataAccess(req, res, next) {
    if (getDataAccessCookie(req)) return next();
    return res.status(403).json({ success: false, message: 'Forbidden: data access required.' });
}

function getSessionCookie(req) {
    const cookieHeader = req.headers.cookie || '';
    const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
        const [key, ...rest] = c.trim().split('=');
        return [key, rest.join('=')];
    }));
    return cookies[SESSION_COOKIE_NAME] || null;
}

function getRequestSessionToken(req) {
    const headerToken = req.headers['x-session-token'] || req.headers['x-admin-token'] || '';
    const bodyToken = req.body && (req.body.token || req.body.sessionToken) ? (req.body.token || req.body.sessionToken) : '';
    return String(headerToken || bodyToken || getSessionCookie(req) || '').trim();
}

function setSessionCookie(req, res, token) {
    res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        maxAge: SESSION_TTL_MS
    });
}

function clearSessionCookie(req, res) {
    res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
    });
}

function isSessionExpired(session) {
    const expiresAt = session?.expiresAt || (session?.loginTime || 0) + SESSION_TTL_MS;
    return Date.now() > expiresAt;
}

function persistSession(session) {
    if (!session || !session.token) return;
    session.loginTime = session.loginTime || Date.now();
    session.expiresAt = session.expiresAt || session.loginTime + SESSION_TTL_MS;
    userSessions.set(session.token, session);
    if (session.isAdmin) activeSessions.add(session.token);
    saveSessionsToDisk();
}

app.use((req, res, next) => {
    if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html')) {
        issueDataAccessCookie(req, res);
    }
    next();
});

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-id, x-admin-token');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

/* ── Restrict public access to frontend-only files (Whitelist Approach) ── */
app.use((req, res, next) => {
    // Decode URL and strip leading/trailing slashes
    const reqPath = decodeURIComponent(req.path).replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();

    // Safety check: block any path traversal or suspicious path segments (like '..' or backslashes)
    if (req.path.includes('..') || req.path.includes('\\') || reqPath.includes('..') || reqPath.includes('\\')) {
        return res.status(403).send('Forbidden: Invalid path.');
    }

    // Redirect /index.html → / cleanly
    if (reqPath === 'index.html') {
        return res.redirect(301, '/');
    }

    // Block node_modules entirely
    if (reqPath.startsWith('node_modules/') || reqPath === 'node_modules') {
        return res.status(403).send('Forbidden');
    }

    if (BLOCKED_DIRECT_FILES.has(reqPath)) {
        return res.status(403).send('Forbidden');
    }

    // Whitelisted root files & paths
    if (reqPath === '' || reqPath === 'script.js' || reqPath === 'index.css' || reqPath === 'ads.txt' || reqPath === 'robots.txt' || reqPath === 'sitemap.xml' || reqPath.endsWith('.ttf') || reqPath.endsWith('.woff') || reqPath.endsWith('.woff2') || reqPath.endsWith('.otf')) {
        return next();
    }

    // Prevent directory-style browsing of anything else
    if (reqPath.endsWith('/')) {
        return res.status(403).send('Forbidden');
    }

    // Whitelisted directories
    if (reqPath.startsWith('images/') || reqPath.startsWith('gifs/') || reqPath.startsWith('videos/') || reqPath.startsWith('fonts/')) {
        return next();
    }

    // Whitelisted API requests
    if (reqPath.startsWith('api/')) {
        return next();
    }

    // Block any other files (databases, configs, server scripts, etc.)
    return res.status(403).send('Forbidden');
});

// Serve static files
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));
app.use(express.static(__dirname));

/* ── JSON helpers ────────────────────────────────────────────────── */
function loadJSON(filePath, defaultVal) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch { return defaultVal; }
}
function sortAllCategories(siteData) {
    if (!siteData || !siteData.categories) return;

    function parsePrice(val) {
        if (!val) return 0;
        let clean = val.toString().replace(/\./g, '').replace(/,/g, '').trim();
        let num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    }

    Object.keys(siteData.categories).forEach(catName => {
        const cat = siteData.categories[catName];
        if (cat && cat.items) {
            const sortedEntries = Object.entries(cat.items).sort((a, b) => {
                const priceA = parsePrice(a[1].usd);
                const priceB = parsePrice(b[1].usd);
                return priceB - priceA;
            });

            const newItems = {};
            sortedEntries.forEach(([name, details]) => {
                newItems[name] = details;
            });
            cat.items = newItems;
        }
    });
}

function updateSkinImages(data) {
    const imagesDir = path.join(__dirname, 'images');
    const gifsDir = path.join(__dirname, 'gifs');
    
    if (!fs.existsSync(imagesDir)) return;
    
    const images = fs.readdirSync(imagesDir).filter(f => f.toLowerCase().endsWith('.png'));
    const gifs = fs.existsSync(gifsDir) ? fs.readdirSync(gifsDir).filter(f => /\.(gif|png|jpg|jpeg|webp)$/i.test(f)) : [];

    const categories = ['Double Barrel', 'Revolver', 'Tactical', 'Smg', 'Silencer', 'Shotgun', 'Knifes', 'Beams', 'Tags', 'Frames'];
    const suffixes = {
        'Double Barrel': ['Db'],
        'Revolver': ['Rev'],
        'Tactical': ['Tac'],
        'Smg': ['Smg'],
        'Silencer': ['Sil', 'Silencer'],
        'Shotgun': ['Sg', 'Shotgun'],
        'Knifes': ['Knife'],
        'Beams': ['Beam'],
        'Tags': ['Tag'],
        'Frames': ['Frame']
    };
    const specialNames = {
        'Shiryus Breath': 'Shiryus',
        'Blacksteel Dragon': 'Blacksteel',
        'Phoenix': 'Pheonix',
        'Hello Kitty': 'Hello_Kitty',
        'Snow Dragon': 'Snow_Dragon',
        'Void Dragon': 'Void_Dragon',
        'Strawberry Shortcake': 'Strawberry_Shortcake',
        'Volcanic Ashes': 'Volcanic_Ashes',
        'Green Tint': 'Green_Tint',
        'Black Ice': 'Black_Ice',
        'Hell Hound': 'Hell_Hound',
        'Hell Dragon': 'Hell_Dragon',
        'Crimson Fang': 'Crimson_Fang',
        'Sakura': 'Sakrua'
    };

    function normalize(name) {
        return name.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '');
    }

    // Helper for finding items by special rules, including space-to-underscore normalization and first-word candidate checks
    function candidates(name) {
        const out = new Set();
        out.add(normalize(name));
        const special = specialNames[name];
        if (special) out.add(special);
        if (name.includes(' ')) out.add(normalize(name.split(' ')[0]));
        return [...out];
    }

    function findInGifs(name, suffixList) {
        const cands = candidates(name);
        for (const suffix of suffixList) {
            for (const cand of cands) {
                const regex = new RegExp(`^${cand}_${suffix}\\.(gif|png|jpg|jpeg|webp)$`, 'i');
                const found = gifs.find(f => regex.test(f));
                if (found) return { file: found, folder: 'gifs' };
            }
            for (const cand of cands) {
                const regex = new RegExp(`^${cand}.*_${suffix}\\.(gif|png|jpg|jpeg|webp)$`, 'i');
                const found = gifs.find(f => regex.test(f));
                if (found) return { file: found, folder: 'gifs' };
            }
            for (const cand of cands) {
                const regex = new RegExp(`${cand}.*${suffix}.*\\.(gif|png|jpg|jpeg|webp)$`, 'i');
                const found = gifs.find(f => regex.test(f));
                if (found) return { file: found, folder: 'gifs' };
            }
        }
        return null;
    }

    function findImage(name, suffixList) {
        const gifResult = findInGifs(name, suffixList);
        if (gifResult) return gifResult;
        const cands = candidates(name);
        for (const suffix of suffixList) {
            for (const cand of cands) {
                const exact = `${cand}_${suffix}.png`;
                const found = images.find(i => i.toLowerCase() === exact.toLowerCase());
                if (found) return { file: found, folder: 'images' };
            }
            for (const cand of cands) {
                const regex = new RegExp(`^${cand}.*_${suffix}\\.png$`, 'i');
                const found = images.find(i => regex.test(i));
                if (found) return { file: found, folder: 'images' };
            }
            for (const cand of cands) {
                const regex = new RegExp(`${cand}.*${suffix}.*\\.png$`, 'i');
                const found = images.find(i => regex.test(i));
                if (found) return { file: found, folder: 'images' };
            }
        }
        return null;
    }

    for (const cat of categories) {
        if (!data.categories || !data.categories[cat] || !data.categories[cat].items) continue;
        const suffixList = suffixes[cat];
        const items = data.categories[cat].items;
        for (const name of Object.keys(items)) {
            const result = findImage(name, suffixList);
            if (result) {
                items[name].customImg = `${result.folder}/${result.file}`;
            }
        }
    }
}

function saveJSON(filePath, data) {
    if (filePath === DATA_FILE) {
        updateSkinImages(data);
        sortAllCategories(data);
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/* ── HTTPS request helpers (no external dependencies) ───────────── */
function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'HCValues/1.0' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('Invalid JSON from Roblox API')); }
            });
        }).on('error', reject);
    });
}

function httpsPost(url, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const urlObj  = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path    : urlObj.pathname + urlObj.search,
            method  : 'POST',
            headers : {
                'Content-Type'  : 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'User-Agent'    : 'HCValues/1.0'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('Invalid JSON from Roblox API')); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

/* ── Session token store (persisted to sessions.json) ────────────── */
const activeSessions = new Set();
const userSessions = new Map();

function saveSessionsToDisk() {
    saveJSON(SESSIONS_FILE, Array.from(userSessions.values()));
}

// Load sessions on startup
function loadPersistedSessions() {
    const saved = loadJSON(SESSIONS_FILE, []);
    
    // Sort saved sessions by loginTime ascending, so newer ones will process last and override
    saved.sort((a, b) => (a.loginTime || 0) - (b.loginTime || 0));
    
    const userToLatestToken = new Map(); // userId -> token
    
    saved.forEach(s => {
        if (s && s.token) {
            // Discard sessions older than 30 days
            if (Date.now() - s.loginTime < 30 * 24 * 60 * 60 * 1000) {
                // If this user already has a loaded session, remove the older one
                if (userToLatestToken.has(s.userId)) {
                    const oldToken = userToLatestToken.get(s.userId);
                    userSessions.delete(oldToken);
                    activeSessions.delete(oldToken);
                }
                
                userSessions.set(s.token, s);
                userToLatestToken.set(s.userId, s.token);
                if (s.isAdmin) {
                    activeSessions.add(s.token);
                }
            }
        }
    });
    return userSessions;
}
loadPersistedSessions();
console.log(`  Sessions loaded: ${userSessions.size}`);
saveSessionsToDisk();

function getActiveSession(token) {
    if (!token) return null;
    let s = userSessions.get(token);
    if (!s) {
        loadPersistedSessions();
        s = userSessions.get(token);
    }
    return s || null;
}

/* ── Admin middleware ────────────────────────────────────────────── */
function requireAdmin(req, res, next) {
    const token = getRequestSessionToken(req);
    const session = getActiveSession(token);
    if (session && session.isAdmin && Number(session.userId) === ADMIN_USER_ID) {
        req.userSession = session;
        return next();
    }
    return res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
}

/* ── Prices Access middleware ────────────────────────────────────── */
function requirePricesAccess(req, res, next) {
    const token = getRequestSessionToken(req);
    const session = getActiveSession(token);
    
    // Check by token
    if (session) {
        
        // Double check blocklist
        if (isUserBlocked(session.userId, session.username)) {
            userSessions.delete(token);
            activeSessions.delete(token);
            saveSessionsToDisk();
            return res.status(403).json({ success: false, message: 'Account is blocked.' });
        }
        
        // Owner always has access
        if (Number(session.userId) === ADMIN_USER_ID) {
            req.userSession = session;
            return next();
        }
        
        // Read whitelist
        const whitelist = loadJSON(PRICES_WHITELIST_FILE, []);
        const isWhitelisted = whitelist.some(item => Number(item.userId) === Number(session.userId));
        if (isWhitelisted) {
            req.userSession = session;
            return next();
        }
    }
    
    return res.status(403).json({ success: false, message: 'Forbidden: Prices access required.' });
}

/* ══════════════════════════════════════════════════════════════════
   ENDPOINTS
══════════════════════════════════════════════════════════════════ */

/* ── Track visit ──────────────────────────────────────────────────── */
app.post('/api/track', (req, res) => {
    const stats   = loadJSON(STATS_FILE, { clicks: 0, traffic: {} });
    stats.clicks  = (stats.clicks || 0) + 1;
    const today   = new Date().toISOString().split('T')[0];
    stats.traffic = stats.traffic || {};
    stats.traffic[today] = (stats.traffic[today] || 0) + 1;
    saveJSON(STATS_FILE, stats);
    res.json({ success: true });
});

/* ── Get stats (admin only) ──────────────────────────────────────── */
app.get('/api/stats', requireAdmin, (req, res) => {
    res.json(loadJSON(STATS_FILE, { clicks: 0, traffic: {} }));
});

/* ── Save data.json (admin only) ─────────────────────────────────── */
app.post('/api/save', requireAdmin, (req, res) => {
    saveJSON(DATA_FILE, req.body);
    res.json({ success: true });
});

/* ── Legacy key-based login ──────────────────────────────────────── */
app.post('/api/login', (req, res) => {
    const body = req.body || {};
    const key = body.key || body.token || '';
    const success = key === 'hcdev2026';
    if (success) {
        const mockToken = 'mock_dev_token';
        const session = {
            token: mockToken,
            userId: ADMIN_USER_ID,
            username: 'cyxopathic',
            displayName: 'Developer',
            avatarUrl: 'shield.png',
            loginTime: Date.now(),
            expiresAt: Date.now() + SESSION_TTL_MS,
            isAdmin: true
        };
        persistSession(session);
        setSessionCookie(req, res, mockToken);
    }
    res.json({ success });
});

/* ── Blocklist helper check ──────────────────────────────────────── */
function isUserBlocked(userId, username) {
    const blocklist = loadJSON(BLOCKLIST_FILE, []);
    return blocklist.some(item => {
        if (!item) return false;
        if (typeof item === 'object') {
            const matchId = item.userId && (Number(item.userId) === Number(userId));
            const matchName = item.username && username && (String(item.username).toLowerCase() === String(username).toLowerCase());
            return matchId || matchName;
        }
        return Number(item) === Number(userId) || String(item) === String(userId) || (username && String(item).toLowerCase() === String(username).toLowerCase());
    });
}

/* ── Roblox: resolve username → full user object ─────────────────── */
app.get('/api/roblox/resolve', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.json({ success: false, message: 'Username is required.' });

    try {
        /* 1. Resolve username → userId */
        const search = await httpsPost(
            'https://users.roblox.com/v1/usernames/users',
            { usernames: [username], excludeBannedUsers: false }
        );
        if (!search.data || search.data.length === 0) {
            return res.json({ success: false, message: 'Roblox user not found. Double-check the username.' });
        }
        const userId = search.data[0].id;

        /* 2. Check blocklist immediately */
        if (isUserBlocked(userId, username)) {
            return res.json({ success: false, message: 'Your account has been Blacklisted from accessing this site. Message @imthesickness on Discord or seek help in the Support Server' });
        }

        /* 3. Get full profile */
        const profile = await httpsGet(`https://users.roblox.com/v1/users/${userId}`);

        /* 4. Account-age gate: must be ≥ 30 days old */
        const created = new Date(profile.created);
        const ageDays = (Date.now() - created.getTime()) / 86_400_000;
        if (ageDays < 30) {
            return res.json({
                success: false,
                message: `Account too new. Your Roblox account must be at least 30 days old. ` +
                         `Yours is ${Math.floor(ageDays)} day${Math.floor(ageDays) !== 1 ? 's' : ''} old.`
            });
        }

        /* 5. Avatar thumbnail (optional, best-effort) */
        let avatarUrl = null;
        try {
            const av = await httpsGet(
                `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
            );
            avatarUrl = av.data?.[0]?.imageUrl || null;
        } catch (_) { /* avatar is non-critical */ }

        res.json({
            success    : true,
            id         : userId,
            username   : profile.name,
            displayName: profile.displayName,
            avatarUrl,
            created    : profile.created,
            ageDays    : Math.floor(ageDays)
        });

    } catch (err) {
        res.json({ success: false, message: 'Could not reach Roblox API: ' + err.message });
    }
});

/* ── Roblox OAuth 2.0 Authentication ──────────────────────────────── */
const robloxStates = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [state, data] of robloxStates.entries()) {
        if (data.expiresAt < now) robloxStates.delete(state);
    }
}, 60 * 1000);

/* Initiate Roblox OAuth login */
app.get('/api/auth/roblox/login', (req, res) => {
    const clientId = (process.env.ROBLOX_CLIENT_ID || '').trim();
    if (!clientId) {
        return res.status(500).send('Roblox Client ID is not configured on the server.');
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host') || 'localhost:8000';
    let redirectUri = `${protocol}://${host}/api/auth/roblox/callback`;
    if (process.env.ROBLOX_REDIRECT_URI && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        redirectUri = process.env.ROBLOX_REDIRECT_URI.trim();
    }

    const state = crypto.randomBytes(24).toString('hex');
    robloxStates.set(state, {
        expiresAt: Date.now() + 10 * 60 * 1000
    });

    const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20profile&state=${state}&prompt=select_account%20consent`;
    res.redirect(robloxAuthUrl);
});

/* Roblox OAuth callback */
app.get('/api/auth/roblox/callback', async (req, res) => {
    const { code, state, error } = req.query;
    if (error) {
        return res.redirect(`/?roblox_error=${encodeURIComponent(error)}`);
    }
    if (!state || !robloxStates.has(state)) {
        return res.redirect('/?roblox_error=invalid_state');
    }

    const stateData = robloxStates.get(state);
    robloxStates.delete(state);

    if (Date.now() > stateData.expiresAt) {
        return res.redirect('/?roblox_error=state_expired');
    }

    const clientId = (process.env.ROBLOX_CLIENT_ID || '').trim();
    const clientSecret = (process.env.ROBLOX_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) {
        return res.redirect('/?roblox_error=missing_credentials');
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host') || 'localhost:8000';
    let redirectUri = `${protocol}://${host}/api/auth/roblox/callback`;
    if (process.env.ROBLOX_REDIRECT_URI && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        redirectUri = process.env.ROBLOX_REDIRECT_URI.trim();
    }

    try {
        const formBody = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code: String(code),
            redirect_uri: redirectUri
        }).toString();

        const tokenRes = await httpsRequest('https://apis.roblox.com/oauth/v1/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formBody
        });

        if (tokenRes.statusCode !== 200 || !tokenRes.body || !tokenRes.body.access_token) {
            console.error('[Roblox OAuth] Token exchange error:', tokenRes.body);
            const errMsg = tokenRes.body?.error_description || tokenRes.body?.error || 'token_exchange_failed';
            return res.redirect(`/?roblox_error=${encodeURIComponent(errMsg)}`);
        }

        const accessToken = tokenRes.body.access_token;

        // Fetch User Info from Roblox OpenID UserInfo endpoint
        const userInfoRes = await httpsRequest('https://apis.roblox.com/oauth/v1/userinfo', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (userInfoRes.statusCode !== 200 || !userInfoRes.body || !userInfoRes.body.sub) {
            console.error('[Roblox OAuth] UserInfo error:', userInfoRes.body);
            return res.redirect('/?roblox_error=failed_to_fetch_user_info');
        }

        const userInfo = userInfoRes.body;
        const userId = Number(userInfo.sub);
        const username = userInfo.preferred_username || userInfo.name || `User_${userId}`;
        const displayName = userInfo.nickname || userInfo.name || username;

        // Blocklist check
        if (isUserBlocked(userId, username)) {
            return res.redirect('/?roblox_error=blacklisted');
        }

        // Account-age gate check (fetch user profile from public API)
        try {
            const profile = await httpsGet(`https://users.roblox.com/v1/users/${userId}`);
            if (profile && profile.created) {
                const created = new Date(profile.created);
                const ageDays = (Date.now() - created.getTime()) / 86_400_000;
                if (ageDays < 30) {
                    return res.redirect(`/?roblox_error=account_too_new_must_be_30_days_old`);
                }
            }
        } catch (_) {}

        // Fetch avatar thumbnail headshot
        let avatarUrl = userInfo.picture || null;
        if (!avatarUrl) {
            try {
                const av = await httpsGet(
                    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
                );
                avatarUrl = av.data?.[0]?.imageUrl || null;
            } catch (_) {}
        }

        const isAdmin = Number(userId) === ADMIN_USER_ID;

        // Clean up any existing sessions for this user ID
        for (const [t, s] of userSessions.entries()) {
            if (Number(s.userId) === Number(userId)) {
                userSessions.delete(t);
                activeSessions.delete(t);
            }
        }

        const userToken = crypto.randomBytes(32).toString('hex');
        const userObj = {
            id: userId,
            username: username,
            displayName: displayName,
            avatarUrl: avatarUrl || 'assets/placeholder-roblox.png',
            loginTime: Date.now(),
            isAdmin: isAdmin
        };

        const newSession = {
            token: userToken,
            userId: userId,
            username: username,
            displayName: displayName,
            avatarUrl: avatarUrl || 'assets/placeholder-roblox.png',
            loginTime: Date.now(),
            expiresAt: Date.now() + SESSION_TTL_MS,
            isAdmin: isAdmin
        };
        persistSession(newSession);

        if (isAdmin) {
            activeSessions.add(userToken);
        }
        setSessionCookie(req, res, userToken);

        // Save/update combined profile in discord-links.json
        try {
            const allLinks = loadDiscordLinks();
            const existingLink = allLinks[String(userId)] || {};
            allLinks[String(userId)] = {
                ...existingLink,
                robloxUserId: userId,
                robloxUsername: username,
                robloxDisplayName: displayName,
                robloxAvatar: avatarUrl || 'assets/placeholder-roblox.png',
                robloxLinkedAt: existingLink.robloxLinkedAt || new Date().toISOString(),
                lastLoginAt: new Date().toISOString()
            };
            saveDiscordLinks(allLinks);
        } catch (e) {
            console.warn('[Roblox OAuth] Failed to save link to discord-links.json:', e);
        }

        const safeUserJson = encodeURIComponent(JSON.stringify(userObj));
        return res.redirect(`/?roblox_success=1&roblox_token=${encodeURIComponent(userToken)}&roblox_user=${safeUserJson}`);

    } catch (err) {
        console.error('[Roblox OAuth] Callback error:', err);
        return res.redirect(`/?roblox_error=${encodeURIComponent(err.message || 'unknown_error')}`);
    }
});

/* ── Verify words list ─────────────────────────────────────────── */
app.get('/api/verify-words', (req, res) => {
    const words = loadJSON(VERIFY_WORDS_FILE, []);
    res.json(words);
});

/* ── Roblox: verify bio phrase (fallback) ────────────────────────── */
app.get('/api/roblox/verify', async (req, res) => {
    const { userId, phrase } = req.query;
    if (!userId || !phrase) {
        return res.json({ success: false, verified: false, message: 'Missing parameters.' });
    }

    /* Re-check blocklist on every verify attempt — no bypass */
    if (isUserBlocked(userId)) {
        return res.json({ success: false, verified: false, message: 'This account is blocked.' });
    }

    try {
        const profile  = await httpsGet(`https://users.roblox.com/v1/users/${userId}`);
        const bio      = (profile.description || '') + '';
        const verified = bio.toLowerCase().includes(String(phrase || '').toLowerCase());
        const isAdmin  = Number(userId) === ADMIN_USER_ID;

        let userToken = null;
        let adminToken = null;

        if (verified) {
            // Get user's avatar headshot
            let avatarUrl = null;
            try {
                const av = await httpsGet(
                    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
                );
                avatarUrl = av.data?.[0]?.imageUrl || null;
            } catch (_) {}

            // Clean up any existing sessions for this user ID to prevent duplicates
            for (const [token, session] of userSessions.entries()) {
                if (Number(session.userId) === Number(userId)) {
                    userSessions.delete(token);
                    activeSessions.delete(token);
                }
            }

            userToken = require('crypto').randomBytes(32).toString('hex');
            const newSession = {
                token: userToken,
                userId: Number(userId),
                username: profile.name,
                displayName: profile.displayName,
                avatarUrl: avatarUrl || 'assets/placeholder-roblox.png',
                loginTime: Date.now(),
                expiresAt: Date.now() + SESSION_TTL_MS,
                isAdmin: isAdmin
            };
            persistSession(newSession);

            if (isAdmin) {
                adminToken = userToken;
                activeSessions.add(adminToken);
            }
            setSessionCookie(req, res, userToken);
        }

        res.json({
            success : true,
            verified,
            isAdmin,
            userToken,
            adminToken,
            message : verified
                ? 'Verified successfully!'
                : 'Phrase not found in your Roblox profile bio. Make sure you saved your profile after adding the code.'
        });
    } catch (err) {
        res.json({ success: false, verified: false, message: 'Could not reach Roblox API: ' + err.message });
    }
});

/* ── Discord OAuth & Verification Helpers ────────────────────────── */
const discordStates = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [state, data] of discordStates.entries()) {
        if (data.expiresAt < now) discordStates.delete(state);
    }
}, 60000);

function getDiscordConfig() {
    const siteData = loadJSON(DATA_FILE, {});
    const cfg = siteData.config || {};
    const hasOAuthKeys = Boolean((process.env.DISCORD_CLIENT_ID || '').trim() && (process.env.DISCORD_CLIENT_SECRET || '').trim());
    return {
        enabled: (cfg.discordEnabled !== undefined ? Boolean(cfg.discordEnabled) : true) && hasOAuthKeys,
        guildId: String(cfg.discordGuildId || '1405216941383094376').trim(),
        inviteLink: String(cfg.discordInviteLink || 'https://discord.gg/PQPM4sYBc4').trim()
    };
}

let cachedServerInfo = {
    serverName: null,
    serverIcon: null,
    onlineCount: null,
    memberCount: null,
    lastFetched: 0
};

async function getDiscordServerInfo() {
    const cfg = getDiscordConfig();
    const now = Date.now();
    if (cachedServerInfo.serverName && (now - cachedServerInfo.lastFetched < 300000)) {
        return cachedServerInfo;
    }

    try {
        let code = 'PQPM4sYBc4';
        if (cfg.inviteLink) {
            const match = cfg.inviteLink.match(/(?:discord\.gg|discord\.com\/invite)\/([a-zA-Z0-9-]+)/i);
            if (match && match[1]) code = match[1];
        }

        const resData = await httpsRequest(`https://discord.com/api/v10/invites/${code}?with_counts=true`);
        const json = resData ? resData.body : null;
        if (json && json.guild) {
            cachedServerInfo = {
                serverName: json.guild.name || 'HC Values',
                serverIcon: json.guild.icon ? `https://cdn.discordapp.com/icons/${json.guild.id}/${json.guild.icon}.png` : null,
                onlineCount: json.approximate_presence_count || null,
                memberCount: json.approximate_member_count || null,
                lastFetched: now
            };
            return cachedServerInfo;
        }
    } catch (e) {
        console.warn('Failed to fetch Discord server info:', e.message || e);
    }

    return {
        serverName: 'HC Values',
        serverIcon: null,
        onlineCount: null,
        memberCount: null
    };
}


function loadDiscordLinks() {
    return loadJSON(DISCORD_LINKS_FILE, {});
}

function saveDiscordLinks(links) {
    saveJSON(DISCORD_LINKS_FILE, links);
}

function getDiscordLinkForUser(userId) {
    const links = loadDiscordLinks();
    return links[String(userId)] || null;
}

function saveDiscordLinkForUser(userId, discordData) {
    const links = loadDiscordLinks();
    const existing = links[String(userId)] || {};
    links[String(userId)] = {
        ...existing,
        robloxUserId: Number(userId),
        ...discordData,
        updatedAt: new Date().toISOString()
    };
    saveDiscordLinks(links);
}

function removeDiscordLinkForUser(userId) {
    const links = loadDiscordLinks();
    if (links[String(userId)]) {
        delete links[String(userId)];
        saveDiscordLinks(links);
    }
}

function httpsRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };
        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(data); } catch (_) { parsed = data; }
                resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on('error', reject);
        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        req.end();
    });
}

async function validateDiscordToken(accessToken) {
    if (!accessToken) return null;
    try {
        const res = await httpsRequest('https://discord.com/api/v10/users/@me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'HCValues/1.0'
            }
        });
        if (res.statusCode === 200 && res.body && res.body.id) {
            return res.body;
        }
        if (res.statusCode === 401) {
            return false; // Authorization revoked or invalid token
        }
    } catch (e) {
        console.warn('[Discord] Token check failed:', e.message);
    }
    return null;
}

async function verifyDiscordGuildMembership(discordUserId, accessToken, guildId) {
    if (!guildId) return false;

    // Check 1: Bot token (most reliable — requires bot to be in the guild)
    const botToken = (process.env.DISCORD_BOT_TOKEN || '').trim();
    if (botToken) {
        try {
            const res = await httpsRequest(`https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bot ${botToken}`,
                    'User-Agent': 'HCValues/1.0'
                }
            });
            if (res.statusCode === 200) {
                console.log(`[Discord] Bot check: user ${discordUserId} IS in guild ${guildId}`);
                return true;
            }
            // 403 = bot not in guild (fall through to user token check)
            // 404 = user not in guild per bot, but still try user token to double-confirm
            console.log(`[Discord] Bot check returned ${res.statusCode} for user ${discordUserId} in guild ${guildId}`);
        } catch (e) {
            console.warn('[Discord] Bot token member check warning:', e.message);
        }
    }

    // Check 2: User Access Token — check /users/@me/guilds (always runs as fallback)
    if (accessToken) {
        try {
            const res = await httpsRequest('https://discord.com/api/v10/users/@me/guilds', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'User-Agent': 'HCValues/1.0'
                }
            });
            if (res.statusCode === 200 && Array.isArray(res.body)) {
                const isMember = res.body.some(g => String(g.id) === String(guildId));
                console.log(`[Discord] User token check: user ${discordUserId} ${isMember ? 'IS' : 'is NOT'} in guild ${guildId}. Total guilds returned: ${res.body.length}`);
                return isMember;
            }
            console.warn(`[Discord] User guilds check returned status ${res.statusCode}`);
        } catch (e) {
            console.warn('[Discord] User token guild check warning:', e.message);
        }
    }

    return false;
}

/* ── Roblox & Discord: validate user session ───────────────────────── */
app.post('/api/validate-session', async (req, res) => {
    const token = getRequestSessionToken(req);
    if (!token || !userSessions.has(token)) {
        return res.json({ success: false, valid: false, message: 'Session invalid or expired.' });
    }
    
    const session = userSessions.get(token);
    if (!session || isSessionExpired(session)) {
        userSessions.delete(token);
        activeSessions.delete(token);
        saveSessionsToDisk();
        clearSessionCookie(req, res);
        return res.json({ success: false, valid: false, message: 'Session expired.' });
    }
    
    // Double check that the user is not blocked
    if (isUserBlocked(session.userId, session.username)) {
        userSessions.delete(token);
        activeSessions.delete(token);
        saveSessionsToDisk();
        return res.json({ success: false, valid: false, message: 'Account is blocked.' });
    }

    const discordCfg = getDiscordConfig();
    const serverInfo = await getDiscordServerInfo();
    let discordStatus = {
        enabled: discordCfg.enabled,
        connected: false,
        inServer: false,
        inviteLink: discordCfg.inviteLink,
        guildId: discordCfg.guildId,
        serverName: serverInfo.serverName || 'HC Values',
        serverIcon: serverInfo.serverIcon || null,
        serverMembers: serverInfo.memberCount || null,
        serverOnline: serverInfo.onlineCount || null
    };

    if (discordCfg.enabled) {
        const link = getDiscordLinkForUser(session.userId);
        if (link && link.accessToken) {
            const discordUser = await validateDiscordToken(link.accessToken);
            if (discordUser === false) {
                // User revoked access in Discord Authorized Apps -> auto disconnect
                removeDiscordLinkForUser(session.userId);
                discordStatus.connected = false;
                discordStatus.inServer = false;
            } else if (discordUser) {
                const isMember = await verifyDiscordGuildMembership(link.discordId, link.accessToken, discordCfg.guildId);
                discordStatus.connected = true;
                discordStatus.inServer = isMember;
                discordStatus.discordId = link.discordId;
                discordStatus.discordUsername = discordUser.global_name || discordUser.username || link.discordUsername;
                discordStatus.discordAvatar = link.discordAvatar;

                link.discordUsername = discordStatus.discordUsername;
                saveDiscordLinkForUser(session.userId, link);
            }
        }
    } else {
        discordStatus.connected = true;
        discordStatus.inServer = true;
    }

    res.json({
        success: true,
        valid: true,
        user: {
            id: session.userId,
            username: session.username,
            displayName: session.displayName,
            avatarUrl: session.avatarUrl,
            loginTime: session.loginTime,
            isAdmin: !!session.isAdmin
        },
        discord: discordStatus
    });
});

/* ── Token-based login (for users who can't use Roblox OAuth) ────── */
app.post('/api/auth/token-login', (req, res) => {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string' || !token.trim()) {
        return res.json({ success: false, message: 'Token is required.' });
    }
    const t = token.trim();
    const session = getActiveSession(t);
    if (!session) {
        return res.json({ success: false, message: 'Invalid or expired token.' });
    }
    if (isSessionExpired(session)) {
        userSessions.delete(t);
        activeSessions.delete(t);
        saveSessionsToDisk();
        return res.json({ success: false, message: 'Token has expired.' });
    }
    if (isUserBlocked(session.userId, session.username)) {
        return res.json({ success: false, message: 'Account is blocked.' });
    }
    setSessionCookie(req, res, t);
    return res.json({
        success: true,
        token: t,
        user: {
            id: session.userId,
            username: session.username,
            displayName: session.displayName,
            avatarUrl: session.avatarUrl,
            loginTime: session.loginTime,
            isAdmin: !!session.isAdmin
        }
    });
});

/* ── Internal: sync session created externally (e.g. by Discord bot) ── */
app.post('/api/internal/session-sync', (req, res) => {
    const session = req.body;
    if (session && session.token) {
        persistSession(session);
        return res.json({ success: true });
    }
    return res.status(400).json({ success: false, message: 'Invalid session data' });
});

/* ── Admin: generate a manual login token for a user ─────────────── */
app.post('/api/admin/generate-token', requireAdmin, async (req, res) => {
    const { robloxUsername, discordId, discordUsername } = req.body || {};

    if (!robloxUsername || !robloxUsername.trim()) {
        return res.json({ success: false, message: 'robloxUsername is required.' });
    }
    if (!discordId || !discordId.trim()) {
        return res.json({ success: false, message: 'discordId (Discord User ID) is required.' });
    }

    try {
        /* 1. Resolve Roblox username → userId + profile */
        const search = await httpsPost(
            'https://users.roblox.com/v1/usernames/users',
            { usernames: [robloxUsername.trim()], excludeBannedUsers: false }
        );
        if (!search.data || search.data.length === 0) {
            return res.json({ success: false, message: `Roblox user "${robloxUsername}" not found.` });
        }
        const userId    = search.data[0].id;
        const username  = search.data[0].name;
        const displayName = search.data[0].displayName || username;

        /* 2. Block-check */
        if (isUserBlocked(userId, username)) {
            return res.json({ success: false, message: `User "${username}" is on the blocklist.` });
        }

        /* 3. Fetch avatar */
        let avatarUrl = 'assets/placeholder-roblox.png';
        try {
            const av = await httpsGet(
                `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
            );
            if (av.data && av.data[0] && av.data[0].imageUrl) {
                avatarUrl = av.data[0].imageUrl;
            }
        } catch (_) {}

        /* 4. Revoke any existing session for this userId */
        for (const [existingToken, existingSession] of userSessions.entries()) {
            if (Number(existingSession.userId) === Number(userId)) {
                userSessions.delete(existingToken);
                activeSessions.delete(existingToken);
                break;
            }
        }

        /* 5. Create new session token */
        const userToken = crypto.randomBytes(32).toString('hex');
        const isAdmin   = Number(userId) === ADMIN_USER_ID;
        const newSession = {
            token:       userToken,
            userId:      userId,
            username:    username,
            displayName: displayName,
            avatarUrl:   avatarUrl,
            loginTime:   Date.now(),
            expiresAt:   Date.now() + SESSION_TTL_MS,
            isAdmin:     isAdmin,
            manualToken: true   // flag so you can identify these in the sessions list
        };
        persistSession(newSession);
        if (isAdmin) activeSessions.add(userToken);

        /* 6. Save / update discord-links.json with provided Discord info */
        try {
            const allLinks = loadDiscordLinks();
            const existing = allLinks[String(userId)] || {};
            allLinks[String(userId)] = {
                ...existing,
                robloxUserId:      userId,
                robloxUsername:    username,
                robloxDisplayName: displayName,
                robloxAvatar:      avatarUrl,
                robloxLinkedAt:    existing.robloxLinkedAt || new Date().toISOString(),
                lastLoginAt:       new Date().toISOString(),
                // Store discord info provided by admin
                discordId:         discordId.trim(),
                discordUsername:   (discordUsername || '').trim() || existing.discordUsername || '',
                manualToken:       true
            };
            saveDiscordLinks(allLinks);
        } catch (e) {
            console.warn('[generate-token] Failed to save discord-links.json:', e);
        }

        console.log(`[generate-token] Admin generated token for ${username} (${userId}), Discord: ${discordId}`);

        return res.json({
            success: true,
            token: userToken,
            user: {
                id: userId,
                username,
                displayName,
                avatarUrl
            },
            expiresAt: newSession.expiresAt
        });

    } catch (err) {
        console.error('[generate-token] Error:', err);
        return res.json({ success: false, message: 'Error generating token: ' + err.message });
    }
});

/* ── Roblox: logout user session ─────────────────────────────────── */
app.post('/api/logout', (req, res) => {
    const token = req.body?.token || getRequestSessionToken(req);
    if (token) {
        userSessions.delete(token);
        activeSessions.delete(token);
        saveSessionsToDisk();
    }
    clearSessionCookie(req, res);
    res.json({ success: true });
});

/* ── Discord OAuth2 & Membership Endpoints ────────────────────────── */

/* Initiate Discord OAuth */
app.get('/api/auth/discord/login', (req, res) => {
    const token = req.query.token || getRequestSessionToken(req);
    if (!token || !userSessions.has(token)) {
        return res.status(401).send('Roblox verification is required before connecting Discord.');
    }
    const session = userSessions.get(token);
    if (isUserBlocked(session.userId, session.username)) {
        return res.status(403).send('Account is blocked.');
    }

    const clientId = (process.env.DISCORD_CLIENT_ID || '').trim();
    if (!clientId) {
        return res.status(500).send('Discord Client ID is not configured on the server. Set DISCORD_CLIENT_ID in .env file.');
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host') || 'localhost:8000';
    let redirectUri = `${protocol}://${host}/api/auth/discord/callback`;
    if (process.env.DISCORD_REDIRECT_URI && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        redirectUri = process.env.DISCORD_REDIRECT_URI.trim();
    }

    const state = crypto.randomBytes(24).toString('hex');
    discordStates.set(state, {
        token,
        userId: session.userId,
        expiresAt: Date.now() + 10 * 60 * 1000
    });

    console.log(`[Discord OAuth] Login initiating with redirectUri: ${redirectUri}`);
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20guilds&state=${state}&prompt=consent`;
    res.redirect(discordAuthUrl);
});

/* Discord OAuth Callback */
app.get('/api/auth/discord/callback', async (req, res) => {
    const { code, state, error } = req.query;
    if (error) {
        return res.redirect(`/?discord_error=${encodeURIComponent(error)}`);
    }
    if (!state || !discordStates.has(state)) {
        return res.redirect('/?discord_error=invalid_state');
    }

    const stateData = discordStates.get(state);
    discordStates.delete(state);

    if (Date.now() > stateData.expiresAt) {
        return res.redirect('/?discord_error=state_expired');
    }

    const clientId = (process.env.DISCORD_CLIENT_ID || '').trim();
    const clientSecret = (process.env.DISCORD_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) {
        return res.redirect('/?discord_error=missing_credentials');
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host') || 'localhost:8000';
    let redirectUri = `${protocol}://${host}/api/auth/discord/callback`;
    if (process.env.DISCORD_REDIRECT_URI && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        redirectUri = process.env.DISCORD_REDIRECT_URI.trim();
    }

    try {
        const bodyParams = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code: String(code),
            redirect_uri: redirectUri
        });

        const tokenRes = await httpsRequest('https://discord.com/api/v10/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'HCValues/1.0'
            },
            body: bodyParams.toString()
        });

        if (tokenRes.statusCode !== 200 || !tokenRes.body || !tokenRes.body.access_token) {
            console.error('[Discord OAuth] Token exchange error:', tokenRes.body);
            return res.redirect('/?discord_error=token_exchange_failed');
        }

        const tokenData = tokenRes.body;
        const accessToken = tokenData.access_token;

        const userRes = await httpsRequest('https://discord.com/api/v10/users/@me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'HCValues/1.0'
            }
        });

        if (userRes.statusCode !== 200 || !userRes.body || !userRes.body.id) {
            return res.redirect('/?discord_error=failed_user_info');
        }

        const discordUser = userRes.body;
        let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
        if (discordUser.avatar) {
            const ext = discordUser.avatar.startsWith('a_') ? 'gif' : 'png';
            avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${ext}?size=128`;
        }

        const discordData = {
            discordId: discordUser.id,
            discordUsername: discordUser.global_name || discordUser.username,
            discordAvatar: avatarUrl,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: Date.now() + (tokenData.expires_in * 1000)
        };

        saveDiscordLinkForUser(stateData.userId, discordData);

        res.redirect('/?discord_success=true');
    } catch (err) {
        console.error('[Discord OAuth] Callback exception:', err);
        res.redirect('/?discord_error=server_error');
    }
});

/* Re-check Guild Membership */
app.post('/api/discord/check-membership', async (req, res) => {
    const token = getRequestSessionToken(req);
    if (!token || !userSessions.has(token)) {
        return res.status(401).json({ success: false, message: 'Session invalid.' });
    }
    const session = userSessions.get(token);
    const discordCfg = getDiscordConfig();

    if (!discordCfg.enabled) {
        return res.json({ success: true, connected: true, inServer: true });
    }

    const link = getDiscordLinkForUser(session.userId);
    if (!link || !link.accessToken) {
        return res.json({ success: true, connected: false, inServer: false });
    }

    const discordUser = await validateDiscordToken(link.accessToken);
    if (discordUser === false) {
        removeDiscordLinkForUser(session.userId);
        return res.json({ success: true, connected: false, inServer: false, message: 'Discord authorization was revoked.' });
    }

    const isMember = await verifyDiscordGuildMembership(link.discordId, link.accessToken, discordCfg.guildId);
    const serverInfo = await getDiscordServerInfo();
    res.json({
        success: true,
        connected: true,
        inServer: isMember,
        guildId: discordCfg.guildId,
        inviteLink: discordCfg.inviteLink,
        serverName: serverInfo.serverName || 'HC Values',
        serverIcon: serverInfo.serverIcon || null,
        serverMembers: serverInfo.memberCount || null,
        serverOnline: serverInfo.onlineCount || null
    });
});

/* Admin: Get Discord Settings */
app.get('/api/admin/discord-settings', requireAdmin, (req, res) => {
    const cfg = getDiscordConfig();
    res.json({
        success: true,
        settings: cfg,
        envStatus: {
            clientIdConfigured: Boolean((process.env.DISCORD_CLIENT_ID || '').trim()),
            clientSecretConfigured: Boolean((process.env.DISCORD_CLIENT_SECRET || '').trim()),
            botTokenConfigured: Boolean((process.env.DISCORD_BOT_TOKEN || '').trim())
        }
    });
});

/* Admin: Update Discord Settings */
app.post('/api/admin/discord-settings', requireAdmin, (req, res) => {
    const { enabled, guildId, inviteLink } = req.body || {};
    const siteData = loadJSON(DATA_FILE, {});
    if (!siteData.config) siteData.config = {};

    if (enabled !== undefined) siteData.config.discordEnabled = Boolean(enabled);
    if (guildId !== undefined) siteData.config.discordGuildId = String(guildId).trim();
    if (inviteLink !== undefined) siteData.config.discordInviteLink = String(inviteLink).trim();

    saveJSON(DATA_FILE, siteData);

    res.json({
        success: true,
        settings: getDiscordConfig()
    });
});

/* ── Admin: get active sessions ──────────────────────────────────── */
app.get('/api/admin/sessions', requireAdmin, (req, res) => {
    const sessionsList = Array.from(userSessions.values())
        .sort((a, b) => b.loginTime - a.loginTime);
    res.json({ success: true, sessions: sessionsList });
});

/* ── Admin: get blocklist ────────────────────────────────────────── */
app.get('/api/admin/blocked', requireAdmin, (req, res) => {
    res.json({ success: true, blocked: loadJSON(BLOCKLIST_FILE, []) });
});

/* ── Admin: block a user ─────────────────────────────────────────── */
app.post('/api/admin/block', requireAdmin, async (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.json({ success: false, message: 'Username or User ID is required.' });

    try {
        let targetUserId = null;
        let targetUsername = null;
        let targetDisplayName = null;
        let targetAvatarUrl = null;

        const isNumeric = /^\d+$/.test(String(userId).trim());

        if (isNumeric) {
            targetUserId = Number(userId);
            try {
                const profile = await httpsGet(`https://users.roblox.com/v1/users/${targetUserId}`);
                targetUsername = profile.name;
                targetDisplayName = profile.displayName;
            } catch (err) {
                targetUsername = `User #${targetUserId}`;
                targetDisplayName = `User #${targetUserId}`;
            }
        } else {
            // It's a username, resolve it!
            const search = await httpsPost(
                'https://users.roblox.com/v1/usernames/users',
                { usernames: [String(userId).trim()], excludeBannedUsers: false }
            );
            if (search.data && search.data.length > 0) {
                targetUserId = search.data[0].id;
                targetUsername = search.data[0].name;
                targetDisplayName = search.data[0].displayName;
            } else {
                return res.json({ success: false, message: `Roblox user "${userId}" not found.` });
            }
        }

        // Get avatar url
        if (targetUserId) {
            try {
                const av = await httpsGet(
                    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${targetUserId}&size=150x150&format=Png&isCircular=false`
                );
                targetAvatarUrl = av.data?.[0]?.imageUrl || null;
            } catch (_) {}
        }

        const blocklist = loadJSON(BLOCKLIST_FILE, []);
        
        // Remove existing items for this user to avoid duplicates
        let filtered = blocklist.filter(item => {
            if (!item) return false;
            if (typeof item === 'object') {
                return Number(item.userId) !== Number(targetUserId);
            }
            return Number(item) !== Number(targetUserId) && String(item) !== String(targetUserId) && String(item).toLowerCase() !== String(targetUsername).toLowerCase();
        });

        const newBlockItem = {
            userId: targetUserId,
            username: targetUsername,
            displayName: targetDisplayName,
            avatarUrl: targetAvatarUrl || 'assets/placeholder-roblox.png',
            blockedAt: new Date().toISOString()
        };

        filtered.push(newBlockItem);
        saveJSON(BLOCKLIST_FILE, filtered);

        // Clear any active sessions for the blocked user
        let sessionModified = false;
        for (const [token, session] of userSessions.entries()) {
            if (Number(session.userId) === Number(targetUserId)) {
                userSessions.delete(token);
                activeSessions.delete(token);
                sessionModified = true;
            }
        }
        if (sessionModified) {
            saveSessionsToDisk();
        }

        res.json({ success: true, blocked: filtered });
    } catch (err) {
        res.json({ success: false, message: 'Error blocking user: ' + err.message });
    }
});

/* ── Admin: unblock a user ───────────────────────────────────────── */
app.post('/api/admin/unblock', requireAdmin, (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.json({ success: false, message: 'userId is required.' });

    let list = loadJSON(BLOCKLIST_FILE, []);
    list = list.filter(item => {
        if (!item) return false;
        if (typeof item === 'object') {
            return Number(item.userId) !== Number(userId);
        }
        return Number(item) !== Number(userId) && String(item) !== String(userId);
    });
    saveJSON(BLOCKLIST_FILE, list);
    res.json({ success: true, blocked: list });
});

/* ── List available media files ──────────────────────────────────── */
app.get('/api/files', requireDataAccess, (req, res) => {
    const folders = ['images', 'gifs', 'videos'];
    const result  = {};
    folders.forEach(folder => {
        const folderPath = path.join(__dirname, folder);
        try {
            const files = fs.readdirSync(folderPath);
            result[folder] = files.filter(f => /\.(png|jpg|jpeg|gif|webp|mp4|webm|mov)$/i.test(f));
        } catch {
            result[folder] = [];
        }
    });
    res.json(result);
});

/* ── Site data: serve data.json via API (direct file access is blocked) ── */
app.get('/api/data', requireDataAccess, (req, res) => {
    res.json(loadJSON(DATA_FILE, {}));
});

/* ── Trending: get list ──────────────────────────────────────────── */
app.get('/api/trending', requireDataAccess, (req, res) => {
    res.json(loadJSON(TRENDING_FILE, null)); // null means "use hardcoded defaults"
});

/* ── Admin: get all votes (admin only) ───────────────────────────── */
app.get('/api/admin/votes', requireAdmin, (req, res) => {
    const all = loadJSON(VOTES_FILE, []);
    res.json({ success: true, votes: all });
});

/* ── Admin: get specific skin vote result (owner only) ────────────── */
app.get('/api/admin/vote-result', requireAdmin, (req, res) => {
    const token = getRequestSessionToken(req);
    if (!token || !userSessions.has(token)) {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
    }
    const session = userSessions.get(token);
    if (Number(session.userId) !== ADMIN_USER_ID) {
        return res.status(403).json({ success: false, message: 'Forbidden: Owner access only.' });
    }

    const { category, skinName } = req.query || {};
    if (!skinName) {
        return res.status(400).json({ success: false, message: 'skinName is required.' });
    }

    const all = loadJSON(VOTES_FILE, []);
    const entry = findVoteEntry(all, category, skinName) || { counts: { overprice:0, perfect:0, underprice:0 }, votes: [] };
    res.json({ success: true, counts: entry.counts, votes: entry.votes || [] });
});

/* ── Trending: save list (admin only) ────────────────────────────── */
app.post('/api/trending', requireAdmin, (req, res) => {
    const items = req.body;
    if (!Array.isArray(items)) return res.json({ success: false, message: 'Expected an array.' });
    saveJSON(TRENDING_FILE, items);
    res.json({ success: true, items });
});

/* ── Votes: allow only on localhost unless explicitly enabled via env */
function votesAllowed(req) {
    try {
        if (process.env.ENABLE_VOTES === 'true') return false;
        return true;
    } catch (_) {
        return true;
    }
}

/* Votes.json structure:
 * [
 *   {
 *     skinKey,
 *     category,
 *     skinName,
 *     counts: { overprice, perfect, underprice },
 *     votes: [ { userId, username, vote, submittedAt }, ... ]
 *   }, ...]
 */

function findVoteEntry(all, category, skinName) {
    const key = `${String(category||'').trim()}|||${String(skinName||'').trim()}`;
    return all.find(e => e.skinKey === key);
}

function getUtcDay(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function countDailyVotes(all, userId) {
    const today = getUtcDay(new Date());
    return all.reduce((count, entry) => {
        if (!entry.votes || !Array.isArray(entry.votes)) return count;
        return count + entry.votes.filter(v => Number(v.userId) === Number(userId) && getUtcDay(v.submittedAt) === today).length;
    }, 0);
}

app.get('/api/votes', requireDataAccess, (req, res) => {
    if (!votesAllowed(req)) return res.json({ success: false, message: 'Voting disabled on this host.' });
    const { category, skinName } = req.query || {};
    if (!skinName) return res.status(400).json({ success: false, message: 'skinName is required.' });

    const all = loadJSON(VOTES_FILE, []);
    const entry = findVoteEntry(all, category, skinName) || { counts: { overprice:0, perfect:0, underprice:0 }, votes: [] };

    // determine user vote
    const token = getRequestSessionToken(req);
    let userVote = null;
    if (token && userSessions.has(token)) {
        const session = userSessions.get(token);
        const v = (entry.votes || []).find(x => Number(x.userId) === Number(session.userId));
        if (v) userVote = v.vote;
    }

    res.json({ success: true, counts: entry.counts, userVote });
});

app.post('/api/vote', (req, res) => {
    if (!votesAllowed(req)) return res.status(403).json({ success: false, message: 'Voting disabled on this host.' });
    const token = getRequestSessionToken(req);
    if (!token || !userSessions.has(token)) return res.status(403).json({ success: false, message: 'Login required to vote.' });
    const session = userSessions.get(token);
    const { category, skinName, vote } = req.body || {};
    if (!skinName || !vote) return res.status(400).json({ success: false, message: 'Missing parameters.' });
    const allowed = new Set(['overprice', 'perfect', 'underprice']);
    if (!allowed.has(String(vote))) return res.status(400).json({ success: false, message: 'Invalid vote option.' });

    const all = loadJSON(VOTES_FILE, []);
    const key = `${String(category||'').trim()}|||${String(skinName||'').trim()}`;
    let entry = all.find(e => e.skinKey === key);
    if (!entry) {
        entry = { skinKey: key, category: category || '', skinName: skinName, counts: { overprice:0, perfect:0, underprice:0 }, votes: [] };
        all.push(entry);
    }

    const userId = Number(session.userId);
    const existingIdx = (entry.votes || []).findIndex(v => Number(v.userId) === userId);
    const existingVote = existingIdx !== -1 ? entry.votes[existingIdx] : null;

    const dailyCount = countDailyVotes(all, userId);
    const voteIsNew = existingVote ? false : true;
    // Hardcoded admin user gets unlimited votes — enforced server-side, not bypassable from frontend
    const isUnlimitedVoter = userId === ADMIN_USER_ID;
    if (voteIsNew && !isUnlimitedVoter && dailyCount >= 5) {
        return res.status(429).json({ success: false, message: 'Daily vote limit reached. You can vote up to 5 times per day.' });
    }

    if (existingVote) {
        if (existingVote.vote === vote) {
            return res.json({ success: true, counts: entry.counts, userVote: vote });
        }
        if (entry.counts && entry.counts[existingVote.vote] !== undefined) {
            entry.counts[existingVote.vote] = Math.max(0, entry.counts[existingVote.vote] - 1);
        }
        existingVote.vote = vote;
        existingVote.submittedAt = new Date().toISOString();
        existingVote.username = session.username;
    } else {
        const voteObj = { userId: userId, username: session.username, vote: vote, submittedAt: new Date().toISOString() };
        entry.votes.push(voteObj);
    }

    if (!entry.counts) entry.counts = { overprice:0, perfect:0, underprice:0 };
    entry.counts[vote] = (entry.counts[vote] || 0) + 1;

    try {
        saveJSON(VOTES_FILE, all);
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to save vote.' });
    }

    res.json({ success: true, counts: entry.counts, userVote: vote });
});

/* ── Prices check access endpoint ─────────────────────────────────── */
app.get('/api/prices/check', (req, res) => {
    const token = req.headers['x-session-token'] || req.headers['x-admin-token'] || '';
    
    // Check by token
    if (token && userSessions.has(token)) {
        const session = userSessions.get(token);
        
        // Double check blocklist
        if (isUserBlocked(session.userId, session.username)) {
            return res.json({ success: false, allowed: false, isAdmin: false });
        }
        
        if (Number(session.userId) === ADMIN_USER_ID) {
            return res.json({ success: true, allowed: true, isAdmin: true });
        }
        
        const whitelist = loadJSON(PRICES_WHITELIST_FILE, []);
        const isWhitelisted = whitelist.some(item => Number(item.userId) === Number(session.userId));
        if (isWhitelisted) {
            return res.json({ success: true, allowed: true, isAdmin: false });
        }
    }
    
    res.json({ success: true, allowed: false, isAdmin: false });
});

/* ── Prices Whitelist: get (Admin only) ───────────────────────────── */
app.get('/api/prices/whitelist', requireAdmin, (req, res) => {
    res.json({ success: true, whitelist: loadJSON(PRICES_WHITELIST_FILE, []) });
});

/* ── Prices Whitelist: get public (No auth required) ──────────────── */
app.get('/api/prices/public-whitelist', (req, res) => {
    const list = loadJSON(PRICES_WHITELIST_FILE, []);
    const publicList = list.map(item => ({
        userId: item.userId,
        username: item.username,
        displayName: item.displayName,
        avatarUrl: item.avatarUrl
    }));
    res.json({ success: true, whitelist: publicList });
});


/* ── Prices Whitelist: add (Admin only) ───────────────────────────── */
app.post('/api/prices/whitelist/add', requireAdmin, async (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.json({ success: false, message: 'Username or User ID is required.' });

    try {
        let targetUserId = null;
        let targetUsername = null;
        let targetDisplayName = null;
        let targetAvatarUrl = null;

        const isNumeric = /^\d+$/.test(String(userId).trim());

        if (isNumeric) {
            targetUserId = Number(userId);
            try {
                const profile = await httpsGet(`https://users.roblox.com/v1/users/${targetUserId}`);
                targetUsername = profile.name;
                targetDisplayName = profile.displayName;
            } catch (err) {
                targetUsername = `User #${targetUserId}`;
                targetDisplayName = `User #${targetUserId}`;
            }
        } else {
            // Username lookup
            const search = await httpsPost(
                'https://users.roblox.com/v1/usernames/users',
                { usernames: [String(userId).trim()], excludeBannedUsers: false }
            );
            if (search.data && search.data.length > 0) {
                targetUserId = search.data[0].id;
                targetUsername = search.data[0].name;
                targetDisplayName = search.data[0].displayName;
            } else {
                return res.json({ success: false, message: `Roblox user "${userId}" not found.` });
            }
        }

        // Get avatar url
        if (targetUserId) {
            try {
                const av = await httpsGet(
                    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${targetUserId}&size=150x150&format=Png&isCircular=false`
                );
                targetAvatarUrl = av.data?.[0]?.imageUrl || null;
            } catch (_) {}
        }

        const whitelist = loadJSON(PRICES_WHITELIST_FILE, []);
        
        // Remove existing duplicates
        let filtered = whitelist.filter(item => Number(item.userId) !== Number(targetUserId));

        const newPlaylistItem = {
            userId: targetUserId,
            username: targetUsername,
            displayName: targetDisplayName,
            avatarUrl: targetAvatarUrl || 'assets/placeholder-roblox.png',
            addedAt: new Date().toISOString()
        };

        filtered.push(newPlaylistItem);
        saveJSON(PRICES_WHITELIST_FILE, filtered);

        res.json({ success: true, whitelist: filtered });
    } catch (err) {
        res.json({ success: false, message: 'Error adding to whitelist: ' + err.message });
    }
});

/* ── Prices Whitelist: remove (Admin only) ────────────────────────── */
app.post('/api/prices/whitelist/remove', requireAdmin, (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.json({ success: false, message: 'userId is required.' });

    let list = loadJSON(PRICES_WHITELIST_FILE, []);
    list = list.filter(item => Number(item.userId) !== Number(userId));
    saveJSON(PRICES_WHITELIST_FILE, list);
    res.json({ success: true, whitelist: list });
});

/* ── Prices Suggestions: get list ─────────────────────────────────── */
app.get('/api/prices/suggestions', requirePricesAccess, (req, res) => {
    const suggestions = loadJSON(PRICE_SUGGESTIONS_FILE, []);
    const session = req.userSession;
    
    if (Number(session.userId) === ADMIN_USER_ID) {
        // Return all suggestions for the owner
        return res.json({ success: true, suggestions });
    } else {
        // Return only suggestions made by the current user
        const userSuggestions = suggestions.filter(s => Number(s.userId) === Number(session.userId));
        return res.json({ success: true, suggestions: userSuggestions });
    }
});

/* ── Prices Suggestions: suggest new price ────────────────────────── */
app.post('/api/prices/suggest', requirePricesAccess, (req, res) => {
    const { category, skinName, suggestedUsd } = req.body || {};
    if (!category || !skinName || !suggestedUsd) {
        return res.status(400).json({ success: false, message: 'Missing parameters.' });
    }
    
    // Suggestion exclusions validation
    const lowerCat = category.toLowerCase();
    const lowerSkin = skinName.toLowerCase();
    if (
        (lowerCat === 'beams' && lowerSkin === 'lightning') ||
        (lowerCat === 'tags' && lowerSkin === 'verified') ||
        (lowerCat === 'exclusives' && lowerSkin === 'wings')
    ) {
        return res.status(400).json({ success: false, message: 'This item is excluded from price suggestions.' });
    }

    
    // Validate skin exists in data.json
    const siteData = loadJSON(DATA_FILE, {});
    const cat = siteData.categories?.[category];
    if (!cat || !cat.items?.[skinName]) {
        return res.status(400).json({ success: false, message: 'Skin or category not found in catalog.' });
    }
    
    const item = cat.items[skinName];
    const oldUsd = item ? item.usd : 'N/A';
    
    const session = req.userSession;
    const suggestions = loadJSON(PRICE_SUGGESTIONS_FILE, []);
    
    const newSuggestion = {
        id: require('crypto').randomBytes(16).toString('hex'),
        userId: session.userId,
        username: session.username,
        displayName: session.displayName,
        avatarUrl: session.avatarUrl,
        category,
        skinName,
        oldUsd,
        suggestedUsd,
        status: 'pending',
        submittedAt: new Date().toISOString()
    };
    
    suggestions.push(newSuggestion);
    saveJSON(PRICE_SUGGESTIONS_FILE, suggestions);
    
    res.json({ success: true, suggestion: newSuggestion });
});

/* ── Prices Suggestions: approve (Admin only) ─────────────────────── */
app.post('/api/prices/approve', requireAdmin, (req, res) => {
    const { suggestionId } = req.body || {};
    if (!suggestionId) return res.status(400).json({ success: false, message: 'Missing suggestionId.' });
    
    const suggestions = loadJSON(PRICE_SUGGESTIONS_FILE, []);
    const sugg = suggestions.find(s => s.id === suggestionId);
    
    if (!sugg) return res.status(404).json({ success: false, message: 'Suggestion not found.' });
    
    // Update suggestion status
    sugg.status = 'approved';
    saveJSON(PRICE_SUGGESTIONS_FILE, suggestions);
    
    // Update site data
    const siteData = loadJSON(DATA_FILE, {});
    const cat = siteData.categories?.[sugg.category];
    if (cat && cat.items?.[sugg.skinName]) {
        const item = cat.items[sugg.skinName];
        item.usd = sugg.suggestedUsd;
        
        // Calculate robux price if not exclusive
        if (item.robux !== 'X') {
            const usdVal = parseFloat(sugg.suggestedUsd.replace(/\./g, '').replace(/,/g, ''));
            if (!isNaN(usdVal)) {
                const robuxVal = usdVal * 200;
                item.robux = robuxVal.toLocaleString('de-DE'); // formatted with dot as thousands separator
            }
        }
        saveJSON(DATA_FILE, siteData);
    }
    
    res.json({ success: true, suggestions });
});

/* ── Prices Suggestions: deny (Admin only) ────────────────────────── */
app.post('/api/prices/deny', requireAdmin, (req, res) => {
    const { suggestionId } = req.body || {};
    if (!suggestionId) return res.status(400).json({ success: false, message: 'Missing suggestionId.' });
    
    let suggestions = loadJSON(PRICE_SUGGESTIONS_FILE, []);
    // Remove the denied suggestion completely so it disappears from the queue
    suggestions = suggestions.filter(s => s.id !== suggestionId);
    saveJSON(PRICE_SUGGESTIONS_FILE, suggestions);
    
    res.json({ success: true, suggestions });
});

/* ── Prices Suggestions: revert approved → pending (Admin only) ───── */
app.post('/api/prices/revert', requireAdmin, (req, res) => {
    const { suggestionId } = req.body || {};
    if (!suggestionId) return res.status(400).json({ success: false, message: 'Missing suggestionId.' });
    
    const suggestions = loadJSON(PRICE_SUGGESTIONS_FILE, []);
    const sugg = suggestions.find(s => s.id === suggestionId);
    
    if (!sugg) return res.status(404).json({ success: false, message: 'Suggestion not found.' });
    if (sugg.status !== 'approved') return res.status(400).json({ success: false, message: 'Only approved suggestions can be reverted.' });
    
    // Restore the old price in data.json
    const siteData = loadJSON(DATA_FILE, {});
    const cat = siteData.categories?.[sugg.category];
    if (cat && cat.items?.[sugg.skinName] && sugg.oldUsd) {
        const item = cat.items[sugg.skinName];
        item.usd = sugg.oldUsd;
        
        // Recalculate robux if not exclusive
        if (item.robux !== 'X') {
            const usdVal = parseFloat(sugg.oldUsd.replace(/\./g, '').replace(/,/g, ''));
            if (!isNaN(usdVal)) {
                item.robux = (usdVal * 200).toLocaleString('de-DE');
            }
        }
        saveJSON(DATA_FILE, siteData);
    }
    
    // Mark suggestion as pending again
    sugg.status = 'pending';
    saveJSON(PRICE_SUGGESTIONS_FILE, suggestions);
    
    res.json({ success: true, suggestions });
});

/* ── Trading Server Link dynamic fetcher ─────────────────────────── */
async function getLatestTradingServerLink() {
    try {
        const siteData = loadJSON(DATA_FILE, {});
        if (siteData.config && siteData.config.tradingServerLink) {
            return siteData.config.tradingServerLink;
        }
    } catch (err) {
        console.error(`[Trading Server] Failed to read from data.json:`, err.message);
    }
    // Fallback to user's new link
    return "https://www.roblox.com/share?code=dc8105db6038374e83b43a7ef874780a&type=Server";
}

app.get('/api/trading-server', async (req, res) => {
    const link = await getLatestTradingServerLink();
    res.json({ success: true, link });
});

// API fallback should return JSON, not HTML - MUST BE AFTER ALL SPECIFIC ROUTES
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found.' });
});

app.use((err, req, res, next) => {
    if (err && err.status === 400 && err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, message: 'Invalid JSON body.' });
    }
    return next(err);
});

/* ── Start server ────────────────────────────────────────────────── */
const server = app.listen(PORT, () => {
    // Automatically map skin, tag, beam, and frame images on startup
    try {
        const data = loadJSON(DATA_FILE, {});
        updateSkinImages(data);
        saveJSON(DATA_FILE, data);
        console.log(`  [Startup] Image mappings automatically updated successfully.`);
    } catch (err) {
        console.error(`  [Startup] Failed to map images:`, err.message);
    }

    console.log(`\n  ✦ HC Values is running → http://localhost:${PORT}\n`);
    console.log(`  Admin ID: ${ADMIN_USER_ID}`);
    console.log(`  Session token: ${SESSION_COOKIE_NAME}`);
    console.log(`  Session expiry: ${SESSION_TTL_DAYS} days`);
    console.log(`  Persisted sessions file: ${SESSIONS_FILE}`);
    console.log(`  Protected data files: data.json, stats.json, blocklist.json, sessions.json, trending.json, price-suggestions.json, prices-whitelist.json`);
    console.log(`  Security: CSP enabled, frame protection enabled, direct file browsing blocked`);
    console.log(`  Access: public UI + protected API, raw data files blocked`);
    console.log(`  Press Ctrl+C to stop.\n`);
});

/* ── Auto-start Status & Token Bot alongside server ────────────── */
let statusBotProcess = null;
if (process.env.AUTO_START_STATUS_BOT !== 'false') {
    const statusBotPath = path.join(__dirname, 'status-bot.js');
    if (fs.existsSync(statusBotPath)) {
        const { fork } = require('child_process');
        function launchStatusBot() {
            try {
                statusBotProcess = fork(statusBotPath, [], {
                    env: { ...process.env, STATUS_BOT_SUPERVISED: '1' },
                    stdio: 'inherit'
                });
                statusBotProcess.on('exit', (code) => {
                    if (code !== 0 && code !== null) {
                        console.warn(`  [StatusBot] Exited with code ${code}. Auto-restarting in 5s...`);
                        setTimeout(launchStatusBot, 5000);
                    }
                });
            } catch (err) {
                console.warn('  [StatusBot] Could not launch status bot:', err.message);
            }
        }
        launchStatusBot();
    }
}

/* ── Graceful shutdown (used by stop_all.bat / process managers) ── */
function gracefulShutdown(signal) {
    console.log(`\n  [Shutdown] Received ${signal}. Closing server gracefully...`);
    if (statusBotProcess) {
        try { statusBotProcess.kill('SIGTERM'); } catch (_) {}
    }
    server.close(() => {
        console.log(`  [Shutdown] Server closed. Goodbye.\n`);
        process.exit(0);
    });
    // Force-exit after 5 seconds if something is hanging
    setTimeout(() => {
        console.error(`  [Shutdown] Forced exit after timeout.`);
        process.exit(1);
    }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
