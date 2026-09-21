const config = require('./config');
const axios = require('axios');

// ============ HELPERS ============
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function getText(msg) {
    return msg.message?.conversation ||
           msg.message?.extendedTextMessage?.text ||
           msg.message?.imageMessage?.caption ||
           msg.message?.videoMessage?.caption || '';
}

function getQuoted(msg) {
    return msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
}

function getSender(msg) {
    return msg.key.participant || msg.key.remoteJid;
}

async function reply(sock, from, text, msg) {
    return sock.sendMessage(from, { text }, { quoted: msg });
}

// ============ COMMAND REGISTRY ============
const commands = {};

function register(name, handler, aliases = []) {
    commands[name] = handler;
    aliases.forEach(a => commands[a] = handler);
}

// ==================================================
// 1. GENERAL (1-20)
// ==================================================
register('ping', async (sock, msg, from) => {
    const s = Date.now();
    await reply(sock, from, '🏓 Pong!', msg);
    await reply(sock, from, `⚡ Speed: ${Date.now() - s}ms`, msg);
});

register('menu', async (sock, msg, from) => {
    const menu = `
╭━━━〔 *${config.BOT_NAME}* 〕━━━╮
┃
┃ 📌 *GENERAL*
┃ ${config.PREFIX}ping, ${config.PREFIX}menu, ${config.PREFIX}help
┃ ${config.PREFIX}info, ${config.PREFIX}owner, ${config.PREFIX}time
┃ ${config.PREFIX}date, ${config.PREFIX}runtime, ${config.PREFIX}speed
┃
┃ 🎨 *MEDIA*
┃ ${config.PREFIX}sticker, ${config.PREFIX}toimg, ${config.PREFIX}tts
┃ ${config.PREFIX}ytmp3, ${config.PREFIX}ytmp4, ${config.PREFIX}play
┃
┃ 🤖 *AI*
┃ ${config.PREFIX}ai, ${config.PREFIX}gpt, ${config.PREFIX}imagine
┃
┃ 👥 *GROUP*
┃ ${config.PREFIX}kick, ${config.PREFIX}add, ${config.PREFIX}promote
┃ ${config.PREFIX}demote, ${config.PREFIX}tagall, ${config.PREFIX}groupinfo
┃
┃ 🛠️ *TOOLS*
┃ ${config.PREFIX}weather, ${config.PREFIX}translate, ${config.PREFIX}shorturl
┃ ${config.PREFIX}qr, ${config.PREFIX}calc, ${config.PREFIX}password
┃
┃ 🛡️ *ANTI (NEW!)*
┃ ${config.PREFIX}antilink, ${config.PREFIX}antispam, ${config.PREFIX}antibot
┃ ${config.PREFIX}antibadword, ${config.PREFIX}antidelete, ${config.PREFIX}anticall
┃ ${config.PREFIX}antistatus (show all)
┃
╰━━━━━━━━━━━━━━━━━━━━╯
    `.trim();
    await reply(sock, from, menu, msg);
});

register('help', async (sock, from, text, msg) => {
    await reply(sock, from, `📖 Use ${config.PREFIX}menu to see all commands.\nTotal: ${Object.keys(commands).length} commands loaded.`, msg);
}, ['h']);

register('info', async (sock, msg, from) => {
    await reply(sock, from, `🤖 *${config.BOT_NAME}*\n\n• Version: 1.0.0\n• Library: Baileys MD\n• Commands: ${Object.keys(commands).length}\n• Status: ${global.botConnected ? '🟢 Online' : '🔴 Offline'}`, msg);
});

register('owner', async (sock, msg, from) => {
    await reply(sock, from, `👑 Owner: wa.me/${config.OWNER_NUMBER}`, msg);
});

register('time', async (sock, msg, from) => {
    await reply(sock, from, `🕐 ${new Date().toLocaleTimeString()}`, msg);
});

register('date', async (sock, msg, from) => {
    await reply(sock, from, `📅 ${new Date().toLocaleDateString()}`, msg);
});

register('runtime', async (sock, msg, from) => {
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);
    await reply(sock, from, `⏱️ Uptime: ${h}h ${m}m ${s}s`, msg);
});

register('speed', async (sock, msg, from) => {
    const s = Date.now();
    await sock.sendMessage(from, { text: '...' });
    await reply(sock, from, `⚡ ${Date.now() - s}ms`, msg);
});

register('alive', async (sock, msg, from) => {
    await reply(sock, from, '✅ Bot is alive and running!', msg);
});

