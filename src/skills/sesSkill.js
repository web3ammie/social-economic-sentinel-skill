const { DynamicStructuredTool } = require("@langchain/core/tools");
const { z } = require("zod");
const { ElfaSDK } = require("@elfa-ai/sdk");

/**
 * Helper function to query the CoinGecko API.
 * Node.js 18+ built-in fetch is utilized for zero-dependency HTTP calls.
 */
async function fetchCoinGeckoData(symbol) {
  const apiKey = process.env.COINGECKO_API_KEY;
  const headers = {};
  if (apiKey) {
    headers["x-cg-demo-api-key"] = apiKey;
  }

  try {
    // 1. Search for the CoinGecko ID using the symbol
    const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`;
    const searchRes = await fetch(searchUrl, { headers });
    if (!searchRes.ok) {
      throw new Error(`CoinGecko search failed with status: ${searchRes.status}`);
    }
    const searchData = await searchRes.json();
    
    // Find the exact match in search results
    const coin = searchData.coins?.find(
      (c) => c.symbol.toLowerCase() === symbol.toLowerCase()
    ) || searchData.coins?.[0];

    if (!coin) {
      throw new Error(`No coin matching symbol "${symbol}" found on CoinGecko.`);
    }

    const coinId = coin.id;

    // 2. Fetch simple price, 24h change, and 24h volume
    const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`;
    const priceRes = await fetch(priceUrl, { headers });
    if (!priceRes.ok) {
      throw new Error(`CoinGecko price fetch failed with status: ${priceRes.status}`);
    }
    const priceData = await priceRes.json();
    const metrics = priceData[coinId];

    if (!metrics) {
      throw new Error(`No price metrics returned for coin ID "${coinId}"`);
    }

    return {
      coinId,
      name: coin.name,
      priceUsd: metrics.usd,
      change24h: metrics.usd_24h_change || 0,
      volume24h: metrics.usd_24h_vol || 0
    };
  } catch (error) {
    throw new Error(`CoinGecko Integration Error: ${error.message}`);
  }
}

/**
 * Helper function to query Elfa AI API.
 */
async function fetchElfaSentimentData(symbol, timeframe) {
  const apiKey = process.env.ELFA_AI_API_KEY;
  if (!apiKey) {
    throw new Error("ELFA_AI_API_KEY is not defined in the environment variables.");
  }

  try {
    const elfa = new ElfaSDK({ elfaApiKey: apiKey });
    
    // Map timeframe parameter for Elfa mentions period
    let period = "1d";
    if (timeframe === "1h") period = "1h";
    if (timeframe === "7d") period = "7d";

    const response = await elfa.getKeywordMentions({
      keywords: symbol,
      timeWindow: period,
      fetchRawTweets: true
    });

    const mentions = response.data || [];
    
    // Calculate simple metrics based on mentions data
    let totalEngagement = 0;
    let positiveMentions = 0;
    let negativeMentions = 0;

    mentions.forEach((item) => {
      // Aggregate tweet metrics if raw tweets were returned
      const likes = item.likes || item.favorite_count || 0;
      const retweets = item.retweets || item.retweet_count || 0;
      totalEngagement += (likes + retweets * 2);

      // Simple keyword matching for sentiment heuristics on tweet text
      const text = (item.text || "").toLowerCase();
      if (text.includes("bull") || text.includes("long") || text.includes("good") || text.includes("moon") || text.includes("win")) {
        positiveMentions++;
      } else if (text.includes("bear") || text.includes("short") || text.includes("bad") || text.includes("dump") || text.includes("scam")) {
        negativeMentions++;
      }
    });

    const totalRated = positiveMentions + negativeMentions;
    const sentimentRatio = totalRated > 0 ? positiveMentions / totalRated : 0.5;

    return {
      mentionsCount: mentions.length,
      engagement: totalEngagement,
      sentimentRatio,
      rawMentions: mentions.slice(0, 5).map(m => ({
        text: m.text,
        user: m.username || m.screen_name,
        engagement: (m.likes || 0) + (m.retweets || 0)
      }))
    };
  } catch (error) {
    throw new Error(`Elfa AI Integration Error: ${error.message}`);
  }
}

