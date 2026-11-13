/* ────────────────────────────────────────────────────────────────
   HC Values – server.js
   Lightweight Node/Express backend — run: node server.js
   ──────────────────────────────────────────────────────────────── */

try { require('dotenv').config(); } catch (_) {}

const express = require('express');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');

const app  = express();
const PORT = process.env.PORT || 8000;
const PRIMARY_ADMIN_DISCORD_ID = '1512110331718013121';
const SECONDARY_ADMIN_DISCORD_ID = '1548279754908508283';
const ADMIN_DISCORD_ID = (process.env.ADMIN_DISCORD_ID || SECONDARY_ADMIN_DISCORD_ID).trim();
const ALLOWED_ADMIN_IDS = new Set([PRIMARY_ADMIN_DISCORD_ID, SECONDARY_ADMIN_DISCORD_ID]);
if (process.env.ADMIN_DISCORD_ID && process.env.ADMIN_DISCORD_ID.trim()) {
    ALLOWED_ADMIN_IDS.add(process.env.ADMIN_DISCORD_ID.trim());
}

function isUserAdmin(userId) {
    if (!userId) return false;
    const cleanId = String(userId).trim();
    return ALLOWED_ADMIN_IDS.has(cleanId);
}

const DATA_ACCESS_COOKIE = 'hc_data_session';
const SESSION_COOKIE_NAME = 'hc_session_token';
const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