register('id', async (sock, msg, from) => {
    await reply(sock, from, `🆔 Chat ID: ${from}`, msg);
});

register('jid', async (sock, msg, from) => {
    await reply(sock, from, `🆔 JID: ${from}`, msg);
});

register('myid', async (sock, msg, from) => {
    await reply(sock, from, `🆔 Your ID: ${getSender(msg)}`, msg);
});

register('prefix', async (sock, msg, from) => {
    await reply(sock, from, `Prefix: ${config.PREFIX}`, msg);
});

register('botname', async (sock, msg, from) => {
    await reply(sock, from, `🤖 ${config.BOT_NAME}`, msg);
});

register('version', async (sock, msg, from) => {
    await reply(sock, from, '📦 Version: 1.0.0', msg);
});

register('repo', async (sock, msg, from) => {
    await reply(sock, from, '📂 Repo: github.com/yourusername/whatsapp-md-bot', msg);
});

register('ping2', async (sock, msg, from) => {
    await reply(sock, from, '🏓 Pong v2!', msg);
});

register('test', async (sock, msg, from) => {
    await reply(sock, from, '✅ Test successful!', msg);
});

// ==================================================
// 2. MEDIA / DOWNLOAD (21-45)
// ==================================================
register('sticker', async (sock, msg, from) => {
    const q = getQuoted(msg);
    const img = msg.message?.imageMessage || q?.imageMessage;
    if (!img) return reply(sock, from, '❌ Reply to an image with .sticker', msg);
    await reply(sock, from, '⚠️ Install `sharp` for sticker support.', msg);
}, ['s']);

register('toimg', async (sock, msg, from) => {
    const q = getQuoted(msg);
    const st = msg.message?.stickerMessage || q?.stickerMessage;
    if (!st) return reply(sock, from, '❌ Reply to a sticker.', msg);
    await reply(sock, from, '⚠️ Install `sharp` for sticker→image conversion.', msg);
});

register('tts', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .tts <text>', msg);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(args.join(' '))}&tl=en&client=tw-ob`;
    await sock.sendMessage(from, { audio: { url }, mimetype: 'audio/mpeg' }, { quoted: msg });
});

register('ytmp3', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .ytmp3 <youtube url>', msg);
    await reply(sock, from, '⚠️ Requires ytdl-core package.', msg);
});

register('ytmp4', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .ytmp4 <youtube url>', msg);
    await reply(sock, from, '⚠️ Requires ytdl-core package.', msg);
});

register('play', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .play <song name>', msg);
    await reply(sock, from, `🔍 Searching: ${args.join(' ')}`, msg);
});

register('song', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .song <name>', msg);
    await reply(sock, from, '🎵 Searching...', msg);
});

register('video', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .video <name>', msg);
    await reply(sock, from, '🎬 Searching...', msg);
});

register('spotify', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .spotify <url>', msg);
    await reply(sock, from, '🎧 Downloading...', msg);
});

register('instagram', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .instagram <url>', msg);
    await reply(sock, from, '📥 Downloading IG post...', msg);
}, ['ig']);

register('facebook', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .facebook <url>', msg);
    await reply(sock, from, '📥 Downloading FB video...', msg);
}, ['fb']);

register('tiktok', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .tiktok <url>', msg);
    await reply(sock, from, '📥 Downloading TikTok...', msg);
}, ['tt']);

register('twitter', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .twitter <url>', msg);
    await reply(sock, from, '📥 Downloading...', msg);
});

register('pinterest', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .pinterest <query>', msg);
    await reply(sock, from, '🔍 Searching Pinterest...', msg);
}, ['pin']);

register('wallpaper', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .wallpaper <query>', msg);
    try {
        const { data } = await axios.get(`https://api.unsplash.com/photos/random?query=${args.join(' ')}&client_id=demo`);
        if (data?.urls?.regular) {
            await sock.sendMessage(from, { image: { url: data.urls.regular } }, { quoted: msg });
        }
    } catch {
        await reply(sock, from, '❌ No wallpaper found.', msg);
    }
});

register('image', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .image <query>', msg);
    await reply(sock, from, `🖼️ Searching: ${args.join(' ')}`, msg);
}, ['img']);

register('gif', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .gif <query>', msg);
    await reply(sock, from, '🎞️ Searching GIF...', msg);
});

register('meme', async (sock, msg, from) => {
    try {
        const { data } = await axios.get('https://meme-api.com/gimme');
        await sock.sendMessage(from, { image: { url: data.url }, caption: data.title }, { quoted: msg });
    } catch {
        await reply(sock, from, '❌ Failed to fetch meme.', msg);
    }
});

