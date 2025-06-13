const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } = require("@solana/spl-token");

async function main() {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Staking;
  
  console.log("Program ID:", program.programId.toString());
  console.log("Provider wallet:", provider.wallet.publicKey.toString());

  // Derive global state PDA
  const [globalState, globalStateBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    program.programId
  );

  try {
    // Initialize the program
    console.log("Initializing global state...");
    const tx = await program.methods
      .initialize(provider.wallet.publicKey)
      .accounts({
        payer: provider.wallet.publicKey,
        globalState: globalState,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Initialize transaction signature:", tx);
    console.log("Global state initialized at:", globalState.toString());
    
    // Fetch and display the global state
    const globalStateAccount = await program.account.globalState.fetch(globalState);
    console.log("Global state authority:", globalStateAccount.authority.toString());
    console.log("Total staked:", globalStateAccount.totalStaked.toString());

  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error); 