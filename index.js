/**
 * ============================================
 *  WhatsApp MD Bot — Main Entry File
 *  Features:
 *   - Telegram Pairing System
 *   - 160+ Commands
 *   - 32+ Anti Commands
 *   - Auto Reconnect
 *   - Session Management
 * ============================================
 */

const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const { initTelegram, notifyAdmin } = require('./telegram');
const { startWhatsApp } = require('./pairing');

// ============ GLOBAL STATE ============
global.botConnected = false;
global.startTime = Date.now();
global.muted = {};
global.antilink = {};
global.welcome = {};
global.goodbye = {};
global.antispam = {};

// ============ BANNER ============
function showBanner() {
    const banner = `
╔══════════════════════════════════════════╗
║                                          ║
║   🤖  WHATSAPP MD BOT                    ║
║   ⚡  Telegram Pairing System            ║
║   📦  160+ Commands • 32+ Anti           ║
║                                          ║
║   Version : 1.0.0                        ║
║   Library : @whiskeysockets/baileys      ║
║   Node    : ${process.version.padEnd(28)}║
║                                          ║
╚══════════════════════════════════════════╝
    `;
    console.log(banner);
}

// ============ VALIDATE CONFIG ============
function validateConfig() {
    const errors = [];

    if (!config.TELEGRAM_BOT_TOKEN || config.TELEGRAM_BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
        errors.push('❌ TELEGRAM_BOT_TOKEN is missing in config.js');
    }

    if (!config.ADMIN_ID || config.ADMIN_ID === 'YOUR_TELEGRAM_ID_HERE') {
        console.log('⚠️  ADMIN_ID not set — admin notifications disabled');
    }

    if (!config.PREFIX) {
        errors.push('❌ PREFIX is missing in config.js');
    }

    if (!config.BOT_NAME) {
        errors.push('❌ BOT_NAME is missing in config.js');
    }

    if (errors.length) {
        console.error('\n' + errors.join('\n') + '\n');
        process.exit(1);
    }

    console.log('✅ Config validated');
}

// ============ ENSURE FOLDERS ============
function ensureFolders() {
    const folders = [
        config.SESSION_DIR,
        './database',
        './temp',
        './logs'
    ];

    folders.forEach(f => {
        fs.ensureDirSync(f);
    });

    console.log('📁 Folders ready');
}

// ============ CLEANUP TEMP ============
function cleanupTemp() {
    const tempDir = './temp';
    if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        const now = Date.now();
        let cleaned = 0;

        files.forEach(f => {
            const fullPath = path.join(tempDir, f);
            try {
                const stat = fs.statSync(fullPath);
                // Delete files older than 1 hour
                if (now - stat.mtimeMs > 3600000) {
                    fs.removeSync(fullPath);
                    cleaned++;
                }
            } catch {}
        });

        if (cleaned > 0) console.log(`🧹 Cleaned ${cleaned} temp files`);
    }
}

// ============ SETUP PROCESS HANDLERS ============
function setupProcessHandlers() {
    // Uncaught exceptions
    process.on('uncaughtException', (err) => {
        console.error('💥 Uncaught Exception:', err.message);
        notifyAdmin(`💥 *Uncaught Exception*\n\`\`\`${err.message}\`\`\``);
    });

    // Unhandled rejections
    process.on('unhandledRejection', (err) => {
        console.error('💥 Unhandled Rejection:', err?.message || err);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down gracefully...');
        notifyAdmin('🛑 *Bot shutting down*');
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM...');
        process.exit(0);
    });

    // Memory warning
    process.on('warning', (w) => {
        if (w.name === 'MaxListenersExceededWarning') {
            console.warn('⚠️  MaxListenersExceededWarning — check event listeners');
        }
    });
}

// ============ SETUP AUTO CLEANUP ============
function setupAutoCleanup() {
    // Every 30 minutes
    setInterval(() => {
        cleanupTemp();
    }, 30 * 60 * 1000);

    // Memory log every hour
    setInterval(() => {
        const mem = process.memoryUsage();
        const mb = (n) => (n / 1024 / 1024).toFixed(2);
        console.log(`📊 Memory: ${mb(mem.rss)}MB RSS | ${mb(mem.heapUsed)}MB Heap`);
    }, 60 * 60 * 1000);
}

// ============ AUTO RECONNECT ============
function setupAutoReconnect() {
    setInterval(() => {
        const credsFile = path.join(config.SESSION_DIR, 'creds.json');

        // If session exists but bot not connected
        if (fs.existsSync(credsFile) && !global.botConnected) {
            console.log('🔄 Auto-reconnect attempt...');
            startWhatsApp(null, null).catch(err => {
                console.error('❌ Reconnect failed:', err.message);
            });
        }
    }, 60 * 1000); // every 1 minute
}

// ============ STARTUP STATS ============
function showStats() {
    const { commands } = require('./commands');
    const cmdCount = Object.keys(commands).length;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📦 Commands loaded : ${cmdCount}`);
    console.log(`🛡️  Anti commands   : 32+`);
    console.log(`🤖 Bot name        : ${config.BOT_NAME}`);
    console.log(`🔤 Prefix          : ${config.PREFIX}`);
    console.log(`📂 Session dir     : ${config.SESSION_DIR}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ============ MAIN START ============
async function main() {
    showBanner();
    validateConfig();
    ensureFolders();
    cleanupTemp();
    setupProcessHandlers();
    setupAutoCleanup();
    showStats();

    // ============ START TELEGRAM BOT ============
    console.log('\n📡 Starting Telegram bot...');

    initTelegram(async (number, chatId) => {
        try {
            console.log(`📱 Pairing request from Telegram (chat: ${chatId}) for: ${number}`);

            const code = await startWhatsApp(number, chatId);

            if (code) {
                console.log(`✅ Pairing code generated: ${code}`);
            }

            return code;
        } catch (err) {
            console.error('❌ Pairing error:', err.message);
            throw err;
        }
    });

    // ============ AUTO RECONNECT EXISTING SESSION ============
    const credsFile = path.join(config.SESSION_DIR, 'creds.json');

    if (fs.existsSync(credsFile)) {
        console.log('\n📂 Existing WhatsApp session found, reconnecting...');
        try {
            await startWhatsApp(null, null);
        } catch (err) {
            console.error('❌ Session reconnect failed:', err.message);
            console.log('💡 Delete ./session folder and re-pair from Telegram.');
        }
    } else {
        console.log('\n💡 No session found. Pair via Telegram:');
        console.log('   1. Open your Telegram bot');
        console.log('   2. Send /pair <your-number>');
        console.log('   3. Enter the code in WhatsApp → Linked Devices');
    }

    // ============ START AUTO RECONNECT LOOP ============
    setupAutoReconnect();

    console.log(`\n🚀 ${config.BOT_NAME} is now running!\n`);
}

// ============ EXECUTE ============
main().catch(err => {
    console.error('💥 Fatal startup error:', err);
    process.exit(1);
});
