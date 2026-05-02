// Story Teller Server - Vercel Compatible
console.log('');
console.log("******* Story Teller Server Side *******");
console.log('');

// External Packages
require('dotenv').config();
const express = require('express');
const { default: mongoose } = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const OpenAI = require('openai');
const User = require('./models/user');
const cloudinary = require("cloudinary").v2;

const path = require('path');
const axios = require('axios');
const fs = require('fs');
const os = require('os');

const bcrypt = require('bcryptjs');

// Internal Routes
const authRouter = require('./routes/auth.js');
const puterVideoGenerator = require('./routes/mk.js');

// ✅ VERCEL: Use os.tmpdir() for temp files (/tmp on Vercel)
const getTempDir = () => os.tmpdir();

// INIT
const app = express();
const PORT = process.env.PORT || 9000;
const DB = process.env.MONGO_URI;

// Middleware
app.use(express.json());
app.use(authRouter);
app.use('/puter-video', puterVideoGenerator);
app.use("/assets", express.static("assets"));

// ✅ VERCEL: Lazy MongoDB connection (serverless-safe)
let isConnected = false;
const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) return;
  try {
    await mongoose.connect(DB, {
      serverSelectionTimeoutMS: 10000,
    });
    isConnected = true;
    console.log('MongoDB connection successful');
  } catch (e) {
    isConnected = false;
    console.log("MongoDB Error:", e);
    throw e;
  }
};

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// ✅ VERCEL: Middleware to ensure DB is connected before every request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (e) {
    res.status(500).json({ error: "Database connection failed. Please try again." });
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// -------------------- Reset Password --------------------
app.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ success: false, error: "Email and new password are required" });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// -------------------- Profile Route --------------------
app.post('/profile', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ email }).select('-password');
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------- OpenAI Init --------------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Safe JSON parser
function extractJSON(text) {
  try {
    if (!text) return null;
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.substring(start, end + 1));
  } catch (e) {
    console.log("JSON_PARSE_ERROR:", e.message);
    return null;
  }
}

// ✅ Safe image prompt sanitizer
function safePrompt(text = "") {
  return text
    .replace(/violence|kill|death|gun|weapon|blood|fight/gi, "action scene")
    .replace(/horror|scary|dark/gi, "mysterious")
    .substring(0, 180);
}

// Convert English text to Roman Urdu
async function convertToRomanUrdu(text) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional Urdu storyteller. Convert the following English text to Natural Roman Urdu that SOUNDS like authentic Urdu when spoken.

IMPORTANT RULES FOR AUTHENTIC URDU ACCENT:
1. Use proper Urdu words (not English words written in Urdu script)
2. Add emotional expressions: 'Achha!', 'Wah!', 'Are!', 'Haye!'
3. Use Urdu sentence structure (verb at the end)
4. Honorifics: 'jee', 'sahab'
5. Common Urdu words: 'bilkul', 'bohat', 'thoda', 'barah'
6. Storytelling phrases: 'chalo', 'suno', 'dekho'

Only return the Roman Urdu text, no explanations.`
        },
        { role: "user", content: text }
      ],
      temperature: 0.4,
      max_tokens: 600
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Roman Urdu conversion error:", error);
    return text;
  }
}

// Enhance Roman Urdu text for better TTS pronunciation
async function enhanceRomanUrduForAccent(text) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a pronunciation expert. Convert the following Roman Urdu text into a version that will be spoken with an authentic Urdu accent by an English TTS system.

Rules for better Urdu pronunciation:
1. Add 'ah' sounds at the end of words ending with 'a' (e.g., 'acha' -> 'achah')
2. Double vowels for emphasis (e.g., 'zara' -> 'zaara')
3. Add 'h' to soften sounds (e.g., 'bara' -> 'barah')
4. Break long words with hyphens for clarity
5. Use common Urdu filler words like 'jee', 'hahn'
6. Add pauses with commas and periods

Only return the enhanced text, no explanations.`
        },
        { role: "user", content: text }
      ],
      temperature: 0.5,
      max_tokens: 800
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Enhancement error:", error);
    return text;
  }
}

