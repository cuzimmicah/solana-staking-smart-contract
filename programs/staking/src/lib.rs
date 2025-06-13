use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("FK2cxLLF8wDCREL3t1uoijHTw2fmSjJxxM6STijFwPJn");

#[program]
pub mod staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, authority: Pubkey) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        global_state.authority = authority;
        global_state.total_staked = 0;
        global_state.bump = ctx.bumps.global_state;
        
        emit!(InitializeEvent {
            authority,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn stake_tokens(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // if first stake
        if ctx.accounts.stake_info.owner == Pubkey::default() {
            ctx.accounts.stake_info.owner = ctx.accounts.user.key();
            ctx.accounts.stake_info.mint = ctx.accounts.mint.key();
            ctx.accounts.stake_info.vault_bump = ctx.bumps.vault_authority;
            ctx.accounts.stake_info.in_game_balance = 0;
        }
        
        // update stake info
        ctx.accounts.stake_info.total_staked = ctx.accounts.stake_info.total_staked
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        
        ctx.accounts.stake_info.last_update = Clock::get()?.unix_timestamp;
        
        // update global state
        ctx.accounts.global_state.total_staked = ctx.accounts.global_state.total_staked
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        
        emit!(StakeEvent {
            user: ctx.accounts.user.key(),
            amount,
            total_staked: ctx.accounts.stake_info.total_staked,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn unstake_tokens(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        // allow unstake up to in-game balance
        require!(
            ctx.accounts.stake_info.in_game_balance >= amount,
            ErrorCode::InsufficientBalance
        );

        // calc how much of the unstake comes from original stake vs rewards
        let staked_portion = std::cmp::min(amount, ctx.accounts.stake_info.total_staked);
        
        // Update stake info - only reduce total_staked by the portion that was originally staked
        ctx.accounts.stake_info.total_staked = ctx.accounts.stake_info.total_staked
            .checked_sub(staked_portion)
            .ok_or(ErrorCode::InsufficientStaked)?;
        
        // Reduce in-game balance by full unstake amount (including rewards)
        ctx.accounts.stake_info.in_game_balance = ctx.accounts.stake_info.in_game_balance
            .checked_sub(amount)
            .ok_or(ErrorCode::InsufficientBalance)?;
            
        ctx.accounts.stake_info.last_update = Clock::get()?.unix_timestamp;

        // Only reduce global total_staked by the portion that was originally staked
        ctx.accounts.global_state.total_staked = ctx.accounts.global_state.total_staked
            .checked_sub(staked_portion)
            .ok_or(ErrorCode::InsufficientStaked)?;

        // Transfer tokens
        let mint_key = ctx.accounts.mint.key();
        let seeds = &[b"vault", mint_key.as_ref(), &[ctx.accounts.stake_info.vault_bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;

        emit!(UnstakeEvent {
            user: ctx.accounts.user.key(),
            amount,
            staked_portion,
            reward_portion: amount.checked_sub(staked_portion).unwrap_or(0),
            remaining_staked: ctx.accounts.stake_info.total_staked,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn update_in_game_balance(ctx: Context<UpdateInGameBalance>, user: Pubkey, new_balance: u64) -> Result<()> {
        // Verify authority
        require!(
            ctx.accounts.authority.key() == ctx.accounts.global_state.authority,
            ErrorCode::UnauthorizedAuthority
        );

        // Verify the user parameter matches the stake info owner
        require!(
            user == ctx.accounts.user_stake.owner,
            ErrorCode::InvalidUser
        );

        // Set the new in-game balance
        ctx.accounts.user_stake.in_game_balance = new_balance;
        ctx.accounts.user_stake.last_update = Clock::get()?.unix_timestamp;

        emit!(InGameBalanceUpdated {
            user,
            new_balance,
            total_staked: ctx.accounts.user_stake.total_staked,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn create_vault(ctx: Context<CreateVault>) -> Result<()> {
        // Vault token account is created through the constraints
        emit!(VaultCreated {
            mint: ctx.accounts.mint.key(),
            vault: ctx.accounts.vault_account.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn deposit_rewards(ctx: Context<DepositRewards>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        // Verify authority
        require!(
            ctx.accounts.authority.key() == ctx.accounts.global_state.authority,
            ErrorCode::UnauthorizedAuthority
        );

        // Transfer reward tokens from authority to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.authority_token_account.to_account_info(),
            to: ctx.accounts.vault_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        emit!(RewardsDeposited {
            authority: ctx.accounts.authority.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + GlobalState::INIT_SPACE,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    /// CHECK: vault authority PDA
    #[account(
        seeds = [b"vault", mint.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = vault_authority
    )]
    pub vault_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + StakeInfo::INIT_SPACE,
        seeds = [b"stake_info", user.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub stake_info: Account<'info, StakeInfo>,

    #[account(
        mut,
        seeds = [b"global_state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    /// CHECK: vault authority PDA
    #[account(
        seeds = [b"vault", mint.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = vault_authority
    )]
    pub vault_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"stake_info", user.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub stake_info: Account<'info, StakeInfo>,

    #[account(
        mut,
        seeds = [b"global_state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateInGameBalance<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"stake_info", user_stake.owner.as_ref(), user_stake.mint.as_ref()],
        bump
    )]
    pub user_stake: Account<'info, StakeInfo>,

    #[account(
        seeds = [b"global_state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,
}

#[derive(Accounts)]
pub struct CreateVault<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        token::mint = mint,
        token::authority = vault_authority
    )]
    pub vault_account: Account<'info, TokenAccount>,

    /// CHECK: vault authority PDA
    #[account(
        seeds = [b"vault", mint.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositRewards<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = authority
    )]
    pub authority_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    /// CHECK: vault authority PDA
    #[account(
        seeds = [b"vault", mint.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = vault_authority
    )]
    pub vault_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"global_state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,

    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct GlobalState {
    pub authority: Pubkey,
    pub total_staked: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct StakeInfo {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub total_staked: u64,
    pub in_game_balance: u64,
    pub vault_bump: u8,
    pub last_update: i64,
}

// Events
#[event]
pub struct InitializeEvent {
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct StakeEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub total_staked: u64,
    pub timestamp: i64,
}

#[event]
pub struct UnstakeEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub staked_portion: u64,
    pub reward_portion: u64,
    pub remaining_staked: u64,
    pub timestamp: i64,
}

#[event]
pub struct InGameBalanceUpdated {
    pub user: Pubkey,
    pub new_balance: u64,
    pub total_staked: u64,
    pub timestamp: i64,
}

#[event]
pub struct VaultCreated {
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RewardsDeposited {
    pub authority: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Not enough tokens staked to unstake that amount.")]
    InsufficientStaked,

    #[msg("Invalid amount.")]
    InvalidAmount,

    #[msg("Overflow error.")]
    Overflow,

    #[msg("Unauthorized authority.")]
    UnauthorizedAuthority,

    #[msg("Insufficient balance.")]
    InsufficientBalance,

    #[msg("Invalid user.")]
    InvalidUser,
}
