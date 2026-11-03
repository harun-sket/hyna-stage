#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import os from 'node:os';
import readline from 'node:readline/promises';

const VERSION = '2.1.0';
const CONFIG_PATH = path.join(os.homedir(), '.hyna-stage');
const BASE_URL = process.env.HYNA_BASE_URL || 'https://mczesspakhkomlnmfstw.supabase.co/functions/v1';

const program = new Command();
program.name('hyna-stage').description('Ephemeral cloud sandboxes in seconds').version(VERSION).addHelpCommand(false);

// --- CUSTOM HELP MENU ---
program.command('help').action(() => {
  console.log(`
${chalk.bold.cyan('HYNA-Stage CLI')} ${chalk.dim(`v${VERSION}`)}
Ephemeral cloud sandboxes in seconds.

${chalk.bold('USAGE')}
  $ hyna-stage <command> [options]

${chalk.bold('AUTH')}
  ${chalk.cyan('login')} [username]        Sign in (prompts for password)
  ${chalk.cyan('whoami')}                  Show current session

${chalk.bold('SANDBOXES')}
  ${chalk.cyan('up')} <file>               Deploy a sandbox
    ${chalk.dim('-n, --name <name>')}        Name this sandbox
    ${chalk.dim('-t, --ttl <seconds>')}      Time-to-live (default 600)
  ${chalk.cyan('watch')} <file>            Live-reload a sandbox on file save
  ${chalk.cyan('open')}                    Open the last deployed sandbox
  ${chalk.cyan('down')} <id>               Destroy a sandbox

${chalk.bold('GLOBAL')}
  ${chalk.dim('-v, --version')}            Show version
  ${chalk.dim('-h, --help')}               Show help
`);
});

// --- CONFIG ---
function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8').trim();
    return raw.startsWith('{') ? JSON.parse(raw) : { token: raw };
  } catch { return {}; }
}

function writeConfig(c) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2), { mode: 0o600 });
}

function requireAuth() {
  const c = readConfig();
  if (!c.token) { 
    console.error(chalk.red('✖ Not logged in. Run: ') + chalk.cyan('hyna-stage login'));
    process.exit(1); 
  }
  return c;
}

