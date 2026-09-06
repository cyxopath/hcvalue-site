// status-bot.js — HC Value Discord Status Bot & Token Generator
// 1. Renames a voice channel to 🟢 or 🔴 based on whether the site is up
// 2. Listens for ,ctoken <discord id or @mention> in your server to generate manual login tokens

require('dotenv').config();
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Configuration ────────────────────────────────────────────────────────────
const BOT_TOKEN           = (process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || '').trim();
const STATUS_CHANNEL_ID   = (process.env.STATUS_CHANNEL_ID || '').trim();
const SITE_URL            = process.env.SITE_URL || 'https://hcvalue-site-production.up.railway.app';
const PORT                = process.env.PORT || 8000;
const INTERNAL_SERVER_URL = process.env.INTERNAL_SERVER_URL || `http://localhost:${PORT}`;
const REQUIRED_ROLE_ID    = '1533700275028627636'; // Only members with this role can generate
const ADMIN_DISCORD_ID    = process.env.ADMIN_DISCORD_ID || '1512110331718013121'; // Site owner/admin Discord ID
const SESSION_TTL_MS      = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Storage Paths (mirroring server.js DATA_DIR) ─────────────────────────────
let DATA_DIR = __dirname;
if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
    DATA_DIR = path.resolve(process.env.DATA_DIR.trim());
} else if (process.env.RAILWAY_ENVIRONMENT || fs.existsSync('/data')) {
    DATA_DIR = '/data';
}

const SESSIONS_FILE      = path.join(DATA_DIR, 'sessions.json');
const DISCORD_LINKS_FILE = path.join(DATA_DIR, 'discord-links.json');
const BLOCKLIST_FILE     = path.join(DATA_DIR, 'blocklist.json');

// ── File Helpers ─────────────────────────────────────────────────────────────
function loadJSON(filePath, fallback = {}) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.warn(`[Storage] Failed to read ${filePath}:`, e.message);
        return fallback;
    }
}

function saveJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error(`[Storage] Failed to write ${filePath}:`, e.message);
        return false;
    }
}

function isUserBlocked(userId, username) {
    const blocklist = loadJSON(BLOCKLIST_FILE, []);
    const numId = Number(userId);
    const lowUser = String(username || '').toLowerCase();
    return blocklist.some(item => {
        if (typeof item === 'object' && item !== null) {
            return Number(item.userId) === numId || (item.username && item.username.toLowerCase() === lowUser);
        }
        return Number(item) === numId || String(item).toLowerCase() === lowUser;
    });
}

// ── HTTP Request Helpers ─────────────────────────────────────────────────────
function discordRequest(method, endpoint, body) {
    return new Promise((resolve, reject) => {
        if (!BOT_TOKEN) return reject(new Error('DISCORD_BOT_TOKEN is not configured in .env'));
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: 'discord.com',
            path: `/api/v10${endpoint}`,
            method,
            headers: {
                'Authorization': `Bot ${BOT_TOKEN}`,
                'Content-Type': 'application/json',
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
            }
        };
        const req = https.request(options, res => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(raw); } catch { parsed = raw; }
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(parsed);
                } else {
                    const err = new Error(parsed?.message || `Discord API returned ${res.statusCode}`);
                    err.code = parsed?.code;
                    err.status = res.statusCode;
                    err.data = parsed;
                    reject(err);
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'HCValues-StatusBot/1.0' }, timeout: 10000 }, res => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
            });
        }).on('error', reject);
    });
}

function httpsPost(url, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const data = JSON.stringify(body);
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'User-Agent': 'HCValues-StatusBot/1.0'
            },
            timeout: 10000
        }, res => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// ── Discord User Lookup & Avatar Extraction ──────────────────────────────────
