# Testing Guide

This guide explains how to test the Minecraft Staking Smart Contract across different scenarios.

## Prerequisites

1. **Environment Setup**:
   - Solana CLI configured for devnet
   - Wallet with SOL for transaction fees
   - Node.js installed for JavaScript tests

2. **Test Token**:
   - Use the provided test token: `Eg5VLcpRJr27VtNZpw1feJaMoRLN3UsmmzHCULtF3366`
   - Or create your own SPL token for testing

## Test Structure

### JavaScript Tests (tests/js/)

All JavaScript tests are located in the `tests/js/` directory and can be run independently.

#### Core Functionality Tests

1. **test-real-staking.js**
   - Tests basic staking and unstaking functionality
   - Verifies account creation and balance updates
   - Usage: `node tests/js/test-real-staking.js`

2. **test-unlimited-unstaking.js**
   - Tests scenarios where users can unstake any amount
   - Validates balance checks and error handling
   - Usage: `node tests/js/test-unlimited-unstaking.js`

#### Advanced Scenario Tests

3. **test-fixed-unlimited.js**
   - Tests fixed staking amounts with unlimited unstaking
   - Comprehensive test suite with multiple scenarios
   - Usage: `node tests/js/test-fixed-unlimited.js`

4. **test-simple-unlimited.js**
   - Simplified version of unlimited operations
   - Good for basic validation
   - Usage: `node tests/js/test-simple-unlimited.js`

#### Security and Edge Case Tests

5. **test-overstaking.js**
   - Tests protection against staking more tokens than available
   - Validates balance checks and transaction failures
   - Usage: `node tests/js/test-overstaking.js`

6. **test-minimal-signature.js**
   - Tests minimal signature requirements
   - Validates transaction signing and authorization
   - Usage: `node tests/js/test-minimal-signature.js`

#### Backend Integration Tests

7. **test-backend-signature.js**
   - Tests backend authority signature requirements
   - Validates authority-only operations
   - Usage: `node tests/js/test-backend-signature.js`

8. **test-signature-call.js**
   - Tests signature-based function calls
   - Usage: `node tests/js/test-signature-call.js`

9. **test-signature-unstaking.js**
   - Tests signature requirements for unstaking operations
   - Usage: `node tests/js/test-signature-unstaking.js`

### Utility Scripts

- **run-test.js**: Test runner for executing multiple tests
- **verify-deployment.js**: Verifies smart contract deployment

### TypeScript Tests (tests/)

- **staking.ts**: Anchor framework integration tests
- Run with: `anchor test`

## Running Tests

### Individual Test Execution

```bash
# Navigate to project root
cd staking

# Run a specific test
node tests/js/test-real-staking.js

# Run deployment verification
node tests/js/verify-deployment.js
```

### Batch Test Execution

```bash
# Run the test suite
node tests/js/run-test.js
```

### Anchor Integration Tests

```bash
# Run TypeScript tests with Anchor
anchor test
```

## Test Scenarios Covered

### 1. Basic Operations
- ✅ Initialize global state
- ✅ Stake tokens to vault
- ✅ Unstake available tokens
- ✅ Check account balances

### 2. Authority Operations
- ✅ Update in-game spent amounts
- ✅ Authority signature validation
- ✅ Unauthorized access prevention

### 3. Edge Cases
- ✅ Insufficient balance handling
- ✅ Overstaking prevention
- ✅ Invalid account handling
- ✅ Signature verification

### 4. Event Emission
- ✅ Stake event emission
- ✅ Unstake event emission
- ✅ In-game spent update events

### 5. PDA Operations
- ✅ Global state PDA creation
- ✅ User stake PDA creation
- ✅ Token vault PDA operations

## Test Data

### Test Accounts
- **Program ID**: `FK2cxLLF8wDCREL3t1uoijHTw2fmSjJxxM6STijFwPJn`
- **Test Token**: `Eg5VLcpRJr27VtNZpw1feJaMoRLN3UsmmzHCULtF3366`
- **Backend Authority**: Loaded from `scripts/backend-keypair.json`

### Test Amounts
- Standard stake amount: 1.0 tokens (1,000,000 with 6 decimals)
- Partial unstake amount: 0.5 tokens (500,000 with 6 decimals)
- In-game spent amount: 0.25 tokens (250,000 with 6 decimals)

## Debugging Tests

### Common Issues

1. **"Account not found" errors**:
   - Ensure global state is initialized
   - Check if user stake account exists
   - Verify correct PDA derivation

2. **"Insufficient funds" errors**:
   - Check user token balance
   - Verify available unstake amount
   - Ensure SOL balance for transaction fees

3. **"Invalid signature" errors**:
   - Verify wallet is connected
   - Check authority keypair loading
   - Validate transaction signing

### Debug Output

Most tests include detailed console output showing:
- Account addresses and PDAs
- Token balances before/after operations
- Transaction signatures
- Error messages with context

### Log Analysis

```bash
# Enable detailed Solana logs
export RUST_LOG=solana_runtime::system_instruction_processor=trace,solana_runtime::message_processor=info,solana_bpf_loader=debug,solana_rbpf=debug

# Run test with verbose output
node tests/js/test-real-staking.js
```

## Continuous Integration

For CI/CD pipelines, use:

```bash
# Install dependencies
npm install

# Build the program
anchor build

# Run test suite
npm test  # or node tests/js/run-test.js
```

## Test Environment Reset

To reset the test environment:

```bash
# Clean build artifacts
anchor clean

# Rebuild program
anchor build

# Deploy fresh instance (optional)
anchor deploy

# Run verification
node tests/js/verify-deployment.js
```

## Adding New Tests

When adding new test files:

1. Place them in `tests/js/` directory
2. Follow the naming convention: `test-[description].js`
3. Include proper error handling and cleanup
4. Add documentation to this guide
5. Update `run-test.js` if needed

### Test Template

```javascript
const anchor = require("@project-serum/anchor");
const { SystemProgram, LAMPORTS_PER_SOL } = require("@solana/web3.js");

describe("Your Test Name", () => {
  // Test setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Staking;

  it("Should perform expected operation", async () => {
    // Test implementation
    try {
      // Your test logic here
      console.log("✅ Test passed");
    } catch (error) {
      console.error("❌ Test failed:", error);
      throw error;
    }
  });
});
```

## Performance Testing

For performance analysis:

1. Monitor transaction times
2. Check account rent costs
3. Measure compute unit usage
4. Validate gas efficiency

See individual test files for performance metrics and optimization notes. 