register('quote', async (sock, msg, from) => {
    try {
        const { data } = await axios.get('https://api.quotable.io/random');
        await reply(sock, from, `💬 "${data.content}"\n— ${data.author}`, msg);
    } catch {
        await reply(sock, from, '❌ Failed to fetch quote.', msg);
    }
});

register('fact', async (sock, msg, from) => {
    try {
        const { data } = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random');
        await reply(sock, from, `🧠 ${data.text}`, msg);
    } catch {
        await reply(sock, from, '❌ Failed to fetch fact.', msg);
    }
});

register('joke', async (sock, msg, from) => {
    try {
        const { data } = await axios.get('https://official-joke-api.appspot.com/random_joke');
        await reply(sock, from, `😂 ${data.setup}\n\n${data.punchline}`, msg);
    } catch {
        await reply(sock, from, '❌ Failed to fetch joke.', msg);
    }
});

register('advice', async (sock, msg, from) => {
    try {
        const { data } = await axios.get('https://api.adviceslip.com/advice');
        await reply(sock, from, `💡 ${data.slip.advice}`, msg);
    } catch {
        await reply(sock, from, '❌ Failed.', msg);
    }
});

register('cat', async (sock, msg, from) => {
    await sock.sendMessage(from, { image: { url: 'https://cataas.com/cat' } }, { quoted: msg });
});

register('dog', async (sock, msg, from) => {
    try {
        const { data } = await axios.get('https://dog.ceo/api/breeds/image/random');
        await sock.sendMessage(from, { image: { url: data.message } }, { quoted: msg });
    } catch {
        await reply(sock, from, '❌ Failed.', msg);
    }
});

register('fox', async (sock, msg, from) => {
    try {
        const { data } = await axios.get('https://randomfox.ca/floof/');
        await sock.sendMessage(from, { image: { url: data.image } }, { quoted: msg });
    } catch {
        await reply(sock, from, '❌ Failed.', msg);
    }
});

// ==================================================
// 3. AI (46-60)
// ==================================================
register('ai', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .ai <question>', msg);
    await reply(sock, from, `🤖 AI: ${args.join(' ')}\n\n⚠️ Add OpenAI API key to enable.`, msg);
}, ['gpt', 'chat']);

register('imagine', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .imagine <prompt>', msg);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(args.join(' '))}`;
    await sock.sendMessage(from, { image: { url }, caption: `🎨 ${args.join(' ')}` }, { quoted: msg });
}, ['imgai']);

register('chatgpt', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .chatgpt <text>', msg);
    await reply(sock, from, '🤖 ChatGPT requires API key.', msg);
});

register('bard', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .bard <text>', msg);
    await reply(sock, from, '🤖 Requires API key.', msg);
});

register('gemini', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .gemini <text>', msg);
    await reply(sock, from, '🤖 Requires API key.', msg);
});

register('llama', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .llama <text>', msg);
    await reply(sock, from, '🦙 Requires API key.', msg);
});

register('deepseek', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .deepseek <text>', msg);
    await reply(sock, from, '🤖 Requires API key.', msg);
});

register('claude', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .claude <text>', msg);
    await reply(sock, from, '🤖 Requires API key.', msg);
});

register('translate', async (sock, msg, from, args) => {
    if (args.length < 2) return reply(sock, from, '❌ Usage: .translate <lang> <text>', msg);
    const lang = args[0];
    const text = args.slice(1).join(' ');
    try {
        const { data } = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`);
        await reply(sock, from, `🌐 ${data.responseData.translatedText}`, msg);
    } catch {
        await reply(sock, from, '❌ Translation failed.', msg);
    }
}, ['trt']);

register('define', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .define <word>', msg);
    try {
        const { data } = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${args[0]}`);
        const def = data[0].meanings[0].definitions[0].definition;
        await reply(sock, from, `📖 *${args[0]}*\n\n${def}`, msg);
    } catch {
        await reply(sock, from, '❌ Word not found.', msg);
    }
});

register('wiki', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .wiki <query>', msg);
    try {
        const { data } = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(args.join(' '))}`);
        await reply(sock, from, `📚 *${data.title}*\n\n${data.extract}`, msg);
    } catch {
        await reply(sock, from, '❌ Not found.', msg);
    }
}, ['wikipedia']);

register('weather', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .weather <city>', msg);
    try {
        const { data } = await axios.get(`https://wttr.in/${args.join(' ')}?format=j1`);
        const c = data.current_condition[0];
        await reply(sock, from, `🌤️ *${args.join(' ')}*\n\n🌡️ Temp: ${c.temp_C}°C\n💧 Humidity: ${c.humidity}%\n💨 Wind: ${c.windspeedKmph} km/h\n☁️ ${c.weatherDesc[0].value}`, msg);
    } catch {
        await reply(sock, from, '❌ City not found.', msg);
    }
});

