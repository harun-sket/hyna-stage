#!/usr/bin/env node

import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os'; // Import OS to find the home directory
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

const DEPLOY_URL = "https://mczesspakhkomlnmfstw.supabase.co/functions/v1/deploy-stage";
const DESTROY_URL = "https://mczesspakhkomlnmfstw.supabase.co/functions/v1/destroy-stage";

// Helper function to auto-detect file type
function detectType(file) {
    const ext = path.extname(file).toLowerCase();
    if (['.html', '.htm', '.css'].includes(ext)) return 'html';
    if (['.js', '.cjs', '.mjs'].includes(ext)) return 'node';
    if (['.py'].includes(ext)) return 'python';
    if (['.java'].includes(ext)) return 'java';
    return null; // Unknown extension
}

// Helper function to save the key to .bashrc
function saveKeyToBashrc(key) {
    try {
        const bashrcPath = path.join(os.homedir(), '.bashrc');
        const saveString = `\n# HynaStage API Key\nexport HYNA_API_KEY="${key}"\n`;
        
        // Check if it already exists to avoid duplicates
        if (fs.existsSync(bashrcPath)) {
            const content = fs.readFileSync(bashrcPath, 'utf8');
            if (content.includes('HYNA_API_KEY=')) return;
        }
        
        fs.appendFileSync(bashrcPath, saveString);
        console.log(chalk.green('✅ API Key saved to ~/.bashrc! You won\'t need to enter it again in new sessions.'));
    } catch (e) {
        console.log(chalk.yellow('⚠️ Could not save key to .bashrc.'));
    }
}

program
  .name('hyna-stage')
  .description('Ephemeral cloud environments in 5 seconds.')
  .version('1.2.0');

// ── UP COMMAND ──
program
  .command('up')
  .description('Deploy a file to a temporary HYNA environment')
  .option('-f, --file <file>', 'File to deploy', 'index.html')
  .option('-t, --type <type>', 'Force project type (html, node, python, java)')
  .option('-k, --key <key>', 'Your HYNA API key (overrides .bashrc)')
  .action(async (options) => {
    
    // 1. Get API Key (CLI Flag -> Env Var -> Prompt & Save)
    let apiKey = options.key || process.env.HYNA_API_KEY;
    
    if (!apiKey) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'key',
          message: 'Enter your HYNA API Key (will be saved for next time):',
          validate: (input) => input.length > 0 ? true : 'API Key is required'
        }
      ]);
      apiKey = answers.key;
      process.env.HYNA_API_KEY = apiKey; // Set for current session
      saveKeyToBashrc(apiKey); // Save for future sessions
    }

    // 2. Check if file exists
    const filePath = path.resolve(process.cwd(), options.file);
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`❌ Error: File not found -> ${options.file}`));
      process.exit(1);
    }

    // 3. Determine Project Type
    let projectType = options.type || detectType(options.file);
    
    if (!projectType) {
      const typeAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'type',
          message: 'What is the type of the project?',
          choices: ['html', 'node', 'python', 'java']
        }
      ]);
      projectType = typeAnswer.type;
    }

    const stats = fs.statSync(filePath);
    const spinner = ora(`Spinning up ${projectType.toUpperCase()} environment...`).start();

    try {
      let fileContent = fs.readFileSync(filePath);
      const isLarge = stats.size > 50000;
      
      if (isLarge) {
        spinner.text = 'Encoding large file for transport...';
        fileContent = fileContent.toString('base64');
      } else {
        fileContent = fileContent.toString('utf-8');
      }

      spinner.text = 'Deploying to E2B MicroVM...';

      const response = await fetch(DEPLOY_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ 
            apiKey: apiKey, 
            code: fileContent, 
            isBase64: isLarge,
            type: projectType 
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Server responded with ${response.status}`);

      spinner.succeed(chalk.green('Environment is LIVE!'));
      
      console.log('');
      console.log(chalk.bgBlue.white.bold(` 🔗 URL: ${data.url} `));
      console.log(chalk.gray(`   Type: ${data.type}`));
      console.log(chalk.gray(`   Sandbox ID: ${data.sandbox_id}`));
      console.log(chalk.gray(`   (Auto-destroys in 1 hour)\n`)); // FIXED: Now says 1 hour

    } catch (err) {
      spinner.fail(chalk.red('Deployment failed'));
      console.error(chalk.red(`\n❌ ${err.message}\n`));
    }
  });

// ── DOWN COMMAND ──
program
  .command('down')
  .description('Destroy an active environment early')
  .argument('<sandbox_id>', 'The Sandbox ID to destroy')
  .option('-k, --key <key>', 'Your HYNA API key')
  .action(async (sandboxId, options) => {
    let apiKey = options.key || process.env.HYNA_API_KEY;
    
    if (!apiKey) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'key',
          message: 'Enter your HYNA API Key:',
          validate: (input) => input.length > 0 ? true : 'API Key is required'
        }
      ]);
      apiKey = answers.key;
      process.env.HYNA_API_KEY = apiKey;
      saveKeyToBashrc(apiKey);
    }

    const spinner = ora(`Destroying sandbox ${sandboxId}...`).start();

    try {
      const response = await fetch(DESTROY_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ sandbox_id: sandboxId })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to destroy sandbox');

      spinner.succeed(chalk.green('Environment destroyed successfully!'));
      console.log(chalk.gray(`   The E2B VM has been terminated.\n`));
    } catch (err) {
      spinner.fail(chalk.red('Destroy failed'));
      console.error(chalk.red(`\n❌ ${err.message}\n`));
    }
  });

program.parse();
