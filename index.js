// ═══════════════════════════════════════════════════════════════════
//  STORY TELLER SERVER  –  Vercel-compatible
//  Removed: fluent-ffmpeg, child_process, fs (local writes), axios streams
//  Added:   Cloudinary slideshow API for video, fetch for image download
// ═══════════════════════════════════════════════════════════════════

console.log('');
console.log("******* Story Teller Server Side (Vercel) *******");
console.log('');

require('dotenv').config();

const express    = require('express');
const mongoose   = require('mongoose');
const bodyParser = require('body-parser');
const cors       = require('cors');
const OpenAI     = require('openai');
const cloudinary = require('cloudinary').v2;
const bcrypt     = require('bcryptjs');

// ── Internal routes ──────────────────────────────────────────────
const authRouter  = require('./routes/auth.js');

// ── App init ─────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 9000;

// ── Middleware ───────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(authRouter);
app.use('/assets', express.static('assets'));

// ── MongoDB ──────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((e) => console.log('❌ MongoDB Error:', e));

// ── Cloudinary ───────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── OpenAI ───────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── User model (inline to avoid path issues on Vercel) ───────────
const User = require('./models/user');

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════

/** Safe JSON extractor – strips markdown fences */
function extractJSON(text) {
  try {
    if (!text) return null;
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = text.indexOf('[');
    const end   = text.lastIndexOf(']');
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.substring(start, end + 1));
  } catch (e) {
    console.log('JSON_PARSE_ERROR:', e.message);
    return null;
  }
}

/** Sanitise image prompts */
function safePrompt(text = '') {
  return text
    .replace(/violence|kill|death|gun|weapon|blood|fight/gi, 'action scene')
    .replace(/horror|scary|dark/gi, 'mysterious')
    .substring(0, 180);
}

// ════════════════════════════════════════════════════════════════
//  LANGUAGE HELPERS
// ════════════════════════════════════════════════════════════════

async function convertToRomanUrdu(text) {
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional Urdu storyteller. Convert the English text to Natural Roman Urdu.
Rules:
1. Use proper Urdu words
2. Add expressions: 'Achha!', 'Wah!', 'Are!', 'Haye!'
3. Urdu sentence structure (verb at end)
4. Use: 'jee', 'bilkul', 'bohat', 'thoda'
5. Storytelling phrases: 'chalo', 'suno', 'dekho'
Only return the Roman Urdu text.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.4,
      max_tokens: 600,
    });
    return res.choices[0].message.content;
  } catch (err) {
    console.error('Roman Urdu conversion error:', err.message);
    return text;
  }
}

async function enhanceRomanUrduForAccent(text) {
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a pronunciation expert. Convert Roman Urdu for better TTS accent.
Rules:
1. Add 'ah' at end of words ending with 'a'
2. Double vowels for emphasis
3. Add 'h' to soften sounds
4. Break long words with hyphens
5. Use 'jee', 'hahn'
6. Add commas/periods for pauses
Only return the enhanced text.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.5,
      max_tokens: 800,
    });
    return res.choices[0].message.content;
  } catch (err) {
    console.error('Enhancement error:', err.message);
    return text;
  }
}