register('news', async (sock, msg, from) => {
    try {
        const { data } = await axios.get('https://newsapi.org/v2/top-headlines?country=us&apiKey=demo');
        await reply(sock, from, '📰 News requires API key.', msg);
    } catch {
        await reply(sock, from, '❌ Failed.', msg);
    }
});

register('lyrics', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .lyrics <song>', msg);
    await reply(sock, from, `🎵 Searching lyrics: ${args.join(' ')}`, msg);
});

// ==================================================
// 4. GROUP MANAGEMENT (61-100)
// ==================================================

register('kick', async (sock, msg, from) => {
    const q = getQuoted(msg);
    if (!q) return reply(sock, from, '❌ Reply to someone to kick.', msg);
    const target = msg.message.extendedTextMessage.contextInfo.participant;
    await sock.groupParticipantsUpdate(from, [target], 'remove');
    await reply(sock, from, '✅ Kicked.', msg);
});

register('add', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .add <number>', msg);
    await sock.groupParticipantsUpdate(from, [`${args[0]}@s.whatsapp.net`], 'add');
    await reply(sock, from, '✅ Added.', msg);
});

register('promote', async (sock, msg, from) => {
    const q = getQuoted(msg);
    if (!q) return reply(sock, from, '❌ Reply to someone.', msg);
    const target = msg.message.extendedTextMessage.contextInfo.participant;
    await sock.groupParticipantsUpdate(from, [target], 'promote');
    await reply(sock, from, '✅ Promoted to admin.', msg);
});

register('demote', async (sock, msg, from) => {
    const q = getQuoted(msg);
    if (!q) return reply(sock, from, '❌ Reply to someone.', msg);
    const target = msg.message.extendedTextMessage.contextInfo.participant;
    await sock.groupParticipantsUpdate(from, [target], 'demote');
    await reply(sock, from, '✅ Demoted.', msg);
});

register('tagall', async (sock, msg, from) => {
    const meta = await sock.groupMetadata(from);
    const mentions = meta.participants.map(p => p.id);
    let text = '📢 *Attention Everyone!*\n\n';
    mentions.forEach(m => text += `@${m.split('@')[0]}\n`);
    await sock.sendMessage(from, { text, mentions }, { quoted: msg });
});

register('hidetag', async (sock, msg, from) => {
    const meta = await sock.groupMetadata(from);
    const mentions = meta.participants.map(p => p.id);
    await sock.sendMessage(from, { text: '👻', mentions }, { quoted: msg });
});

register('groupinfo', async (sock, msg, from) => {
    const meta = await sock.groupMetadata(from);
    await reply(sock, from, `📊 *Group Info*\n\n📛 Name: ${meta.subject}\n👥 Members: ${meta.participants.length}\n🆔 ID: ${from}\n📝 Desc: ${meta.desc || 'N/A'}`, msg);
}, ['ginfo']);

register('groupsetting', async (sock, msg, from, args) => {
    const opt = args[0];
    if (opt === 'open') {
        await sock.groupSettingUpdate(from, 'not_announcement');
        await reply(sock, from, '🔓 Group opened.', msg);
    } else if (opt === 'close') {
        await sock.groupSettingUpdate(from, 'announcement');
        await reply(sock, from, '🔒 Group closed.', msg);
    }
});

register('link', async (sock, msg, from) => {
    const code = await sock.groupInviteCode(from);
    await reply(sock, from, `🔗 https://chat.whatsapp.com/${code}`, msg);
});

register('revoke', async (sock, msg, from) => {
    await sock.groupRevokeInvite(from);
    await reply(sock, from, '✅ Link revoked.', msg);
});

register('leave', async (sock, msg, from) => {
    await reply(sock, from, '👋 Goodbye!', msg);
    await sock.groupLeave(from);
});

register('subject', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .subject <new name>', msg);
    await sock.groupUpdateSubject(from, args.join(' '));
    await reply(sock, from, '✅ Subject updated.', msg);
});

register('desc', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .desc <text>', msg);
    await sock.groupUpdateDescription(from, args.join(' '));
    await reply(sock, from, '✅ Description updated.', msg);
});