function getDiscordAvatarUrl(discordUser) {
    if (discordUser && discordUser.avatar) {
        const ext = discordUser.avatar.startsWith('a_') ? 'gif' : 'png';
        return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${ext}?size=128`;
    }
    const idx = discordUser && discordUser.id ? Number((BigInt(discordUser.id) >> 22n) % 6n) : 0;
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

async function fetchDiscordUser(discordId) {
    try {
        return await discordRequest('GET', `/users/${discordId}`);
    } catch (e) {
        console.warn(`[Discord] Could not fetch user ${discordId}:`, e.message);
        return null;
    }
}

function extractFirstName(discordUser) {
    if (!discordUser) return 'there';
    const fullName = (discordUser.global_name || discordUser.username || '').trim();
    if (!fullName) return 'there';
    const firstWord = fullName.split(/\s+/)[0];
    return firstWord || fullName;
}

// ── Token Generation Core (Discord-only) ─────────────────────────────────────
async function generateToken(targetDiscordId) {
    // 1. Resolve Discord user via Discord Bot API
    const discordUser = await fetchDiscordUser(targetDiscordId);
    if (!discordUser || !discordUser.id) {
        return {
            success: false,
            message: `Discord user "${targetDiscordId}" could not be found via Discord API. Make sure the ID is correct.`
        };
    }

    const discordUsername = discordUser.username || '';
    const displayName = discordUser.global_name || discordUser.username || targetDiscordId;
    const firstName = extractFirstName(discordUser);

    // 2. Block check
    if (isUserBlocked(discordUser.id, discordUsername)) {
        return {
            success: false,
            message: `User "${discordUsername}" (ID: ${discordUser.id}) is on the blocklist.`
        };
    }

    // 3. Fetch Discord avatar
    const avatarUrl = getDiscordAvatarUrl(discordUser);

    // 4. Generate secure 32-byte hex token
    const userToken = crypto.randomBytes(32).toString('hex');
    const isAdmin = String(discordUser.id) === String(ADMIN_DISCORD_ID);
    const loginTime = Date.now();
    const expiresAt = loginTime + SESSION_TTL_MS;

    const newSession = {
        token: userToken,
        userId: String(discordUser.id),
        username: discordUsername,
        displayName: displayName,
        avatarUrl: avatarUrl,
        discordId: String(discordUser.id),
        loginTime: loginTime,
        expiresAt: expiresAt,
        isAdmin: isAdmin,
        manualToken: true
    };

    // 5. Persist to sessions.json (replaces any previous session for this discord user)
    try {
        const savedSessions = loadJSON(SESSIONS_FILE, []);
        const filtered = Array.isArray(savedSessions)
            ? savedSessions.filter(s => String(s?.userId) !== String(discordUser.id) && String(s?.discordId) !== String(discordUser.id))
            : [];
        filtered.push(newSession);
        saveJSON(SESSIONS_FILE, filtered);
    } catch (e) {
        console.error('[Token] Failed to write sessions.json:', e);
    }

    // 6. Persist to discord-links.json
    try {
        const allLinks = loadJSON(DISCORD_LINKS_FILE, {});
        const existing = allLinks[String(discordUser.id)] || {};
        allLinks[String(discordUser.id)] = {
            ...existing,
            discordId: String(discordUser.id).trim(),
            discordUsername: discordUsername || existing.discordUsername || '',
            discordAvatar: avatarUrl,
            lastLoginAt: new Date().toISOString(),
            manualToken: true
        };
        saveJSON(DISCORD_LINKS_FILE, allLinks);
    } catch (e) {
        console.error('[Token] Failed to write discord-links.json:', e);
    }

    // 7. Live sync with running server.js if available locally
    try {
        const syncData = JSON.stringify(newSession);
        const req = http.request(`${INTERNAL_SERVER_URL}/api/internal/session-sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(syncData)
            },
            timeout: 2000
        });
        req.on('error', () => {}); // Silently ignore if server not online
        req.write(syncData);
        req.end();
    } catch (_) {}

    // 8. DM the user on Discord
    let dmSuccess = false;
    let dmError = null;
    try {
        const dmChannel = await discordRequest('POST', '/users/@me/channels', { recipient_id: targetDiscordId });
        if (dmChannel && dmChannel.id) {
            const dmContent = `Hey **${firstName}**, your login token for **HC Values** has been generated:`;
            const dmEmbed = {
                title: 'HC Values Login Token',
                description: 'Here is your manual login token for **https://hcvalue.xyz**.\nCopy the token below and use the **"Have a token? Login here."** button on the website.',
                color: 0x5865F2,
                fields: [
                    {
                        name: 'Login Token',
                        value: `\`\`\`${userToken}\`\`\``
                    },
                    {
                        name: 'Discord Account',
                        value: `**${displayName}** (@${discordUsername})\nID: \`${discordUser.id}\``,
                        inline: true
                    },
                    {
                        name: 'Expires',
                        value: '30 days',
                        inline: true
                    },
                    {
                        name: 'How to Login',
                        value: '1. Go to **https://hcvalue.xyz**\n2. Click **"Have a token? Login here."**\n3. Paste the token above and click **Login**.',
                        inline: false
                    }
                ],
                thumbnail: { url: avatarUrl },
                footer: { text: 'HC Values | Keep this token private and do not share it.' }
            };
            await discordRequest('POST', `/channels/${dmChannel.id}/messages`, {
                content: dmContent,
                embeds: [dmEmbed]
            });
            dmSuccess = true;
            console.log(`[Token] Sent DM to ${targetDiscordId} (${firstName})`);
        }
    } catch (e) {
        dmError = e.code === 50007 ? 'User DMs are closed' : e.message;
        console.warn(`[Token] Could not DM user ${targetDiscordId}:`, dmError);
    }

    return {
        success: true,
        token: userToken,
        discordUser,
        displayName,
        username: discordUsername,
        firstName,
        avatarUrl,
        expiresAt,
        dmSuccess,
        dmError
    };
}

