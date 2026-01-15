import express from 'express';
import fs from 'fs';
import pino from 'pino';
import qrcode from 'qrcode';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';

const router = express.Router();

// Ensure the session directory exists
function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {
        console.error('Error removing file:', e);
    }
}

// Store active connections
const activeConnections = new Map();

router.get('/', async (req, res) => {
    const sessionId = req.query.sessionId || 'default';
    const dirs = `./sessions/${sessionId}`;

    // Remove existing session if present
    if (fs.existsSync(dirs)) {
        await removeFile(dirs);
    }

    // Create session directory
    fs.mkdirSync(dirs, { recursive: true });

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();
            const botInstance = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: false,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 10000,
            });

            // Store connection
            activeConnections.set(sessionId, botInstance);

            let qrGenerated = false;
            let connectionEstablished = false;

            botInstance.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // Generate QR code
                if (qr && !qrGenerated) {
                    qrGenerated = true;
                    console.log("📱 QR Code generated");
                    
                    try {
                        // Generate QR code as base64
                        const qrImage = await qrcode.toDataURL(qr);
                        
                        // Send QR code to client
                        if (!res.headersSent) {
                            res.json({
                                success: true,
                                qrCode: qrImage,
                                qrString: qr,
                                sessionId: sessionId,
                                message: 'Scan this QR code with WhatsApp → Linked Devices'
                            });
                        }
                    } catch (error) {
                        console.error("❌ Error generating QR code:", error);
                        if (!res.headersSent) {
                            res.status(500).json({
                                success: false,
                                message: 'Failed to generate QR code'
                            });
                        }
                    }
                }

                if (connection === 'open') {
                    connectionEstablished = true;
                    console.log("✅ Connected successfully!");
                    
                    // Send success response if not already sent
                    if (!res.headersSent) {
                        res.json({
                            success: true,
                            message: 'Connected to WhatsApp!',
                            sessionId: sessionId
                        });
                    }

                    // Get session credentials
                    const creds = state.creds;
                    
                    // Save credentials to file
                    const credsFile = `${dirs}/creds.json`;
                    fs.writeFileSync(credsFile, JSON.stringify(creds, null, 2));
                    
                    console.log("📁 Session saved to:", credsFile);
                    console.log("🎉 WhatsApp Web session established!");
                    
                    // Optional: Send session info to phone
                    try {
                        // Get the phone number from credentials
                        const phoneNumber = creds.me?.id?.split(':')[0]?.replace('@s.whatsapp.net', '');
                        if (phoneNumber) {
                            await botInstance.sendMessage(`${phoneNumber}@s.whatsapp.net`, {
                                text: `✅ WhatsApp Web connected successfully!\n\nSession ID: ${sessionId}\n\n⚠️ Keep your session files safe. Do not share them.`
                            });
                        }
                    } catch (error) {
                        console.log("Note: Could not send confirmation message");
                    }
                }

                if (connection === 'close') {
                    console.log("❌ Connection closed");
                    
                    // Clean up
                    activeConnections.delete(sessionId);
                    
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                    
                    if (shouldReconnect && !connectionEstablished) {
                        console.log("🔄 Attempting to reconnect...");
                        setTimeout(() => initiateSession(), 3000);
                    } else if (lastDisconnect?.error?.output?.statusCode === 401) {
                        console.log("🔐 Logged out. Need new QR code.");
                        // Remove session files
                        removeFile(dirs);
                    }
                }
            });

            botInstance.ev.on('creds.update', saveCreds);

        } catch (err) {
            console.error('Error initializing session:', err);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to initialize WhatsApp session',
                    error: err.message
                });
            }
            // Clean up on error
            removeFile(dirs);
            activeConnections.delete(sessionId);
        }
    }

    await initiateSession();
});

// Endpoint to check session status
router.get('/status/:sessionId', async (req, res) => {
    const sessionId = req.params.sessionId;
    const dirs = `./sessions/${sessionId}`;
    const credsFile = `${dirs}/creds.json`;

    if (fs.existsSync(credsFile)) {
        try {
            const creds = JSON.parse(fs.readFileSync(credsFile, 'utf-8'));
            const botInstance = activeConnections.get(sessionId);
            
            res.json({
                success: true,
                connected: !!botInstance,
                hasCredentials: true,
                phoneNumber: creds.me?.id?.split(':')[0]?.replace('@s.whatsapp.net', ''),
                sessionId: sessionId
            });
        } catch (error) {
            res.json({
                success: false,
                connected: false,
                hasCredentials: false,
                sessionId: sessionId
            });
        }
    } else {
        res.json({
            success: false,
            connected: false,
            hasCredentials: false,
            sessionId: sessionId
        });
    }
});

// Endpoint to get session file
router.get('/download/:sessionId', async (req, res) => {
    const sessionId = req.params.sessionId;
    const dirs = `./sessions/${sessionId}`;
    const credsFile = `${dirs}/creds.json`;

    if (fs.existsSync(credsFile)) {
        res.download(credsFile, `whatsapp-session-${sessionId}.json`);
    } else {
        res.status(404).json({
            success: false,
            message: 'Session not found'
        });
    }
});

// Endpoint to logout/delete session
router.delete('/:sessionId', async (req, res) => {
    const sessionId = req.params.sessionId;
    const dirs = `./sessions/${sessionId}`;
    
    // Close connection if active
    const botInstance = activeConnections.get(sessionId);
    if (botInstance) {
        await botInstance.logout();
        activeConnections.delete(sessionId);
    }
    
    // Remove session files
    removeFile(dirs);
    
    res.json({
        success: true,
        message: 'Session deleted successfully'
    });
});

// Cleanup on server shutdown
process.on('SIGINT', () => {
    console.log('Shutting down... Cleaning up sessions');
    activeConnections.forEach(async (bot, sessionId) => {
        try {
            await bot.logout();
        } catch (error) {
            console.log(`Error closing session ${sessionId}:`, error);
        }
    });
    process.exit(0);
});

export default router;