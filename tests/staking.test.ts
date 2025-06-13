import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Staking } from "../target/types/staking";
import { expect } from "chai";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";

describe("staking", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Staking as Program<Staking>;
  const provider = anchor.getProvider();

  // Test accounts
  let mint: anchor.web3.PublicKey;
  let userTokenAccount: anchor.web3.PublicKey;
  let authorityTokenAccount: anchor.web3.PublicKey;
  let vaultAccount: anchor.web3.PublicKey;
  let vaultAuthority: anchor.web3.PublicKey;
  let globalState: anchor.web3.PublicKey;
  let stakeInfo: anchor.web3.PublicKey;
  
  const user = anchor.web3.Keypair.generate();
  const authority = anchor.web3.Keypair.generate();

  before(async () => {
    // Airdrop SOL to test accounts
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    );

    // Create mint
    mint = await createMint(
      provider.connection,
      user,
      user.publicKey,
      null,
      6
    );

    // Create user token account
    userTokenAccount = await createAccount(
      provider.connection,
      user,
      mint,
      user.publicKey
    );

    // Create authority token account
    authorityTokenAccount = await createAccount(
      provider.connection,
      authority,
      mint,
      authority.publicKey
    );

    // Mint tokens to user and authority
    await mintTo(
      provider.connection,
      user,
      mint,
      userTokenAccount,
      user,
      1000000000 // 1000 tokens
    );

    await mintTo(
      provider.connection,
      authority,
      mint,
      authorityTokenAccount,
      authority,
      500000000 // 500 tokens for rewards
    );

    // Derive PDAs
    [globalState] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );

    [vaultAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), mint.toBuffer()],
      program.programId
    );

    [stakeInfo] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake_info"), user.publicKey.toBuffer(), mint.toBuffer()],
      program.programId
    );
  });

  it("Initialize global state", async () => {
    await program.methods
      .initialize(authority.publicKey)
      .accounts({
        payer: user.publicKey,
        globalState,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const globalStateAccount = await program.account.globalState.fetch(globalState);
    expect(globalStateAccount.authority.toString()).to.equal(authority.publicKey.toString());
    expect(globalStateAccount.totalStaked.toNumber()).to.equal(0);
  });

  it("Create vault", async () => {
    vaultAccount = await createAccount(
      provider.connection,
      user,
      mint,
      vaultAuthority
    );

    // Verify vault was created correctly
    const vaultInfo = await getAccount(provider.connection, vaultAccount);
    expect(vaultInfo.mint.toString()).to.equal(mint.toString());
    expect(vaultInfo.owner.toString()).to.equal(vaultAuthority.toString());
  });

  it("Stake tokens", async () => {
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
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    const stakeInfoAccount = await program.account.stakeInfo.fetch(stakeInfo);
    expect(stakeInfoAccount.totalStaked.toNumber()).to.equal(stakeAmount.toNumber());
    expect(stakeInfoAccount.inGameBalance.toNumber()).to.equal(0);

    const globalStateAccount = await program.account.globalState.fetch(globalState);
    expect(globalStateAccount.totalStaked.toNumber()).to.equal(stakeAmount.toNumber());
  });

  it("Deposit rewards", async () => {
    const rewardAmount = new anchor.BN(50000000); // 50 tokens

    await program.methods
      .depositRewards(rewardAmount)
      .accounts({
        authority: authority.publicKey,
        authorityTokenAccount,
        mint,
        vaultAuthority,
        vaultAccount,
        globalState,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    // Check vault balance increased
    const vaultInfo = await getAccount(provider.connection, vaultAccount);
    expect(vaultInfo.amount.toString()).to.equal("150000000"); // 100 staked + 50 rewards
  });

  it("Update in-game balance", async () => {
    const newBalance = new anchor.BN(120000000); // 120 tokens (100 staked + 20 earned)

    await program.methods
      .updateInGameBalance(user.publicKey, newBalance)
      .accounts({
        authority: authority.publicKey,
        userStake: stakeInfo,
        globalState,
      })
      .signers([authority])
      .rpc();

    const stakeInfoAccount = await program.account.stakeInfo.fetch(stakeInfo);
    expect(stakeInfoAccount.inGameBalance.toNumber()).to.equal(newBalance.toNumber());
  });

  it("Unstake tokens (partial - mix of stake and rewards)", async () => {
    const unstakeAmount = new anchor.BN(80000000); // 80 tokens

    const initialStakeInfo = await program.account.stakeInfo.fetch(stakeInfo);
    const initialUserBalance = await getAccount(provider.connection, userTokenAccount);

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

    const finalStakeInfo = await program.account.stakeInfo.fetch(stakeInfo);
    const finalUserBalance = await getAccount(provider.connection, userTokenAccount);

    // Check stake info updates
    expect(finalStakeInfo.totalStaked.toNumber()).to.equal(20000000); // 100 - 80 = 20
    expect(finalStakeInfo.inGameBalance.toNumber()).to.equal(40000000); // 120 - 80 = 40

    // Check user received tokens
    const balanceIncrease = Number(finalUserBalance.amount) - Number(initialUserBalance.amount);
    expect(balanceIncrease).to.equal(unstakeAmount.toNumber());

    // Check global state
    const globalStateAccount = await program.account.globalState.fetch(globalState);
    expect(globalStateAccount.totalStaked.toNumber()).to.equal(20000000); // Only original stake portion
  });

  it("Update balance with more rewards", async () => {
    const newBalance = new anchor.BN(60000000); // 60 tokens (20 staked + 40 earned)

    await program.methods
      .updateInGameBalance(user.publicKey, newBalance)
      .accounts({
        authority: authority.publicKey,
        userStake: stakeInfo,
        globalState,
      })
      .signers([authority])
      .rpc();

    const stakeInfoAccount = await program.account.stakeInfo.fetch(stakeInfo);
    expect(stakeInfoAccount.inGameBalance.toNumber()).to.equal(newBalance.toNumber());
  });

  it("Unstake remaining tokens (all rewards)", async () => {
    const unstakeAmount = new anchor.BN(60000000); // All remaining balance

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

    const finalStakeInfo = await program.account.stakeInfo.fetch(stakeInfo);
    
    // All should be withdrawn
    expect(finalStakeInfo.totalStaked.toNumber()).to.equal(0);
    expect(finalStakeInfo.inGameBalance.toNumber()).to.equal(0);

    // Global state should show no staked tokens
    const globalStateAccount = await program.account.globalState.fetch(globalState);
    expect(globalStateAccount.totalStaked.toNumber()).to.equal(0);
  });

  it("Should fail to unstake more than balance", async () => {
    // First stake some tokens again
    const stakeAmount = new anchor.BN(50000000);
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
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    // Set balance to 30 tokens
    await program.methods
      .updateInGameBalance(user.publicKey, new anchor.BN(30000000))
      .accounts({
        authority: authority.publicKey,
        userStake: stakeInfo,
        globalState,
      })
      .signers([authority])
      .rpc();

    // Try to unstake 40 tokens (more than balance)
    try {
      await program.methods
        .unstakeTokens(new anchor.BN(40000000))
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
      
      expect.fail("Should have failed");
    } catch (error) {
      expect(error.message).to.include("InsufficientBalance");
    }
  });
}); 