// ── Build Clean Channel Embed ────────────────────────────────────────────────
function buildChannelEmbed(result, targetDiscordId) {
    const expDate = new Date(result.expiresAt).toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
    });

    return {
        title: 'Generated Login Token',
        color: 0x5865F2,
        fields: [
            {
                name: 'Token',
                value: `\`\`\`${result.token}\`\`\``
            },
            {
                name: 'Discord User',
                value: `<@${targetDiscordId}>\n**${result.displayName}** (@${result.username})\nID: \`${targetDiscordId}\``,
                inline: true
            },
            {
                name: 'Expires',
                value: `${expDate} (30 days)`,
                inline: false
            }
        ],
        thumbnail: result.avatarUrl ? { url: result.avatarUrl } : undefined,
        footer: { text: 'HC Values | Token Generator' },
        timestamp: new Date().toISOString()
    };
}

// ── Check Role Permission ────────────────────────────────────────────────────
function isMemberAuthorized(member) {
    if (!member) return false;
    const roles = Array.isArray(member.roles) ? member.roles : [];
    // Only role ID 1533700275028627636 can generate
    if (roles.includes(REQUIRED_ROLE_ID)) return true;
    // Server administrator safety check
    if (member.permissions && (BigInt(member.permissions) & 0x8n) === 0x8n) return true;
    return false;
}

// ── Discord Gateway Connection ───────────────────────────────────────────────
const WsConstructor = typeof WebSocket !== 'undefined' ? WebSocket : (function() {
    try { return require('ws'); } catch { return null; }
})();

let wsInstance = null;
let heartbeatTimer = null;
let lastSequence = null;

function connectGateway() {
    if (!BOT_TOKEN) {
        console.error('[Gateway] Cannot connect: DISCORD_BOT_TOKEN is not set in .env');
        return;
    }
    if (!WsConstructor) {
        console.error('[Gateway] WebSocket client is unavailable.');
        return;
    }

    console.log('[Gateway] Connecting to Discord Gateway...');
    const ws = new WsConstructor('wss://gateway.discord.gg/?v=10&encoding=json');
    wsInstance = ws;

    ws.onopen = () => {
        console.log('[Gateway] Connection established.');
    };

    ws.onmessage = async (event) => {
        let payload = null;
        try {
            payload = JSON.parse(event.data);
        } catch {
            return;
        }

        const { op, d, s, t } = payload;
        if (s !== null && s !== undefined) lastSequence = s;

        // Op 10: Hello -> Start heartbeat and identify
        if (op === 10) {
            const interval = d.heartbeat_interval;
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            heartbeatTimer = setInterval(() => {
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ op: 1, d: lastSequence }));
                }
            }, interval);

            // Intents: GUILDS (1) + GUILD_MESSAGES (512) + DIRECT_MESSAGES (4096) + MESSAGE_CONTENT (32768)
            const intents = 1 | 512 | 4096 | 32768;
            ws.send(JSON.stringify({
                op: 2,
                d: {
                    token: BOT_TOKEN,
                    intents,
                    properties: { os: process.platform, browser: 'hcvalues-bot', device: 'hcvalues-bot' }
                }
            }));
        }

        // Op 11: Heartbeat ACK
        if (op === 11) {
            // Heartbeat acknowledged
        }

        // Op 0: Dispatch Events
        if (op === 0) {
            // READY Event
            if (t === 'READY') {
                console.log(`[Gateway] READY! Logged in as ${d.user.username}#${d.user.discriminator} (ID: ${d.user.id})`);
                console.log(`[Gateway] Connected to ${d.guilds?.length || 0} server(s).`);
                console.log(`[Gateway] Listening for ,ctoken command! (Role ID: ${REQUIRED_ROLE_ID})`);
            }

            // MESSAGE_CREATE Event (,ctoken command)
            if (t === 'MESSAGE_CREATE') {
                handleMessageCreate(d);
            }
        }
    };

    ws.onclose = (event) => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        console.warn(`[Gateway] Disconnected. Code: ${event.code}, Reason: ${event.reason || 'None'}`);

        // Code 4014: Disallowed intent(s)
        if (event.code === 4014) {
            console.warn('═══════════════════════════════════════════════════════════════════════');
            console.warn('⚠️ [Gateway] Discord rejected MESSAGE_CONTENT intent (code 4014).');
            console.warn('👉 To use ,ctoken, please enable "Message Content Intent" in your Discord Developer Portal:');
            console.warn('   1. Go to https://discord.com/developers/applications');
            console.warn('   2. Select your Bot -> Click "Bot" tab');
            console.warn('   3. Scroll down to "Privileged Gateway Intents"');
            console.warn('   4. Toggle "Message Content Intent" to ON and save!');
            console.warn('═══════════════════════════════════════════════════════════════════════');
        }

        // Auto-reconnect after 5 seconds to keep bot online
        setTimeout(connectGateway, 5000);
    };

    ws.onerror = (err) => {
        console.error('[Gateway] Error:', err.message || err);
    };
}

