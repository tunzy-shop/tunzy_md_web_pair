import express from 'express';
import fs from 'fs';
import https from 'https';
import http from 'http';
import cors from 'cors';
import whatsappRoute from './routes/whatsapp.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Create necessary directories
const directories = ['./sessions', './logs', './routes'];
directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
app.use('/whatsapp', whatsappRoute);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'TUNZY MD Web Pair API',
        version: '2.0.0',
        endpoints: {
            generate_qr: 'GET /whatsapp?sessionId=your_session',
            check_status: 'GET /whatsapp/status/:sessionId',
            download_session: 'GET /whatsapp/download/:sessionId',
            list_sessions: 'GET /whatsapp/sessions',
            delete_session: 'DELETE /whatsapp/:sessionId'
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'whatsapp-web-pair',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Create HTTP server
const server = http.createServer(app);

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server started on port ${PORT}`);
    console.log(`🌐 Access URLs:`);
    console.log(`   Local: http://localhost:${PORT}`);
    console.log(`   Network: http://${getLocalIP()}:${PORT}`);
    console.log(`\n📱 WhatsApp QR Endpoint: http://localhost:${PORT}/whatsapp?sessionId=test`);
    console.log(`📊 Health Check: http://localhost:${PORT}/health`);
});

// Function to get local IP address
function getLocalIP() {
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}