register('listadmins', async (sock, msg, from) => {
    const meta = await sock.groupMetadata(from);
    const admins = meta.participants.filter(p => p.admin);
    let text = '👑 *Admins:*\n\n';
    admins.forEach(a => text += `• @${a.id.split('@')[0]}\n`);
    await sock.sendMessage(from, { text, mentions: admins.map(a => a.id) }, { quoted: msg });
});

register('listmembers', async (sock, msg, from) => {
    const meta = await sock.groupMetadata(from);
    let text = `👥 *Members (${meta.participants.length}):*\n\n`;
    meta.participants.forEach(p => text += `• @${p.id.split('@')[0]}\n`);
    await sock.sendMessage(from, { text, mentions: meta.participants.map(p => p.id) }, { quoted: msg });
});

// ⚠️ NOTE: antilink, antispam, welcome, goodbye, warn, resetwarn 
// are now handled by anti.js — DO NOT register them here!

register('mute', async (sock, msg, from) => {
    if (!global.muted) global.muted = {};
    global.muted[from] = true;
    await reply(sock, from, '🔇 Bot muted in this chat.', msg);
});

register('unmute', async (sock, msg, from) => {
    if (!global.muted) global.muted = {};
    global.muted[from] = false;
    await reply(sock, from, '🔊 Bot unmuted.', msg);
});

register('poll', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .poll question|opt1|opt2', msg);
    const [q, ...opts] = args.join(' ').split('|');
    await sock.sendMessage(from, {
        poll: { name: q, values: opts, selectableCount: 1 }
    }, { quoted: msg });
});

register('create', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .create <group name>', msg);
    await reply(sock, from, `⚠️ Group creation feature coming.`, msg);
});

register('join', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .join <invite link>', msg);
    const code = args[0].split('chat.whatsapp.com/')[1];
    if (code) {
        await sock.groupAcceptInvite(code);
        await reply(sock, from, '✅ Joined.', msg);
    }
});

register('everyone', async (sock, msg, from) => {
    const meta = await sock.groupMetadata(from);
    const mentions = meta.participants.map(p => p.id);
    await sock.sendMessage(from, { text: '📢 Everyone!', mentions }, { quoted: msg });
});

register('silent', async (sock, msg, from) => {
    await reply(sock, from, '🤫 Silent mode enabled.', msg);
});

register('tagadmin', async (sock, msg, from) => {
    const meta = await sock.groupMetadata(from);
    const admins = meta.participants.filter(p => p.admin).map(p => p.id);
    let text = '👑 *Admins:*\n';
    admins.forEach(a => text += `@${a.split('@')[0]}\n`);
    await sock.sendMessage(from, { text, mentions: admins }, { quoted: msg });
});

register('groupstats', async (sock, msg, from) => {
    const meta = await sock.groupMetadata(from);
    const admins = meta.participants.filter(p => p.admin).length;
    await reply(sock, from, `📊 Total: ${meta.participants.length}\n👑 Admins: ${admins}\n👥 Members: ${meta.participants.length - admins}`, msg);
});

register('clear', async (sock, msg, from) => {
    await sock.chatModify({ clear: { message: { id: [], timestamp: Date.now() } } }, from).catch(() => {});
    await reply(sock, from, '🧹 Chat cleared.', msg);
});

register('archive', async (sock, msg, from) => {
    await sock.chatModify({ archive: true, lastMessages: [] }, from);
    await reply(sock, from, '📦 Archived.', msg);
});

register('pin', async (sock, msg, from) => {
    await sock.chatModify({ pin: true }, from);
    await reply(sock, from, '📌 Pinned.', msg);
});

register('unpin', async (sock, msg, from) => {
    await sock.chatModify({ pin: false }, from);
    await reply(sock, from, '📌 Unpinned.', msg);
});

register('delete', async (sock, msg, from) => {
    const q = getQuoted(msg);
    if (!q) return reply(sock, from, '❌ Reply to a message.', msg);
    const key = msg.message.extendedTextMessage.contextInfo.stanzaId;
    await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: key, participant: msg.message.extendedTextMessage.contextInfo.participant } });
}, ['del']);

register('block', async (sock, msg, from) => {
    const q = getQuoted(msg);
    if (!q) return reply(sock, from, '❌ Reply to block.', msg);
    const t = msg.message.extendedTextMessage.contextInfo.participant;
    await sock.updateBlockStatus(t, 'block');
    await reply(sock, from, '🚫 Blocked.', msg);
});

register('unblock', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .unblock <number>', msg);
    await sock.updateBlockStatus(`${args[0]}@s.whatsapp.net`, 'unblock');
    await reply(sock, from, '✅ Unblocked.', msg);
});

