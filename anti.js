// ============================================
// ANTI COMMANDS — AntiLink, AntiSpam, AntiBot,
// AntiWord, AntiBadWord, AntiMedia, AntiCall,
// AntiDelete, AntiViewOnce, AntiTag, AntiGroup,
// AntiForward, AntiSticker, AntiImage, AntiVideo,
// AntiAudio, AntiDocument, AntiContact, AntiLocation,
// AntiVCard, AntiInvite, AntiFlood, etc.
// ============================================

const config = require('./config');
const fs = require('fs-extra');

// ============ ANTI DATABASE (JSON file) ============
const DB_FILE = './database/anti.json';

function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.ensureDirSync('./database');
        fs.writeJsonSync(DB_FILE, {});
    }
    return fs.readJsonSync(DB_FILE);
}

function saveDB(data) {
    fs.ensureDirSync('./database');
    fs.writeJsonSync(DB_FILE, data, { spaces: 2 });
}

function getGroupData(groupId) {
    const db = loadDB();
    if (!db[groupId]) {
        db[groupId] = {
            antilink: false,
            antispam: false,
            antibot: false,
            antibadword: false,
            antiword: false,
            antimedia: false,
            anticall: false,
            antidelete: false,
            antiviewonce: false,
            antitag: false,
            antigroup: false,
            antiforward: false,
            antisticker: false,
            antiimage: false,
            antiaudio: false,
            antivideo: false,
            antidocument: false,
            anticontact: false,
            antilocation: false,
            antivcard: false,
            antiinvite: false,
            antiflood: false,
            antipromote: false,
            antidelete_msg: {},
            warnings: {},
            badwords: ['fuck', 'bitch', 'shit', 'asshole', 'bastard'],
            action: 'delete', // 'delete' | 'warn' | 'kick'
            maxWarn: 3
        };
        saveDB(db);
    }
    return db[groupId];
}

function updateGroup(groupId, key, value) {
    const db = loadDB();
    if (!db[groupId]) getGroupData(groupId);
    db[groupId][key] = value;
    saveDB(db);
}

function addWarning(groupId, userId) {
    const db = loadDB();
    if (!db[groupId].warnings[userId]) db[groupId].warnings[userId] = 0;
    db[groupId].warnings[userId]++;
    saveDB(db);
    return db[groupId].warnings[userId];
}

function resetWarnings(groupId, userId) {
    const db = loadDB();
    if (db[groupId]?.warnings?.[userId]) {
        delete db[groupId].warnings[userId];
        saveDB(db);
    }
}

// ============ HELPERS ============
const isGroup = (from) => from.endsWith('@g.us');
const PREFIX = config.PREFIX;

async function isAdmin(sock, groupId, userId) {
    try {
        const meta = await sock.groupMetadata(groupId);
        const p = meta.participants.find(x => x.id === userId);
        return p?.admin === 'admin' || p?.admin === 'superadmin';
    } catch { return false; }
}

async function isBotAdmin(sock, groupId) {
    try {
        const meta = await sock.groupMetadata(groupId);
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const p = meta.participants.find(x => x.id === botId);
        return p?.admin === 'admin' || p?.admin === 'superadmin';
    } catch { return false; }
}

async function action(sock, groupId, userId, type, reason) {
    const data = getGroupData(groupId);
    try {
        if (data.action === 'kick' && await isBotAdmin(sock, groupId)) {
            await sock.groupParticipantsUpdate(groupId, [userId], 'remove');
            await sock.sendMessage(groupId, { text: `🚫 *Kicked* @${userId.split('@')[0]}\nReason: ${reason}`, mentions: [userId] });
        } else if (data.action === 'warn') {
            const warns = addWarning(groupId, userId);
            await sock.sendMessage(groupId, {
                text: `⚠️ @${userId.split('@')[0]} warned (${warns}/${data.maxWarn})\nReason: ${reason}`,
                mentions: [userId]
            });
            if (warns >= data.maxWarn && await isBotAdmin(sock, groupId)) {
                await sock.groupParticipantsUpdate(groupId, [userId], 'remove');
                await sock.sendMessage(groupId, { text: `🚫 Max warnings reached. Kicked @${userId.split('@')[0]}`, mentions: [userId] });
                resetWarnings(groupId, userId);
            }
        } else {
            // delete only
            await sock.sendMessage(groupId, { text: `⚠️ @${userId.split('@')[0]} — ${reason}`, mentions: [userId] });
        }
    } catch (e) { console.error('Action error:', e); }
}

