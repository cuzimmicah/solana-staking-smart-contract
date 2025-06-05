# Minecraft Staking Smart Contract

A Solana smart contract built with Anchor for a Minecraft-integrated token staking system. Players can stake SPL tokens through a website wallet connection, and the staked tokens can be spent in-game through backend authority updates.

## Features

- **SPL Token Staking**: Players can stake any SPL token through wallet connection
- **PDA-based Vault**: Secure token custody using Program Derived Addresses
- **User Stake Tracking**: Tracks total staked amounts, in-game spent amounts, and timestamps
- **Event Emission**: Emits events for off-chain listeners (Minecraft backend integration)
- **Restricted Unstaking**: Users can only unstake tokens that haven't been spent in-game
- **Authority-controlled Spending**: Backend authority can update in-game spent amounts

## Smart Contract Structure

### Account Types

- **GlobalState**: Stores program-wide configuration and authority
- **UserStake**: Individual user staking records with amounts and timestamps
- **Token Vault**: PDA-controlled token account for secure custody

### Instructions

1. **initialize**: Sets up the global state with authority
2. **stake**: Stakes tokens into the vault and creates/updates user stake account
3. **unstake**: Withdraws unspent tokens from the vault
4. **update_in_game_spent**: Authority-only function to update spent amounts

## Deployment Information

- **Program ID**: `FK2cxLLF8wDCREL3t1uoijHTw2fmSjJxxM6STijFwPJn`
- **Network**: Solana Devnet
- **Test Token**: `Eg5VLcpRJr27VtNZpw1feJaMoRLN3UsmmzHCULtF3366` (6 decimals)

## Project Structure

```
staking/
├── programs/staking/          # Smart contract source code
│   ├── src/lib.rs            # Main contract logic
│   └── Cargo.toml            # Rust dependencies
├── tests/                    # Test files
│   ├── staking.ts           # TypeScript integration tests
│   └── js/                  # JavaScript test suite
│       ├── test-*.js        # Various test scenarios
│       ├── run-test.js      # Test runner
│       └── verify-deployment.js # Deployment verification
├── scripts/                  # Utility scripts and keypairs
├── migrations/              # Deployment scripts
├── app/                     # Frontend application (if applicable)
├── Anchor.toml              # Anchor configuration
├── Cargo.toml               # Workspace configuration
└── package.json             # Node.js dependencies
```

## Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (1.14+)
- [Anchor Framework](https://www.anchor-lang.com/docs/installation) (0.28+)
- [Node.js](https://nodejs.org/) (16+)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd staking
```

2. Install dependencies:
```bash
npm install
```

3. Build the smart contract:
```bash
anchor build
```

## Configuration

### Network Setup

1. Set Solana to devnet:
```bash
solana config set --url devnet
```

2. Create/restore wallet:
```bash
solana-keygen new  # or restore existing wallet
```

3. Airdrop SOL for testing:
```bash
solana airdrop 2
```

### Program Deployment

1. Deploy the program:
```bash
anchor deploy
```

2. Update the program ID in:
   - `Anchor.toml`
   - `programs/staking/src/lib.rs`

## Testing

The project includes comprehensive test suites for various scenarios:

### JavaScript Tests (tests/js/)

- **test-real-staking.js**: Basic staking functionality
- **test-unlimited-unstaking.js**: Unlimited unstaking scenarios
- **test-fixed-unlimited.js**: Fixed amount with unlimited unstaking
- **test-simple-unlimited.js**: Simple unlimited operations
- **test-minimal-signature.js**: Minimal signature requirements
- **test-overstaking.js**: Overstaking protection tests
- **test-signature-*.js**: Various signature-based tests

### Running Tests

1. Run individual tests:
```bash
node tests/js/test-real-staking.js
```

2. Run test suite:
```bash
node tests/js/run-test.js
```

3. Verify deployment:
```bash
node tests/js/verify-deployment.js
```

### TypeScript Tests

```bash
anchor test
```

## Usage Examples

### Staking Tokens

```javascript
const tx = await program.methods
  .stake(new anchor.BN(1000000)) // 1 token (6 decimals)
  .accounts({
    user: wallet.publicKey,
    userStake: userStakePDA,
    globalState: globalStatePDA,
    tokenVault: tokenVaultPDA,
    userTokenAccount: userTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc();
```

### Unstaking Tokens

```javascript
const tx = await program.methods
  .unstake(new anchor.BN(500000)) // 0.5 tokens
  .accounts({
    user: wallet.publicKey,
    userStake: userStakePDA,
    globalState: globalStatePDA,
    tokenVault: tokenVaultPDA,
    userTokenAccount: userTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc();
```

### Backend In-Game Spending

```javascript
const tx = await program.methods
  .updateInGameSpent(new anchor.BN(250000)) // 0.25 tokens spent
  .accounts({
    authority: backendWallet.publicKey,
    targetUser: userWallet.publicKey,
    userStake: userStakePDA,
    globalState: globalStatePDA,
  })
  .rpc();
```

## Events

The contract emits the following events for off-chain integration:

- **StakeEvent**: When tokens are staked
- **UnstakeEvent**: When tokens are unstaked  
- **InGameSpentUpdated**: When in-game spent amount is updated

## Security Features

- **PDA-based Token Custody**: Tokens are held in program-controlled accounts
- **Authority Verification**: Only designated authority can update in-game spending
- **Overflow Protection**: Safe math operations prevent overflow attacks
- **Spend Validation**: Users cannot unstake more than their available balance

## Integration with Minecraft

This smart contract is designed to integrate with a Minecraft server through:

1. **Event Listening**: Backend listens for stake/unstake events
2. **In-Game Spending**: Backend updates spent amounts when players use tokens
3. **Balance Verification**: Real-time balance checks for in-game purchases

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For questions or issues:
- Create an issue in this repository
- Review the test files for usage examples
- Check the Anchor documentation for framework-specific questions 