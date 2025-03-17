use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
    program_error::ProgramError
};
use sha2::{Sha256, Digest};

#[derive(Debug)]
pub struct SignatureRecord {
    signature: String,
    password_hash: [u8; 32],
}

entrypoint!(process_instruction);

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let operation = instruction_data[0];
    let password = String::from_utf8(instruction_data[1..].to_vec()).map_err(|_| ProgramError::InvalidArgument)?;

    match operation {
        0 => {
            let signature = String::from_utf8(accounts[0].data.borrow().to_vec())
                .map_err(|_| ProgramError::InvalidArgument)?;
            
            let record = SignatureRecord::create_signature(signature, &password);
            accounts[1].serialize_data(&record)?;
            msg!("Signature created successfully");
        }
        1 => {
            let record = accounts[0].deserialize_data::<SignatureRecord>()?;
            let signature = record.verify_and_view(&password)?;
            msg!("Authorized access. Signature: {}", signature);
        }
        _ => return Err(ProgramError::InvalidInstructionData)
    }

    Ok(())
}

impl SignatureRecord {
    pub fn create_signature(signature: String, password: &str) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        let password_hash = hasher.finalize().into();
        
        SignatureRecord {
            signature,
            password_hash
        }
    }

    pub fn verify_and_view(&self, password: &str) -> Result<&str, ProgramError> {
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        let attempt_hash = hasher.finalize();

        if attempt_hash.as_slice() == &self.password_hash {
            Ok(&self.signature)
        } else {
            Err(ProgramError::InvalidArgument)
        }
    }
}