// Generate voiceover using OpenAI TTS
async function generateVoiceover(text, filename) {
  try {
    const enhancedText = await enhanceRomanUrduForAccent(text);
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "fable",
      input: enhancedText,
      speed: 0.85
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const filePath = path.join(getTempDir(), filename);
    fs.writeFileSync(filePath, buffer);
    console.log("✅ Voiceover generated with Urdu accent using 'fable' voice");
    return filePath;
  } catch (error) {
    console.error("Voiceover generation error:", error);
    return null;
  }
}

// ✅ VERCEL: Cloudinary-based video creation (no ffmpeg required)
async function createVideoCloudinaryTransform(imageUrls, voiceoverPath) {
  try {
    // Upload voiceover audio
    const audioUpload = await cloudinary.uploader.upload(voiceoverPath, {
      folder: "story_voiceovers",
      resource_type: "video",
    });

    // Upload all images and collect public_ids
    const uploadedImages = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const result = await cloudinary.uploader.upload(imageUrls[i], {
        folder: "story_video_frames",
        resource_type: "image",
      });
      uploadedImages.push(result.public_id);
    }

    // Build Cloudinary slideshow URL using chained transformations
    const videoUrl = cloudinary.url(uploadedImages[0], {
      resource_type: "video",
      transformation: [
        { width: 1024, height: 1024, crop: "fill" },
        { duration: 4 },
        ...uploadedImages.slice(1).flatMap(id => [
          { overlay: `video:${id.replace(/\//g, ':')}` },
          { width: 1024, height: 1024, crop: "fill", duration: 4, flags: "splice" },
          { layer_apply: true },
        ]),
        {
          overlay: `video:${audioUpload.public_id.replace(/\//g, ':')}`,
          flags: "layer_apply",
        },
      ],
      format: "mp4",
    });

    return { videoUrl, audioPublicId: audioUpload.public_id };
  } catch (err) {
    console.error("Transform video error:", err);
    throw err;
  }
}

// -------------------- Test Voices --------------------
app.get('/test-voices', async (req, res) => {
  const testText = "Achha! Suno meri kahani. Ek dafa ka zikr hai...";
  const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  const results = [];

  for (const voice of voices) {
    try {
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice,
        input: testText,
        speed: 0.85
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      const filePath = path.join(getTempDir(), `test_${voice}.mp3`);
      fs.writeFileSync(filePath, buffer);

      const uploadResult = await cloudinary.uploader.upload(filePath, {
        folder: "voice_tests",
        resource_type: "raw",
        public_id: `voice_${voice}`
      });
      results.push({ voice, url: uploadResult.secure_url });

      setTimeout(() => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }, 1000);
    } catch (error) {
      results.push({ voice, error: error.message });
    }
  }

  res.json({
    message: "Test different voices to find best Urdu accent",
    recommended: "Try 'fable' or 'nova' for best Urdu accent",
    results
  });
});

