#!/usr/bin/env node
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const API_URL = 'https://mczesspakhkomlnmfstw.supabase.co/functions/v1/deploy-stage';
const DESTROY_URL = 'https://mczesspakhkomlnmfstw.supabase.co/functions/v1/destroy-stage';
const SUPABASE_KEY = 'sb_publishable_sG0q8k6txKHOihBduyr67w_UKfolcvj';

const configPath = path.join(require('os').homedir(), '.hyna-stage');

async function getApiKey() {
    // Check for --key argument first (Auto-Injection)
    const keyArg = process.argv.find(arg => arg.startsWith('--key='));
    if (keyArg) {
        const key = keyArg.split('=')[1];
        fs.writeFileSync(configPath, key.trim()); // Save it for next time
        return key.trim();
    }

    // Check cache
    if (fs.existsSync(configPath)) {
        return fs.readFileSync(configPath, 'utf8').trim();
    }
    
    // Otherwise prompt
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question('🔑 Enter your HYNA-Stage API Key: ', (key) => {
            fs.writeFileSync(configPath, key.trim());
            rl.close();
            resolve(key.trim());
        });
    });
}

async function main() {
    const command = process.argv[2];
    const apiKey = await getApiKey();

    if (command === 'up') {
        console.log('🚀  Initializing HYNA-Stage...');
        console.log('📦  Spinning up cloud environment...');
        
        try {
            const res = await axios.post(API_URL, {}, {
                headers: { 
                    'Authorization': 'Bearer ' + apiKey,
                    'apikey': SUPABASE_KEY,
                    'Content-Type': 'application/json'
                }
            });

            console.log('\n✅  Environment is LIVE!');
            console.log('🔗  URL: \x1b[36m' + res.data.url + '\x1b[0m');
            console.log('🆔  Sandbox ID: ' + res.data.sandbox_id);
            console.log('⏱️  Auto-destruct in: 1 hour\n');

        } catch (err) {
            console.error('❌  Error:', err.response?.data?.error || err.message);
        }
    } 
    else if (command === 'down') {
        const sandboxId = process.argv.find(arg => !arg.startsWith('--') && arg !== 'down' && arg !== 'up');
        
        if (!sandboxId) {
            console.error('❌  Please provide a sandbox ID: hyna-stage down <sandbox_id>');
            process.exit(1);
        }

        console.log('🗑️   Destroying sandbox ' + sandboxId + '...');

        try {
            await axios.post(DESTROY_URL, { sandbox_id: sandboxId }, {
                headers: { 
                    'Authorization': 'Bearer ' + apiKey,
                    'apikey': SUPABASE_KEY,
                    'Content-Type': 'application/json'
                }
            });

            console.log('\n✅  Environment destroyed successfully.\n');

        } catch (err) {
            console.error('❌  Error:', err.response?.data?.error || err.message);
        }
    } 
    else {
        console.log('Usage:');
        console.log('  hyna-stage up              Spin up a new environment');
        console.log('  hyna-stage down <id>       Destroy a specific environment');
    }
}

main();
