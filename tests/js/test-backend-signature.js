const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function testBackendSignature() {
  console.log('🔐 Backend Signature Testing Setup');
  console.log('==================================\n');

  // Configuration
  const PROGRAM_ID = new PublicKey('FK2cxLLF8wDCREL3t1uoijHTw2fmSjJxxM6STijFwPJn');
  const TOKEN_MINT = new PublicKey('Eg5VLcpRJr27VtNZpw1feJaMoRLN3UsmmzHCULtF3366');
  
  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  try {
    // Load user wallet
    const userKeypairPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
    const userSecretKey = JSON.parse(fs.readFileSync(userKeypairPath, 'utf8'));
    const userKeypair = Keypair.fromSecretKey(new Uint8Array(userSecretKey));
    
    // Load backend keypair
    const backendSecretKey = JSON.parse(fs.readFileSync('./backend-keypair.json', 'utf8'));
    const backendKeypair = Keypair.fromSecretKey(new Uint8Array(backendSecretKey));
    
    console.log('📊 Account Information:');
    console.log(`👤 User Wallet: ${userKeypair.publicKey.toString()}`);
    console.log(`🖥️ Backend Wallet: ${backendKeypair.publicKey.toString()}`);
    console.log(`🎯 Program ID: ${PROGRAM_ID.toString()}`);
    console.log(`🪙 Token Mint: ${TOKEN_MINT.toString()}`);
    
    // Derive important accounts
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), TOKEN_MINT.toBuffer()],
      PROGRAM_ID
    );
    
    const [stakeInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from('stake_info'), userKeypair.publicKey.toBuffer(), TOKEN_MINT.toBuffer()],
      PROGRAM_ID
    );
    
    const userTokenAccount = await getAssociatedTokenAddress(
      TOKEN_MINT,
      userKeypair.publicKey
    );
    
    const vaultTokenAccount = await getAssociatedTokenAddress(
      TOKEN_MINT,
      vaultAuthority,
      true
    );
    
    console.log('\n🔑 Derived Accounts:');
    console.log(`Vault Authority PDA: ${vaultAuthority.toString()}`);
    console.log(`Stake Info PDA: ${stakeInfo.toString()}`);
    console.log(`User Token Account: ${userTokenAccount.toString()}`);
    console.log(`Vault Token Account: ${vaultTokenAccount.toString()}`);
    
    // Check account balances
    console.log('\n💰 Current State:');
    
    try {
      const userBalance = await connection.getTokenAccountBalance(userTokenAccount);
      console.log(`User Token Balance: ${userBalance.value.uiAmount} tokens`);
    } catch (e) {
      console.log('User Token Account: Not found');
    }
    
    try {
      const vaultBalance = await connection.getTokenAccountBalance(vaultTokenAccount);
      console.log(`Vault Token Balance: ${vaultBalance.value.uiAmount} tokens`);
    } catch (e) {
      console.log('Vault Token Account: Not found');
    }
    
    try {
      const stakeAccount = await connection.getAccountInfo(stakeInfo);
      if (stakeAccount) {
        console.log('✅ Stake Info Account: Exists');
        console.log(`   Data Length: ${stakeAccount.data.length} bytes`);
        console.log(`   Owner: ${stakeAccount.owner.toString()}`);
      } else {
        console.log('❌ Stake Info Account: Does not exist');
      }
    } catch (e) {
      console.log('❌ Stake Info Account: Error reading');
    }
    
    // Test signature creation
    console.log('\n🔏 Signature Testing:');
    testSignatureCreation(userKeypair, backendKeypair);
    
    // Show how to use with Anchor
    showAnchorUsage(userKeypair, backendKeypair);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

function testSignatureCreation(userKeypair, backendKeypair) {
  console.log('Testing signature creation process...');
  
  // 1. Create a message that the backend would sign
  const unstakeAmount = 25 * 10**6; // 25 tokens
  const timestamp = Date.now();
  const message = `unstake:${userKeypair.publicKey.toString()}:${unstakeAmount}:${timestamp}`;
  
  console.log(`Message to sign: "${message}"`);
  
  // 2. Create message buffer
  const messageBuffer = Buffer.from(message, 'utf8');
  console.log(`Message buffer length: ${messageBuffer.length} bytes`);
  
  // 3. In a real implementation, you would sign this with the backend private key
  console.log('✅ Message prepared for signing');
  
  // 4. Show the accounts needed for the transaction
  console.log('\n📋 Accounts needed for unstake_with_signature:');
  console.log('- user: User wallet (signer)');
  console.log('- userTokenAccount: User\'s token account');
  console.log('- mint: Token mint account');
  console.log('- vaultAuthority: Vault PDA');
  console.log('- vaultAccount: Vault token account');
  console.log('- stakeInfo: User\'s stake info PDA');
  console.log('- tokenProgram: SPL Token program');
}

function showAnchorUsage(userKeypair, backendKeypair) {
  console.log('\n🔧 Anchor Usage Example:');
  console.log('========================');
  
  const exampleCode = `
// 1. Set up environment
process.env.ANCHOR_PROVIDER_URL = 'https://api.devnet.solana.com';
process.env.ANCHOR_WALLET = '${path.join(os.homedir(), '.config', 'solana', 'id.json')}';

// 2. Load program
const program = anchor.workspace.Staking;

// 3. Create transaction
const tx = await program.methods
  .unstakeWithSignature(
    new anchor.BN(25 * 10**6),  // amount
    new PublicKey('${backendKeypair.publicKey.toString()}'),  // backend pubkey
    dummySignature,  // 64-byte signature array
    messageBuffer    // message buffer
  )
  .accounts({
    user: userKeypair.publicKey,
    userTokenAccount: userTokenAccount,
    mint: TOKEN_MINT,
    vaultAuthority: vaultAuthority,
    vaultAccount: vaultTokenAccount,
    stakeInfo: stakeInfo,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .signers([userKeypair])
  .rpc();
`;

  console.log(exampleCode);
  
  console.log('\n✅ Ready for signature-based unstaking!');
  console.log('\n🎯 Next Steps:');
  console.log('1. Use the backend keypair to sign unstaking permissions');
  console.log('2. Update contract to include real Ed25519 signature verification');
  console.log('3. Create Minecraft plugin to track spending and generate signatures');
  console.log('4. Build frontend to request signatures from backend');
}

function showMinecraftIntegration() {
  console.log('\n🎮 Minecraft Integration Flow:');
  console.log('==============================');
  console.log('1. Player stakes tokens via web interface');
  console.log('2. Backend tracks staked balance for player');
  console.log('3. Player spends in-game currency (tracked by plugin)');
  console.log('4. Backend reduces available unstaking balance');
  console.log('5. Player requests unstaking via web interface');
  console.log('6. Backend verifies unstaking amount vs remaining balance');
  console.log('7. Backend signs unstaking permission');
  console.log('8. Frontend calls unstake_with_signature with backend signature');
  console.log('9. Smart contract verifies signature and processes unstaking');
  console.log('10. Player receives tokens back to wallet');
}

testBackendSignature().then(() => {
  showMinecraftIntegration();
}); 