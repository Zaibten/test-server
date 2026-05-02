require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function checkCredits() {
  console.log("\n🔍 Checking OpenAI API status...\n");

  try {

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: "Say OK" }
      ],
      max_tokens: 5,
    });

    console.log("✅ API WORKING");
    console.log("💰 You have available credits\n");

  } catch (error) {

    // 🔴 QUOTA ERROR
    if (error.code === "insufficient_quota") {
      console.log("❌ NO CREDITS LEFT");
      console.log("👉 Please add billing / upgrade plan\n");
    }

    // 🔴 INVALID KEY
    else if (error.code === "invalid_api_key") {
      console.log("❌ INVALID API KEY");
      console.log("👉 Check your .env file\n");
    }

    // 🔴 RATE LIMIT
    else if (error.code === "rate_limit_exceeded") {
      console.log("⚠️ RATE LIMIT HIT");
      console.log("👉 Try again later\n");
    }

    // 🔴 OTHER ERROR
    else {
      console.log("❌ ERROR:", error.message);
    }
  }
}

checkCredits();