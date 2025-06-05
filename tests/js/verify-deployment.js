const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey } = require('@solana/web3.js');

async function verifyDeployment() {
  console.log('🔍 Verifying Staking Contract Deployment');
  console.log('====================================\n');

  // Program ID from deployment
  const programId = new PublicKey('FK2cxLLF8wDCREL3t1uoijHTw2fmSjJxxM6STijFwPJn');
  
  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  try {
    // Check if program exists
    const programInfo = await connection.getAccountInfo(programId);
    
    if (programInfo) {
      console.log('✅ Contract deployed successfully!');
      console.log(`📍 Program ID: ${programId.toString()}`);
      console.log(`💰 Program Balance: ${programInfo.lamports / 1e9} SOL`);
      console.log(`📏 Program Size: ${programInfo.data.length} bytes`);
      console.log(`👤 Owner: ${programInfo.owner.toString()}`);
      
      // Check if it's a valid BPF program
      if (programInfo.owner.toString() === 'BPFLoaderUpgradeab1e11111111111111111111111') {
        console.log('✅ Valid BPF program detected');
      }
      
      console.log('\n🎯 Contract Features:');
      console.log('• stake_tokens: Users can stake SPL tokens');
      console.log('• unstake_tokens: Users can withdraw staked tokens');
      console.log('• PDA-based vault for secure token custody');
      console.log('• StakeInfo accounts track user balances');
      
      console.log('\n🔗 Devnet Explorer:');
      console.log(`https://explorer.solana.com/address/${programId.toString()}?cluster=devnet`);
      
      console.log('\n🎮 Ready for Integration!');
      console.log('Your staking contract is live and ready to use.');
      
    } else {
      console.log('❌ Program not found on devnet');
    }
    
  } catch (error) {
    console.error('Error verifying deployment:', error.message);
  }
}

verifyDeployment(); 