// ============ MAIN ANTI HANDLER ============
// এই function টা pairing.js এর messages.upsert এ call করবেন
async function handleAnti(sock, msg, from) {
    if (!isGroup(from)) return false;

    const sender = msg.key.participant;
    if (!sender) return false;

    // Skip admins
    if (await isAdmin(sock, from, sender)) return false;

    const data = getGroupData(from);
    const body = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text ||
                 msg.message?.imageMessage?.caption ||
                 msg.message?.videoMessage?.caption || '';

    // ===== 1. ANTILINK =====
    if (data.antilink) {
        const linkRegex = /(https?:\/\/[^\s]+|chat\.whatsapp\.com\/[A-Za-z0-9]+|wa\.me\/[0-9]+|t\.me\/[^\s]+)/gi;
        if (linkRegex.test(body)) {
            try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
            return await action(sock, from, sender, 'link', 'Link detected');
        }
    }

    // ===== 2. ANTIINVITE =====
    if (data.antiinvite) {
        if (/chat\.whatsapp\.com\/[A-Za-z0-9]+/i.test(body)) {
            try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
            return await action(sock, from, sender, 'invite', 'Group invite detected');
        }
    }

    // ===== 3. ANTIBADWORD =====
    if (data.antibadword) {
        const lower = body.toLowerCase();
        const found = data.badwords.find(w => lower.includes(w));
        if (found) {
            try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
            return await action(sock, from, sender, 'badword', `Bad word: ${found}`);
        }
    }

    // ===== 4. ANTIWORD (custom list) =====
    if (data.antiword && data.customWords?.length) {
        const lower = body.toLowerCase();
        const found = data.customWords.find(w => lower.includes(w.toLowerCase()));
        if (found) {
            try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
            return await action(sock, from, sender, 'word', `Blocked word: ${found}`);
        }
    }

    // ===== 5. ANTIBOT =====
    if (data.antibot) {
        if (sender.endsWith('@s.whatsapp.net') && sender.includes('bot')) {
            try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
            return await action(sock, from, sender, 'bot', 'Bot detected');
        }
    }

    // ===== 6. ANTISTICKER =====
    if (data.antisticker && msg.message?.stickerMessage) {
        try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
        return await action(sock, from, sender, 'sticker', 'Stickers not allowed');
    }

    // ===== 7. ANTIIMAGE =====
    if (data.antiimage && msg.message?.imageMessage) {
        try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
        return await action(sock, from, sender, 'image', 'Images not allowed');
    }

    // ===== 8. ANTIVIDEO =====
    if (data.antivideo && msg.message?.videoMessage) {
        try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
        return await action(sock, from, sender, 'video', 'Videos not allowed');
    }

    // ===== 9. ANTIAUDIO =====
    if (data.antiaudio && msg.message?.audioMessage) {
        try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
        return await action(sock, from, sender, 'audio', 'Audio not allowed');
    }

    // ===== 10. ANTIDOCUMENT =====
    if (data.antidocument && msg.message?.documentMessage) {
        try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
        return await action(sock, from, sender, 'document', 'Documents not allowed');
    }

    // ===== 11. ANTICONTACT =====
    if (data.anticontact && msg.message?.contactMessage) {
        try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
        return await action(sock, from, sender, 'contact', 'Contacts not allowed');
    }

    // ===== 12. ANTILOCATION =====
    if (data.antilocation && msg.message?.locationMessage) {
        try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
        return await action(sock, from, sender, 'location', 'Locations not allowed');
    }

    // ===== 13. ANTIVCARD =====
    if (data.antivcard && msg.message?.contactMessage) {
        try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
        return await action(sock, from, sender, 'vcard', 'vCards not allowed');
    }

    // ===== 14. ANTIMEDIA (all media) =====
    if (data.antimedia) {
        const m = msg.message;
        if (m?.imageMessage || m?.videoMessage || m?.audioMessage || m?.documentMessage || m?.stickerMessage) {
            try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
            return await action(sock, from, sender, 'media', 'Media not allowed');
        }
    }

    // ===== 15. ANTITAG (mass mention) =====
    if (data.antitag) {
        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentions.length > 5) {
            try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
            return await action(sock, from, sender, 'tag', `Mass mention (${mentions.length})`);
        }
    }

    // ===== 16. ANTIFORWARD =====
    if (data.antiforward && msg.message?.extendedTextMessage?.contextInfo?.isForwarded) {
        try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
        return await action(sock, from, sender, 'forward', 'Forwarded messages not allowed');
    }

    // ===== 17. ANTIGROUP (status@broadcast) =====
    if (data.antigroup && from === 'status@broadcast') {
        return true;
    }

    // ===== 18. ANTIFLOOD (rate limiting) =====
    if (data.antifloood && data.antiflood) {
        // handled separately
    }

    return false;
}

