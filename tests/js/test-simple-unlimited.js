const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Set environment variables
process.env.ANCHOR_PROVIDER_URL = 'https://api.devnet.solana.com';
process.env.ANCHOR_WALLET = path.join(require('os').homedir(), '.config', 'solana', 'id.json');

// Create a test script that tests unlimited unstaking with minimal signature data
const testScript = `
const anchor = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');

async function testSimpleUnlimited() {
  console.log('🎮 Testing Simple Unlimited Unstaking');
  console.log('====================================\\n');

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
    
    // Get initial state
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
      console.log('❌ No stake account found.\\n');
      return;
    }
    
    // Test unstaking MORE than staked with minimal parameters
    const unstakeAmount = currentStaked + (200 * 10**6); // 200 tokens more than staked
    console.log(\`🧪 Testing: Unstake \${unstakeAmount / 10**6} tokens (more than \${currentStaked / 10**6} staked)\`);
    
    try {
      const tx = await program.methods
        .unstakeWithSignature(
          new anchor.BN(unstakeAmount),
          backendKeypair.publicKey,
          [], // Empty signature array
          []  // Empty message array
        )
        .accounts({
          user: provider.wallet.publicKey,
          userTokenAccount,
          mint: TOKEN_MINT,
          vaultAuthority,
          vaultAccount: vaultTokenAccount,
          stakeInfo,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      
      console.log(\`✅ SUCCESS: Unlimited unstaking works! \${tx}\`);
      
      // Check final state
      const finalUserBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
      const finalVaultBalance = await provider.connection.getTokenAccountBalance(vaultTokenAccount);
      const finalStakeAccount = await program.account.stakeInfo.fetch(stakeInfo);
      
      console.log('\\n📊 Final State:');
      console.log(\`💰 User balance: \${finalUserBalance.value.uiAmount} tokens\`);
      console.log(\`🏦 Vault balance: \${finalVaultBalance.value.uiAmount} tokens\`);
      console.log(\`🎯 Remaining staked: \${finalStakeAccount.amount.toNumber() / 10**6} tokens\`);
      
             console.log('\\n🎉 Unlimited Unstaking CONFIRMED!');
       console.log(\`✅ Successfully unstaked \${unstakeAmount / 10**6} tokens\`);
       console.log(\`✅ User earned \${(unstakeAmount - currentStaked) / 10**6} extra tokens from gameplay\`);
       console.log('✅ Smart contract trusts backend authorization');
      
    } catch (error) {
      console.log(\`❌ FAILED: \${error.message}\`);
      
      // If signature issue, let's try with the original restricted function to see difference
      console.log('\\n🔄 Trying regular unstake for comparison...');
      try {
        const regularTx = await program.methods
          .unstakeTokens(new anchor.BN(unstakeAmount))
          .accounts({
            user: provider.wallet.publicKey,
            userTokenAccount,
            mint: TOKEN_MINT,
            vaultAuthority,
            vaultAccount: vaultTokenAccount,
            stakeInfo,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        
        console.log(\`❌ Regular unstake unexpectedly succeeded: \${regularTx}\`);
        
      } catch (regularError) {
        console.log(\`✅ Regular unstake correctly failed: \${regularError.message}\`);
        console.log('✅ This confirms that unlimited unstaking requires backend approval');
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testSimpleUnlimited();
`;

// Write the test script to a temporary file
fs.writeFileSync('./temp-simple-test.js', testScript);

console.log('🔧 Running simple unlimited unstaking test...\n');

// Run the test
const test = spawn('node', ['temp-simple-test.js'], {
  stdio: 'inherit',
  shell: true
});

test.on('close', (code) => {
  // Clean up temp file
  try {
    fs.unlinkSync('./temp-simple-test.js');
  } catch (e) {
    // Ignore cleanup errors
  }
  
  console.log(`\n🏁 Test finished with code ${code}`);
  
  if (code === 0) {
    console.log('\n🎉 Simple test completed!');
    console.log('\n🎮 Testing unlimited unstaking logic...');
  }
  
  process.exit(code);
}); 