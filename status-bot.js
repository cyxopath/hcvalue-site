// status-bot.js — HC Value Discord Status Bot
// Pings the site every 5 minutes and updates a Discord channel message with 🟢 or 🔴

const https = require('https');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const STATUS_CHANNEL_ID = process.env.STATUS_CHANNEL_ID;
const SITE_URL = process.env.SITE_URL || 'https://hcvalue-site-production.up.railway.app';

let statusMessageId = null;

function discordRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'discord.com',
      path: `/api/v10${path}`,
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
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function checkSite() {
  return new Promise(resolve => {
    const req = https.get(SITE_URL, { timeout: 10000 }, res => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function updateStatus() {
  const isUp = await checkSite();
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Amsterdam' });

  const content = isUp
    ? `🟢 **HC Value is ONLINE**\nLast checked: ${now}`
    : `🔴 **HC Value is OFFLINE**\nLast checked: ${now}`;

  try {
    if (statusMessageId) {
      await discordRequest('PATCH', `/channels/${STATUS_CHANNEL_ID}/messages/${statusMessageId}`, { content });
      console.log(`[${now}] Status updated: ${isUp ? 'ONLINE' : 'OFFLINE'}`);
    } else {
      // Send first message and save its ID so we edit it every time (keeps channel clean)
      const msg = await discordRequest('POST', `/channels/${STATUS_CHANNEL_ID}/messages`, { content });
      statusMessageId = msg.id;
      console.log(`[${now}] Status message created: ${statusMessageId}`);
    }
  } catch (err) {
    console.error('Discord API error:', err);
  }
}

// Run immediately on startup, then every 5 minutes
updateStatus();
setInterval(updateStatus, 5 * 60 * 1000);
console.log('HC Value Status Bot started! Checking site every 5 minutes.');
