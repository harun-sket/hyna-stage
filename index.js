#!/usr/bin/env node

import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

const DEPLOY_URL = "https://mczesspakhkomlnmfstw.supabase.co/functions/v1/deploy-stage";
const DESTROY_URL = "https://mczesspakhkomlnmfstw.supabase.co/functions/v1/destroy-stage";

program
  .name('hyna-stage')
  .description('Ephemeral cloud environments in 5 seconds.')
  .version('1.0.5');

// ── UP COMMAND ──
program
  .command('up')
  .description('Deploy a file to a temporary HYNA environment')
  .option('-f, --file <file>', 'File to deploy', 'index.html')
  .option('-k, --key <key>', 'Your HYNA API key')
  .action(async (options) => {
    let apiKey = options.key;
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
    }

    const filePath = path.resolve(process.cwd(), options.file);
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`❌ Error: File not found -> ${options.file}`));
      process.exit(1);
    }

    const stats = fs.statSync(filePath);
    const spinner = ora('Spinning up cloud environment...').start();

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
        body: JSON.stringify({ apiKey: apiKey, code: fileContent, isBase64: isLarge })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Server responded with ${response.status}`);

      spinner.succeed(chalk.green('Environment is LIVE!'));
      
      console.log('');
      console.log(chalk.bgBlue.white.bold(` 🔗 URL: ${data.url} `));
      console.log(chalk.gray(`   Sandbox ID: ${data.sandbox_id}`));
      console.log(chalk.gray(`   (Auto-destroys in 5 minutes)\n`));

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
    let apiKey = options.key;
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