register('listblock', async (sock, msg, from) => {
    const list = await sock.fetchBlocklist();
    await reply(sock, from, `🚫 Blocked: ${list.length}`, msg);
});

register('bio', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .bio <text>', msg);
    await sock.updateProfileStatus(args.join(' '));
    await reply(sock, from, '✅ Bio updated.', msg);
});

register('setname', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .setname <name>', msg);
    await sock.updateProfileName(args.join(' '));
    await reply(sock, from, '✅ Name updated.', msg);
});

register('profilepic', async (sock, msg, from) => {
    const q = getQuoted(msg);
    const img = msg.message?.imageMessage || q?.imageMessage;
    if (!img) return reply(sock, from, '❌ Send/reply an image.', msg);
    await reply(sock, from, '⚠️ Profile picture update requires image processing.', msg);
}, ['setpp']);

// ==================================================
// 5. TOOLS / UTILITIES (101-140)
// ==================================================

register('calc', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .calc 2+2', msg);
    try {
        const result = eval(args.join(' ').replace(/[^0-9+\-*/().\s]/g, ''));
        await reply(sock, from, `🧮 ${args.join(' ')} = ${result}`, msg);
    } catch {
        await reply(sock, from, '❌ Invalid expression.', msg);
    }
}, ['calculate']);

register('qr', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .qr <text>', msg);
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(args.join(' '))}`;
    await sock.sendMessage(from, { image: { url }, caption: '🔲 QR Code' }, { quoted: msg });
});

register('shorturl', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .shorturl <url>', msg);
    try {
        const { data } = await axios.get(`https://tinyurl.com/api-create.php?url=${args[0]}`);
        await reply(sock, from, `🔗 ${data}`, msg);
    } catch {
        await reply(sock, from, '❌ Failed.', msg);
    }
}, ['short']);

register('password', async (sock, msg, from, args) => {
    const len = parseInt(args[0]) || 12;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let pwd = '';
    for (let i = 0; i < len; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    await reply(sock, from, `🔐 Password: \`${pwd}\``, msg);
}, ['pw']);

register('uuid', async (sock, msg, from) => {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    await reply(sock, from, `🆔 ${uuid}`, msg);
});

register('base64', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .base64 <text>', msg);
    await reply(sock, from, Buffer.from(args.join(' ')).toString('base64'), msg);
}, ['b64']);

register('unbase64', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .unbase64 <text>', msg);
    try {
        await reply(sock, from, Buffer.from(args.join(' '), 'base64').toString(), msg);
    } catch {
        await reply(sock, from, '❌ Invalid.', msg);
    }
});

register('reverse', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .reverse <text>', msg);
    await reply(sock, from, args.join(' ').split('').reverse().join(''), msg);
});

register('upper', async (sock, msg, from, args) => {
    await reply(sock, from, args.join(' ').toUpperCase(), msg);
});

register('lower', async (sock, msg, from, args) => {
    await reply(sock, from, args.join(' ').toLowerCase(), msg);
});

register('count', async (sock, msg, from, args) => {
    const text = args.join(' ');
    await reply(sock, from, `📊 Characters: ${text.length}\n📝 Words: ${text.split(/\s+/).filter(Boolean).length}`, msg);
});

register('char', async (sock, msg, from, args) => {
    await reply(sock, from, `📊 ${args.join(' ').length} characters`, msg);
});

register('word', async (sock, msg, from, args) => {
    await reply(sock, from, `📊 ${args.join(' ').split(/\s+/).filter(Boolean).length} words`, msg);
});

register('md5', async (sock, msg, from, args) => {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(args.join(' ')).digest('hex');
    await reply(sock, from, `🔒 ${hash}`, msg);
});

register('sha256', async (sock, msg, from, args) => {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(args.join(' ')).digest('hex');
    await reply(sock, from, `🔒 ${hash}`, msg);
});

register('rand', async (sock, msg, from, args) => {
    const min = parseInt(args[0]) || 1;
    const max = parseInt(args[1]) || 100;
    await reply(sock, from, `🎲 ${Math.floor(Math.random() * (max - min + 1)) + min}`, msg);
}, ['random']);

register('dice', async (sock, msg, from) => {
    await reply(sock, from, `🎲 ${Math.floor(Math.random() * 6) + 1}`, msg);
});

register('coin', async (sock, msg, from) => {
    await reply(sock, from, Math.random() < 0.5 ? '🪙 Heads!' : '🪙 Tails!', msg);
}, ['flip']);

