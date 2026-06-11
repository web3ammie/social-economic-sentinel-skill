const {
  calculateSESIndex,
  getSESRecommendation
} = require("./sesSkill");

describe("Social-Economic Sentinel (SES) Scoring Logic", () => {
  test("calculateSESIndex returns a balanced neutral-bearish index when change is 0% and mentions are 0", () => {
    // 24h change = 0%, mentions = 0, sentiment ratio = 0.5 (neutral)
    // marketScore = 25 + (0 * 1.5) = 25
    // socialScore = Math.min(25, log2(1) * 5) = 0
    // sentimentScore = 0.5 * 25 = 12.5
    // total = 25 + 0 + 12.5 = 37.5 -> round to 38
    const index = calculateSESIndex(0, 0, 0.5);
    expect(index).toBe(38);
  });

  test("calculateSESIndex returns a highly bullish score under high social buzz and price surge", () => {
    // 24h change = 10% (surge), mentions = 31 (buzz), sentiment ratio = 0.9 (bullish)
    // marketScore = 25 + 15 = 40
    // socialScore = Math.min(25, log2(32) * 5) = 25
    // sentimentScore = 0.9 * 25 = 22.5
    // total = 40 + 25 + 22.5 = 87.5 -> round to 88
    const index = calculateSESIndex(10, 31, 0.9);
    expect(index).toBe(88);
  });

  test("calculateSESIndex clamps values properly to maximum score of 100", () => {
    // Extremely high values should clamp at 100
    const index = calculateSESIndex(100, 1000, 1.0);
    expect(index).toBe(100);
  });

  test("calculateSESIndex clamps values properly to minimum score of 0", () => {
    // Extremely low/negative values should clamp at 0
    const index = calculateSESIndex(-100, 0, 0.0);
    expect(index).toBe(0);
  });

  test("getSESRecommendation maps scores correctly to their respective status levels", () => {
    expect(getSESRecommendation(85).status).toBe("Strong Bullish Hype");
    expect(getSESRecommendation(60).status).toBe("Moderate Bullish");
    expect(getSESRecommendation(50).status).toBe("Neutral");
    expect(getSESRecommendation(30).status).toBe("Moderate Bearish");
    expect(getSESRecommendation(15).status).toBe("Strong Bearish / Silent");
  });
});
