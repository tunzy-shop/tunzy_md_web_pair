import express from 'express';
import fs from 'fs';
import pino from 'pino';
import qrcode from 'qrcode';
import { 
    makeWASocket, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore, 
    Browsers, 
    fetchLatestBaileysVersion,
    DisconnectReason
} from '@whiskeysockets/baileys';

const router = express.Router();

// Create sessions directory if it doesn't exist
const SESSIONS_DIR = './sessions';
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Store active connections
const activeConnections = new Map();

// Helper function to remove files
function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
        console.log(`🧹 Cleaned up: ${FilePath}`);
        return true;
    } catch (e) {
        console.error('Error removing file:', e);
        return false;
    }
}

router.get('/', async (req, res) => {
    const sessionId = req.query.sessionId || 'default';
    const dirs = `${SESSIONS_DIR}/${sessionId}`;
    
    console.log(`📱 Starting WhatsApp connection for session: ${sessionId}`);
    
    // Set response timeout to prevent hanging
    res.setTimeout(60000, () => {
        if (!res.headersSent) {
            res.status(408).json({
                success: false,
                message: 'Request timeout'
            });
        }
    });

    async function initiateSession() {
        try {
            // Clean previous session if exists
            if (fs.existsSync(dirs)) {
                console.log(`Found existing session for ${sessionId}, cleaning up...`);
                removeFile(dirs);
            }

            const { state, saveCreds } = await useMultiFileAuthState(dirs);
            const { version } = await fetchLatestBaileysVersion();
            
            console.log(`📦 Creating WhatsApp socket for session: ${sessionId}`);

            const sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
                },
                printQRInTerminal: true,
                logger: pino({ level: 'fatal' }),
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: true,
            });

            // Store the socket
            activeConnections.set(sessionId, sock);
            
            let qrSent = false;
            let isConnected = false;

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                console.log(`🔌 Connection update for ${sessionId}:`, {
                    connection,
                    qr: qr ? 'QR received' : 'No QR',
                    lastDisconnect: lastDisconnect?.error?.message
                });

                // Handle QR code generation
                if (qr && !qrSent && !isConnected) {
                    qrSent = true;
                    console.log(`🔄 Generating QR code for ${sessionId}`);
                    
                    try {
                        // Generate QR code image
                        const qrImage = await qrcode.toDataURL(qr);
                        
                        if (!res.headersSent) {
                            res.json({
                                success: true,
                                qrCode: qrImage,
                                qrString: qr,
                                sessionId: sessionId,
                                message: 'Scan this QR code with WhatsApp (Linked Devices)',
                                status: 'waiting_for_scan'
                            });
                        }
                    } catch (error) {
                        console.error(`❌ QR generation error for ${sessionId}:`, error);
                        if (!res.headersSent) {
                            res.status(500).json({
                                success: false,
                                message: 'Failed to generate QR code'
                            });
                        }
                    }
                }

                // Handle successful connection
                if (connection === 'open') {
                    isConnected = true;
                    console.log(`✅ WhatsApp connected for session: ${sessionId}`);
                    
                    // If response not sent yet (direct connection without QR)
                    if (!res.headersSent) {
                        res.json({
                            success: true,
                            message: 'Connected to WhatsApp',
                            sessionId: sessionId,
                            status: 'connected'
                        });
                    }
                    
                    // Save credentials
                    try {
                        const credsFile = `${dirs}/creds.json`;
                        fs.writeFileSync(credsFile, JSON.stringify(state.creds, null, 2));
                        console.log(`💾 Credentials saved for ${sessionId}`);
                    } catch (error) {
                        console.error(`❌ Failed to save credentials for ${sessionId}:`, error);
                    }
                }

                // Handle connection closure
                if (connection === 'close') {
                    console.log(`❌ Connection closed for ${sessionId}`);
                    
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                    
                    // Remove from active connections
                    activeConnections.delete(sessionId);
                    
                    if (shouldReconnect && !isConnected) {
                        console.log(`🔄 Attempting reconnect for ${sessionId}`);
                        setTimeout(() => initiateSession(), 3000);
                    } else if (statusCode === DisconnectReason.loggedOut) {
                        console.log(`🔐 Logged out, cleaning session: ${sessionId}`);
                        removeFile(dirs);
                    }
                    
                    // If connection closed before QR was sent
                    if (!qrSent && !isConnected && !res.headersSent) {
                        res.status(503).json({
                            success: false,
                            message: 'Connection failed before QR generation',
                            status: 'connection_failed'
                        });
                    }
                }
            });

            // Listen for credentials updates
            sock.ev.on('creds.update', saveCreds);

            // Check if already authenticated
            if (state.creds.registered) {
                console.log(`✅ Already authenticated for ${sessionId}`);
                isConnected = true;
                if (!res.headersSent) {
                    res.json({
                        success: true,
                        message: 'Already authenticated',
                        sessionId: sessionId,
                        status: 'authenticated'
                    });
                }
            }

        } catch (error) {
            console.error(`❌ Session initialization error for ${sessionId}:`, error);
            
            // Clean up on error
            removeFile(dirs);
            activeConnections.delete(sessionId);
            
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to initialize session',
                    error: error.message,
                    sessionId: sessionId
                });
            }
        }
    }

    // Start the session
    await initiateSession();
});

