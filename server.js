import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the WhatsApp router
import whatsappRouter from './whatsapp.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create necessary directories
const directories = ['./sessions', './logs'];
directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Routes
app.use('/whatsapp', whatsappRouter);

// Test route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'WhatsApp Web API is running',
        endpoints: [
            'GET  /whatsapp?sessionId=test',
            'GET  /whatsapp/status/:sessionId',
            'GET  /whatsapp/sessions',
            'GET  /whatsapp/download/:sessionId',
            'DELETE /whatsapp/:sessionId'
        ]
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 WhatsApp Web API available at http://localhost:${PORT}/whatsapp`);
    console.log(`🔗 Test endpoint: http://localhost:${PORT}/whatsapp?sessionId=test1`);
});