// -------------------- Generate Story Comic (POST) --------------------
app.post('/generate-story-comic', async (req, res) => {
  try {
    const { prompt } = req.body;
    const finalPrompt = prompt || "A cute cat goes on a magical adventure";

    // 1️⃣ Generate story
    const storyRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: `Write a short kid-friendly story (max 150 words) about: ${finalPrompt}` }],
      max_tokens: 300,
    });
    const englishStory = storyRes.choices?.[0]?.message?.content || "";
    console.log("📖 English Story:", englishStory);

    // 2️⃣ Generate panels
    const panelRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "Return ONLY JSON array." },
        { role: "user", content: `Create 4 comic panels for this story:\nStory: ${englishStory}\nReturn JSON:\n[{"title":"","description":"","imagePrompt":""}]` }
      ]
    });

    let panels = extractJSON(panelRes.choices?.[0]?.message?.content);
    if (!Array.isArray(panels)) return res.status(500).json({ error: "Panel error" });

    console.log("🎨 Generating comic images...");

    // 3️⃣ Generate images
    const panelsWithImages = await Promise.all(
      panels.map(async (panel, index) => {
        try {
          const img = await openai.images.generate({
            model: "dall-e-3",
            prompt: `${safePrompt(panel.imagePrompt)}, cartoon style, colorful, kid-friendly`,
            size: "1024x1024",
            response_format: "b64_json",
          });
          const base64 = img.data?.[0]?.b64_json;
          if (base64) {
            const uploadRes = await cloudinary.uploader.upload(`data:image/png;base64,${base64}`, { folder: "story_comics" });
            console.log(`✅ Panel ${index + 1} image uploaded`);
            return { ...panel, image: uploadRes.secure_url };
          }
          return { ...panel, image: "" };
        } catch (err) {
          console.error(`Panel ${index} error:`, err.message);
          return { ...panel, image: "" };
        }
      })
    );

    const validImages = panelsWithImages.filter(p => p.image);

    if (validImages.length === 0) {
      return res.json({ success: true, story: englishStory, panels: panelsWithImages, videoUrl: null, message: "No images generated for video" });
    }

    res.json({
      success: true,
      story: englishStory,
      panels: panelsWithImages,
      videoUrl: null,
      videoGenerating: true,
      message: "Comic generated! Video is being created in background..."
    });

    // 4️⃣ Background video generation
    console.log("🎬 Starting background video generation...");
    const romanUrduStory = await convertToRomanUrdu(englishStory);
    const voiceoverFile = await generateVoiceover(romanUrduStory, `voice_${Date.now()}.mp3`);

    if (voiceoverFile) {
      try {
        const { videoUrl } = await createVideoCloudinaryTransform(validImages.map(p => p.image), voiceoverFile);
        console.log("🎬 VIDEO GENERATED SUCCESSFULLY!");
        console.log("📹 Video URL:", videoUrl);
        setTimeout(() => { if (fs.existsSync(voiceoverFile)) fs.unlinkSync(voiceoverFile); }, 5000);
      } catch (videoErr) {
        console.error("Video creation failed:", videoErr.message);
      }
    }
  } catch (err) {
    console.error("Error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// -------------------- Get Latest Video --------------------
app.get('/get-latest-video', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'story_videos',
      resource_type: 'video',
      max_results: 1,
      sort_by: 'created_at',
      sort_order: 'desc'
    });
    if (result.resources && result.resources.length > 0) {
      res.json({ success: true, videoUrl: result.resources[0].secure_url, createdAt: result.resources[0].created_at });
    } else {
      res.json({ success: false, message: "No videos found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------- Test Roman Urdu --------------------
app.get('/test-roman-urdu', async (req, res) => {
  const testText = req.query.text || "Once upon a time, there was a little cat who loved to explore the magical forest.";
  const romanUrdu = await convertToRomanUrdu(testText);
  res.json({ original: testText, romanUrdu });
});

// -------------------- Test Voiceover --------------------
app.post('/test-voiceover', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text required" });

    const romanUrdu = await convertToRomanUrdu(text);
    const voiceFile = await generateVoiceover(romanUrdu, `test_voice_${Date.now()}.mp3`);

    if (voiceFile) {
      const uploadResult = await cloudinary.uploader.upload(voiceFile, { folder: "voiceovers", resource_type: "raw" });
      res.json({ success: true, originalText: text, romanUrduText: romanUrdu, audioUrl: uploadResult.secure_url });
      setTimeout(() => { if (fs.existsSync(voiceFile)) fs.unlinkSync(voiceFile); }, 5000);
    } else {
      res.json({ error: "Voice generation failed" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------- Stream Story Comic (GET SSE) --------------------
app.get('/generate-story-comic-stream', async (req, res) => {
  const startTime = Date.now();
  const uniqueRequestId = `${Date.now()}-${Math.random().toString(36)}-${req.query.prompt || 'none'}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const prompt = req.query.prompt;
    if (!prompt) return res.status(400).send("Prompt required");

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    send({ progress: 5 });

    const uniqueSuffix = `[unique request: ${uniqueRequestId}]`;
    const forcedUniquePrompt = `${prompt}. Generate a completely new, different story every time. Never repeat. ${uniqueSuffix}`;

    // 1️⃣ Story
    const storyRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: `Write a very short kid-friendly story (max 100 words) based on: "${forcedUniquePrompt}". Be extremely creative and different from any previous story. Use random style, characters, and setting.` }],
      max_tokens: 150,
      temperature: 0.9,
      seed: Math.floor(Math.random() * 1000000)
    });
    const englishStory = storyRes.choices?.[0]?.message?.content || "";
    send({ progress: 20, story: englishStory });

    // 2️⃣ Panels
    const panelRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: "Return ONLY valid JSON array, no extra text." },
        { role: "user", content: `Generate 4 unique comic panels for the story below. Each panel must have a title, description, and imagePrompt. Make every panel different and unexpected.\nStory: ${englishStory}\nUnique request ID: ${uniqueRequestId}` }
      ]
    });

    let panels = extractJSON(panelRes.choices?.[0]?.message?.content);
    if (!Array.isArray(panels)) throw new Error("Panel parsing failed");
    panels = panels.map(p => ({ ...p, image: "" }));
    send({ progress: 40, panels });

    // 3️⃣ Images (with concurrency)
    const concurrency = 2;
    const imageQueue = [...panels.entries()];

    async function processQueue() {
      const batch = [];
      while (imageQueue.length && batch.length < concurrency) batch.push(imageQueue.shift());
      if (batch.length === 0) return;

      await Promise.all(batch.map(async ([idx, panel]) => {
        try {
          const img = await openai.images.generate({
            model: "dall-e-3",
            prompt: safePrompt(panel.imagePrompt) + ", cute cartoon style, completely new scene",
            size: "1024x1024",
            response_format: "b64_json",
          });
          const base64 = img.data?.[0]?.b64_json;
          if (!base64) throw new Error("No base64");

          const uploadRes = await cloudinary.uploader.upload(`data:image/png;base64,${base64}`, { folder: "story_comics" });
          const imageUrl = uploadRes.secure_url;
          console.log(`📸 Panel ${idx + 1} image URL: ${imageUrl}`);
          panels[idx].image = imageUrl;
          send({ progress: 40 + Math.round(((idx + 1) / panels.length) * 60), panelIndex: idx, image: imageUrl });
        } catch (err) {
          console.error(`Panel ${idx} failed:`, err.message);
          panels[idx].image = "";
        }
      }));

      await processQueue();
    }

    await processQueue();
    send({ progress: 85, status: "Converting story to Roman Urdu..." });

    // 4️⃣ Voiceover & video
    const validPanels = panels.filter(p => p.image);
    let videoUrl = null;
    let romanUrduStory = null;

    if (validPanels.length > 0) {
      try {
        send({ progress: 88, status: "Converting to Roman Urdu with authentic accent..." });
        romanUrduStory = await convertToRomanUrdu(englishStory);
        send({ progress: 90, status: "Roman Urdu story ready", romanUrduStory });

        send({ progress: 92, status: "Generating voiceover with authentic Urdu accent..." });
        const voiceoverFile = await generateVoiceover(romanUrduStory, `voice_${Date.now()}.mp3`);

        if (voiceoverFile) {
          send({ progress: 94, status: "Creating video with Cloudinary..." });
          try {
            const result = await createVideoCloudinaryTransform(validPanels.map(p => p.image), voiceoverFile);
            videoUrl = result.videoUrl;
            console.log("🎬 VIDEO GENERATED SUCCESSFULLY!");
            console.log("📹 Video URL:", videoUrl);
            setTimeout(() => { if (fs.existsSync(voiceoverFile)) fs.unlinkSync(voiceoverFile); }, 5000);
          } catch (videoError) {
            console.error("Video creation error:", videoError.message);
          }
        }
      } catch (videoError) {
        console.error("Video generation error:", videoError);
      }
    }

    send({
      progress: 100,
      step: "done",
      videoUrl,
      romanUrduStory: romanUrduStory || await convertToRomanUrdu(englishStory),
      panels,
      generationTime: `${Math.floor((Date.now() - startTime) / 1000)}s`
    });

    res.end();
  } catch (e) {
    console.error(e);
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
});

// -------------------- Text-Only Story Generation --------------------
app.post('/api/generate-story-text', async (req, res) => {
  try {
    const { character, world, mood, customPrompt } = req.body;

    if (!character && !world && !mood && !customPrompt) {
      return res.status(400).json({ success: false, error: "Please provide at least character, world, mood, or a custom prompt" });
    }

    const storyPrompt = customPrompt || `Write a short, engaging, kid-friendly story (150-200 words) about:
- Character: ${character || "a friendly animal"}
- Setting: ${world || "a magical place"}
- Mood/Tone: ${mood || "adventurous and fun"}

Make the story creative, positive, and suitable for children.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional children's storyteller. Create engaging, imaginative, and age-appropriate stories for kids aged 4-10. Keep the language simple but vivid, include positive messages, and make the stories magical and fun." },
        { role: "user", content: storyPrompt }
      ],
      temperature: 0.8,
      max_tokens: 400,
    });

    const story = completion.choices[0].message.content;

    const titleCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: `Generate a creative, catchy title for this children's story (max 8 words, no explanation, just the title):\n\n${story}` }],
      temperature: 0.7,
      max_tokens: 30,
    });

    const title = titleCompletion.choices[0].message.content.trim();

    res.json({
      success: true,
      story,
      title,
      metadata: {
        character: character || null,
        world: world || null,
        mood: mood || null,
        wordCount: story.split(/\s+/).length,
        generatedAt: new Date().toISOString()
      }
    });

    console.log(`✅ Story generated: "${title}" (${story.split(/\s+/).length} words)`);
  } catch (error) {
    console.error("Story generation error:", error);
    if (error.code === "insufficient_quota") return res.status(429).json({ success: false, error: "API quota exceeded. Please try again later." });
    if (error.code === "invalid_api_key") return res.status(500).json({ success: false, error: "Server configuration error." });
    res.status(500).json({ success: false, error: error.message || "Failed to generate story" });
  }
});

