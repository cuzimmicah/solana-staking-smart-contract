const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair, SystemProgram } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount } = require("@solana/spl-token");

async function main() {
  console.log("🚀 Starting deployment verification...\n");

  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Staking;
  
  console.log("Program ID:", program.programId.toString());
  console.log("Provider wallet:", provider.wallet.publicKey.toString());

  // Test accounts
  const user = Keypair.generate();
  const authority = provider.wallet.publicKey; // Use provider wallet as authority
  
  // Airdrop SOL to user
  console.log("\n💰 Airdropping SOL to test user...");
  await provider.connection.confirmTransaction(
    await provider.connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
  );

  // Create test token mint
  console.log("🪙 Creating test token mint...");
  const mint = await createMint(
    provider.connection,
    user,
    user.publicKey,
    null,
    6 // 6 decimals
  );
  console.log("Mint created:", mint.toString());

  // Create token accounts
  console.log("📦 Creating token accounts...");
  const userTokenAccount = await createAccount(
    provider.connection,
    user,
    mint,
    user.publicKey
  );
  
  const authorityTokenAccount = await createAccount(
    provider.connection,
    user, // user pays for authority's account
    mint,
    authority
  );

  // Mint tokens
  console.log("🏭 Minting test tokens...");
  await mintTo(provider.connection, user, mint, userTokenAccount, user, 1000000000); // 1000 tokens
  await mintTo(provider.connection, user, mint, authorityTokenAccount, user, 500000000); // 500 tokens

  // Derive PDAs
  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    program.programId
  );

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), mint.toBuffer()],
    program.programId
  );

  const [stakeInfo] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake_info"), user.publicKey.toBuffer(), mint.toBuffer()],
    program.programId
  );

  try {
    // 1. Initialize global state
    console.log("\n🏗️  Testing initialize...");
    await program.methods
      .initialize(authority)
      .accounts({
        payer: user.publicKey,
        globalState,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();
    console.log("✅ Initialize successful");

    // 2. Create vault
    console.log("\n🏦 Creating vault...");
    const vaultAccount = await createAccount(
      provider.connection,
      user,
      mint,
      vaultAuthority
    );
    console.log("✅ Vault created:", vaultAccount.toString());

    // 3. Stake tokens
    console.log("\n🔒 Testing stake tokens...");
    const stakeAmount = new anchor.BN(100000000); // 100 tokens
    await program.methods
      .stakeTokens(stakeAmount)
      .accounts({
        user: user.publicKey,
        userTokenAccount,
        mint,
        vaultAuthority,
        vaultAccount,
        stakeInfo,
        globalState,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .signers([user])
      .rpc();
    console.log("✅ Stake successful");

    // 4. Deposit rewards
    console.log("\n🎁 Testing deposit rewards...");
    const rewardAmount = new anchor.BN(50000000); // 50 tokens
    await program.methods
      .depositRewards(rewardAmount)
      .accounts({
        authority,
        authorityTokenAccount,
        mint,
        vaultAuthority,
        vaultAccount,
        globalState,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log("✅ Deposit rewards successful");

    // 5. Update in-game balance
    console.log("\n🎮 Testing update in-game balance...");
    const newBalance = new anchor.BN(120000000); // 120 tokens
    await program.methods
      .updateInGameBalance(user.publicKey, newBalance)
      .accounts({
        authority,
        userStake: stakeInfo,
        globalState,
      })
      .rpc();
    console.log("✅ Update balance successful");

    // 6. Unstake tokens
    console.log("\n🔓 Testing unstake tokens...");
    const unstakeAmount = new anchor.BN(80000000); // 80 tokens
    await program.methods
      .unstakeTokens(unstakeAmount)
      .accounts({
        user: user.publicKey,
        userTokenAccount,
        mint,
        vaultAuthority,
        vaultAccount,
        stakeInfo,
        globalState,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();
    console.log("✅ Unstake successful");

    // 7. Verify final state
    console.log("\n📊 Verifying final state...");
    const finalStakeInfo = await program.account.stakeInfo.fetch(stakeInfo);
    const finalGlobalState = await program.account.globalState.fetch(globalState);
    const finalVaultBalance = await getAccount(provider.connection, vaultAccount);

    console.log("Final stake info:");
    console.log("  - Total staked:", finalStakeInfo.totalStaked.toString());
    console.log("  - In-game balance:", finalStakeInfo.inGameBalance.toString());
    console.log("Final global state:");
    console.log("  - Total staked globally:", finalGlobalState.totalStaked.toString());
    console.log("Final vault balance:", finalVaultBalance.amount.toString());

    console.log("\n🎉 All tests passed! Deployment verification successful!");

  } catch (error) {
    console.error("\n❌ Error during verification:", error);
    process.exit(1);
  }
}

main().catch(console.error); 