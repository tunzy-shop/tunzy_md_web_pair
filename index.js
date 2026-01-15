<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TUNZY MD - WhatsApp QR</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
            width: 100%;
        }
        
        h1 {
            color: #333;
            margin-bottom: 10px;
            text-align: center;
        }
        
        .subtitle {
            color: #666;
            text-align: center;
            margin-bottom: 30px;
            font-size: 14px;
        }
        
        .input-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            color: #555;
            font-weight: 500;
        }
        
        input {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #ddd;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        button:hover {
            transform: translateY(-2px);
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        
        .qr-container {
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            display: none;
        }
        
        .qr-code {
            width: 250px;
            height: 250px;
            margin: 0 auto 20px;
            border: 10px solid white;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .status {
            text-align: center;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
            display: none;
        }
        
        .success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        
        .instructions {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 15px;
            border-radius: 10px;
            margin-top: 20px;
            font-size: 14px;
        }
        
        .instructions h3 {
            color: #856404;
            margin-bottom: 10px;
        }
        
        .instructions ol {
            padding-left: 20px;
        }
        
        .instructions li {
            margin-bottom: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔗 TUNZY MD WhatsApp Pair</h1>
        <p class="subtitle">Generate WhatsApp session via QR code</p>
        
        <div class="input-group">
            <label for="sessionId">Session ID (optional):</label>
            <input type="text" id="sessionId" placeholder="my_session or leave empty for auto-generate">
        </div>
        
        <button id="generateBtn" onclick="generateQR()">Generate QR Code</button>
        
        <div class="status" id="status"></div>
        
        <div class="qr-container" id="qrContainer">
            <img id="qrImage" class="qr-code" alt="QR Code">
            <p id="qrMessage">Scan with WhatsApp → Linked Devices</p>
            <button onclick="checkStatus()">Check Connection Status</button>
        </div>
        
        <div class="instructions">
            <h3>📋 How to use:</h3>
            <ol>
                <li>Click "Generate QR Code"</li>
                <li>Open WhatsApp on your phone</li>
                <li>Go to Settings → Linked Devices → Link a Device</li>
                <li>Scan the QR code shown above</li>
                <li>Click "Check Connection Status" after scanning</li>
                <li>Download your session file when connected</li>
            </ol>
        </div>
    </div>

    <script>
        let currentSessionId = '';
        
        async function generateQR() {
            const sessionId = document.getElementById('sessionId').value || `session_${Date.now()}`;
            currentSessionId = sessionId;
            
            const btn = document.getElementById('generateBtn');
            const statusDiv = document.getElementById('status');
            const qrContainer = document.getElementById('qrContainer');
            
            // Reset UI
            btn.disabled = true;
            btn.textContent = 'Generating...';
            statusDiv.style.display = 'none';
            qrContainer.style.display = 'none';
            
            try {
                // Make request to generate QR
                const response = await fetch(`/whatsapp?sessionId=${encodeURIComponent(sessionId)}`);
                const data = await response.json();
                
                if (data.success) {
                    if (data.qrCode) {
                        // Show QR code
                        document.getElementById('qrImage').src = data.qrCode;
                        document.getElementById('qrMessage').textContent = data.message;
                        qrContainer.style.display = 'block';
                        
                        // Show success status
                        showStatus('QR code generated successfully! Scan it with WhatsApp.', 'success');
                        
                        // Start checking status
                        setTimeout(checkStatus, 3000);
                    } else if (data.message === 'Connected to WhatsApp') {
                        showStatus('✅ Already connected to WhatsApp!', 'success');
                        checkStatus();
                    }
                } else {
                    showStatus('Error: ' + (data.message || 'Unknown error'), 'error');
                }
            } catch (error) {
                showStatus('Connection error: ' + error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Generate QR Code';
            }
        }
        
        async function checkStatus() {
            if (!currentSessionId) return;
            
            try {
                const response = await fetch(`/whatsapp/status/${encodeURIComponent(currentSessionId)}`);
                const data = await response.json();
                
                if (data.success) {
                    if (data.isActive && data.hasCredentials) {
                        showStatus(`✅ Connected! Phone: ${data.phoneNumber || 'Unknown'}`, 'success');
                        
                        // Add download button
                        const qrContainer = document.getElementById('qrContainer');
                        if (!document.getElementById('downloadBtn')) {
                            const downloadBtn = document.createElement('button');
                            downloadBtn.id = 'downloadBtn';
                            downloadBtn.textContent = 'Download Session File';
                            downloadBtn.onclick = () => {
                                window.open(`/whatsapp/download/${currentSessionId}`, '_blank');
                            };
                            downloadBtn.style.marginTop = '10px';
                            qrContainer.appendChild(downloadBtn);
                        }
                    } else if (data.hasCredentials) {
                        showStatus('Session saved but not active', 'info');
                    } else {
                        showStatus('Waiting for QR scan...', 'info');
                        setTimeout(checkStatus, 3000);
                    }
                }
            } catch (error) {
                console.error('Status check error:', error);
            }
        }
        
        function showStatus(message, type) {
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = message;
            statusDiv.className = 'status ' + type;
            statusDiv.style.display = 'block';
        }
    </script>
</body>
</html>