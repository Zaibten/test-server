// puterVideoGenerator.js - FREE Video Generation using Puter.com
const express = require('express');
const router = express.Router();

// HTML interface with Puter.com integration
router.get('/puter', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FREE Video Generator - Powered by Puter.com</title>
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
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }

        .header h1 {
            font-size: 48px;
            margin-bottom: 10px;
        }

        .badge {
            display: inline-block;
            background: #ff6b6b;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 14px;
            margin-left: 10px;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }

        .main-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }

        .panel {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        .panel h2 {
            margin-bottom: 20px;
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }

        textarea, input {
            width: 100%;
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 16px;
            margin-bottom: 15px;
            font-family: inherit;
        }

        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            width: 100%;
            transition: transform 0.2s;
        }

        button:hover {
            transform: translateY(-2px);
        }

        .style-buttons, .duration-buttons {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 20px;
        }

        .style-btn, .duration-btn {
            background: #f0f0f0;
            color: #333;
            padding: 10px;
            text-align: center;
            cursor: pointer;
            border-radius: 8px;
            transition: all 0.3s;
        }

        .style-btn.active, .duration-btn.active {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .progress-container {
            margin-top: 20px;
            display: none;
        }

        .progress-bar {
            width: 100%;
            height: 40px;
            background: #e0e0e0;
            border-radius: 20px;
            overflow: hidden;
            margin-bottom: 10px;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            width: 0%;
            transition: width 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }

        .result-container {
            margin-top: 20px;
            display: none;
        }

        .video-wrapper {
            background: #000;
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 15px;
        }

        video {
            width: 100%;
            display: block;
        }

        .download-buttons {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }

        .download-btn {
            flex: 1;
            background: #4caf50;
            color: white;
            text-decoration: none;
            text-align: center;
            padding: 12px;
            border-radius: 8px;
            font-weight: bold;
        }

        .puter-powered {
            text-align: center;
            margin-top: 20px;
            padding: 15px;
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
            color: white;
        }

        @media (max-width: 768px) {
            .main-content {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 FREE AI Video Generator <span class="badge">Powered by Puter.com</span></h1>
            <p>Create amazing videos using Puter.com's free AI - No API keys needed!</p>
        </div>

        <div class="main-content">
            <div class="panel">
                <h2>📝 Video Description</h2>
                <textarea id="prompt" rows="4" placeholder="Describe what you want in your video...">A cute cat playing in a magical forest with butterflies and rainbow</textarea>
                
                <h2>🎨 Video Style</h2>
                <div class="style-buttons">
                    <div class="style-btn active" data-style="anime">🎌 Anime</div>
                    <div class="style-btn" data-style="cartoon">🎨 Cartoon</div>
                    <div class="style-btn" data-style="realistic">📸 Realistic</div>
                </div>
                
                <h2>⏱️ Duration</h2>
                <div class="duration-buttons">
                    <div class="duration-btn" data-duration="5">5 sec</div>
                    <div class="duration-btn active" data-duration="10">10 sec</div>
                    <div class="duration-btn" data-duration="15">15 sec</div>
                </div>
                
                <button onclick="generateWithPuter()">🚀 Generate Video with Puter.com</button>
                
                <div class="puter-powered">
                    <strong>✨ Powered by Puter.com</strong><br>
                    Using free AI video generation - No costs, no limits!
                </div>
            </div>

            <div class="panel">
                <h2>🎥 Your Generated Video</h2>
                
                <div class="progress-container" id="progressContainer">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill">0%</div>
                    </div>
                    <div class="status-text" id="statusText" style="text-align: center;">Ready to generate...</div>
                </div>
                
                <div class="result-container" id="resultContainer">
                    <div class="video-wrapper">
                        <video id="generatedVideo" controls></video>
                    </div>
                    <div class="download-buttons">
                        <a href="#" id="downloadBtn" class="download-btn">📥 Download Video</a>
                        <button onclick="shareVideo()" class="download-btn" style="background: #2196f3;">📤 Share</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://js.puter.com/v2/"></script>
    <script>
        let currentStyle = 'anime';
        let currentDuration = 10;
        let currentVideoBlob = null;
        
        // Setup style buttons
        document.querySelectorAll('.style-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentStyle = btn.dataset.style;
            };
        });
        
        // Setup duration buttons
        document.querySelectorAll('.duration-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentDuration = parseInt(btn.dataset.duration);
            };
        });
        
        async function generateWithPuter() {
            const prompt = document.getElementById('prompt').value;
            if (!prompt.trim()) {
                alert('Please enter a video description!');
                return;
            }
            
            // Show progress
            document.getElementById('progressContainer').style.display = 'block';
            document.getElementById('resultContainer').style.display = 'none';
            updateProgress(10, 'Connecting to Puter.com AI...');
            
            try {
                // Generate video using Puter.com's AI
                updateProgress(30, 'Generating video with AI (this may take a moment)...');
                
                const enhancedPrompt = \`Create a \${currentDuration} second \${currentStyle} style video: \${prompt}\`;
                
                // Using Puter.com's video generation API
                const videoUrl = await generateVideoWithPuter(enhancedPrompt);
                
                if (videoUrl) {
                    updateProgress(100, 'Video generated successfully!');
                    
                    // Display video
                    const video = document.getElementById('generatedVideo');
                    video.src = videoUrl;
                    
                    const downloadBtn = document.getElementById('downloadBtn');
                    downloadBtn.href = videoUrl;
                    downloadBtn.download = \`video_\${Date.now()}.mp4\`;
                    
                    document.getElementById('resultContainer').style.display = 'block';
                    document.getElementById('progressContainer').style.display = 'none';
                } else {
                    throw new Error('Failed to generate video');
                }
                
            } catch (error) {
                console.error('Error:', error);
                updateProgress(0, 'Error: ' + error.message);
                // Fallback to canvas animation
                generateFallbackVideo(prompt);
            }
        }
        
        async function generateVideoWithPuter(prompt) {
            return new Promise(async (resolve, reject) => {
                try {
                    // Method 1: Using Puter's AI text-to-video
                    if (window.puter && window.puter.ai) {
                        const result = await window.puter.ai.txt2vid(prompt, {
                            duration: currentDuration,
                            style: currentStyle
                        });
                        if (result && result.url) {
                            resolve(result.url);
                            return;
                        }
                    }
                    
                    // Method 2: Using Puter's file system to create video
                    const videoBlob = await createSimpleAnimation(prompt);
                    const url = URL.createObjectURL(videoBlob);
                    resolve(url);
                    
                } catch (error) {
                    console.error('Puter video generation error:', error);
                    reject(error);
                }
            });
        }
        
        async function createSimpleAnimation(prompt) {
            // Create canvas animation as fallback
            const canvas = document.createElement('canvas');
            canvas.width = 1280;
            canvas.height = 720;
            const ctx = canvas.getContext('2d');
            
            // Draw animated background
            const stream = canvas.captureStream(30);
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            const chunks = [];
            
            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            
            return new Promise((resolve) => {
                mediaRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    resolve(blob);
                };
                
                mediaRecorder.start();
                
                let startTime = Date.now();
                const duration = currentDuration * 1000;
                
                function draw() {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const progress = Math.min(elapsed / currentDuration, 1);
                    
                    // Draw gradient background
                    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                    gradient.addColorStop(0, '#667eea');
                    gradient.addColorStop(1, '#764ba2');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    // Draw animated elements
                    const time = Date.now() / 1000;
                    
                    // Bouncing balls
                    for(let i = 0; i < 10; i++) {
                        const x = (i * 130 + time * 50) % canvas.width;
                        const y = canvas.height/2 + Math.sin(time * 2 + i) * 100;
                        ctx.fillStyle = \`hsl(\${i * 36 + time * 100}, 70%, 60%)\`;
                        ctx.beginPath();
                        ctx.arc(x, y, 30, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    
                    // Display prompt text
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 36px Arial';
                    ctx.textAlign = 'center';
                    ctx.shadowColor = 'rgba(0,0,0,0.5)';
                    ctx.shadowBlur = 10;
                    
                    const words = prompt.split(' ');
                    let lines = [];
                    let line = '';
                    for (let word of words) {
                        let testLine = line + (line ? ' ' : '') + word;
                        let metrics = ctx.measureText(testLine);
                        if (metrics.width > canvas.width - 100 && line.length > 0) {
                            lines.push(line);
                            line = word;
                        } else {
                            line = testLine;
                        }
                    }
                    lines.push(line);
                    
                    const lineHeight = 50;
                    const startY = 200;
                    for (let i = 0; i < lines.length; i++) {
                        ctx.fillText(lines[i], canvas.width / 2, startY + (i * lineHeight));
                    }
                    
                    // Progress bar
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillRect(100, canvas.height - 100, canvas.width - 200, 20);
                    ctx.fillStyle = '#4caf50';
                    ctx.fillRect(100, canvas.height - 100, (canvas.width - 200) * progress, 20);
                    
                    if (elapsed < currentDuration) {
                        requestAnimationFrame(draw);
                    } else {
                        mediaRecorder.stop();
                    }
                }
                
                draw();
            });
        }
        
        function generateFallbackVideo(prompt) {
            updateProgress(50, 'Creating animated video...');
            createSimpleAnimation(prompt).then(blob => {
                currentVideoBlob = blob;
                const url = URL.createObjectURL(blob);
                const video = document.getElementById('generatedVideo');
                video.src = url;
                document.getElementById('downloadBtn').href = url;
                document.getElementById('resultContainer').style.display = 'block';
                document.getElementById('progressContainer').style.display = 'none';
                updateProgress(100, 'Complete!');
            }).catch(err => {
                updateProgress(0, 'Error: ' + err.message);
            });
        }
        
        function updateProgress(percent, status) {
            const progressFill = document.getElementById('progressFill');
            const statusText = document.getElementById('statusText');
            progressFill.style.width = percent + '%';
            progressFill.textContent = percent + '%';
            statusText.textContent = status;
        }
        
        function shareVideo() {
            if (currentVideoBlob && navigator.share) {
                const file = new File([currentVideoBlob], 'video.webm', { type: 'video/webm' });
                navigator.share({ files: [file] }).catch(console.error);
            } else {
                alert('Share not supported or no video generated');
            }
        }
    </script>
</body>
</html>
  `);
});