// ════════════════════════════════════════════════════════════════
//  VOICEOVER  (returns a Cloudinary URL, no local files)
//  language: 'english' | 'urdu'
// ════════════════════════════════════════════════════════════════
async function generateVoiceover(text, language = 'urdu') {
  try {
    let finalText = text;
    let voice     = 'nova';  // English default
    let speed     = 0.92;

    if (language === 'urdu') {
      const romanUrdu = await convertToRomanUrdu(text);
      finalText       = await enhanceRomanUrduForAccent(romanUrdu);
      voice           = 'fable';
      speed           = 0.85;
      console.log('📖 Roman Urdu Story:', romanUrdu);
    } else {
      console.log('📖 English Story (direct TTS)');
    }

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice,
      input: finalText,
      speed,
    });

    // Convert to Buffer – no fs needed
    const buffer = Buffer.from(await mp3.arrayBuffer());

    // Upload audio buffer directly to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder:        'story_voiceovers',
          resource_type: 'raw',        // audio file
          format:        'mp3',
          public_id:     `voice_${Date.now()}`,
        },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
      stream.end(buffer);
    });

    console.log(`✅ Voiceover uploaded (${language}): ${uploadResult.secure_url}`);
    return uploadResult.secure_url;   // ← returns URL, not a local path
  } catch (err) {
    console.error('Voiceover generation error:', err.message);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
//  VIDEO CREATOR  –  Cloudinary slideshow (no FFmpeg needed)
//  imageUrls: string[]   voiceoverUrl: string
// ════════════════════════════════════════════════════════════════
async function createVideoFromSlideshow(imageUrls, voiceoverUrl) {
  try {
    // Build a Cloudinary multi-layer transformation:
    // Use the Cloudinary Video API to create a slideshow from images
    // Each image is overlaid as a layer with a fixed duration

    const durationPerSlide = 4;   // seconds per image

    // Cloudinary public IDs are embedded in their URLs.
    // We upload each image URL as a new cloudinary resource so we have public_ids.
    // Then we use the video generation via explicit API.

    // Step 1 – collect public_ids (images are already in cloudinary/story_comics)
    const publicIds = imageUrls.map((url) => {
      // Extract public_id from cloudinary URL
      // e.g. https://res.cloudinary.com/<cloud>/image/upload/v.../story_comics/xyz.png
      const match = url.match(/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
      return match ? match[1] : null;
    }).filter(Boolean);

    if (publicIds.length === 0) throw new Error('No valid Cloudinary public IDs found');

    // Step 2 – Use Cloudinary's multi API to stitch into a video slideshow
    // Cloudinary multi() creates an animated GIF/MP4 from a list of images
    const multiResult = await cloudinary.multi({
      tag:      null,
      public_ids: publicIds,
      transformation: [
        { width: 1024, height: 1024, crop: 'pad', background: 'black' },
        { delay: durationPerSlide * 1000 },   // ms per frame
      ],
      format:   'mp4',
      notification_url: null,
    });

    // multi() returns { url, secure_url, ... }
    console.log('🎬 Cloudinary slideshow created:', multiResult.secure_url);

    // Step 3 – Overlay audio using Cloudinary's video transformation URL
    // Cloudinary supports audio overlay via URL transformation
    // Extract public_id of the voiceover
    const audioMatch = voiceoverUrl.match(/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
    const audioPubId = audioMatch ? audioMatch[1] : null;

    if (!audioPubId) {
      console.warn('⚠️  Could not parse audio public_id – returning video without audio');
      return multiResult.secure_url;
    }

    // Build audio-overlay URL
    const videoMatch  = multiResult.secure_url.match(/upload\/(.+)$/);
    const videoSuffix = videoMatch ? videoMatch[1] : null;

    if (!videoSuffix) return multiResult.secure_url;

    // Cloudinary transformation: overlay audio track
    const videoWithAudio = multiResult.secure_url.replace(
      '/upload/',
      `/upload/l_${audioPubId.replace(/\//g, ':')},fl_layer_apply/`
    );

    console.log('🎬 Video with audio URL:', videoWithAudio);
    return videoWithAudio;

  } catch (err) {
    console.error('Slideshow creation error:', err.message);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ════════════════════════════════════════════════════════════════

app.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
      return res.status(400).json({ success: false, error: 'Email and new password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/profile', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ════════════════════════════════════════════════════════════════
//  STORY TEXT  API
// ════════════════════════════════════════════════════════════════

app.post('/api/generate-story-text', async (req, res) => {
  try {
    const { character, world, mood, customPrompt } = req.body;

    if (!character && !world && !mood && !customPrompt)
      return res.status(400).json({ success: false, error: 'Please provide character, world, mood, or customPrompt' });

    const storyPrompt = customPrompt ||
      `Write a short, engaging, kid-friendly story (150-200 words) about:
      - Character: ${character || 'a friendly animal'}
      - Setting: ${world || 'a magical place'}
      - Mood/Tone: ${mood || 'adventurous and fun'}
      Make it creative, positive, and suitable for children ages 4-10.`;

    const [storyResult, titleResult] = await Promise.all([
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: "You are a professional children's storyteller. Create engaging, age-appropriate stories for kids aged 4-10." },
          { role: 'user', content: storyPrompt },
        ],
        temperature: 0.8,
        max_tokens: 400,
      }),
      // We'll use the story for title generation after
    ]);

    const story = storyResult.choices[0].message.content;

    const titleResult2 = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Generate a creative, catchy title for this children's story (max 8 words, just the title, no quotes or explanation):\n\n${story}`,
      }],
      temperature: 0.7,
      max_tokens: 30,
    });

    const title = titleResult2.choices[0].message.content.trim();

    res.json({
      success: true,
      story,
      title,
      metadata: {
        character: character || null,
        world:     world || null,
        mood:      mood || null,
        wordCount: story.split(/\s+/).length,
        generatedAt: new Date().toISOString(),
      },
    });

    console.log(`✅ Story generated: "${title}" (${story.split(/\s+/).length} words)`);
  } catch (error) {
    console.error('Story generation error:', error);
    if (error.code === 'insufficient_quota')
      return res.status(429).json({ success: false, error: 'API quota exceeded. Please try again later.' });
    res.status(500).json({ success: false, error: error.message || 'Failed to generate story' });
  }
});

