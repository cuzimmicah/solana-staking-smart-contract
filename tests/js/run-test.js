const { spawn } = require('child_process');
const path = require('path');

// Set environment variables
process.env.ANCHOR_PROVIDER_URL = 'https://api.devnet.solana.com';
process.env.ANCHOR_WALLET = path.join(require('os').homedir(), '.config', 'solana', 'id.json');

console.log('🔧 Environment Setup:');
console.log(`ANCHOR_PROVIDER_URL: ${process.env.ANCHOR_PROVIDER_URL}`);
console.log(`ANCHOR_WALLET: ${process.env.ANCHOR_WALLET}\n`);

// Run the test
const test = spawn('npx', [
  'ts-mocha', 
  '-p', './tsconfig.json', 
  '-t', '1000000', 
  'tests/staking.ts'
], {
  stdio: 'inherit',
  shell: true
});

test.on('close', (code) => {
  console.log(`\n🏁 Test finished with code ${code}`);
  process.exit(code);
}); 