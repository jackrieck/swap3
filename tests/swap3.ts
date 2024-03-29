import * as anchor from "@project-serum/anchor";
import * as spl from "@solana/spl-token";
import * as tokenSwap from "@solana/spl-token-swap";
import * as assert from "assert";
import { Program } from "@project-serum/anchor";
import { Swap3 } from "../target/types/swap3";

// Pool fees
const TRADING_FEE_NUMERATOR = 25;
const TRADING_FEE_DENOMINATOR = 10000;
const OWNER_TRADING_FEE_NUMERATOR = 5;
const OWNER_TRADING_FEE_DENOMINATOR = 10000;
const OWNER_WITHDRAW_FEE_NUMERATOR = 0;
const OWNER_WITHDRAW_FEE_DENOMINATOR = 0;
const HOST_FEE_NUMERATOR = 20;
const HOST_FEE_DENOMINATOR = 100;

describe("swap3", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.Swap3 as Program<Swap3>;

  it("Swap Tokens", async () => {
    const payer = await newAccountWithLamports(program.provider.connection);
    const tokenSwapAccount = new anchor.web3.Account();

    const [tokenSwapAccountAuthority, tokenSwapAccountAuthorityBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [tokenSwapAccount.publicKey.toBuffer()],
        tokenSwap.TOKEN_SWAP_PROGRAM_ID
      );

    // create pool mint, token A & B mints

    const tokenPoolMint = await spl.createMint(
      program.provider.connection,
      payer,
      tokenSwapAccountAuthority,
      null,
      2
    );
    console.log("created pool mint");

    const tokenAMint = await spl.createMint(
      program.provider.connection,
      payer,
      payer.publicKey,
      null,
      2
    );
    console.log("created token A mint");

    const tokenBMint = await spl.createMint(
      program.provider.connection,
      payer,
      payer.publicKey,
      null,
      2
    );
    console.log("created token B mint");

    const feeAccount = await spl.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      payer,
      tokenPoolMint,
      new anchor.web3.PublicKey("HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN"),
      true
    );
    console.log("fee account created");

    // create swap token accounts
    const swapPoolMintTokenAccount =
      await spl.getOrCreateAssociatedTokenAccount(
        program.provider.connection,
        payer,
        tokenPoolMint,
        payer.publicKey,
        false
      );
    const swapTokenATokenAccount = await spl.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      payer,
      tokenAMint,
      tokenSwapAccountAuthority,
      true
    );
    const swapTokenBTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      payer,
      tokenBMint,
      tokenSwapAccountAuthority,
      true
    );
    console.log("created swap pool mint token accounts");

    // mint initial tokens to swap token accounts
    await spl.mintTo(
      program.provider.connection,
      payer,
      tokenAMint,
      swapTokenATokenAccount.address,
      payer,
      100
    );
    await spl.mintTo(
      program.provider.connection,
      payer,
      tokenBMint,
      swapTokenBTokenAccount.address,
      payer,
      100
    );
    console.log("minted initial tokens to swap token accounts");

    const pool = await tokenSwap.TokenSwap.createTokenSwap(
      program.provider.connection,
      payer,
      tokenSwapAccount,
      tokenSwapAccountAuthority,
      swapTokenATokenAccount.address,
      swapTokenBTokenAccount.address,
      tokenPoolMint,
      tokenAMint,
      tokenBMint,
      feeAccount.address,
      swapPoolMintTokenAccount.address,
      tokenSwap.TOKEN_SWAP_PROGRAM_ID,
      spl.TOKEN_PROGRAM_ID,
      tokenSwapAccountAuthorityBump,
      TRADING_FEE_NUMERATOR,
      TRADING_FEE_DENOMINATOR,
      OWNER_TRADING_FEE_NUMERATOR,
      OWNER_TRADING_FEE_DENOMINATOR,
      OWNER_WITHDRAW_FEE_NUMERATOR,
      OWNER_WITHDRAW_FEE_DENOMINATOR,
      HOST_FEE_NUMERATOR,
      HOST_FEE_DENOMINATOR,
      tokenSwap.CurveType.ConstantProduct
    );

    // user ATA's
    const userTokenAATA = await spl.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      payer,
      tokenAMint,
      program.provider.wallet.publicKey
    );
    const userTokenBATA = await spl.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      payer,
      tokenBMint,
      program.provider.wallet.publicKey
    );

    // mint source tokens to user ATA
    await spl.mintTo(
      program.provider.connection,
      payer,
      tokenAMint,
      userTokenAATA.address,
      payer.publicKey,
      10
    );
    console.log("user setup complete");

    const amountIn = 10;
    const minAmountOut = 5;

    const swapTokensTxSig = await program.rpc.swapTokens(
      new anchor.BN(amountIn),
      new anchor.BN(minAmountOut),
      {
        accounts: {
          destinationMint: tokenBMint,
          sourceMint: tokenAMint,
          destination: userTokenBATA.address,
          source: userTokenAATA.address,
          swapDestination: swapTokenBTokenAccount.address,
          swapSource: swapTokenATokenAccount.address,
          poolMint: tokenPoolMint,
          amm: tokenSwapAccount.publicKey,
          ammAuthority: tokenSwapAccountAuthority,
          poolFee: feeAccount.address,
          user: program.provider.wallet.publicKey,
          tokenSwapProgram: tokenSwap.TOKEN_SWAP_PROGRAM_ID,
          tokenProgram: spl.TOKEN_PROGRAM_ID,
          associatedTokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
      }
    );
    console.log("swapTokensTxSig:", swapTokensTxSig);

    // assert we have at least min amount
    const balance = await program.provider.connection.getTokenAccountBalance(
      userTokenBATA.address
    );
    assert.ok(Number(balance.value.amount) >= minAmountOut);
  });
});

async function newAccountWithLamports(
  connection: anchor.web3.Connection,
  lamports: number = 100_000_000
): Promise<anchor.web3.Account> {
  // generate keypair
  const account = new anchor.web3.Account();

  // airdrop lamports
  let txSig = await connection.requestAirdrop(account.publicKey, lamports);
  await connection.confirmTransaction(txSig);
  console.log("airdropTxSig:", txSig);

  // check account balance
  const lamportsBalance = await connection.getBalance(account.publicKey);
  console.log("lamports balance:", lamportsBalance);

  return account;
}

// sleep current thread in seconds
async function sleep(seconds: number) {
  const ms = seconds * 1000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