app.get('/api/test-story', (_req, res) => {
  res.json({ success: true, message: 'Story API is working!', usage: 'POST /api/generate-story-text with { character, world, mood }' });
});

// ════════════════════════════════════════════════════════════════
//  MAIN STREAMING ENDPOINT
//  GET /generate-story-comic-stream?prompt=...&language=english|urdu
//
//  ⚠️  Vercel Pro has 60s timeout.  Vercel Hobby has 10s.
//      For long generation (images + video) use Pro plan or
//      separate the video step to a background job / webhook.
// ════════════════════════════════════════════════════════════════
app.get('/generate-story-comic-stream', async (req, res) => {
  const startTime       = Date.now();
  const uniqueRequestId = `${Date.now()}-${Math.random().toString(36)}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const prompt = req.query.prompt;
    if (!prompt) return res.status(400).send('Prompt required');

    const language  = (req.query.language || 'english').toLowerCase();
    const isEnglish = language !== 'urdu';

    console.log(`\n🌐 Language: ${isEnglish ? '🇺🇸 English' : '🇵🇰 Roman Urdu'}\n`);

    send({ progress: 5 });

    // 1️⃣  STORY
    const storyRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Write a very short kid-friendly story (max 100 words) based on: "${prompt}. [unique: ${uniqueRequestId}]". Be extremely creative and different every time.`,
      }],
      max_tokens:  150,
      temperature: 0.9,
      seed: Math.floor(Math.random() * 1_000_000),
    });

    const englishStory = storyRes.choices?.[0]?.message?.content || '';
    send({ progress: 20, story: englishStory });

    // 2️⃣  PANELS
    const panelRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'Return ONLY valid JSON array, no extra text.' },
        {
          role: 'user',
          content: `Generate 4 unique comic panels for this story. Each panel must have title, description, imagePrompt.\nStory: ${englishStory}`,
        },
      ],
    });

    let panels = extractJSON(panelRes.choices?.[0]?.message?.content);
    if (!Array.isArray(panels)) throw new Error('Panel parsing failed');

    panels = panels.map((p) => ({ ...p, image: '' }));
    send({ progress: 40, panels });

    // 3️⃣  IMAGES  (2 at a time)
    const imageQueue = [...panels.entries()];

    async function processImageQueue() {
      const batch = [];
      while (imageQueue.length && batch.length < 2) batch.push(imageQueue.shift());
      if (batch.length === 0) return;

      await Promise.all(
        batch.map(async ([idx, panel]) => {
          try {
            const img = await openai.images.generate({
              model:           'dall-e-3',
              prompt:          safePrompt(panel.imagePrompt) + ', cute cartoon style, colorful, kid-friendly',
              size:            '1024x1024',
              response_format: 'b64_json',
            });

            const base64 = img.data?.[0]?.b64_json;
            if (!base64) throw new Error('No base64');

            const uploadRes = await cloudinary.uploader.upload(
              `data:image/png;base64,${base64}`,
              { folder: 'story_comics' }
            );

            panels[idx].image = uploadRes.secure_url;
            console.log(`📸 Panel ${idx + 1}: ${uploadRes.secure_url}`);
            send({
              progress:   40 + Math.round(((idx + 1) / panels.length) * 40),
              panelIndex: idx,
              image:      uploadRes.secure_url,
            });
          } catch (err) {
            console.error(`Panel ${idx} failed:`, err.message);
            panels[idx].image = '';
          }
        })
      );

      await processImageQueue();
    }

    await processImageQueue();

    // 4️⃣  VOICEOVER + VIDEO (Cloudinary-based, no FFmpeg)
    const validPanels = panels.filter((p) => p.image);
    let videoUrl      = null;

    if (validPanels.length > 0) {
      try {
        send({ progress: 82, status: isEnglish ? '🇺🇸 Generating English voiceover...' : '🇵🇰 Converting to Roman Urdu...' });

        // Generate voiceover → returns Cloudinary URL
        const voiceUrl = await generateVoiceover(englishStory, language);

        if (voiceUrl) {
          send({ progress: 90, status: 'Creating video slideshow...' });

          const imageUrls = validPanels.map((p) => p.image);
          videoUrl        = await createVideoFromSlideshow(imageUrls, voiceUrl);

          if (videoUrl) {
            console.log('');
            console.log('══════════════════════════════════════════════');
            console.log('🎬  VIDEO GENERATED SUCCESSFULLY!');
            console.log(`🌐  Language : ${isEnglish ? '🇺🇸 English' : '🇵🇰 Urdu'}`);
            console.log(`📹  Video URL: ${videoUrl}`);
            console.log('══════════════════════════════════════════════');
            console.log('');
          }
        }
      } catch (videoErr) {
        console.error('Video generation error:', videoErr.message);
      }
    }

    send({
      progress:       100,
      step:           'done',
      videoUrl,
      language,
      panels,
      generationTime: `${Math.floor((Date.now() - startTime) / 1000)}s`,
    });

    res.end();
  } catch (e) {
    console.error(e);
    send({ error: e.message });
    res.end();
  }
});

