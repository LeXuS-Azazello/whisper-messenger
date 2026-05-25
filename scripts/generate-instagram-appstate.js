#!/usr/bin/env node
/**
 * Instagram AppState (Cookie Jar) Generator for voicemsg.net
 *
 * Run this LOCALLY on your machine (good IP) to bootstrap Instagram accounts.
 *
 * instagram-private-api is very sensitive to credential logins from bad IPs.
 * Use this script once per account, then always use the exported cookies.
 *
 * Usage:
 *   node scripts/generate-instagram-appstate.js
 *
 *   or env vars:
 *   IG_USERNAME=... IG_PASSWORD=... node scripts/generate-instagram-appstate.js
 *
 * The output JSON is exactly what the dashboard expects for Instagram AppState.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { IgApiClient } from 'instagram-private-api';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise(r => rl.question(q, r));

async function main() {
    console.log('\n=== Instagram AppState Generator (instagram-private-api) ===\n');
    console.log('This performs ONE credential login from your local machine and exports cookies.\n');

    let username = process.env.IG_USERNAME;
    let password = process.env.IG_PASSWORD;

    if (!username) username = await question('Instagram username: ');
    if (!password) password = await question('Password: ');

    if (!username || !password) {
        console.error('Username and password required');
        process.exit(1);
    }

    const slug = username.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const outFile = path.join(process.cwd(), `ig-appstate-${slug}.json`);

    console.log('\nLogging in to Instagram (can take 15-40s, may ask for 2FA or challenge)...\n');

    const ig = new IgApiClient();
    ig.state.generateDevice(username);

    try {
        await ig.account.login(username, password);

        // Export cookies in the format deserializeCookieJar accepts
        const cookieJar = await ig.state.serializeCookieJar();
        const appState = cookieJar.cookies || cookieJar; // array of cookie objects

        const json = JSON.stringify(appState, null, 2);
        fs.writeFileSync(outFile, json, 'utf8');

        console.log('\n✅ SUCCESS! Cookies exported.');
        console.log(`Saved to: ${outFile}`);
        console.log('\n--- PASTE THE FOLLOWING JSON INTO THE INSTAGRAM APPSTATE FIELD IN DASHBOARD ---\n');
        console.log(json);
        console.log('\n--------------------------------------------------------------------------------\n');

        console.log('The instagram-fca-manager will store this and the client pods will use cookie auth only (no more password).');

        rl.close();
    } catch (err) {
        console.error('\n[LOGIN FAILED]');
        console.error(err);
        console.log('\nCommon issues:');
        console.log('  - Instagram sent a challenge (photo verification, "suspicious login", 2FA)');
        console.log('  - Your IP is flagged');
        console.log('  - Account has login approvals enabled');
        console.log('\nIn that case the best option is manual cookie export via browser DevTools or EditThisCookie extension.');
        rl.close();
        process.exit(1);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