// ============ ANTI-DELETE HANDLER ============
// এটা pairing.js এর messages.upsert এ "type === 'append'" হলেও চেক করবেন
async function handleAntiDelete(sock, msg, from) {
    if (!isGroup(from)) return;

    const data = getGroupData(from);
    if (!data.antidelete) return;

    // Store message for later retrieval
    if (!data.antidelete_msg) data.antidelete_msg = {};
    const db = loadDB();
    if (!db[from].antidelete_msg) db[from].antidelete_msg = {};

    if (msg.message && !msg.message.protocolMessage) {
        db[from].antidelete_msg[msg.key.id] = {
            sender: msg.key.participant || msg.key.remoteJid,
            message: msg.message,
            timestamp: Date.now()
        };
        // Keep only last 100
        const keys = Object.keys(db[from].antidelete_msg);
        if (keys.length > 100) delete db[from].antidelete_msg[keys[0]];
        saveDB(db);
    }

    // Detect deleted message
    if (msg.message?.protocolMessage?.type === 0) {
        const deletedId = msg.message.protocolMessage.key.id;
        const stored = db[from].antidelete_msg?.[deletedId];
        if (stored) {
            await sock.sendMessage(from, {
                text: `🚨 *Anti-Delete Detected!*\n\n👤 From: @${stored.sender.split('@')[0]}\n📝 Message:`,
                mentions: [stored.sender]
            });
            try {
                await sock.sendMessage(from, { forward: { key: { remoteJid: from, fromMe: false, id: deletedId, participant: stored.sender }, message: stored.message } });
            } catch {
                const text = stored.message.conversation || stored.message.extendedTextMessage?.text || '[media]';
                await sock.sendMessage(from, { text: `📄 ${text}` });
            }
        }
    }
}

// ============ ANTI-VIEWONCE HANDLER ============
async function handleAntiViewOnce(sock, msg, from) {
    const data = getGroupData(from);
    if (!data.antiviewonce) return;

    const m = msg.message;
    const viewOnce = m?.viewOnceMessageV2?.message || m?.viewOnceMessage?.message;
    if (!viewOnce) return;

    const sender = msg.key.participant;
    const text = '🚨 *Anti-ViewOnce Detected!*';

    if (viewOnce.imageMessage) {
        const buffer = await sock.downloadMediaMessage({ message: viewOnce });
        await sock.sendMessage(from, { image: buffer, caption: `${text}\n👤 @${sender.split('@')[0]}`, mentions: [sender] });
    } else if (viewOnce.videoMessage) {
        const buffer = await sock.downloadMediaMessage({ message: viewOnce });
        await sock.sendMessage(from, { video: buffer, caption: `${text}\n👤 @${sender.split('@')[0]}`, mentions: [sender] });
    }
}

