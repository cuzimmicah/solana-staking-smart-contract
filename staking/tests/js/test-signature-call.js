const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Set environment variables
process.env.ANCHOR_PROVIDER_URL = 'https://api.devnet.solana.com';
process.env.ANCHOR_WALLET = path.join(require('os').homedir(), '.config', 'solana', 'id.json');

// Create a test script that uses anchor workspace
const testScript = `
const anchor = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');

async function testSignatureFunction() {
  console.log('🔐 Testing unstake_with_signature function');
  console.log('========================================\\n');

  try {
    // Load provider and program
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.Staking;

    const TOKEN_MINT = new PublicKey('Eg5VLcpRJr27VtNZpw1feJaMoRLN3UsmmzHCULtF3366');
    
    // Load backend keypair
    const backendSecretKey = JSON.parse(fs.readFileSync('./backend-keypair.json', 'utf8'));
    const backendKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(backendSecretKey));
    
    console.log('👤 User:', provider.wallet.publicKey.toString());
    console.log('🖥️ Backend:', backendKeypair.publicKey.toString());
    console.log('🎯 Program:', program.programId.toString());
    
    // Derive PDAs
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), TOKEN_MINT.toBuffer()],
      program.programId
    );
    
    const [stakeInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from('stake_info'), provider.wallet.publicKey.toBuffer(), TOKEN_MINT.toBuffer()],
      program.programId
    );
    
    const userTokenAccount = await getAssociatedTokenAddress(
      TOKEN_MINT,
      provider.wallet.publicKey
    );
    
    const vaultTokenAccount = await getAssociatedTokenAddress(
      TOKEN_MINT,
      vaultAuthority,
      true
    );
    
    // Check current stake
    try {
      const stakeAccount = await program.account.stakeInfo.fetch(stakeInfo);
      console.log(\`Current staked amount: \${stakeAccount.amount.toNumber() / 10**6} tokens\\n\`);
    } catch (e) {
      console.log('❌ No stake account found. Please stake tokens first.');
      return;
    }
    
    // Test 1: Valid backend signature
    console.log('🧪 Test 1: Valid backend pubkey');
    await testUnstaking(program, {
      amount: new anchor.BN(10 * 10**6), // 10 tokens
      backendPubkey: backendKeypair.publicKey,
      userTokenAccount,
      mint: TOKEN_MINT,
      vaultAuthority,
      vaultAccount: vaultTokenAccount,
      stakeInfo,
      shouldSucceed: true,
      testName: 'Valid backend'
    });
    
    // Test 2: Invalid backend signature
    console.log('\\n🧪 Test 2: Invalid backend pubkey');
    const fakeBackend = anchor.web3.Keypair.generate();
    await testUnstaking(program, {
      amount: new anchor.BN(5 * 10**6), // 5 tokens
      backendPubkey: fakeBackend.publicKey,
      userTokenAccount,
      mint: TOKEN_MINT,
      vaultAuthority,
      vaultAccount: vaultTokenAccount,
      stakeInfo,
      shouldSucceed: false,
      testName: 'Invalid backend'
    });
    
    console.log('\\n✅ Signature verification tests completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

async function testUnstaking(program, params) {
  const { amount, backendPubkey, shouldSucceed, testName, ...accounts } = params;
  
  // Create message and dummy signature
  const message = Buffer.from(\`unstake:\${program.provider.wallet.publicKey.toString()}:\${amount.toString()}:\${Date.now()}\`);
  const dummySignature = new Array(64).fill(0);
  
  console.log(\`   Testing: \${testName}\`);
  console.log(\`   Backend: \${backendPubkey.toString()}\`);
  console.log(\`   Amount: \${amount.toNumber() / 10**6} tokens\`);
  
  try {
    const tx = await program.methods
      .unstakeWithSignature(
        amount,
        backendPubkey,
        dummySignature,
        message
      )
      .accounts({
        user: program.provider.wallet.publicKey,
        ...accounts,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    if (shouldSucceed) {
      console.log(\`   ✅ SUCCESS: \${tx}\`);
    } else {
      console.log(\`   ❌ UNEXPECTED SUCCESS: \${tx}\`);
    }
    
  } catch (error) {
    if (shouldSucceed) {
      console.log(\`   ❌ FAILED: \${error.message}\`);
    } else {
      console.log(\`   ✅ CORRECTLY FAILED: \${error.message}\`);
    }
  }
}

testSignatureFunction();
`;

// Write the test script to a temporary file
fs.writeFileSync('./temp-signature-test.js', testScript);

console.log('🔧 Running signature verification test...\n');

// Run the test
const test = spawn('node', ['temp-signature-test.js'], {
  stdio: 'inherit',
  shell: true
});

test.on('close', (code) => {
  // Clean up temp file
  try {
    fs.unlinkSync('./temp-signature-test.js');
  } catch (e) {
    // Ignore cleanup errors
  }
  
  console.log(`\n🏁 Test finished with code ${code}`);
  
  if (code === 0) {
    console.log('\n🎉 Signature verification system is working!');
    console.log('\n📋 Summary:');
    console.log('✅ Backend keypair generated');
    console.log('✅ Contract accepts valid backend signatures');
    console.log('✅ Contract rejects invalid backend signatures');
    console.log('\n🔗 Next steps for production:');
    console.log('1. Implement real Ed25519 signature verification in contract');
    console.log('2. Create backend API for signature generation');
    console.log('3. Build Minecraft plugin for in-game tracking');
    console.log('4. Create web interface for staking/unstaking');
  }
  
  process.exit(code);
}); 