class TunzyPair {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.pairingCode = '';
        this.qrCodeData = '';
    }

    initializeElements() {
        this.phoneInput = document.getElementById('phoneNumber');
        this.generateQRBtn = document.getElementById('generateQRBtn');
        this.generateCodeBtn = document.getElementById('generateCodeBtn');
        this.downloadCredsBtn = document.getElementById('downloadCredsBtn');
        this.copyCodeBtn = document.getElementById('copyCodeBtn');
        
        this.qrContainer = document.getElementById('qrContainer');
        this.codeContainer = document.getElementById('codeContainer');
        this.credsInfo = document.getElementById('credsInfo');
        this.qrcodeElement = document.getElementById('qrcode');
        this.pairingCodeElement = document.getElementById('pairingCode');
        
        this.notification = document.getElementById('notification');
    }

    setupEventListeners() {
        this.generateQRBtn.addEventListener('click', () => this.generateQRCode());
        this.generateCodeBtn.addEventListener('click', () => this.generatePairingCode());
        this.downloadCredsBtn.addEventListener('click', () => this.downloadCreds());
        this.copyCodeBtn.addEventListener('click', () => this.copyPairingCode());
    }

    validatePhoneNumber(phone) {
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        return phoneRegex.test(phone);
    }

    async generateQRCode() {
        const phone = this.phoneInput.value.trim();
        
        if (!this.validatePhoneNumber(phone)) {
            this.showNotification('Please enter a valid phone number with country code (e.g., +2349012345678)', 'error');
            return;
        }

        try {
            // Generate QR code data
            this.qrCodeData = this.generateSessionData(phone);
            
            // Clear previous QR code
            this.qrcodeElement.innerHTML = '';
            
            // Generate new QR code
            QRCode.toCanvas(this.qrcodeElement, this.qrCodeData, {
                width: 256,
                height: 256,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            }, (error) => {
                if (error) {
                    console.error('QR Code generation error:', error);
                    this.showNotification('Error generating QR code', 'error');
                }
            });

            // Show QR container
            this.qrContainer.classList.remove('hidden');
            this.codeContainer.classList.add('hidden');
            
            // Generate pairing code as well
            this.generatePairingCodeData(phone);
            
            this.showNotification('QR Code generated successfully! Scan it with WhatsApp');
            
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Error generating QR code', 'error');
        }
    }

    async generatePairingCode() {
        const phone = this.phoneInput.value.trim();
        
        if (!this.validatePhoneNumber(phone)) {
            this.showNotification('Please enter a valid phone number with country code', 'error');
            return;
        }

        try {
            // Generate pairing code
            this.generatePairingCodeData(phone);
            
            // Show code container
            this.codeContainer.classList.remove('hidden');
            this.qrContainer.classList.add('hidden');
            
            this.showNotification('Pairing code generated successfully!');
            
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Error generating pairing code', 'error');
        }
    }

    generateSessionData(phone) {
        // Generate a unique session ID
        const sessionId = 'tunzy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Create session data (this would typically come from your bot's API)
        return JSON.stringify({
            phone: phone,
            sessionId: sessionId,
            platform: 'TUNZY-MD',
            timestamp: Date.now(),
            type: 'qr-pairing'
        });
    }

    generatePairingCodeData(phone) {
        // Generate a 6-digit pairing code
        this.pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Display the code
        this.pairingCodeElement.textContent = this.pairingCode;
        
        // Also generate session data for creds.json
        this.generateCredsData(phone, this.pairingCode);
    }

    generateCredsData(phone, code) {
        // This is where you would integrate with your actual bot API
        // For now, we'll create a mock creds.json structure
        
        this.credsData = {
            "clientID": "TUNZY-MD-" + Date.now(),
            "serverToken": "1@TUNZYMD_" + Math.random().toString(36).substr(2, 16),
            "clientToken": this.pairingCode + "_" + Math.random().toString(36).substr(2, 16),
            "encKey": Array.from({length: 32}, () => Math.floor(Math.random() * 256)),
            "macKey": Array.from({length: 32}, () => Math.floor(Math.random() * 256)),
            "phone": phone,
            "pairingCode": code,
            "paired": false,
            "platform": "web",
            "generatedAt": new Date().toISOString()
        };
        
        // Show creds info
        this.credsInfo.classList.remove('hidden');
    }

    downloadCreds() {
        if (!this.credsData) {
            this.showNotification('Please generate a pairing code or QR code first', 'error');
            return;
        }

        try {
            // Convert to JSON string with proper formatting
            const jsonString = JSON.stringify(this.credsData, null, 2);
            
            // Create blob and download link
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = 'creds.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up
            URL.revokeObjectURL(url);
            
            this.showNotification('creds.json downloaded successfully!');
            
        } catch (error) {
            console.error('Error downloading creds.json:', error);
            this.showNotification('Error downloading file', 'error');
        }
    }

    copyPairingCode() {
        if (!this.pairingCode) {
            this.showNotification('No pairing code to copy', 'error');
            return;
        }

        navigator.clipboard.writeText(this.pairingCode)
            .then(() => {
                this.showNotification('Pairing code copied to clipboard!');
            })
            .catch(err => {
                console.error('Failed to copy:', err);
                this.showNotification('Failed to copy code', 'error');
            });
    }

    showNotification(message, type = 'success') {
        this.notification.textContent = message;
        this.notification.style.background = type === 'error' ? '#dc3545' : '#28a745';
        this.notification.classList.remove('hidden');
        
        setTimeout(() => {
            this.notification.classList.add('hidden');
        }, 3000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TunzyPair();
});