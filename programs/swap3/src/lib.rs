use anchor_lang::prelude::*;
use anchor_spl::{self, associated_token, token};
use spl_token_swap::instruction::{swap, Swap};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod swap3 {
    use super::*;
    pub fn swap_tokens(
        ctx: Context<SwapTokens>,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        // accounts array
        let accounts = [
            ctx.accounts.token_swap_program.clone(),
            ctx.accounts.token_program.clone().to_account_info(),
            ctx.accounts.amm.clone(),
            ctx.accounts.amm_authority.clone(),
            ctx.accounts.user.clone().to_account_info(),
            ctx.accounts.source.clone().to_account_info(),
            ctx.accounts.swap_source.clone().to_account_info(),
            ctx.accounts.swap_destination.clone().to_account_info(),
            ctx.accounts.destination.clone().to_account_info(),
            ctx.accounts.pool_mint.clone().to_account_info(),
            ctx.accounts.pool_fee.clone().to_account_info(),
        ];

        // set data for swap instruction
        let data = Swap {
            amount_in: amount_in,
            minimum_amount_out: minimum_amount_out,
        };

        // create swap instruction
        let ix = swap(
            &ctx.accounts.token_swap_program.clone().key(),
            &ctx.accounts.token_program.clone().key(),
            &ctx.accounts.amm.clone().key(),
            &ctx.accounts.amm_authority.clone().key(),
            &ctx.accounts.user.clone().key(),
            &ctx.accounts.source.clone().key(),
            &ctx.accounts.swap_source.clone().key(),
            &ctx.accounts.swap_destination.clone().key(),
            &ctx.accounts.destination.clone().key(),
            &ctx.accounts.pool_mint.clone().key(),
            &ctx.accounts.pool_fee.clone().key(),
            None,
            data,
        )?;

        // swap tokens
        // TODO: how to do without match
        match anchor_lang::solana_program::program::invoke(&ix, &accounts) {
            Ok(_) => Ok(()),
            Err(e) => Err(e.into()),
        }
    }
}

#[derive(Accounts)]
pub struct SwapTokens<'info> {
    // swap mints
    #[account()]
    pub destination_mint: Account<'info, token::Mint>,
    #[account()]
    pub source_mint: Account<'info, token::Mint>,

    // user token accounts
    #[account(mut, associated_token::mint = destination_mint, associated_token::authority = user)]
    pub destination: Box<Account<'info, token::TokenAccount>>,
    #[account(mut, associated_token::mint = source_mint, associated_token::authority = user)]
    pub source: Box<Account<'info, token::TokenAccount>>,

    // swap program token accounts
    #[account(mut)]
    pub swap_destination: Box<Account<'info, token::TokenAccount>>,
    #[account(mut)]
    pub swap_source: Box<Account<'info, token::TokenAccount>>,

    // LP mint
    #[account(mut)]
    pub pool_mint: Account<'info, token::Mint>,

    /// CHECK: not dangerous
    #[account()]
    pub amm: AccountInfo<'info>,

    /// CHECK: not dangerous
    #[account(mut)]
    pub amm_authority: AccountInfo<'info>,

    // fees go here
    #[account(mut)]
    pub pool_fee: Account<'info, token::TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: not dangerous
    pub token_swap_program: AccountInfo<'info>,
    pub token_program: Program<'info, token::Token>,
    pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
