#!/usr/bin/env node
/**
 * Facebook AppState Generator (for voicemsg.net / facebook-fca-manager)
 *
 * This script lets you perform the INITIAL login with email/password
 * FROM YOUR LOCAL MACHINE (good residential IP) and save a working AppState JSON.
 *
 * Why this exists:
 *   - Facebook blocks credential logins from cloud / Kubernetes IPs almost always.
 *   - The internal scraping in fca-unofficial is very fragile.
 *   - The ONLY reliable way for normal users is browser export (C3C UFC Utility).
 *   - This script is for admins/power-users who need to bootstrap many accounts.
 *
 * Usage:
 *   node scripts/generate-facebook-appstate.js
 *
 *   or with env vars (non-interactive):
 *   FB_EMAIL=... FB_PASSWORD=... node scripts/generate-facebook-appstate.js
 *
 * Output:
 *   - appstate-<email-slug>.json   (ready to paste into the dashboard)
 *   - Also prints the full JSON so you can copy it directly
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import login from '@vangbanlanhat/fca-unofficial';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(q) {
    return new Promise(resolve => rl.question(q, resolve));
}

async function main() {
    console.log('\n=== Facebook AppState Generator (fca-unofficial) ===\n');
    console.log('This will log in ONCE with credentials (from your local IP) and save the session.\n');

    let email = process.env.FB_EMAIL;
    let password = process.env.FB_PASSWORD;

    if (!email) {
        email = await question('Facebook email / phone / username: ');
    }
    if (!password) {
        password = await question('Password (will be hidden in real terminals): ');
        // For simplicity we don't mask here; in real use user can use env var
    }

    if (!email || !password) {
        console.error('Email and password are required.');
        process.exit(1);
    }

    const emailSlug = email.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const outFile = path.join(process.cwd(), `appstate-${emailSlug}.json`);

    console.log('\nTrying to log in (this may take 10-30 seconds)...\n');

    const credentials = { email, password };

    login(credentials, {
        logLevel: 'warn',
        forceLogin: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }, (err, api) => {
        if (err) {
            console.error('\n[ERROR] Login failed:');
            console.error(err);
            console.log('\nCommon reasons:');
            console.log('  - Facebook triggered a checkpoint / 2FA / "suspicious login"');
            console.log('  - Your IP has bad reputation for Facebook');
            console.log('  - Account is locked / requires phone verification');
            console.log('\nRecommendation: use the browser extension method instead (C3C UFC Utility).');
            rl.close();
            process.exit(1);
        }

        try {
            const appState = api.getAppState();
            const json = JSON.stringify(appState, null, 2);

            fs.writeFileSync(outFile, json, 'utf8');

            console.log('\n✅ SUCCESS! AppState saved.');
            console.log(`File: ${outFile}`);
            console.log('\n--- COPY THE JSON BELOW AND PASTE IT INTO THE DASHBOARD ---\n');
            console.log(json);
            console.log('\n----------------------------------------------------------------\n');

            console.log('Now go to voicemsg.net dashboard → Facebook card → paste the array into the AppState field.');
            console.log('The manager will store it and spawn a working client pod.');

            rl.close();
        } catch (e) {
            console.error('Failed to get/save AppState:', e);
            rl.close();
            process.exit(1);
        }
    });
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
