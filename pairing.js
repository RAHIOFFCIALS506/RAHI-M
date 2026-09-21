const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const config = require('./config');
const { notifyAdmin } = require('./telegram');
const { commands, getText, getQuoted, reply } = require('./commands');
const anti = require('./anti');

let sock = null;

async function startWhatsApp(number, chatId) {
    return new Promise(async (resolve, reject) => {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(config.SESSION_DIR);

            sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }),
                browser: Browsers.ubuntu('Chrome'),
                mobile: false
            });

            if (!sock.authState.creds.registered && number) {
                setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(number);
                        resolve(code);
                    } catch (err) { reject(err); }
                }, 3000);
            } else {
                resolve(null);
            }

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect } = update;
                if (connection === 'close') {
                    const reason = lastDisconnect?.error?.output?.statusCode;
                    if (reason !== DisconnectReason.loggedOut) {
                        console.log('🔄 Reconnecting...');
                        startWhatsApp(number, chatId);
                    } else {
                        fs.removeSync(config.SESSION_DIR);
                    }
                    global.botConnected = false;
                } else if (connection === 'open') {
                    console.log('✅ WhatsApp Connected!');
                    global.botConnected = true;
                    notifyAdmin(`✅ *WhatsApp Connected!*\n📱 Number: ${number}`);
                }
            });

            // ===== CALL HANDLER (Anti-Call) =====
            sock.ev.on('call', async (calls) => {
                for (const call of calls) {
                    await anti.handleAntiCall(sock, call).catch(() => {});
                }
            });

            // ===== MESSAGE HANDLER =====
            sock.ev.on('messages.upsert', async ({ messages, type }) => {
                const msg = messages[0];
                if (!msg.message) return;
                const from = msg.key.remoteJid;

                // Anti-Delete runs on both notify & append
                if (from?.endsWith('@g.us')) {
                    await anti.handleAntiDelete(sock, msg, from).catch(() => {});
                }

                if (type !== 'notify') return;
                if (msg.key.fromMe) return;

                // Anti-ViewOnce
                if (from?.endsWith('@g.us')) {
                    await anti.handleAntiViewOnce(sock, msg, from).catch(() => {});
                }

                // Anti-Flood check
                if (from?.endsWith('@g.us')) {
                    const flooded = await anti.checkFlood(sock, msg, from).catch(() => false);
                    if (flooded) return;
                }

                // Anti checks (before command processing)
                if (from?.endsWith('@g.us')) {
                    const blocked = await anti.handleAnti(sock, msg, from).catch(() => false);
                    if (blocked) return;
                }

                // Skip muted
                if (global.muted?.[from]) return;

                const text = getText(msg);
                if (!text.startsWith(config.PREFIX)) return;

                const [cmd, ...args] = text.slice(config.PREFIX.length).trim().split(/\s+/);
                const handler = commands[cmd.toLowerCase()];

                if (handler) {
                    try {
                        await handler(sock, msg, from, args);
                    } catch (e) {
                        console.error('Command error:', e);
                        await sock.sendMessage(from, { text: `❌ Error: ${e.message}` }, { quoted: msg });
                    }
                }
            });

        } catch (err) { reject(err); }
    });
}

module.exports = { startWhatsApp };