// --- API ---
async function api(endpoint, { body, auth = true, method = 'POST' } = {}) {
  const cfg = readConfig();
  const headers = { 'Content-Type': 'application/json', 'x-hyna-key': 'hyna_xc5ub3l52qh' };
  if (auth) headers.Authorization = `Bearer ${cfg.token}`;
  
  const res = await fetch(`${BASE_URL}/${endpoint}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; 
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  
  if (!res.ok) throw new Error(data?.error || data?.message || res.statusText);
  return data;
}

// --- OPEN IN BROWSER HELPER ---
function openBrowser(url) {
  let cmd;
  if (process.platform === 'android' || process.env.PREFIX?.includes('com.termux')) {
    cmd = `termux-open-url "${url}"`;
  } else if (process.platform === 'darwin') {
    cmd = `open "${url}"`;
  } else if (process.platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => { 
    if (err) console.log('⚠️ Could not open browser automatically. Please copy the URL above.'); 
  });
}

// --- LOGIN ---
program.command('login')
  .argument('[username]', 'Username')
  .option('-p, --password <password>', 'Password')
  .action(async (username, opts) => {
    let user = username;
    if (!user) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      user = (await rl.question(chalk.cyan('Username: '))).trim(); 
      rl.close();
    }
    let pass = opts.password;
    if (!pass) {
      process.stdout.write(chalk.cyan('Password: '));
      pass = await new Promise((resolve) => {
        const stdin = process.stdin; stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
        let buf = '';
        stdin.on('data', (ch) => {
          if (ch === '\r' || ch === '\n') { stdin.setRawMode(false); stdin.pause(); process.stdout.write('\n'); resolve(buf); }
          else if (ch === '\u0003') { process.exit(130); }
          else if (ch === '\u007f') { buf = buf.slice(0, -1); }
          else { buf += ch; }
        });
      });
    }
    
    const spinner = ora('Authenticating...').start();
    try {
      const d = await api('login', { auth: false, body: { username: user, password: pass } });
      writeConfig({ username: user, token: d.token || d.access_token, baseUrl: BASE_URL });
      spinner.succeed(chalk.green(`Signed in as ${chalk.bold(user)}`));
    } catch (e) { 
      spinner.fail(chalk.red(e.message)); 
    }
  });

// --- WHOAMI ---
program.command('whoami').action(() => {
  const c = readConfig();
  if (c.token) {
    console.log(`Signed in as ${chalk.cyan(c.username)} -> ${chalk.dim(BASE_URL)}`);
  } else {
    console.log(chalk.yellow('Not logged in.'));
  }
});

// --- DEPLOY LOGIC (Shared by up & watch) ---
async function deployFile(file, opts, isWatch = false) {
  if (!fs.existsSync(file)) { 
    console.error(chalk.red(`✖ File not found: ${file}`)); 
    if (!isWatch) process.exit(1); 
    return;
  }
  
  const content = fs.readFileSync(file, 'utf8');
  const spinner = ora(isWatch ? 'Redeploying update...' : 'Provisioning Firecracker MicroVM...').start();
  
  try {
    const d = await api('deploy-stage', { body: { file: path.basename(file), name: opts.name, ttl: Number(opts.ttl), content } });
    spinner.succeed(chalk.green(isWatch ? 'Update deployed!' : 'Sandbox is live\n'));
    
    console.log(`  ${chalk.dim('ID')}    ${d.id}`);
    console.log(`  ${chalk.dim('URL')}   ${chalk.cyan.underline(d.url)}`);
    console.log(`  ${chalk.dim('TTL')}   ${d.ttl}s\n`);

    // Save last URL to config so 'open' works
    const cfg = readConfig();
    cfg.lastUrl = d.url;
    writeConfig(cfg);

    if (!isWatch) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      await rl.question(chalk.gray('Press [Enter] to open in browser (or Ctrl+C to exit)...'));
      rl.close();

      const proxyUrl = `https://hyna-verify-proxy.harun-sket.deno.net?url=${encodeURIComponent(d.url)}`;
      console.log(`  ${chalk.dim('VERIFY')} ${chalk.cyan.underline(proxyUrl)}\n`);
      openBrowser(proxyUrl);
      console.log(chalk.green('\n✔ Opened in browser!\n'));
    }
  } catch (e) { 
    spinner.fail(chalk.red(e.message)); 
  }
}

// --- UP ---
program.command('up')
  .argument('<file>', 'File to deploy')
  .option('-n, --name <name>', 'Sandbox name')
  .option('-t, --ttl <seconds>', 'Time-to-live', '600')
  .action(async (file, opts) => {
    requireAuth();
    const content = fs.readFileSync(file, 'utf8');
    const spinner = ora(`Uploading ${file} to E2B...`).start();
    try {
      const d = await api('deploy-stage', { body: { file: path.basename(file), name: opts.name, ttl: Number(opts.ttl), content } });
      spinner.succeed(chalk.green('Sandbox is live\n'));

      console.log(`  ${chalk.dim('ID')}    ${d.id}`);
      console.log(`  ${chalk.dim('URL')}   ${chalk.cyan.underline(d.url)}`);
      console.log(`  ${chalk.dim('TTL')}   ${d.ttl}s\n`);

      const proxyUrl = `https://hyna-verify-proxy.harun9842245.workers.dev?url=${encodeURIComponent(d.url)}`;
      console.log(`  ${chalk.dim('VERIFY')} ${chalk.cyan.underline(proxyUrl)}\n`);

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      await rl.question(chalk.gray('Press [Enter] to open in browser (or Ctrl+C to exit)...'));
      rl.close();

      openBrowser(proxyUrl);
      console.log(chalk.green('\n✔ Opened in browser!\n'));
    } catch (e) {
      spinner.fail(chalk.red(e.message));
    }
  });

// --- WATCH (Live Reload) ---
program.command('watch')
  .argument('<file>', 'File to watch and redeploy')
  .option('-n, --name <name>', 'Sandbox name')
  .option('-t, --ttl <seconds>', 'Time-to-live', '600')
  .action(async (file, opts) => {
    requireAuth();
    console.log(chalk.cyan(`
👀 Watching ${chalk.bold(file)} for changes... (Ctrl+C to stop)
`));
    
    await deployFile(file, opts, true);
    
    let isDeploying = false;
    let debounceTimer = null;

    fs.watch(file, (eventType) => {
      if (eventType === 'change') {
        if (debounceTimer) clearTimeout(debounceTimer);
        
        debounceTimer = setTimeout(async () => {
          if (isDeploying) return;
          isDeploying = true;
          console.log(chalk.yellow(`
[watch] Change detected! Triggering hot reload...`));
          await deployFile(file, opts, true);
          isDeploying = false;
        }, 800); // 800ms debounce
      }
    });
  });

