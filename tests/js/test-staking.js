const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair, SystemProgram } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');

async function testStaking() {
  console.log('🧪 Testing Staking Contract with Real SPL Token');
  console.log('==============================================\n');

  // Configuration
  const PROGRAM_ID = new PublicKey('FK2cxLLF8wDCREL3t1uoijHTw2fmSjJxxM6STijFwPJn');
  const TOKEN_MINT = new PublicKey('Eg5VLcpRJr27VtNZpw1feJaMoRLN3UsmmzHCULtF3366');
  
  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  try {
    // Load the user's wallet (this should be your default Solana keypair)
    const userKeypair = Keypair.fromSecretKey(
      // In a real app, load from file. For testing, we'll use a dummy keypair
      new Uint8Array(64).fill(1) // This won't work - just for demonstration
    );
    
    console.log('📊 Test Configuration:');
    console.log(`🎯 Program ID: ${PROGRAM_ID.toString()}`);
    console.log(`🪙 Token Mint: ${TOKEN_MINT.toString()}`);
    console.log(`👤 User: ${userKeypair.publicKey.toString()}`);
    
    // Derive PDAs
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), TOKEN_MINT.toBuffer()],
      PROGRAM_ID
    );
    
    const [stakeInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from('stake_info'), userKeypair.publicKey.toBuffer(), TOKEN_MINT.toBuffer()],
      PROGRAM_ID
    );
    
    console.log(`\n🔑 Derived Addresses:`);
    console.log(`Vault Authority: ${vaultAuthority.toString()}`);
    console.log(`Stake Info: ${stakeInfo.toString()}`);
    
    // Get user's token account
    const userTokenAccount = await getAssociatedTokenAddress(
      TOKEN_MINT,
      userKeypair.publicKey
    );
    
    console.log(`User Token Account: ${userTokenAccount.toString()}`);
    
    // Check if vault token account exists
    const vaultTokenAccount = await getAssociatedTokenAddress(
      TOKEN_MINT,
      vaultAuthority,
      true // Allow off-curve addresses for PDAs
    );
    
    console.log(`Vault Token Account: ${vaultTokenAccount.toString()}`);
    
    // Check balances
    try {
      const userBalance = await connection.getTokenAccountBalance(userTokenAccount);
      console.log(`\n💰 Current Balances:`);
      console.log(`User Token Balance: ${userBalance.value.uiAmount} tokens`);
    } catch (error) {
      console.log('User token account not found or empty');
    }
    
    try {
      const vaultBalance = await connection.getTokenAccountBalance(vaultTokenAccount);
      console.log(`Vault Token Balance: ${vaultBalance.value.uiAmount} tokens`);
    } catch (error) {
      console.log('Vault token account not yet created');
    }
    
    console.log('\n✅ Test Setup Complete!');
    console.log('\n📝 Next Steps for Manual Testing:');
    console.log('1. Create vault token account (if needed)');
    console.log('2. Call stake_tokens instruction');
    console.log('3. Verify tokens moved to vault');
    console.log('4. Call unstake_tokens instruction');
    console.log('5. Verify tokens returned to user');
    
    console.log('\n🎯 Your Test Token Details:');
    console.log(`Token Address: ${TOKEN_MINT.toString()}`);
    console.log(`Explorer: https://explorer.solana.com/address/${TOKEN_MINT.toString()}?cluster=devnet`);
    
  } catch (error) {
    console.error('Error during testing:', error.message);
  }
}

// Additional helper function to show program usage
function showInstructions() {
  console.log('\n📚 Staking Contract Instructions:');
  console.log('\nTo stake tokens, you need to call:');
  console.log('stake_tokens(amount: u64)');
  console.log('\nAccounts needed:');
  console.log('- user: Signer (your wallet)');
  console.log('- user_token_account: Your token account');
  console.log('- mint: Token mint address');
  console.log('- vault_authority: PDA [b"vault", mint]');
  console.log('- vault_account: Token account owned by vault_authority');
  console.log('- stake_info: PDA [b"stake_info", user, mint]');
  console.log('- token_program: TOKEN_PROGRAM_ID');
  console.log('- system_program: SystemProgram.programId');
  console.log('- rent: SYSVAR_RENT_PUBKEY');
  console.log('- associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID');
}

testStaking();
showInstructions(); 