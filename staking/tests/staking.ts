import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Staking } from "../target/types/staking";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from "@solana/spl-token";
import { expect } from "chai";

describe("staking", () => {
  // Configure the client to use devnet
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Staking as Program<Staking>;

  // Our test token (created earlier)
  const TOKEN_MINT = new anchor.web3.PublicKey("Eg5VLcpRJr27VtNZpw1feJaMoRLN3UsmmzHCULtF3366");
  
  let userTokenAccount: anchor.web3.PublicKey;
  let vaultAuthority: anchor.web3.PublicKey;
  let vaultTokenAccount: anchor.web3.PublicKey;
  let stakeInfo: anchor.web3.PublicKey;

  before(async () => {
    console.log("🔧 Setting up test accounts...");
    
    // Derive PDAs with updated seeds
    [vaultAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), TOKEN_MINT.toBuffer()],
      program.programId
    );

    [stakeInfo] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake_info"), provider.wallet.publicKey.toBuffer(), TOKEN_MINT.toBuffer()],
      program.programId
    );

    // Get token accounts
    userTokenAccount = await getAssociatedTokenAddress(
      TOKEN_MINT,
      provider.wallet.publicKey
    );

    vaultTokenAccount = await getAssociatedTokenAddress(
      TOKEN_MINT,
      vaultAuthority,
      true // Allow off-curve for PDAs
    );

    console.log(`👤 User: ${provider.wallet.publicKey.toString()}`);
    console.log(`🪙 Token Mint: ${TOKEN_MINT.toString()}`);
    console.log(`💳 User Token Account: ${userTokenAccount.toString()}`);
    console.log(`🏦 Vault Authority: ${vaultAuthority.toString()}`);
    console.log(`💰 Vault Token Account: ${vaultTokenAccount.toString()}`);
    console.log(`📊 Stake Info: ${stakeInfo.toString()}`);
  });

  it("Creates vault token account if needed", async () => {
    console.log("🏗️ Creating vault token account...");
    
    try {
      // Check if vault token account exists
      await provider.connection.getTokenAccountBalance(vaultTokenAccount);
      console.log("✅ Vault token account already exists");
    } catch (error) {
      console.log("⚠️ Creating vault token account...");
      
      const createVaultAccountIx = createAssociatedTokenAccountInstruction(
        provider.wallet.publicKey, // payer
        vaultTokenAccount,         // ata
        vaultAuthority,           // owner (the PDA)
        TOKEN_MINT               // mint
      );

      const tx = new anchor.web3.Transaction().add(createVaultAccountIx);
      const signature = await provider.sendAndConfirm(tx);
      console.log(`✅ Vault account created: ${signature}`);
    }
  });

  it("Stakes tokens successfully", async () => {
    console.log("🎯 Testing token staking...");
    
    const stakeAmount = new anchor.BN(50 * 10**6); // 50 tokens (6 decimals)
    
    // Get initial balances
    const userBalanceBefore = await provider.connection.getTokenAccountBalance(userTokenAccount);
    console.log(`User balance before: ${userBalanceBefore.value.uiAmount} tokens`);

    try {
      const tx = await program.methods
        .stakeTokens(stakeAmount)
        .accountsPartial({
          user: provider.wallet.publicKey,
          userTokenAccount: userTokenAccount,
          mint: TOKEN_MINT,
          vaultAuthority: vaultAuthority,
          vaultAccount: vaultTokenAccount,
          stakeInfo: stakeInfo,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log(`✅ Stake transaction: ${tx}`);

      // Verify balances after staking
      const userBalanceAfter = await provider.connection.getTokenAccountBalance(userTokenAccount);
      const vaultBalanceAfter = await provider.connection.getTokenAccountBalance(vaultTokenAccount);
      
      console.log(`User balance after: ${userBalanceAfter.value.uiAmount} tokens`);
      console.log(`Vault balance after: ${vaultBalanceAfter.value.uiAmount} tokens`);

      // Verify the stake was recorded
      const stakeAccount = await program.account.stakeInfo.fetch(stakeInfo);
      console.log(`Stake amount recorded: ${stakeAccount.amount.toNumber() / 10**6} tokens`);

      expect(userBalanceAfter.value.uiAmount).to.be.lessThan((userBalanceBefore.value.uiAmount || 0));
      expect(vaultBalanceAfter.value.uiAmount).to.be.greaterThan(0);

    } catch (error) {
      console.error("❌ Staking failed:", error);
      throw error;
    }
  });

  it("Unstakes tokens successfully using simple unstake", async () => {
    console.log("🔄 Testing simple token unstaking...");
    
    const unstakeAmount = new anchor.BN(25 * 10**6); // Unstake 25 tokens
    
    // Get balances before unstaking
    const userBalanceBefore = await provider.connection.getTokenAccountBalance(userTokenAccount);
    const vaultBalanceBefore = await provider.connection.getTokenAccountBalance(vaultTokenAccount);
    
    console.log(`User balance before unstake: ${userBalanceBefore.value.uiAmount || 0} tokens`);
    console.log(`Vault balance before unstake: ${vaultBalanceBefore.value.uiAmount || 0} tokens`);

    try {
      const tx = await program.methods
        .unstakeTokens(unstakeAmount)
        .accountsPartial({
          user: provider.wallet.publicKey,
          userTokenAccount: userTokenAccount,
          mint: TOKEN_MINT,
          vaultAuthority: vaultAuthority,
          vaultAccount: vaultTokenAccount,
          stakeInfo: stakeInfo,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log(`✅ Unstake transaction: ${tx}`);

      // Verify balances after unstaking
      const userBalanceAfter = await provider.connection.getTokenAccountBalance(userTokenAccount);
      const vaultBalanceAfter = await provider.connection.getTokenAccountBalance(vaultTokenAccount);
      
      console.log(`User balance after unstake: ${userBalanceAfter.value.uiAmount} tokens`);
      console.log(`Vault balance after unstake: ${vaultBalanceAfter.value.uiAmount} tokens`);

      // Verify the stake amount was updated
      const stakeAccount = await program.account.stakeInfo.fetch(stakeInfo);
      console.log(`Remaining stake: ${stakeAccount.amount.toNumber() / 10**6} tokens`);

      expect(userBalanceAfter.value.uiAmount).to.be.greaterThan((userBalanceBefore.value.uiAmount || 0));
      expect(vaultBalanceAfter.value.uiAmount).to.be.lessThan((vaultBalanceBefore.value.uiAmount || 0));

    } catch (error) {
      console.error("❌ Unstaking failed:", error);
      throw error;
    }
  });

  it("Prevents unstaking more than staked", async () => {
    console.log("🛡️ Testing unstaking limits...");
    
    const invalidAmount = new anchor.BN(1000 * 10**6); // Try to unstake 1000 tokens (more than staked)
    
    try {
      await program.methods
        .unstakeTokens(invalidAmount)
        .accountsPartial({
          user: provider.wallet.publicKey,
          userTokenAccount: userTokenAccount,
          mint: TOKEN_MINT,
          vaultAuthority: vaultAuthority,
          vaultAccount: vaultTokenAccount,
          stakeInfo: stakeInfo,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      
      expect.fail("Should have failed to unstake more than staked");
    } catch (error: any) {
      console.log("✅ Correctly prevented over-unstaking");
      expect(error.toString()).to.include("InsufficientStaked");
    }
  });

  after(async () => {
    console.log("\n📊 Final Test Summary:");
    
    const userBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
    const vaultBalance = await provider.connection.getTokenAccountBalance(vaultTokenAccount);
    const stakeAccount = await program.account.stakeInfo.fetch(stakeInfo);
    
    console.log(`Final user balance: ${userBalance.value.uiAmount} tokens`);
    console.log(`Final vault balance: ${vaultBalance.value.uiAmount} tokens`);
    console.log(`Final staked amount: ${stakeAccount.amount.toNumber() / 10**6} tokens`);
    
    console.log(`\n🔗 View transactions on Solana Explorer (devnet)`);
    console.log(`Program: https://explorer.solana.com/address/${program.programId.toString()}?cluster=devnet`);
  });
}); 