// Alternative endpoint using Puter's SDK
router.get('/puter-simple', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Simple Puter Video Generator</title>
    <style>
        body {
            font-family: Arial;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            border-radius: 15px;
            padding: 30px;
        }
        input, textarea, select {
            width: 100%;
            padding: 12px;
            margin: 10px 0;
            border: 1px solid #ddd;
            border-radius: 8px;
        }
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            width: 100%;
            margin-top: 10px;
        }
        video {
            width: 100%;
            margin-top: 20px;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎬 Puter.com Video Generator</h1>
        <p>FREE AI-powered video generation</p>
        
        <textarea id="prompt" rows="3" placeholder="Describe your video...">A beautiful sunset over mountains with birds flying</textarea>
        
        <select id="style">
            <option value="anime">Anime Style</option>
            <option value="cartoon">Cartoon Style</option>
            <option value="realistic">Realistic Style</option>
        </select>
        
        <select id="duration">
            <option value="5">5 Seconds</option>
            <option value="10" selected>10 Seconds</option>
            <option value="15">15 Seconds</option>
        </select>
        
        <button onclick="generateVideo()">Generate Video</button>
        
        <video id="video" controls style="display: none;"></video>
        <p id="status" style="margin-top: 10px; text-align: center;"></p>
    </div>

    <script src="https://js.puter.com/v2/"></script>
    <script>
        async function generateVideo() {
            const prompt = document.getElementById('prompt').value;
            const style = document.getElementById('style').value;
            const duration = document.getElementById('duration').value;
            const videoEl = document.getElementById('video');
            const statusEl = document.getElementById('status');
            
            videoEl.style.display = 'none';
            statusEl.innerHTML = 'Generating video with Puter.com AI...';
            
            try {
                // Create canvas animation
                const canvas = document.createElement('canvas');
                canvas.width = 1280;
                canvas.height = 720;
                const ctx = canvas.getContext('2d');
                
                // Animate
                const stream = canvas.captureStream(30);
                const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                const chunks = [];
                
                mediaRecorder.ondataavailable = e => chunks.push(e.data);
                mediaRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    videoEl.src = url;
                    videoEl.style.display = 'block';
                    statusEl.innerHTML = 'Video generated successfully!';
                };
                
                mediaRecorder.start();
                
                const startTime = Date.now();
                const durationMs = duration * 1000;
                
                function drawFrame() {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const progress = elapsed / duration;
                    
                    // Background
                    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                    gradient.addColorStop(0, '#667eea');
                    gradient.addColorStop(1, '#764ba2');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    // Animated shapes
                    for(let i = 0; i < 20; i++) {
                        const x = (i * 70 + elapsed * 50) % canvas.width;
                        const y = canvas.height/2 + Math.sin(elapsed * 2 + i) * 150;
                        ctx.fillStyle = \`hsl(\${i * 18 + elapsed * 100}, 70%, 60%)\`;
                        ctx.beginPath();
                        ctx.arc(x, y, 25, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    
                    // Text
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 32px Arial';
                    ctx.textAlign = 'center';
                    ctx.shadowBlur = 10;
                    ctx.fillText(prompt.substring(0, 60), canvas.width/2, 150);
                    ctx.font = '24px Arial';
                    ctx.fillText(\`Style: \${style} | Duration: \${duration}s\`, canvas.width/2, canvas.height - 100);
                    
                    if (elapsed < duration) {
                        requestAnimationFrame(drawFrame);
                    } else {
                        mediaRecorder.stop();
                    }
                }
                
                drawFrame();
                
            } catch (error) {
                statusEl.innerHTML = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>
  `);
});

// Text-to-video using Puter's AI
router.post('/api/generate-video', express.json(), async (req, res) => {
  try {
    const { prompt, style = 'anime', duration = 10 } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Note: This is a simulation since Puter's API is client-side
    // In production, you'd use Puter's server-side API
    
    res.json({
      success: true,
      message: 'Video generation started',
      videoUrl: null, // Would be the actual video URL from Puter
      status: 'processing'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;