# Solana Staking Program

A Solana staking program that allows users to stake tokens and track their in-game balance for gaming applications.

## Features

- **Stake Tokens**: Users can stake SPL tokens into a secure vault
- **In-Game Balance Tracking**: Authority can update users' in-game balances based on their game activity
- **Flexible Unstaking**: Users can unstake up to the minimum of their staked amount and current in-game balance
- **Global State Management**: Tracks total staked across all users
- **Event Emission**: All actions emit events for off-chain tracking

## Program Structure

### Instructions

1. **`initialize`** - Initialize the global state with an authority
2. **`stake_tokens`** - Stake tokens into the vault
3. **`unstake_tokens`** - Unstake tokens from the vault (including earned rewards)
4. **`update_in_game_balance`** - Update a user's in-game balance (authority only)
5. **`create_vault`** - Create a vault for a specific token mint
6. **`deposit_rewards`** - Deposit reward tokens into the vault (authority only)

### Accounts

- **`GlobalState`** - Program-wide configuration and stats
- **`StakeInfo`** - Per-user staking information

## Prerequisites

1. Install [Rust](https://rustup.rs/)
2. Install [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
3. Install [Anchor](https://www.anchor-lang.com/docs/installation)
4. Install [Node.js](https://nodejs.org/)

## Setup

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Configure Solana CLI for your target network:
```bash
# For localnet
solana config set --url localhost

# For devnet  
solana config set --url devnet

# For mainnet
solana config set --url mainnet-beta
```

3. Create a keypair (if you don't have one):
```bash
solana-keygen new
```

4. Fund your account:
```bash
# For localnet (start local validator first)
solana-test-validator

# For devnet
solana airdrop 2

# For mainnet - you need real SOL
```

## Build and Deploy

1. Build the program:
```bash
anchor build
```

2. Deploy to your target network:
```bash
# Localnet
anchor deploy --provider.cluster localnet

# Devnet
anchor deploy --provider.cluster devnet

# Mainnet (be careful!)
anchor deploy --provider.cluster mainnet
```

3. Initialize the program:
```bash
node scripts/deploy.js
```

## Usage

### For Game Developers

1. **Create a vault** for your token mint
2. **Players stake tokens** using the `stake_tokens` instruction
3. **Deposit reward tokens** into the vault using `deposit_rewards`
4. **Update player balances** as they play using `update_in_game_balance` (can exceed staked amount for rewards)
5. **Players unstake** when they want to withdraw using `unstake_tokens` (can withdraw full balance including rewards)

### Example Flow

```typescript
// 1. Initialize (done once)
await program.methods
  .initialize(authorityPubkey)
  .accounts({ /* accounts */ })
  .rpc();

// 2. Create vault for token (done once per token)
await program.methods
  .createVault()
  .accounts({ /* accounts */ })
  .rpc();

// 3. User stakes tokens
await program.methods
  .stakeTokens(new BN(1000000)) // 1 token with 6 decimals
  .accounts({ /* accounts */ })
  .rpc();

// 4. Authority deposits reward tokens into vault
await program.methods
  .depositRewards(new BN(500000)) // 0.5 tokens in rewards
  .accounts({ /* accounts */ })
  .rpc();

// 5. Game backend updates user's in-game balance (including rewards)
await program.methods
  .updateInGameBalance(userPubkey, new BN(1500000)) // 1.5 tokens (1 staked + 0.5 earned)
  .accounts({ /* accounts */ })
  .rpc();

// 6. User unstakes (can unstake full balance including rewards)
await program.methods
  .unstakeTokens(new BN(1200000)) // 1.2 tokens (0.8 from stake + 0.4 from rewards)
  .accounts({ /* accounts */ })
  .rpc();
```

## Security Considerations

- **Authority Control**: The authority can update any user's in-game balance
- **PDA Security**: All accounts use proper PDA derivation with seeds
- **Overflow Protection**: All arithmetic operations use checked math
- **Token Safety**: Uses standard SPL token transfers

## Testing

Run the test suite:
```bash
anchor test
```

Note: Tests require the program to be built first to generate correct TypeScript types.

## Program Addresses

- **Localnet**: FK2cxLLF8wDCREL3t1uoijHTw2fmSjJxxM6STijFwPJn
- **Devnet**: FK2cxLLF8wDCREL3t1uoijHTw2fmSjJxxM6STijFwPJn
- **Mainnet**: FK2cxLLF8wDCREL3t1uoijHTw2fmSjJxxM6STijFwPJn

## License

MIT License 