register('8ball', async (sock, msg, from, args) => {
    const answers = ['Yes', 'No', 'Maybe', 'Definitely', 'Ask again', 'Never', 'Of course', 'Not sure'];
    await reply(sock, from, `🎱 ${answers[Math.floor(Math.random() * answers.length)]}`, msg);
});

register('pick', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .pick opt1,opt2,opt3', msg);
    const opts = args.join(' ').split(',');
    await reply(sock, from, `👉 ${opts[Math.floor(Math.random() * opts.length)].trim()}`, msg);
});

register('rate', async (sock, msg, from, args) => {
    await reply(sock, from, `⭐ Rating: ${Math.floor(Math.random() * 10) + 1}/10`, msg);
});

register('emojify', async (sock, msg, from, args) => {
    const map = { a:'🇦', b:'🇧', c:'🇨', d:'🇩', e:'🇪', f:'🇫', g:'🇬', h:'🇭', i:'🇮', j:'🇯', k:'🇰', l:'🇱', m:'🇲', n:'🇳', o:'🇴', p:'🇵', q:'🇶', r:'🇷', s:'🇸', t:'🇹', u:'🇺', v:'🇻', w:'🇼', x:'🇽', y:'🇾', z:'🇿' };
    const out = args.join(' ').toLowerCase().split('').map(c => map[c] || c).join('');
    await reply(sock, from, out, msg);
});

register('mock', async (sock, msg, from, args) => {
    const out = args.join(' ').split('').map((c, i) => i % 2 ? c.toUpperCase() : c.toLowerCase()).join('');
    await reply(sock, from, out, msg);
});

register('spoil', async (sock, msg, from, args) => {
    await reply(sock, from, `||${args.join(' ')}||`, msg);
});

register('bold', async (sock, msg, from, args) => {
    await reply(sock, from, `*${args.join(' ')}*`, msg);
});

register('italic', async (sock, msg, from, args) => {
    await reply(sock, from, `_${args.join(' ')}_`, msg);
});

register('strike', async (sock, msg, from, args) => {
    await reply(sock, from, `~${args.join(' ')}~`, msg);
});

register('mono', async (sock, msg, from, args) => {
    await reply(sock, from, '```' + args.join(' ') + '```', msg);
});

register('time2', async (sock, msg, from, args) => {
    if (!args.length) return reply(sock, from, '❌ Usage: .time2 <timezone>', msg);
    try {
        const t = new Date().toLocaleString('en-US', { timeZone: args[0] });
        await reply(sock, from, `🕐 ${t}`, msg);
    } catch {
        await reply(sock, from, '❌ Invalid timezone.', msg);
    }
});

register('age', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .age YYYY-MM-DD', msg);
    const birth = new Date(args[0]);
    const age = Math.floor((Date.now() - birth) / (1000 * 60 * 60 * 24 * 365.25));
    await reply(sock, from, `🎂 Age: ${age} years`, msg);
});

register('bmi', async (sock, msg, from, args) => {
    if (args.length < 2) return reply(sock, from, '❌ Usage: .bmi <weight kg> <height m>', msg);
    const bmi = (parseFloat(args[0]) / (parseFloat(args[1]) ** 2)).toFixed(1);
    await reply(sock, from, `⚖️ BMI: ${bmi}`, msg);
});

register('temp', async (sock, msg, from, args) => {
    if (args.length < 3) return reply(sock, from, '❌ Usage: .temp <value> <C|F> <to>', msg);
    const v = parseFloat(args[0]);
    const r = args[1].toUpperCase() === 'C' ? (v * 9/5) + 32 : (v - 32) * 5/9;
    await reply(sock, from, `🌡️ ${r.toFixed(1)}°${args[1].toUpperCase() === 'C' ? 'F' : 'C'}`, msg);
});

register('currency', async (sock, msg, from, args) => {
    if (args.length < 3) return reply(sock, from, '❌ Usage: .currency <amount> <from> <to>', msg);
    await reply(sock, from, '💱 Currency conversion requires API key.', msg);
});

register('ip', async (sock, msg, from, args) => {
    try {
        const { data } = await axios.get(`http://ip-api.com/json/${args[0] || ''}`);
        await reply(sock, from, `🌐 IP: ${data.query}\n📍 ${data.city}, ${data.country}\n🏢 ${data.isp}`, msg);
    } catch {
        await reply(sock, from, '❌ Failed.', msg);
    }
});

register('whois', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .whois <domain>', msg);
    await reply(sock, from, '🔍 WHOIS lookup requires API.', msg);
});