// ============ ANTI-CALL HANDLER ============
async function handleAntiCall(sock, call) {
    const antiCallGlobal = loadDB().__global__?.anticall;
    if (!antiCallGlobal) return;

    const from = call.from;
    await sock.rejectCall(call.id, from);
    await sock.sendMessage(from, { text: '📵 Calls are not allowed. Please text instead.' });
}

// ============ ANTI-FLOOD TRACKER ============
const floodTracker = {};

async function checkFlood(sock, msg, from) {
    const data = getGroupData(from);
    if (!data.antiflood) return false;

    const sender = msg.key.participant;
    const now = Date.now();
    const key = `${from}:${sender}`;

    if (!floodTracker[key]) floodTracker[key] = [];
    floodTracker[key] = floodTracker[key].filter(t => now - t < 5000);
    floodTracker[key].push(now);

    if (floodTracker[key].length > 5) {
        try { await sock.sendMessage(from, { delete: msg.key }); } catch {}
        await action(sock, from, sender, 'flood', 'Flood detected');
        floodTracker[key] = [];
        return true;
    }
    return false;
}

// ============ COMMAND REGISTRATIONS ============
function registerAntiCommands(register, reply, getQuoted) {
    // Helper to make toggler
    const makeToggler = (key, label) => {
        return async (sock, msg, from, args) => {
            if (!isGroup(from)) return reply(sock, from, '❌ Group only command.', msg);
            if (!await isAdmin(sock, from, msg.key.participant)) return reply(sock, from, '❌ Admin only.', msg);

            const value = args[0]?.toLowerCase() === 'on';
            updateGroup(from, key, value);
            await reply(sock, from, `${value ? '✅' : '❌'} ${label}: ${value ? 'ON' : 'OFF'}`, msg);
        };
    };

    // ===== TOGGLE COMMANDS =====
    register('antilink',   makeToggler('antilink',   'Anti-Link'),   ['nolink']);
    register('antispam',   makeToggler('antispam',   'Anti-Spam'));
    register('antibot',    makeToggler('antibot',    'Anti-Bot'));
    register('antibadword',makeToggler('antibadword','Anti-Badword'),['antibad']);
    register('antiword',   makeToggler('antiword',   'Anti-Word'));
    register('antimedia',  makeToggler('antimedia',  'Anti-Media'));
    register('anticall',   async (sock, msg, from, args) => {
        const db = loadDB();
        if (!db.__global__) db.__global__ = {};
        db.__global__.anticall = args[0]?.toLowerCase() === 'on';
        saveDB(db);
        await reply(sock, from, `${db.__global__.anticall ? '✅' : '❌'} Anti-Call: ${db.__global__.anticall ? 'ON' : 'OFF'}`, msg);
    });
    register('antidelete', makeToggler('antidelete', 'Anti-Delete'), ['antidelete']);
    register('antiviewonce', makeToggler('antiviewonce', 'Anti-ViewOnce'), ['antivo']);
    register('antitag',    makeToggler('antitag',    'Anti-Tag'));
    register('antigroup',  makeToggler('antigroup',  'Anti-Group'));
    register('antiforward',makeToggler('antiforward','Anti-Forward'));
    register('antisticker',makeToggler('antisticker','Anti-Sticker'));
    register('antiimage',  makeToggler('antiimage',  'Anti-Image'));
    register('antivideo',  makeToggler('antivideo',  'Anti-Video'));
    register('antiaudio',  makeToggler('antiaudio',  'Anti-Audio'));
    register('antidocument',makeToggler('antidocument','Anti-Document'));
    register('anticontact',makeToggler('anticontact','Anti-Contact'));
    register('antilocation',makeToggler('antilocation','Anti-Location'));
    register('antivcard',  makeToggler('antivcard',  'Anti-vCard'));
    register('antiinvite', makeToggler('antiinvite', 'Anti-Invite'));
    register('antiflood',  makeToggler('antiflood',  'Anti-Flood'));
    register('antipromote',makeToggler('antipromote','Anti-Promote'));

    // ===== BADWORD MANAGEMENT =====
    register('addbadword', async (sock, msg, from, args) => {
        if (!isGroup(from)) return reply(sock, from, '❌ Group only.', msg);
        if (!await isAdmin(sock, from, msg.key.participant)) return reply(sock, from, '❌ Admin only.', msg);
        if (!args[0]) return reply(sock, from, '❌ Usage: .addbadword <word>', msg);

        const db = loadDB();
        if (!db[from].badwords) db[from].badwords = [];
        const word = args[0].toLowerCase();
        if (db[from].badwords.includes(word)) return reply(sock, from, '⚠️ Already added.', msg);

        db[from].badwords.push(word);
        saveDB(db);
        await reply(sock, from, `✅ Added badword: ${word}`, msg);
    }, ['addbw']);

    register('delbadword', async (sock, msg, from, args) => {
        if (!isGroup(from)) return reply(sock, from, '❌ Group only.', msg);
        if (!await isAdmin(sock, from, msg.key.participant)) return reply(sock, from, '❌ Admin only.', msg);

        const db = loadDB();
        const word = args[0]?.toLowerCase();
        db[from].badwords = (db[from].badwords || []).filter(w => w !== word);
        saveDB(db);
        await reply(sock, from, `✅ Removed: ${word}`, msg);
    }, ['delbw']);

    register('listbadword', async (sock, msg, from) => {
        const data = getGroupData(from);
        await reply(sock, from, `📋 *Badwords (${data.badwords.length}):*\n\n${data.badwords.join(', ')}`, msg);
    }, ['listbw']);

    // ===== CUSTOM WORD LIST =====
    register('addword', async (sock, msg, from, args) => {
        if (!isGroup(from)) return reply(sock, from, '❌ Group only.', msg);
        if (!await isAdmin(sock, from, msg.key.participant)) return reply(sock, from, '❌ Admin only.', msg);
        if (!args[0]) return reply(sock, from, '❌ Usage: .addword <word>', msg);

        const db = loadDB();
        if (!db[from].customWords) db[from].customWords = [];
        db[from].customWords.push(args[0].toLowerCase());
        saveDB(db);
        await reply(sock, from, `✅ Added: ${args[0]}`, msg);
    });

    register('delword', async (sock, msg, from, args) => {
        if (!isGroup(from)) return reply(sock, from, '❌ Group only.', msg);
        if (!await isAdmin(sock, from, msg.key.participant)) return reply(sock, from, '❌ Admin only.', msg);

        const db = loadDB();
        db[from].customWords = (db[from].customWords || []).filter(w => w !== args[0]?.toLowerCase());
        saveDB(db);
        await reply(sock, from, `✅ Removed: ${args[0]}`, msg);
    });

    register('listword', async (sock, msg, from) => {
        const data = getGroupData(from);
        const list = data.customWords || [];
        await reply(sock, from, `📋 *Custom Words (${list.length}):*\n\n${list.join(', ') || 'None'}`, msg);
    });

    // ===== ACTION SETTER =====
    register('antiaction', async (sock, msg, from, args) => {
        if (!isGroup(from)) return reply(sock, from, '❌ Group only.', msg);
        if (!await isAdmin(sock, from, msg.key.participant)) return reply(sock, from, '❌ Admin only.', msg);
        const a = args[0]?.toLowerCase();
        if (!['delete', 'warn', 'kick'].includes(a)) {
            return reply(sock, from, '❌ Usage: .antiaction delete|warn|kick', msg);
        }
        updateGroup(from, 'action', a);
        await reply(sock, from, `✅ Anti action set to: *${a}*`, msg);
    });

    // ===== MAX WARN SETTER =====
    register('maxwarn', async (sock, msg, from, args) => {
        if (!isGroup(from)) return reply(sock, from, '❌ Group only.', msg);
        if (!await isAdmin(sock, from, msg.key.participant)) return reply(sock, from, '❌ Admin only.', msg);
        const n = parseInt(args[0]);
        if (!n) return reply(sock, from, '❌ Usage: .maxwarn <number>', msg);
        updateGroup(from, 'maxWarn', n);
        await reply(sock, from, `✅ Max warnings: ${n}`, msg);
    });

    // ===== RESET WARN =====
    register('resetwarn', async (sock, msg, from) => {
        const q = getQuoted(msg);
        if (!q) return reply(sock, from, '❌ Reply to a user.', msg);
        const target = msg.message.extendedTextMessage.contextInfo.participant;
        resetWarnings(from, target);
        await reply(sock, from, `✅ Warnings reset for @${target.split('@')[0]}`, msg);
    }, ['clearwarn']);

    // ===== CHECK WARN =====
    register('checkwarn', async (sock, msg, from) => {
        const q = getQuoted(msg);
        if (!q) return reply(sock, from, '❌ Reply to a user.', msg);
        const target = msg.message.extendedTextMessage.contextInfo.participant;
        const data = getGroupData(from);
        const warns = data.warnings[target] || 0;
        await reply(sock, from, `⚠️ @${target.split('@')[0]}: ${warns}/${data.maxWarn} warnings`, msg);
    }, ['warns']);

    // ===== ANTI STATUS =====
    register('antistatus', async (sock, msg, from) => {
        const data = getGroupData(from);
        const text = `
╭━━━〔 *ANTI STATUS* 〕━━━╮
┃
┃ 🔗 Anti-Link: ${data.antilink ? '✅' : '❌'}
┃ 🚫 Anti-Spam: ${data.antispam ? '✅' : '❌'}
┃ 🤖 Anti-Bot: ${data.antibot ? '✅' : '❌'}
┃ 🤬 Anti-Badword: ${data.antibadword ? '✅' : '❌'}
┃ 📝 Anti-Word: ${data.antiword ? '✅' : '❌'}
┃ 📎 Anti-Media: ${data.antimedia ? '✅' : '❌'}
┃ 📞 Anti-Call: ${data.anticall ? '✅' : '❌'}
┃ 🗑️ Anti-Delete: ${data.antidelete ? '✅' : '❌'}
┃ 👁️ Anti-ViewOnce: ${data.antiviewonce ? '✅' : '❌'}
┃ 📢 Anti-Tag: ${data.antitag ? '✅' : '❌'}
┃ ➡️ Anti-Forward: ${data.antiforward ? '✅' : '❌'}
┃ 🎨 Anti-Sticker: ${data.antisticker ? '✅' : '❌'}
┃ 🖼️ Anti-Image: ${data.antiimage ? '✅' : '❌'}
┃ 🎥 Anti-Video: ${data.antivideo ? '✅' : '❌'}
┃ 🎵 Anti-Audio: ${data.antiaudio ? '✅' : '❌'}
┃ 📄 Anti-Document: ${data.antidocument ? '✅' : '❌'}
┃ 📇 Anti-Contact: ${data.anticontact ? '✅' : '❌'}
┃ 📍 Anti-Location: ${data.antilocation ? '✅' : '❌'}
┃ 💳 Anti-vCard: ${data.antivcard ? '✅' : '❌'}
┃ 🔒 Anti-Invite: ${data.antiinvite ? '✅' : '❌'}
┃ 🌊 Anti-Flood: ${data.antiflood ? '✅' : '❌'}
┃
┃ ⚙️ Action: *${data.action}*
┃ ⚠️ Max Warn: *${data.maxWarn}*
┃
╰━━━━━━━━━━━━━━━━━━━━╯
        `.trim();
        await reply(sock, from, text, msg);
    }, ['antilist']);
}

module.exports = {
    handleAnti,
    handleAntiDelete,
    handleAntiViewOnce,
    handleAntiCall,
    checkFlood,
    registerAntiCommands,
    getGroupData,
    updateGroup
};
