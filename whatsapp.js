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

// Sessions directory
const SESSIONS_DIR = './sessions';

// Store active connections
const activeConnections = new Map();

// Create sessions directory if not exists
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Helper function to remove directory
function removeDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
        try {
            fs.rmSync(dirPath, { recursive: true, force: true });
            return true;
        } catch (error) {
            console.error('Error removing directory:', error);
            return false;
        }
    }
    return false;
}

// Generate QR Code
router.get('/', async (req, res) => {
    const sessionId = req.query.sessionId || `session_${Date.now()}`;
    const sessionDir = `${SESSIONS_DIR}/${sessionId}`;
    
    console.log(`🔧 Request received for session: ${sessionId}`);
    
    // Set response timeout
    req.setTimeout(60000); // 60 seconds timeout
    
    // Clean up existing session if any
    if (fs.existsSync(sessionDir)) {
        console.log(`🧹 Cleaning existing session: ${sessionId}`);
        removeDirectory(sessionDir);
    }
    
    // Create session directory
    fs.mkdirSync(sessionDir, { recursive: true });
    
    let sock = null;
    let qrSent = false;
    let connected = false;
    
    try {
        console.log(`📦 Initializing WhatsApp for session: ${sessionId}`);
        
        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        // Get latest version
        const { version } = await fetchLatestBaileysVersion();
        
        console.log(`⚡ Creating WhatsApp socket...`);
        
        // Create WhatsApp connection
        sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
            },
            printQRInTerminal: true,
            logger: pino({ level: 'error' }),
            browser: Browsers.ubuntu('Chrome'),
            markOnlineOnConnect: true,
        });
        
        // Store connection
        activeConnections.set(sessionId, sock);
        
        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect } = update;
            
            console.log(`📡 [${sessionId}] Connection update:`, connection);
            
            // QR Code received
            if (qr && !qrSent && !connected) {
                qrSent = true;
                console.log(`🔢 [${sessionId}] QR Code generated`);
                
                try {
                    // Generate QR code as base64
                    const qrImage = await qrcode.toDataURL(qr);
                    
                    // Send response to client
                    if (!res.headersSent) {
                        res.json({
                            success: true,
                            sessionId,
                            qrCode: qrImage,
                            qrString: qr,
                            message: 'Scan QR with WhatsApp → Linked Devices',
                            status: 'qr_ready'
                        });
                    }
                } catch (error) {
                    console.error(`❌ [${sessionId}] QR generation error:`, error);
                    if (!res.headersSent) {
                        res.status(500).json({
                            success: false,
                            message: 'Failed to generate QR code'
                        });
                    }
                }
            }
            
            // Connected successfully
            if (connection === 'open') {
                connected = true;
                console.log(`✅ [${sessionId}] WhatsApp connected!`);
                
                // Save credentials
                try {
                    const credsFile = `${sessionDir}/creds.json`;
                    fs.writeFileSync(credsFile, JSON.stringify(state.creds, null, 2));
                    console.log(`💾 [${sessionId}] Credentials saved`);
                    
                    // If response not sent yet (direct connection)
                    if (!qrSent && !res.headersSent) {
                        res.json({
                            success: true,
                            sessionId,
                            message: 'Connected to WhatsApp',
                            status: 'connected'
                        });
                    }
                } catch (error) {
                    console.error(`❌ [${sessionId}] Save error:`, error);
                }
            }
            
            // Connection closed
            if (connection === 'close') {
                console.log(`🔌 [${sessionId}] Connection closed`);
                
                // Check if logged out
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(`🚪 [${sessionId}] Logged out, removing session`);
                    removeDirectory(sessionDir);
                }
                
                // Remove from active connections
                activeConnections.delete(sessionId);
                
                // If no response sent yet
                if (!qrSent && !connected && !res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: 'Connection failed'
                    });
                }
            }
        });
        
        // Save credentials when updated
        sock.ev.on('creds.update', saveCreds);
        
        // Set timeout for connection
        setTimeout(() => {
            if (!qrSent && !connected && !res.headersSent) {
                console.log(`⏰ [${sessionId}] Connection timeout`);
                res.status(408).json({
                    success: false,
                    message: 'Connection timeout'
                });
                
                // Cleanup
                activeConnections.delete(sessionId);
                removeDirectory(sessionDir);
                if (sock) sock.end();
            }
        }, 45000); // 45 seconds timeout
        
    } catch (error) {
        console.error(`💥 [${sessionId}] Initialization error:`, error);
        
        // Cleanup on error
        activeConnections.delete(sessionId);
        removeDirectory(sessionDir);
        if (sock) sock.end();
        
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Failed to initialize WhatsApp',
                error: error.message
            });
        }
    }
});

