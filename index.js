require("dotenv").config();
const { PharosAgentKit } = require("pharos-agent-kit");
const { sesSkillTool } = require("./src/skills/sesSkill");

async function main() {
  console.log("=== Initializing Social-Economic Sentinel Agent ===");

  // Ensure environment variables are loaded
  if (!process.env.PHAROS_PRIVATE_KEY) {
    console.error("\nError: PHAROS_PRIVATE_KEY is not set. Please copy .env.example to .env and configure it.");
    process.exit(1);
  }
  
  if (!process.env.ELFA_AI_API_KEY) {
    console.warn("\nWarning: ELFA_AI_API_KEY is not defined in the environment. Calls to the Elfa AI API will fail.");
  }

  try {
    // 1. Initialize PharosAgentKit
    // Spire Testnet RPC is default if RPC_URL is not provided
    const rpcUrl = process.env.RPC_URL || "https://spire.pharos.xyz/http";
    const agentKit = new PharosAgentKit(
      process.env.PHAROS_PRIVATE_KEY,
      rpcUrl,
      {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY
      }
    );

    console.log("PharosAgentKit initialized successfully!");
    console.log(`Connected Wallet Address: ${agentKit.wallet?.address || "Loaded"}`);

    // 2. Describe the Tool
    console.log("\nRegistered Custom Tool Info:");
    console.log(`- Name: ${sesSkillTool.name}`);
    console.log(`- Description: ${sesSkillTool.description}`);

    // 3. Dry run of the Tool
    console.log("\nExecuting tool dry-run: sesSkillTool.func({ tokenSymbol: 'PROS' })...");
    
    // We run the tool function directly to verify it works and formats correctly
    const result = await sesSkillTool.func({ tokenSymbol: "PROS", timeframe: "24h" });
    
    console.log("\n=== Sentinel Output ===");
    console.log(result);

  } catch (error) {
    console.error("Execution Error:", error);
  }
}

if (require.main === module) {
  main();
}
