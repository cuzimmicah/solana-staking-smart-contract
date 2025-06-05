const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function testRealStaking() {
  console.log('🎮 Testing Minecraft Staking Contract');
  console.log('==================================\n');

  // Configuration
  const PROGRAM_ID = new PublicKey('FK2cxLLF8wDCREL3t1uoijHTw2fmSjJxxM6STijFwPJn');
  const TOKEN_MINT = new PublicKey('Eg5VLcpRJr27VtNZpw1feJaMoRLN3UsmmzHCULtF3366');
  
  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  try {
    // Load the user's actual wallet
    const keypairPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
    console.log(`Loading keypair from: ${keypairPath}`);
    
    const secretKey = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
    const userKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
    
    console.log('📊 Test Setup:');
    console.log(`👤 User: ${userKeypair.publicKey.toString()}`);
    console.log(`🎯 Program: ${PROGRAM_ID.toString()}`);
    console.log(`🪙 Token: ${TOKEN_MINT.toString()}`);
    
    // Derive PDAs
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), TOKEN_MINT.toBuffer()],
      PROGRAM_ID
    );
    
    const [stakeInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from('stake_info'), userKeypair.publicKey.toBuffer(), TOKEN_MINT.toBuffer()],
      PROGRAM_ID
    );
    
    console.log(`\n🔑 PDAs:`);
    console.log(`Vault Authority: ${vaultAuthority.toString()}`);
    console.log(`Stake Info: ${stakeInfo.toString()}`);
    
    // Get token accounts
    const userTokenAccount = await getAssociatedTokenAddress(
      TOKEN_MINT,
      userKeypair.publicKey
    );
    
    const vaultTokenAccount = await getAssociatedTokenAddress(
      TOKEN_MINT,
      vaultAuthority,
      true // Allow off-curve for PDAs
    );
    
    console.log(`\n💳 Token Accounts:`);
    console.log(`User: ${userTokenAccount.toString()}`);
    console.log(`Vault: ${vaultTokenAccount.toString()}`);
    
    // Check current balances
    console.log(`\n💰 Current Balances:`);
    
    try {
      const userBalance = await connection.getTokenAccountBalance(userTokenAccount);
      console.log(`User Balance: ${userBalance.value.uiAmount} tokens`);
    } catch (error) {
      console.log('❌ User token account not found');
      return;
    }
    
    try {
      const vaultBalance = await connection.getTokenAccountBalance(vaultTokenAccount);
      console.log(`Vault Balance: ${vaultBalance.value.uiAmount} tokens`);
    } catch (error) {
      console.log('⚠️ Vault token account not yet created');
    }
    
    // Check if stake info exists
    try {
      const stakeAccount = await connection.getAccountInfo(stakeInfo);
      if (stakeAccount) {
        console.log('✅ Stake info account exists');
      } else {
        console.log('⚠️ Stake info account will be created on first stake');
      }
    } catch (error) {
      console.log('⚠️ Stake info account will be created on first stake');
    }
    
    console.log('\n🎯 Ready for Staking Test!');
    console.log('\n📝 To test staking manually with Anchor CLI:');
    console.log('anchor run stake-test');
    
    console.log('\n🔗 Useful Links:');
    console.log(`Token Explorer: https://explorer.solana.com/address/${TOKEN_MINT.toString()}?cluster=devnet`);
    console.log(`Program Explorer: https://explorer.solana.com/address/${PROGRAM_ID.toString()}?cluster=devnet`);
    console.log(`User Explorer: https://explorer.solana.com/address/${userKeypair.publicKey.toString()}?cluster=devnet`);
    
    // Create a simple Anchor client configuration
    console.log('\n⚙️ Anchor Client Config:');
    console.log(`Provider URL: https://api.devnet.solana.com`);
    console.log(`Wallet: ${keypairPath}`);
    console.log(`Program ID: ${PROGRAM_ID.toString()}`);
    
    return {
      programId: PROGRAM_ID,
      tokenMint: TOKEN_MINT,
      userKeypair,
      userTokenAccount,
      vaultAuthority,
      vaultTokenAccount,
      stakeInfo
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('ENOENT')) {
      console.log('\n💡 Solution: Generate a Solana keypair first:');
      console.log('solana-keygen new');
    }
  }
}

// Function to show how to create Anchor test
function showAnchorTest() {
  console.log('\n🧪 Anchor Test Template:');
  console.log(`
// In tests/staking.ts
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Staking } from "../target/types/staking";

describe("staking", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Staking as Program<Staking>;
  
  const TOKEN_MINT = new anchor.web3.PublicKey("Eg5VLcpRJr27VtNZpw1feJaMoRLN3UsmmzHCULtF3366");
  
  it("Stakes tokens", async () => {
    const amount = new anchor.BN(100 * 10**6); // 100 tokens
    
    const tx = await program.methods
      .stakeTokens(amount)
      .accounts({
        // ... account addresses
      })
      .rpc();
      
    console.log("Stake transaction:", tx);
  });
});
`);
}

testRealStaking().then(() => {
  showAnchorTest();
}); 