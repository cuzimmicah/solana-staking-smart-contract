const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair, SystemProgram } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function testSignatureUnstaking() {
  console.log('🔐 Testing External Backend Signature Verification');
  console.log('===============================================\n');

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
    
    console.log('👤 User:', userKeypair.publicKey.toString());
    console.log('🖥️ Backend:', backendKeypair.publicKey.toString());
    console.log('🎯 Program:', PROGRAM_ID.toString());
    console.log('🪙 Token:', TOKEN_MINT.toString());
    
    // Derive PDAs
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), TOKEN_MINT.toBuffer()],
      PROGRAM_ID
    );
    
    const [stakeInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from('stake_info'), userKeypair.publicKey.toBuffer(), TOKEN_MINT.toBuffer()],
      PROGRAM_ID
    );
    
    // Get token accounts
    const userTokenAccount = await getAssociatedTokenAddress(
      TOKEN_MINT,
      userKeypair.publicKey
    );
    
    const vaultTokenAccount = await getAssociatedTokenAddress(
      TOKEN_MINT,
      vaultAuthority,
      true
    );
    
    console.log('\n🔑 Accounts:');
    console.log('User Token Account:', userTokenAccount.toString());
    console.log('Vault Authority:', vaultAuthority.toString());
    console.log('Vault Token Account:', vaultTokenAccount.toString());
    console.log('Stake Info:', stakeInfo.toString());
    
    // Check current balances
    const userBalance = await connection.getTokenAccountBalance(userTokenAccount);
    const vaultBalance = await connection.getTokenAccountBalance(vaultTokenAccount);
    const stakeAccount = await connection.getAccountInfo(stakeInfo);
    
    console.log('\n💰 Current Balances:');
    console.log(`User: ${userBalance.value.uiAmount} tokens`);
    console.log(`Vault: ${vaultBalance.value.uiAmount} tokens`);
    
    if (stakeAccount) {
      console.log('✅ Stake account exists');
    } else {
      console.log('❌ No stake account found. Please stake some tokens first.');
      return;
    }
    
    // Test 1: Valid Backend Signature
    console.log('\n🧪 Test 1: Testing unstake_with_signature with valid backend');
    await testUnstakeWithSignature(
      connection,
      PROGRAM_ID,
      userKeypair,
      backendKeypair,
      TOKEN_MINT,
      25 * 10**6, // 25 tokens
      true // should succeed
    );
    
    // Test 2: Invalid Backend Signature
    console.log('\n🧪 Test 2: Testing unstake_with_signature with invalid backend');
    const fakeBackend = Keypair.generate();
    await testUnstakeWithSignature(
      connection,
      PROGRAM_ID,
      userKeypair,
      fakeBackend,
      TOKEN_MINT,
      10 * 10**6, // 10 tokens
      false // should fail
    );
    
    console.log('\n✅ Signature verification tests completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testUnstakeWithSignature(
  connection,
  programId,
  userKeypair,
  backendKeypair,
  tokenMint,
  amount,
  shouldSucceed
) {
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(userKeypair),
    anchor.AnchorProvider.defaultOptions()
  );
  
  // Load program
  const idl = JSON.parse(fs.readFileSync('./target/idl/staking.json', 'utf8'));
  const program = new anchor.Program(idl, programId, provider);
  
  // Derive accounts
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), tokenMint.toBuffer()],
    programId
  );
  
  const [stakeInfo] = PublicKey.findProgramAddressSync(
    [Buffer.from('stake_info'), userKeypair.publicKey.toBuffer(), tokenMint.toBuffer()],
    programId
  );
  
  const userTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    userKeypair.publicKey
  );
  
  const vaultTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    vaultAuthority,
    true
  );
  
  // Create message (in real implementation, this would be signed data about the transaction)
  const message = Buffer.from(`unstake:${userKeypair.publicKey.toString()}:${amount}:${Date.now()}`);
  
  // Create a dummy signature (64 bytes)
  const signature = new Array(64).fill(0);
  
  console.log(`   Backend: ${backendKeypair.publicKey.toString()}`);
  console.log(`   Amount: ${amount / 10**6} tokens`);
  console.log(`   Message: ${message.toString()}`);
  
  try {
    const tx = await program.methods
      .unstakeWithSignature(
        new anchor.BN(amount),
        backendKeypair.publicKey,
        signature,
        message
      )
      .accounts({
        user: userKeypair.publicKey,
        userTokenAccount: userTokenAccount,
        mint: tokenMint,
        vaultAuthority: vaultAuthority,
        vaultAccount: vaultTokenAccount,
        stakeInfo: stakeInfo,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userKeypair])
      .rpc();
    
    if (shouldSucceed) {
      console.log(`   ✅ SUCCESS: Transaction ${tx}`);
    } else {
      console.log(`   ❌ UNEXPECTED: Transaction should have failed but succeeded: ${tx}`);
    }
    
  } catch (error) {
    if (shouldSucceed) {
      console.log(`   ❌ FAILED: ${error.message}`);
    } else {
      console.log(`   ✅ CORRECTLY FAILED: ${error.message}`);
    }
  }
}

// Function to demonstrate how to create a proper Ed25519 signature
function createBackendSignature(backendKeypair, message) {
  const crypto = require('crypto');
  const nacl = require('tweetnacl');
  
  // In a real implementation, you would:
  // 1. Hash the message
  const messageHash = crypto.createHash('sha256').update(message).digest();
  
  // 2. Sign with the backend's private key
  const signature = nacl.sign.detached(messageHash, backendKeypair.secretKey);
  
  return signature;
}

function showImplementationGuide() {
  console.log('\n📚 Implementation Guide for Minecraft Backend:');
  console.log('===============================================');
  console.log('1. Backend generates unstaking permission:');
  console.log('   - User spends in-game currency');
  console.log('   - Backend creates message: "unstake:{userPubkey}:{amount}:{timestamp}"');
  console.log('   - Backend signs message with private key');
  console.log('   - Backend stores signature for user');
  
  console.log('\n2. User requests unstaking:');
  console.log('   - Frontend calls backend API with unstake request');
  console.log('   - Backend verifies user has permission and returns signature');
  console.log('   - Frontend calls unstake_with_signature with backend signature');
  
  console.log('\n3. Smart contract verifies:');
  console.log('   - Backend public key matches expected');
  console.log('   - Signature is valid for the message');
  console.log('   - User has sufficient staked tokens');
  
  console.log('\n🔗 Next Steps:');
  console.log('- Deploy contract with real signature verification');
  console.log('- Create Minecraft plugin to track in-game spending');
  console.log('- Build backend API for signature generation');
  console.log('- Create frontend to interact with both backend and contract');
}

testSignatureUnstaking().then(() => {
  showImplementationGuide();
}); 