// ── Handle Prefix Command: ,ctoken ───────────────────────────────────────────
async function handleMessageCreate(msg) {
    if (!msg || msg.author?.bot) return;
    const content = (msg.content || '').trim();

    // Check if message starts with ,ctoken
    if (!content.startsWith(',ctoken')) return;

    const channelId = msg.channel_id;

    // Check authorization role (only role 1533700275028627636 can generate)
    if (!isMemberAuthorized(msg.member)) {
        try {
            await discordRequest('POST', `/channels/${channelId}/messages`, {
                content: `**Permission Denied:** You must have the <@&${REQUIRED_ROLE_ID}> role to generate tokens.`,
                message_reference: { message_id: msg.id }
            });
        } catch (_) {}
        return;
    }

    // Parse parameters: ,ctoken <discord id or @mention>
    const parts = content.split(/\s+/);
    if (parts.length < 2) {
        try {
            await discordRequest('POST', `/channels/${channelId}/messages`, {
                content: `**Invalid Usage:**\nFormat: \`,ctoken <discord id or @mention>\`\nExample: \`,ctoken 1512110331718013121\` or \`,ctoken @User\`\nNote: Discord must be the numeric User ID or a direct user mention.`,
                message_reference: { message_id: msg.id }
            });
        } catch (_) {}
        return;
    }

    const rawDiscordId = parts[1];
    const cleanDiscordId = rawDiscordId.replace(/[<@!>]/g, '').trim();

    if (!/^\d{17,20}$/.test(cleanDiscordId)) {
        try {
            await discordRequest('POST', `/channels/${channelId}/messages`, {
                content: `**Invalid Discord ID:** "${rawDiscordId}". You must provide ONLY a numeric Discord User ID or user mention.`,
                message_reference: { message_id: msg.id }
            });
        } catch (_) {}
        return;
    }

    // Execute token generation
    const result = await generateToken(cleanDiscordId);

    if (!result.success) {
        try {
            await discordRequest('POST', `/channels/${channelId}/messages`, {
                content: `**Token Generation Failed:** ${result.message}`,
                message_reference: { message_id: msg.id }
            });
        } catch (_) {}
        return;
    }

    // Reply in channel with embed matching the website token generator
    const embed = buildChannelEmbed(result, cleanDiscordId);
    try {
        await discordRequest('POST', `/channels/${channelId}/messages`, {
            embeds: [embed],
            message_reference: { message_id: msg.id }
        });
    } catch (e) {
        console.error('[Command] Failed to send channel response:', e);
    }
}

// ── Site Status Voice Channel Renaming ───────────────────────────────────────
function checkSite() {
    return new Promise(resolve => {
        const u = new URL(SITE_URL);
        const client = u.protocol === 'https:' ? https : http;
        const req = client.get(SITE_URL, { timeout: 10000 }, res => {
            resolve(res.statusCode >= 200 && res.statusCode < 400);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

async function updateStatus() {
    if (!STATUS_CHANNEL_ID) {
        return;
    }

    const isUp = await checkSite();
    const now = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Amsterdam' });
    const newName = isUp ? '🟢 HC Value Online' : '🔴 HC Value Offline';

    try {
        await discordRequest('PATCH', `/channels/${STATUS_CHANNEL_ID}`, { name: newName });
        console.log(`[${now}] Channel renamed to: ${newName}`);
    } catch (err) {
        console.warn('Discord API voice channel error:', err.message);
    }
}

// ── Startup ──────────────────────────────────────────────────────────────────
console.log('✦ HC Value Status Bot & Token Generator starting...');
console.log(`  Required Role ID : ${REQUIRED_ROLE_ID}`);
console.log(`  Site URL         : ${SITE_URL}`);
console.log(`  Data Storage     : ${DATA_DIR}`);

// 1. Run site check immediately, then every 5 minutes (if voice channel configured)
if (STATUS_CHANNEL_ID) {
    updateStatus();
    setInterval(updateStatus, 5 * 60 * 1000);
} else {
    console.log('  Notice: STATUS_CHANNEL_ID not configured in .env (voice channel renaming paused).');
}

// 2. Connect to Discord Gateway for ,ctoken commands (auto-reconnecting)
connectGateway();
