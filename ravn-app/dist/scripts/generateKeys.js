import fs from 'fs';
import path from 'path';
import { CryptoService } from '../services/cryptoService.js';
function runKeygen() {
    console.log('====================================================');
    console.log('RAVN LICENSING SYSTEM — ED25519 KEYPAIR GENERATOR');
    console.log('====================================================');
    const { publicKey, privateKey } = CryptoService.generateKeyPair();
    console.log('\n[PUBLIC KEY (Embed in macOS Swift CryptoKit)]:\n');
    console.log(publicKey);
    console.log('\n[PRIVATE KEY (Keep Secure in Backend Server)]:\n');
    console.log(privateKey);
    // Format .env
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }
    // Update or append
    const privateKeyFormatted = privateKey.replace(/\n/g, '\\n');
    if (envContent.includes('LICENSE_PRIVATE_KEY=')) {
        envContent = envContent.replace(/LICENSE_PRIVATE_KEY=.*/g, `LICENSE_PRIVATE_KEY="${privateKeyFormatted}"`);
    }
    else {
        envContent += `\nLICENSE_PRIVATE_KEY="${privateKeyFormatted}"`;
    }
    if (envContent.includes('LICENSE_PUBLIC_KEY=')) {
        envContent = envContent.replace(/LICENSE_PUBLIC_KEY=.*/g, `LICENSE_PUBLIC_KEY="${publicKey}"`);
    }
    else {
        envContent += `\nLICENSE_PUBLIC_KEY="${publicKey}"`;
    }
    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
    console.log(`\n✅ Saved keys directly to ${envPath}`);
    console.log('====================================================\n');
}
runKeygen();