// ════════════════════════════════════════════════════════════════
//  MISCELLANEOUS ROUTES
// ════════════════════════════════════════════════════════════════

app.get('/get-latest-video', async (_req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type:          'upload',
      prefix:        'story_videos',
      resource_type: 'video',
      max_results:   1,
      sort_by:       'created_at',
      sort_order:    'desc',
    });
    if (result.resources?.length > 0) {
      res.json({ success: true, videoUrl: result.resources[0].secure_url, createdAt: result.resources[0].created_at });
    } else {
      res.json({ success: false, message: 'No videos found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/test-roman-urdu', async (req, res) => {
  const testText  = req.query.text || 'Once upon a time, there was a little cat who loved to explore the magical forest.';
  const romanUrdu = await convertToRomanUrdu(testText);
  res.json({ original: testText, romanUrdu });
});

app.post('/test-voiceover', async (req, res) => {
  try {
    const { text, language = 'urdu' } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });

    const audioUrl = await generateVoiceover(text, language);
    if (audioUrl) {
      res.json({ success: true, audioUrl, language });
    } else {
      res.json({ error: 'Voice generation failed' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/check-openai', async (_req, res) => {
  try {
    await openai.chat.completions.create({
      model:     'gpt-4o-mini',
      messages:  [{ role: 'user', content: 'Hi' }],
      max_tokens: 5,
    });
    res.json({ status: 'working', credits: 'available' });
  } catch (error) {
    if (error.code === 'insufficient_quota') return res.json({ status: 'failed', reason: 'no_credits' });
    if (error.code === 'invalid_api_key')    return res.json({ status: 'failed', reason: 'invalid_key' });
    res.json({ status: 'error', message: error.message });
  }
});

app.get('/home', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Story Teller Server</title>
  <style>
    body { background:#1e1e2f; color:#e4e4e4; font-family:sans-serif; padding:2rem; }
    h1   { color:#ffcc00; }
    li   { margin-bottom: 6px; }
    code { background:#2b2b3d; padding:2px 8px; border-radius:4px; }
  </style>
</head>
<body>
  <h1>🎬 Story Teller Server</h1>
  <p>✅ Server is running on Vercel.</p>
  <h3>Available Endpoints</h3>
  <ul>
    <li><code>GET  /generate-story-comic-stream?prompt=...&language=english|urdu</code></li>
    <li><code>POST /api/generate-story-text</code> — { character, world, mood }</li>
    <li><code>GET  /check-openai</code></li>
    <li><code>GET  /test-roman-urdu?text=...</code></li>
    <li><code>POST /test-voiceover</code> — { text, language }</li>
    <li><code>GET  /get-latest-video</code></li>
  </ul>
</body>
</html>`);
});

// ════════════════════════════════════════════════════════════════
//  START  (local dev only – Vercel uses serverless handler)
// ════════════════════════════════════════════════════════════════
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