// Status endpoint
router.get('/status/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const dirs = `${SESSIONS_DIR}/${sessionId}`;
    const credsFile = `${dirs}/creds.json`;

    const isConnected = activeConnections.has(sessionId);
    const hasCreds = fs.existsSync(credsFile);
    
    let phoneNumber = null;
    if (hasCreds) {
        try {
            const creds = JSON.parse(fs.readFileSync(credsFile, 'utf-8'));
            if (creds.me?.id) {
                phoneNumber = creds.me.id.split(':')[0];
            }
        } catch (error) {
            console.error(`Error reading creds for ${sessionId}:`, error);
        }
    }

    res.json({
        success: true,
        sessionId,
        connected: isConnected,
        hasCredentials: hasCreds,
        phoneNumber,
        timestamp: new Date().toISOString()
    });
});

// Download session
router.get('/download/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const credsFile = `${SESSIONS_DIR}/${sessionId}/creds.json`;

    if (fs.existsSync(credsFile)) {
        res.download(credsFile, `whatsapp-session-${sessionId}.json`);
    } else {
        res.status(404).json({
            success: false,
            message: 'Session not found'
        });
    }
});

// Logout/delete session
router.delete('/:sessionId', async (req, res) => {
    const sessionId = req.params.sessionId;
    const dirs = `${SESSIONS_DIR}/${sessionId}`;
    
    try {
        // Close connection if active
        const sock = activeConnections.get(sessionId);
        if (sock) {
            await sock.logout();
            activeConnections.delete(sessionId);
        }
        
        // Remove session files
        const removed = removeFile(dirs);
        
        res.json({
            success: true,
            message: removed ? 'Session deleted successfully' : 'Session not found',
            sessionId
        });
    } catch (error) {
        console.error(`Error deleting session ${sessionId}:`, error);
        res.status(500).json({
            success: false,
            message: 'Error deleting session',
            error: error.message
        });
    }
});

// List all sessions
router.get('/sessions', (req, res) => {
    try {
        const sessions = fs.readdirSync(SESSIONS_DIR)
            .filter(dir => fs.statSync(`${SESSIONS_DIR}/${dir}`).isDirectory())
            .map(dir => {
                const hasCreds = fs.existsSync(`${SESSIONS_DIR}/${dir}/creds.json`);
                return {
                    sessionId: dir,
                    hasCredentials: hasCreds,
                    isActive: activeConnections.has(dir),
                    created: fs.statSync(`${SESSIONS_DIR}/${dir}`).ctime
                };
            });
        
        res.json({
            success: true,
            sessions,
            total: sessions.length
        });
    } catch (error) {
        console.error('Error listing sessions:', error);
        res.status(500).json({
            success: false,
            message: 'Error listing sessions'
        });
    }
});

// Cleanup on exit
process.on('SIGINT', async () => {
    console.log('🔄 Shutting down... Closing all connections');
    
    for (const [sessionId, sock] of activeConnections.entries()) {
        try {
            await sock.end();
            console.log(`Closed connection for ${sessionId}`);
        } catch (error) {
            console.error(`Error closing ${sessionId}:`, error);
        }
    }
    
    process.exit(0);
});

export default router;