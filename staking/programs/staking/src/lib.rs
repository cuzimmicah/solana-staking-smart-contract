use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("FK2cxLLF8wDCREL3t1uoijHTw2fmSjJxxM6STijFwPJn");

#[program]
pub mod staking {
    use super::*;

    pub fn stake_tokens(ctx: Context<Stake>, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        ctx.accounts.stake_info.amount += amount;
        
        // Store the vault bump if this is the first stake
        if ctx.accounts.stake_info.vault_bump == 0 {
            ctx.accounts.stake_info.vault_bump = ctx.bumps.vault_authority;
        }
        
        Ok(())
    }

    // Basic unstake function (same as before)
    pub fn unstake_tokens(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.stake_info.amount >= amount,
            ErrorCode::InsufficientStaked
        );

        ctx.accounts.stake_info.amount -= amount;

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

        Ok(())
    }

    // New function for signature-verified unstaking (for Minecraft backend)
    // Allows unstaking any amount as long as backend signs approval
    pub fn unstake_with_signature(
        ctx: Context<UnstakeWithSignature>, 
        amount: u64,
        backend_pubkey: Pubkey,
        _signature: Vec<u8>, // We'll implement real verification later
        _message: Vec<u8>,
    ) -> Result<()> {
        // Verify the backend_pubkey matches expected
        let expected_backend = Pubkey::try_from("Au5x3rmPd7NQdMPqKe12HLeCP2nN9ZiaP8Zy85ntgUvo")
            .map_err(|_| ErrorCode::InvalidBackendKey)?;
        
        require!(
            backend_pubkey == expected_backend,
            ErrorCode::InvalidBackendKey
        );

        // For backend-approved unstaking, we trust the backend's validation
        // The amount can exceed what the user originally staked (for in-game earnings)
        // Only reduce tracked stake amount if unstaking from original stake
        if amount <= ctx.accounts.stake_info.amount {
            ctx.accounts.stake_info.amount -= amount;
        } else {
            // If unstaking more than staked, set staked amount to 0
            // (user is withdrawing their stake + earnings)
            ctx.accounts.stake_info.amount = 0;
        }

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

        Ok(())
    }
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

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UnstakeWithSignature<'info> {
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

    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct StakeInfo {
    pub amount: u64,
    pub vault_bump: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Not enough tokens staked to unstake that amount.")]
    InsufficientStaked,

    #[msg("Invalid backend public key.")]
    InvalidBackendKey,
}