// --- OPEN ---
program.command('open').action(() => {
  const c = readConfig();
  if (c.lastUrl) {
    console.log(chalk.cyan(`Opening last sandbox: ${c.lastUrl}`));
    openBrowser(c.lastUrl);
  } else {
    console.log(chalk.yellow('No recent sandbox found. Deploy one first.'));
  }
});

// --- DOWN ---
program.command('down')
  .argument('<id>', 'Sandbox ID')
  .action(async (id) => {
    requireAuth();
    const spinner = ora(`Destroying sandbox ${id}...`).start();
    try {
      await api('destroy-stage', { body: { sandbox_id: id } });
      spinner.succeed(chalk.green(`Sandbox ${id} destroyed`));
    } catch (e) { 
      spinner.fail(chalk.red(e.message)); 
    }
  });

// --- HIDDEN EASTER EGG ---
program.command('planet', { hidden: true }).action(async () => {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const globe = [
        "          .-'''''-.",
        "        .'  .-'-.'  '.",
        "       /   /     \\   \\",
        "      |   |   .   |   |",
        "      |   |       |   |",
        "       \\   \\     /   /",
        "        '.  '-.-'  .'",
        "          '-.....-'"
    ];
    console.log("");
    for (const line of globe) { console.log(chalk.cyan(line)); await sleep(60); }
    console.log(chalk.green.bold("\n🌍 HACKING THE PLANET..."));
    console.log(chalk.cyan.italic("Just kidding. Go build something real. 🌱\n"));
});


// --- INIT (FORGE) ---
program.command('init')
  .argument('<template>', 'Template to scaffold (node, python, java, html)')
  .option('-t, --ttl <seconds>', 'Time-to-live', '600')
  .action(async (template, opts) => {
    requireAuth();
    
    const validTemplates = ['node', 'python', 'java', 'html'];
    if (!validTemplates.includes(template)) {
      console.error(chalk.red(`✖ Invalid template. Choose from: ${validTemplates.join(', ')}`));
      process.exit(1);
    }

    const spinner = ora(`Forge: Scaffolding ${chalk.bold(template)} environment...`).start();
    
    try {
      const d = await api('deploy-stage', { body: { template, ttl: Number(opts.ttl) } });
      
      spinner.succeed(chalk.green(`${template} environment is live\n`));
      
      console.log(`  ${chalk.dim('ID')}    ${d.id}`);
      console.log(`  ${chalk.dim('URL')}   ${chalk.cyan.underline(d.url)}`);
      console.log(`  ${chalk.dim('TTL')}   ${d.ttl}s\n`);

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      await rl.question(chalk.gray('Press [Enter] to open in browser (or Ctrl+C to exit)...'));
      rl.close();

      const proxyUrl = `https://hyna-verify-proxy.harun9842245.workers.dev?url=${encodeURIComponent(d.url)}`;
      console.log(`  ${chalk.dim('VERIFY')} ${chalk.cyan.underline(proxyUrl)}\n`);
      openBrowser(proxyUrl);
      console.log(chalk.green('\n✔ Opened in browser!\n'));
    } catch (e) { 
      spinner.fail(chalk.red(e.message)); 
    }
  });


program.command('templates')
  .description('List available templates from the HYNA Marketplace')
  .action(async () => {
    const spinner = ora('Fetching HYNA Marketplace...').start();
    try {
      const res = await fetch('https://hyna-verify-proxy.harun9842245.workers.dev/templates');
      const data = await res.json();
      spinner.succeed(chalk.green('Available Templates:\n'));
      
      for (const [name, config] of Object.entries(data)) {
        console.log(`  ${chalk.cyan.bold(name)} - Port: ${config.port}`);
      }
      console.log('\n' + chalk.gray('Run: hyna-stage init <template> to forge one.'));
    } catch (e) {
      spinner.fail(chalk.red('Could not fetch marketplace: ' + e.message));
    }
  });


program.parseAsync(process.argv).catch((e) => { console.error(chalk.red(`✖ ${e.message}`)); process.exit(1); });
