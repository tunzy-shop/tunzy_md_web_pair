// Update the generate methods to use fetch API
async generateQRCode() {
    const phone = this.phoneInput.value.trim();
    
    if (!this.validatePhoneNumber(phone)) {
        this.showNotification('Please enter a valid phone number with country code (e.g., +2349012345678)', 'error');
        return;
    }

    try {
        // Call API
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phone: phone })
        });

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to generate');
        }

        // Generate QR code with the data
        this.qrCodeData = JSON.stringify({
            phone: phone,
            sessionId: data.sessionId,
            pairingCode: data.pairingCode
        });
        
        // Clear previous QR code
        this.qrcodeElement.innerHTML = '';
        
        // Generate QR code
        QRCode.toCanvas(this.qrcodeElement, this.qrCodeData, {
            width: 256,
            height: 256,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        // Store creds data
        this.credsData = data.creds;
        this.pairingCode = data.pairingCode;
        
        // Show containers
        this.qrContainer.classList.remove('hidden');
        this.codeContainer.classList.remove('hidden');
        this.credsInfo.classList.remove('hidden');
        
        // Update pairing code display
        this.pairingCodeElement.textContent = this.pairingCode;
        
        this.showNotification('QR Code generated successfully!');
        
    } catch (error) {
        console.error('Error:', error);
        this.showNotification('Error: ' + error.message, 'error');
    }
}

async generatePairingCode() {
    const phone = this.phoneInput.value.trim();
    
    if (!this.validatePhoneNumber(phone)) {
        this.showNotification('Please enter a valid phone number with country code', 'error');
        return;
    }

    try {
        // Call API
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phone: phone })
        });

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to generate');
        }

        // Store data
        this.credsData = data.creds;
        this.pairingCode = data.pairingCode;
        
        // Update display
        this.pairingCodeElement.textContent = this.pairingCode;
        
        // Show containers
        this.codeContainer.classList.remove('hidden');
        this.credsInfo.classList.remove('hidden');
        this.qrContainer.classList.add('hidden');
        
        this.showNotification('Pairing code generated successfully!');
        
    } catch (error) {
        console.error('Error:', error);
        this.showNotification('Error: ' + error.message, 'error');
    }
}