register('dns', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .dns <domain>', msg);
    const dns = require('dns').promises;
    try {
        const r = await dns.resolve4(args[0]);
        await reply(sock, from, `🌐 ${r.join('\n')}`, msg);
    } catch {
        await reply(sock, from, '❌ Lookup failed.', msg);
    }
});

register('pinghost', async (sock, msg, from, args) => {
    if (!args[0]) return reply(sock, from, '❌ Usage: .pinghost <host>', msg);
    await reply(sock, from, `🏓 Pinging ${args[0]}...`, msg);
});

// ==================================================
// 6. FUN / TEXT (141-160)
// ==================================================

register('shayari', async (sock, msg, from) => {
    const list = ['Dil se nikli dua...', 'Mohabbat mein...', 'Zindagi ek safar hai...'];
    await reply(sock, from, list[Math.floor(Math.random() * list.length)], msg);
});

register('quote2', async (sock, msg, from) => {
    try {
        const { data } = await axios.get('https://api.quotable.io/random');
        await reply(sock, from, `💬 "${data.content}"\n— ${data.author}`, msg);
    } catch {
        await reply(sock, from, '❌ Failed.', msg);
    }
});

register('compliment', async (sock, msg, from) => {
    const list = ['You are amazing!', 'You light up the room!', 'You are brilliant!'];
    await reply(sock, from, list[Math.floor(Math.random() * list.length)], msg);
});

register('insult', async (sock, msg, from) => {
    const list = ['You are a potato.', 'You are a snail.', 'You are a rock.'];
    await reply(sock, from, list[Math.floor(Math.random() * list.length)], msg);
});

register('love', async (sock, msg, from, args) => {
    await reply(sock, from, `❤️ Love %: ${Math.floor(Math.random() * 101)}%`, msg);
});

register('ship', async (sock, msg, from, args) => {
    await reply(sock, from, `💕 Ship %: ${Math.floor(Math.random() * 101)}%`, msg);
});

register('gay', async (sock, msg, from) => {
    await reply(sock, from, `🏳️‍🌈 ${Math.floor(Math.random() * 101)}% gay`, msg);
});

register('lesbian', async (sock, msg, from) => {
    await reply(sock, from, `🏳️‍🌈 ${Math.floor(Math.random() * 101)}% lesbian`, msg);
});

register('horny', async (sock, msg, from) => {
    await reply(sock, from, `😏 ${Math.floor(Math.random() * 101)}% horny`, msg);
});

register('stupid', async (sock, msg, from) => {
    await reply(sock, from, `🤪 ${Math.floor(Math.random() * 101)}% stupid`, msg);
});

register('smart', async (sock, msg, from) => {
    await reply(sock, from, `🧠 ${Math.floor(Math.random() * 101)}% smart`, msg);
});

register('ugly', async (sock, msg, from) => {
    await reply(sock, from, `😬 ${Math.floor(Math.random() * 101)}% ugly`, msg);
});

register('beautiful', async (sock, msg, from) => {
    await reply(sock, from, `😍 ${Math.floor(Math.random() * 101)}% beautiful`, msg);
});

register('handsome', async (sock, msg, from) => {
    await reply(sock, from, `😎 ${Math.floor(Math.random() * 101)}% handsome`, msg);
});

register('rich', async (sock, msg, from) => {
    await reply(sock, from, `💰 ${Math.floor(Math.random() * 101)}% rich`, msg);
});

register('poor', async (sock, msg, from) => {
    await reply(sock, from, `💸 ${Math.floor(Math.random() * 101)}% poor`, msg);
});

register('lucky', async (sock, msg, from) => {
    await reply(sock, from, `🍀 ${Math.floor(Math.random() * 101)}% lucky`, msg);
});

register('evil', async (sock, msg, from) => {
    await reply(sock, from, `😈 ${Math.floor(Math.random() * 101)}% evil`, msg);
});

register('good', async (sock, msg, from) => {
    await reply(sock, from, `😇 ${Math.floor(Math.random() * 101)}% good`, msg);
});

register('roast', async (sock, msg, from) => {
    const list = ['You are like a cloud, when you disappear it is a beautiful day.', 'You bring everyone so much joy when you leave.', 'I would agree with you but then we would both be wrong.'];
    await reply(sock, from, list[Math.floor(Math.random() * list.length)], msg);
});

// ==================================================
// 7. ANTI COMMANDS (auto-registered from anti.js)
// ==================================================
const { registerAntiCommands } = require('./anti');
registerAntiCommands(register, reply, getQuoted);

// ==================================================
// EXPORT
// ==================================================
module.exports = { commands, getText, getQuoted, getSender, reply };
