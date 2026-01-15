const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store sessions (in production, use a database)
const sessions = new Map();

// Generate pairing code endpoint
app.post('/api/generate-pairing', (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone || !phone.match(/^\+[1-9]\d{1,14}$/)) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        // Generate pairing code
        const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
        const sessionId = 'tunzy_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
        
        // Create session
        const session = {
            phone,
            pairingCode,
            sessionId,
            status: 'pending',
            createdAt: new Date(),
            creds: {
                clientID: `TUNZY-MD-${Date.now()}`,
                serverToken: `1@${crypto.randomBytes(8).toString('hex')}`,
                clientToken: `${pairingCode}_${crypto.randomBytes(8).toString('hex')}`,
                encKey: Array.from(crypto.randomBytes(32)),
                macKey: Array.from(crypto.randomBytes(32)),
                phone,
                pairingCode,
                paired: false,
                platform: 'web',
                generatedAt: new Date().toISOString()
            }
        };
        
        sessions.set(sessionId, session);
        
        res.json({
            success: true,
            pairingCode,
            sessionId,
            message: 'Pairing code generated'
        });
        
    } catch (error) {
        console.error('Error generating pairing:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate QR code endpoint
app.post('/api/generate-qr', async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone || !phone.match(/^\+[1-9]\d{1,14}$/)) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        const sessionId = 'tunzy_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
        const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Create session data for QR code
        const sessionData = {
            phone,
            sessionId,
            pairingCode,
            platform: 'TUNZY-MD',
            timestamp: Date.now(),
            type: 'qr-pairing',
            action: 'whatsapp-auth'
        };
        
        // Store session
        const session = {
            phone,
            pairingCode,
            sessionId,
            status: 'pending',
            createdAt: new Date(),
            creds: {
                clientID: `TUNZY-MD-${Date.now()}`,
                serverToken: `1@${crypto.randomBytes(8).toString('hex')}`,
                clientToken: `${pairingCode}_${crypto.randomBytes(8).toString('hex')}`,
                encKey: Array.from(crypto.randomBytes(32)),
                macKey: Array.from(crypto.randomBytes(32)),
                phone,
                pairingCode,
                paired: false,
                platform: 'web',
                generatedAt: new Date().toISOString()
            }
        };
        
        sessions.set(sessionId, session);
        
        // Generate QR code as data URL
        const qrData = JSON.stringify(sessionData);
        const qrCodeUrl = await QRCode.toDataURL(qrData, {
            width: 400,
            margin: 2,
            color: {
                dark: '#000000FF',
                light: '#FFFFFFFF'
            }
        });
        
        res.json({
            success: true,
            qrCode: qrCodeUrl,
            sessionId,
            pairingCode,
            message: 'QR code generated'
        });
        
    } catch (error) {
        console.error('Error generating QR:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get creds.json endpoint
app.get('/api/creds/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = sessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Set content type for JSON download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="creds.json"');
        
        res.send(JSON.stringify(session.creds, null, 2));
        
    } catch (error) {
        console.error('Error getting creds:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`TUNZY-MD Web Pair server running on http://localhost:${PORT}`);
});