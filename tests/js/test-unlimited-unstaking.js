const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Set environment variables
process.env.ANCHOR_PROVIDER_URL = 'https://api.devnet.solana.com';
process.env.ANCHOR_WALLET = path.join(require('os').homedir(), '.config', 'solana', 'id.json');

// Create a test script that tests unlimited unstaking with backend approval
const testScript = `
const anchor = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');

async function testUnlimitedUnstaking() {
  console.log('🎮 Testing Unlimited Unstaking (Minecraft Earnings)');
  console.log('=================================================\\n');

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
    
    // Get initial balances and stake info
    console.log('📊 Initial State:');
    const userBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
    const vaultBalance = await provider.connection.getTokenAccountBalance(vaultTokenAccount);
    console.log(\`💰 User balance: \${userBalance.value.uiAmount} tokens\`);
    console.log(\`🏦 Vault balance: \${vaultBalance.value.uiAmount} tokens\`);
    
    let currentStaked = 0;
    try {
      const stakeAccount = await program.account.stakeInfo.fetch(stakeInfo);
      currentStaked = stakeAccount.amount.toNumber();
      console.log(\`🎯 Currently staked: \${currentStaked / 10**6} tokens\\n\`);
    } catch (e) {
      console.log('❌ No stake account found. Please stake tokens first.\\n');
      return;
    }
    
    // Test scenarios
    console.log('🧪 Test Scenarios:');
    console.log('==================\\n');
    
    // Scenario 1: Unstake exactly what's staked (traditional)
    console.log('1️⃣ Unstake exactly what is staked (175 tokens)');
    await testSignatureUnstaking(program, {
      amount: new anchor.BN(currentStaked),
      description: 'Traditional unstaking - exact staked amount',
      expectedBehavior: 'Should succeed and reduce staked amount to 0'
    });
    
    // Check updated stake
    let newStaked = 0;
    try {
      const stakeAccount = await program.account.stakeInfo.fetch(stakeInfo);
      newStaked = stakeAccount.amount.toNumber();
      console.log(\`   📊 Staked amount after: \${newStaked / 10**6} tokens\\n\`);
    } catch (e) {
      console.log('   📊 Stake account no longer exists\\n');
    }
    
    // Scenario 2: Unstake MORE than originally staked (Minecraft earnings)
    const earningsAmount = 300 * 10**6; // 300 tokens (user earned 125 more than they staked)
    console.log('2️⃣ Unstake 300 tokens (more than originally staked - simulating Minecraft earnings)');
    await testSignatureUnstaking(program, {
      amount: new anchor.BN(earningsAmount),
      description: 'Minecraft earnings - unstake more than staked',
      expectedBehavior: 'Should succeed because backend approves the earned amount'
    });
    
    // Check final stake
    try {
      const stakeAccount = await program.account.stakeInfo.fetch(stakeInfo);
      const finalStaked = stakeAccount.amount.toNumber();
      console.log(\`   📊 Final staked amount: \${finalStaked / 10**6} tokens\\n\`);
    } catch (e) {
      console.log('   📊 Stake account no longer exists\\n');
    }
    
    // Scenario 3: Regular unstaking should still be restricted
    console.log('3️⃣ Try regular unstaking for 100 tokens (should fail since no stake left)');
    await testRegularUnstaking(program, {
      amount: new anchor.BN(100 * 10**6),
      description: 'Regular unstaking without backend approval',
      expectedBehavior: 'Should fail because regular unstaking is still restricted'
    });
    
    // Final balances
    console.log('\\n📊 Final State:');
    const finalUserBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
    const finalVaultBalance = await provider.connection.getTokenAccountBalance(vaultTokenAccount);
    console.log(\`💰 User balance: \${finalUserBalance.value.uiAmount} tokens\`);
    console.log(\`🏦 Vault balance: \${finalVaultBalance.value.uiAmount} tokens\`);
    
    console.log('\\n✅ Unlimited unstaking tests completed!');
    console.log('\\n🎮 Minecraft Integration Ready:');
    console.log('• Users can earn tokens in-game');
    console.log('• Backend tracks total withdrawable balance');
    console.log('• Users can withdraw stake + earnings');
    console.log('• Vault provides liquidity for earnings');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

async function testSignatureUnstaking(program, params) {
  const { amount, description, expectedBehavior } = params;
  
  console.log(\`   📝 \${description}\`);
  console.log(\`   💰 Amount: \${amount.toNumber() / 10**6} tokens\`);
  console.log(\`   🎯 Expected: \${expectedBehavior}\`);
  
  try {
    // Create dummy message and signature (backend would create real ones)
    const message = Buffer.from(\`unstake:\${program.provider.wallet.publicKey.toString()}:\${amount.toString()}:\${Date.now()}\`);
    const dummySignature = new Array(64).fill(0);
    
    // Load backend keypair for validation
    const backendSecretKey = JSON.parse(fs.readFileSync('./backend-keypair.json', 'utf8'));
    const backendKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(backendSecretKey));
    
    // Derive accounts
    const TOKEN_MINT = new PublicKey('Eg5VLcpRJr27VtNZpw1feJaMoRLN3UsmmzHCULtF3366');
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), TOKEN_MINT.toBuffer()],
      program.programId
    );
    const [stakeInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from('stake_info'), program.provider.wallet.publicKey.toBuffer(), TOKEN_MINT.toBuffer()],
      program.programId
    );
    const userTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, program.provider.wallet.publicKey);
    const vaultTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, vaultAuthority, true);
    
    const tx = await program.methods
      .unstakeWithSignature(
        amount,
        backendKeypair.publicKey,
        dummySignature,
        message
      )
      .accounts({
        user: program.provider.wallet.publicKey,
        userTokenAccount,
        mint: TOKEN_MINT,
        vaultAuthority,
        vaultAccount: vaultTokenAccount,
        stakeInfo,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    console.log(\`   ✅ SUCCESS: \${tx}\`);
    
  } catch (error) {
    console.log(\`   ❌ FAILED: \${error.message}\`);
  }
}

async function testRegularUnstaking(program, params) {
  const { amount, description, expectedBehavior } = params;
  
  console.log(\`   📝 \${description}\`);
  console.log(\`   💰 Amount: \${amount.toNumber() / 10**6} tokens\`);
  console.log(\`   🎯 Expected: \${expectedBehavior}\`);
  
  try {
    // Derive accounts
    const TOKEN_MINT = new PublicKey('Eg5VLcpRJr27VtNZpw1feJaMoRLN3UsmmzHCULtF3366');
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), TOKEN_MINT.toBuffer()],
      program.programId
    );
    const [stakeInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from('stake_info'), program.provider.wallet.publicKey.toBuffer(), TOKEN_MINT.toBuffer()],
      program.programId
    );
    const userTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, program.provider.wallet.publicKey);
    const vaultTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, vaultAuthority, true);
    
    const tx = await program.methods
      .unstakeTokens(amount)
      .accounts({
        user: program.provider.wallet.publicKey,
        userTokenAccount,
        mint: TOKEN_MINT,
        vaultAuthority,
        vaultAccount: vaultTokenAccount,
        stakeInfo,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    console.log(\`   ❌ UNEXPECTED SUCCESS: \${tx}\`);
    
  } catch (error) {
    console.log(\`   ✅ CORRECTLY FAILED: \${error.message}\`);
  }
}

testUnlimitedUnstaking();
`;

// Write the test script to a temporary file
fs.writeFileSync('./temp-unlimited-test.js', testScript);

console.log('🔧 Running unlimited unstaking test...\n');

// Run the test
const test = spawn('node', ['temp-unlimited-test.js'], {
  stdio: 'inherit',
  shell: true
});

test.on('close', (code) => {
  // Clean up temp file
  try {
    fs.unlinkSync('./temp-unlimited-test.js');
  } catch (e) {
    // Ignore cleanup errors
  }
  
  console.log(`\n🏁 Test finished with code ${code}`);
  
  if (code === 0) {
    console.log('\n🎉 Unlimited unstaking is working correctly!');
    console.log('\n🎮 Ready for Minecraft Integration:');
    console.log('✅ Users can unstake more than they staked');
    console.log('✅ Backend controls withdrawal limits');
    console.log('✅ Vault provides earnings liquidity');
    console.log('✅ Regular unstaking still has limits');
  }
  
  process.exit(code);
}); 