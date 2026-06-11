require("dotenv").config();
const { ElfaSDK } = require("@elfa-ai/sdk");

async function test() {
  const apiKey = process.env.ELFA_AI_API_KEY;
  console.log("Using API Key:", apiKey ? `${apiKey.substring(0, 8)}...` : "None");
  
  const elfa = new ElfaSDK({ elfaApiKey: apiKey });

  console.log("\n--- Testing Ping ---");
  try {
    const pingRes = await elfa.ping();
    console.log("Ping Success:", pingRes);
  } catch (err) {
    console.error("Ping Error:", err.message);
  }

  console.log("\n--- Testing API Key Status ---");
  try {
    const statusRes = await elfa.getApiKeyStatus();
    console.log("Status Success:", JSON.stringify(statusRes, null, 2));
  } catch (err) {
    console.error("Status Error:", err.message);
  }

  console.log("\n--- Testing getTrendingTokens ---");
  try {
    const trendRes = await elfa.getTrendingTokens({ timeWindow: "24h" });
    console.log("Trending Success: Total =", trendRes.data?.total);
  } catch (err) {
    console.error("Trending Error:", err.message);
  }

  console.log("\n--- Testing getKeywordMentions with various parameter combinations ---");
  
  const attempts = [
    { keywords: "PROS" },
    { keywords: "PROS", timeWindow: "24h" },
    { keywords: "PROS", timeWindow: "1d" },
    { keywords: "PROS", timeWindow: "24h", limit: 50 },
    { keywords: "PROS", timeWindow: "24h", fetchRawTweets: true },
    { keywords: "PROS", from: Math.floor(Date.now() / 1000) - 86400, to: Math.floor(Date.now() / 1000) }
  ];

  for (let i = 0; i < attempts.length; i++) {
    console.log(`\nAttempt ${i + 1}:`, JSON.stringify(attempts[i]));
    try {
      const res = await elfa.getKeywordMentions(attempts[i]);
      console.log(`Attempt ${i + 1} Success! Mentions count:`, res.data?.length || 0);
    } catch (err) {
      console.error(`Attempt ${i + 1} Error:`, err.message);
    }
  }
}

test();