// -------------------- Story Test Endpoint --------------------
app.get('/api/test-story', (req, res) => {
  res.json({ success: true, message: "Story API is working!", usage: "POST to /api/generate-story-text with { character, world, mood, customPrompt }" });
});

// -------------------- Generate Multiple Story Variants --------------------
app.post('/api/generate-story-variants', async (req, res) => {
  try {
    const { character, world, mood, count = 3 } = req.body;
    if (count > 5) return res.status(400).json({ success: false, error: "Maximum 5 story variants at a time" });

    const stories = [];
    for (let i = 0; i < count; i++) {
      const prompt = `Write a short children's story (100-150 words) about:
- Character: ${character || "a cute animal"}
- Setting: ${world || "a magical kingdom"}
- Mood: ${mood || "happy and adventurous"}
Make this version ${i + 1} different and unique.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
        max_tokens: 350,
      });
      stories.push({ variant: i + 1, story: completion.choices[0].message.content });
    }

    res.json({ success: true, count: stories.length, stories });
  } catch (error) {
    console.error("Variants generation error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------- Demo Cat Comic --------------------
app.get('/demo-cat-comic', async (req, res) => {
  try {
    const prompt = "A cute cat goes on a magical adventure in a colorful world";

    const storyRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: `Write a short, fun, kid-friendly story about: ${prompt}` }],
      max_tokens: 200,
    });
    const story = storyRes.choices?.[0]?.message?.content || "";

    const panelRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "Return ONLY JSON array." },
        { role: "user", content: `Create 4 comic panels:\n[{"title":"","description":"","imagePrompt":""}]\nStory:\n${story}` }
      ]
    });

    const panels = extractJSON(panelRes.choices?.[0]?.message?.content);
    if (!Array.isArray(panels)) return res.json({ error: "panel failed" });

    const results = await Promise.all(panels.map(async (p) => {
      try {
        const img = await openai.images.generate({
          model: "dall-e-3",
          prompt: `${safePrompt(p.imagePrompt)}, cartoon, cute cat, colorful`,
          size: "1024x1024",
          response_format: "b64_json",
        });
        const base64 = img.data?.[0]?.b64_json;
        let imageUrl = "";
        if (base64) {
          const uploadRes = await cloudinary.uploader.upload(`data:image/png;base64,${base64}`, { folder: "demo_cat" });
          imageUrl = uploadRes.secure_url;
        }
        return { title: p.title, description: p.description, image: imageUrl };
      } catch (e) {
        return { title: p.title, description: p.description, image: "" };
      }
    }));

    res.json({ success: true, story, panels: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Demo failed" });
  }
});

// -------------------- OpenAI Health Check --------------------
app.get('/check-openai', async (req, res) => {
  try {
    await openai.chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "user", content: "Hi" }], max_tokens: 5 });
    res.json({ status: "working", credits: "available" });
  } catch (error) {
    if (error.code === "insufficient_quota") return res.json({ status: "failed", reason: "no_credits" });
    if (error.code === "invalid_api_key") return res.json({ status: "failed", reason: "invalid_key" });
    res.json({ status: "error", message: error.message });
  }
});

// -------------------- Home Dashboard --------------------
app.get("/home", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Code Sync Server</title>
      <link rel="icon" type="image/x-icon" href="assets/images/logo.png" />
      <script src="https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700&display=swap');
        body { margin: 0; font-family: 'Montserrat', sans-serif; background-color: #1e1e2f; color: #e4e4e4; display: flex; flex-direction: column; min-height: 100vh; overflow-x: hidden; position: relative; }
        .particle-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; }
        .dashboard-container { width: 90%; max-width: 1200px; padding: 30px; background-color: #2b2b3d; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); margin: 30px auto; flex-grow: 1; animation: fadeIn 1.2s ease-in-out; z-index: 1; }
        @keyframes fadeIn { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; }
        .header img { height: 100px; width: 100px; border-radius: 50%; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .header h1 { font-size: 36px; color: #fff; font-weight: 700; margin: 0; }
        .header p { font-size: 18px; color: #bbb; margin-top: 5px; text-align: center; }
        footer { background-color: #282836; color: #999; padding: 20px; text-align: center; font-size: 14px; border-top: 2px solid #444; }
        footer a { color: #ff7f50; text-decoration: none; font-weight: 500; }
      </style>
    </head>
    <body>
      <div id="particle-container" class="particle-container"></div>
      <div class="dashboard-container">
        <div class="header">
          <img src="/assets/images/logo.png" alt="App Logo" />
          <div>
            <h1>Code Sync Server Dashboard</h1>
            <p>3D Virtually Perfect</p>
          </div>
        </div>
        <footer>
          <p>&copy; 2025 Anatomy. All rights reserved.
          <a href="#">Terms</a> | <a href="#">Privacy Policy</a></p>
        </footer>
      </div>
      <script>
        particlesJS("particle-container", {
          particles: { number: { value: 80, density: { enable: true, value_area: 800 } }, shape: { type: "circle" }, opacity: { value: 0.5 }, size: { value: 3 }, line_linked: { enable: true, color: "#fff", opacity: 0.5, width: 2 } },
          interactivity: { events: { onhover: { enable: true, mode: "repulse" } } }
        });
      </script>
    </body>
    </html>
  `);
});

// ✅ VERCEL: Export app as serverless module
module.exports = app;

// ✅ VERCEL: Only listen locally (not on Vercel)
if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at:`);
    console.log(`➡️  http://localhost:${PORT}`);
    console.log(`➡️  http://0.0.0.0:${PORT}`);
  });
}
