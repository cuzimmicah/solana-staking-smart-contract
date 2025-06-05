# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-05

### Added
- Initial smart contract implementation for Minecraft token staking
- PDA-based token vault for secure custody
- User stake accounts with tracking for total staked, in-game spent, and timestamps
- Authority-controlled in-game spending updates
- Event emission for off-chain integration
- Comprehensive JavaScript test suite covering multiple scenarios
- TypeScript integration tests using Anchor framework
- Complete project documentation and setup guides

### Features
- **Smart Contract Functions**:
  - `initialize`: Sets up global state with authority
  - `stake`: Stakes tokens into the vault
  - `unstake`: Withdraws unspent tokens from the vault  
  - `update_in_game_spent`: Authority-only function to update spent amounts

- **Security Features**:
  - PDA-based token custody
  - Authority verification for spending updates
  - Overflow protection with safe math operations
  - Spend validation preventing overspending

- **Integration Support**:
  - Event emission for Minecraft backend listeners
  - Real-time balance verification
  - Backend authority management

### Testing
- 9 comprehensive JavaScript test files covering various scenarios
- TypeScript Anchor integration tests
- Deployment verification scripts
- Test token creation and minting utilities

### Deployment
- Successfully deployed to Solana Devnet
- Program ID: `FK2cxLLF8wDCREL3t1uoijHTw2fmSjJxxM6STijFwPJn`
- Test SPL Token: `Eg5VLcpRJr27VtNZpw1feJaMoRLN3UsmmzHCULtF3366`

### Documentation
- Complete README with setup and usage instructions
- Comprehensive testing guide
- Code comments and inline documentation
- Project structure and architecture overview 