/**
 * Computes the unified Social-Economic Sentinel (SES) Index.
 * Returns a score from 0 to 100 based on price momentum and social sentiment.
 */
function calculateSESIndex(change24h, mentionsCount, sentimentRatio) {
  // 1. Market Momentum Score (0 to 50 scale)
  // Baseline score is 25. +1.5 points per 1% price increase, up to +25.
  // -1.5 points per 1% price decrease, down to -25.
  let marketScore = 25 + (change24h * 1.5);
  marketScore = Math.max(0, Math.min(50, marketScore));

  // 2. Social Buzz Score (0 to 50 scale)
  // Logarithmic scaling for mentions. 0 mentions = 0, 31+ mentions yields max score.
  let socialScore = Math.min(25, Math.log2(mentionsCount + 1) * 5);
  
  // Factor in the sentiment ratio of those mentions (adds up to 25 points)
  const sentimentScore = sentimentRatio * 25;
  
  const totalSocialScore = socialScore + sentimentScore;

  // 3. Combined score
  return Math.round(marketScore + totalSocialScore);
}

/**
 * Returns a textual summary recommendation based on the SES Index.
 */
function getSESRecommendation(sesIndex) {
  if (sesIndex >= 75) {
    return {
      status: "Strong Bullish Hype",
      description: "High social chatter combined with positive market price action. Strong buy interest and community backing."
    };
  } else if (sesIndex >= 55) {
    return {
      status: "Moderate Bullish",
      description: "Positive market movement with growing social chatter. Stable accumulation phase."
    };
  } else if (sesIndex >= 45) {
    return {
      status: "Neutral",
      description: "Price and social volume are balanced. Typical consolidative market behavior."
    };
  } else if (sesIndex >= 25) {
    return {
      status: "Moderate Bearish",
      description: "Declining price action or dry social channels. Proceed with caution."
    };
  } else {
    return {
      status: "Strong Bearish / Silent",
      description: "Severe negative price momentum and zero social relevance. Major sell pressure or lack of user interest."
    };
  }
}

/**
 * Instantiates the LangChain DynamicStructuredTool for the Social-Economic Sentinel.
 */
const sesSkillTool = new DynamicStructuredTool({
  name: "social_economic_sentinel",
  description: "Queries live social sentiment (Elfa AI) and market price changes (CoinGecko) for any crypto token to return a unified momentum indicator (SES Index). Required keys: ELFA_AI_API_KEY.",
  schema: z.object({
    tokenSymbol: z.string().describe("The ticker symbol of the token to analyze (e.g. PROS, PHAROS, ETH, BTC)"),
    timeframe: z.enum(["1h", "24h", "7d"]).optional().default("24h").describe("The timeframe to track social media mentions")
  }),
  func: async ({ tokenSymbol, timeframe }) => {
    try {
      // Fetch data in parallel
      const [marketData, socialData] = await Promise.all([
        fetchCoinGeckoData(tokenSymbol),
        fetchElfaSentimentData(tokenSymbol, timeframe)
      ]);

      const sesIndex = calculateSESIndex(
        marketData.change24h,
        socialData.mentionsCount,
        socialData.sentimentRatio
      );

      const recommendation = getSESRecommendation(sesIndex);

      const output = {
        success: true,
        symbol: tokenSymbol.toUpperCase(),
        coinGeckoName: marketData.name,
        coinGeckoId: marketData.coinId,
        priceUsd: marketData.priceUsd,
        change24h: marketData.change24h,
        volume24h: marketData.volume24h,
        socialMentionsCount: socialData.mentionsCount,
        socialEngagementSum: socialData.engagement,
        socialSentimentRatio: parseFloat(socialData.sentimentRatio.toFixed(2)),
        sesIndex,
        recommendation: recommendation.status,
        recommendationDetail: recommendation.description,
        recentMentions: socialData.rawMentions
      };

      return JSON.stringify(output, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        symbol: tokenSymbol.toUpperCase(),
        error: error.message
      }, null, 2);
    }
  }
});

module.exports = {
  sesSkillTool,
  fetchCoinGeckoData,
  fetchElfaSentimentData,
  calculateSESIndex,
  getSESRecommendation
};