// Check session status
router.get('/status/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const sessionDir = `${SESSIONS_DIR}/${sessionId}`;
    
    const isActive = activeConnections.has(sessionId);
    const hasCreds = fs.existsSync(`${sessionDir}/creds.json`);
    const sessionExists = fs.existsSync(sessionDir);
    
    let phoneNumber = null;
    if (hasCreds) {
        try {
            const creds = JSON.parse(fs.readFileSync(`${sessionDir}/creds.json`, 'utf8'));
            if (creds.me?.id) {
                phoneNumber = creds.me.id.split(':')[0]?.replace('@s.whatsapp.net', '');
            }
        } catch (error) {
            // Ignore parse errors
        }
    }
    
    res.json({
        success: true,
        sessionId,
        isActive,
        hasCredentials: hasCreds,
        sessionExists,
        phoneNumber,
        timestamp: new Date().toISOString()
    });
});

// Download session file
router.get('/download/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const credsFile = `${SESSIONS_DIR}/${sessionId}/creds.json`;
    
    if (fs.existsSync(credsFile)) {
        res.download(credsFile, `tunzy-md-session-${sessionId}.json`);
    } else {
        res.status(404).json({
            success: false,
            message: 'Session file not found'
        });
    }
});

// List all sessions
router.get('/sessions', (req, res) => {
    try {
        if (!fs.existsSync(SESSIONS_DIR)) {
            return res.json({
                success: true,
                sessions: [],
                count: 0
            });
        }
        
        const sessions = fs.readdirSync(SESSIONS_DIR)
            .filter(dir => fs.statSync(`${SESSIONS_DIR}/${dir}`).isDirectory())
            .map(dir => {
                const dirPath = `${SESSIONS_DIR}/${dir}`;
                const credsFile = `${dirPath}/creds.json`;
                const hasCreds = fs.existsSync(credsFile);
                
                let phoneNumber = null;
                if (hasCreds) {
                    try {
                        const creds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
                        if (creds.me?.id) {
                            phoneNumber = creds.me.id.split(':')[0]?.replace('@s.whatsapp.net', '');
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                }
                
                return {
                    sessionId: dir,
                    hasCredentials: hasCreds,
                    isActive: activeConnections.has(dir),
                    phoneNumber,
                    created: fs.statSync(dirPath).birthtime
                };
            });
        
        res.json({
            success: true,
            sessions,
            count: sessions.length
        });
    } catch (error) {
        console.error('List sessions error:', error);
        res.status(500).json({
            success: false,
            message: 'Error listing sessions'
        });
    }
});

// Delete session
router.delete('/:sessionId', async (req, res) => {
    const sessionId = req.params.sessionId;
    
    // Close connection if active
    const sock = activeConnections.get(sessionId);
    if (sock) {
        try {
            await sock.logout();
        } catch (error) {
            console.error(`Logout error for ${sessionId}:`, error);
        }
        activeConnections.delete(sessionId);
    }
    
    // Remove session files
    const removed = removeDirectory(`${SESSIONS_DIR}/${sessionId}`);
    
    res.json({
        success: true,
        message: removed ? 'Session deleted' : 'Session not found',
        sessionId
    });
});

// Test endpoint
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'WhatsApp route is working!',
        service: 'TUNZY MD Web Pair'
    });
});

export default router;