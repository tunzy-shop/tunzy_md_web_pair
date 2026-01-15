const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve static files
app.use(express.static(__dirname));

// API endpoint for generating pairing data (mock)
app.post('/api/generate', (req, res) => {
    const { phone } = req.body;
    
    if (!phone || !/^\+[1-9]\d{1,14}$/.test(phone)) {
        return res.status(400).json({ 
            error: 'Invalid phone number format. Use +[country code][number]' 
        });
    }
    
    // Generate mock pairing data
    const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = 'tunzy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    res.json({
        success: true,
        pairingCode: pairingCode,
        sessionId: sessionId,
        phone: phone,
        creds: {
            clientID: "TUNZY-MD-" + Date.now(),
            serverToken: "1@TUNZYMD_" + Math.random().toString(36).substr(2, 16),
            clientToken: pairingCode + "_" + Math.random().toString(36).substr(2, 16),
            encKey: Array.from({length: 32}, () => Math.floor(Math.random() * 256)),
            macKey: Array.from({length: 32}, () => Math.floor(Math.random() * 256)),
            phone: phone,
            pairingCode: pairingCode,
            paired: false,
            platform: "web",
            generatedAt: new Date().toISOString()
        }
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Handle 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access: http://localhost:${PORT}`);
});