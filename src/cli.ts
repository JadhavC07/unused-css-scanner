#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { UnusedCSSScanner } from './scanner';
import { FileManager } from './file-manager';
import { StyleUsage } from './types';

interface CLIOptions {
  dryRun: boolean;
  noBackup: boolean;
  noGitCheck: boolean;
  config?: string;
  format: 'text' | 'json';
  help: boolean;
  version: boolean;
}

class CLI {
  private rl: readline.Interface;
  private scanner: UnusedCSSScanner | null = null;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private async askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => resolve(answer.trim()));
    });
  }

  private parseArgs(args: string[]): { options: CLIOptions; target: string | null } {
    const options: CLIOptions = {
      dryRun: false,
      noBackup: false,
      noGitCheck: false,
      format: 'text',
      help: false,
      version: false,
    };

    let target: string | null = null;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--dry-run':
        case '-d':
          options.dryRun = true;
          break;
        case '--no-backup':
          options.noBackup = true;
          break;
        case '--no-git-check':
          options.noGitCheck = true;
          break;
        case '--config':
        case '-c':
          options.config = args[++i];
          break;
        case '--format':
        case '-f':
          const format = args[++i];
          if (format === 'json' || format === 'text') {
            options.format = format;
          }
          break;
        case '--help':
        case '-h':
        case 'help':
          options.help = true;
          break;
        case '--version':
        case '-v':
          options.version = true;
          break;
        case 'scan':
          // skip, just a command
          break;
        default:
          if (!arg.startsWith('-') && !target) {
            target = arg;
          }
      }
    }

    return { options, target };
  }

  private showHelp(): void {
    console.log(`
🔍 Unused CSS Scanner - Clean up your React Native StyleSheets

Usage:
  unused-css-scanner [options] [file/folder]

Commands:
  scan                              Start interactive mode
  <file>                            Scan a specific file
  <folder>                          Scan all files in folder
  help                              Show this help message

Options:
  --dry-run, -d                     Show what would be deleted without actually deleting
  --no-backup                       Don't create backup files
  --no-git-check                    Skip git safety checks
  --config <path>, -c <path>        Use custom config file
  --format <text|json>, -f          Output format (default: text)
  --help, -h                        Show this help
  --version, -v                     Show version

Examples:
  unused-css-scanner                     # Interactive mode
  unused-css-scanner src/                # Scan src folder
  unused-css-scanner App.tsx             # Scan single file
  unused-css-scanner --dry-run src/      # Dry run on src folder
  unused-css-scanner --format json       # JSON output for CI/CD

Config File (.unusedcssrc.json):
  {
    "ignore": ["node_modules/**", "**/*.test.*"],
    "extensions": [".tsx", ".ts", ".jsx", ".js"],
    "autoFix": false,
    "backup": true,
    "checkGit": true,
    "thresholds": {
      "maxStylesPerFile": 50,
      "minUsageRate": 80
    }
  }

Supported Patterns:
  ✓ styles.container                   # Direct access
  ✓ styles["container"]                # Bracket notation
  ✓ const s = styles; s.container      # Aliasing
  ✓ {...styles.container}              # Spread operator

📦 Package: unused-css-scanner
🔗 NPM: https://www.npmjs.com/package/unused-css-scanner
`);
  }

  private showVersion(): void {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
      );
      console.log(`unused-css-scanner v${packageJson.version}`);
    } catch {
      console.log('unused-css-scanner');
    }
  }

  private getFolders(): string[] {
    try {
      const items = fs.readdirSync(process.cwd());
      return items.filter((item) => {
        const fullPath = path.join(process.cwd(), item);
        return (
          FileManager.isDirectory(fullPath) &&
          !item.startsWith('.') &&
          !FileManager.shouldIgnore(fullPath, [/node_modules/, /dist/, /build/])
        );
      });
    } catch (error) {
      console.error('Error reading directory:', error);
      return [];
    }
  }

  async interactiveScan(options: CLIOptions): Promise<void> {
    console.log('\n🔍 Unused CSS Scanner - Interactive Mode\n');
    console.log('═'.repeat(60));

    const folders = this.getFolders();

    if (folders.length === 0) {
      console.log('\n❌ No folders found in current directory.');
      return;
    }

    console.log('\n📁 Available folders:\n');
    folders.forEach((folder, index) => {
      console.log(`   ${index + 1}) ${folder}`);
    });
    console.log(`   ${folders.length + 1}) Enter custom path`);
    console.log(`   0) Scan current directory (.)\n`);

    const folderChoice = await this.askQuestion('Choose a folder (enter number): ');

    let selectedPath: string;

    if (folderChoice === '0') {
      selectedPath = '.';
    } else {
      const choice = parseInt(folderChoice);
      if (choice === folders.length + 1) {
        selectedPath = await this.askQuestion('\n📁 Enter folder or file path: ');
      } else if (choice >= 1 && choice <= folders.length) {
        selectedPath = folders[choice - 1];
      } else {
        console.log('\n❌ Invalid choice.');
        return;
      }
    }

    if (!FileManager.exists(selectedPath)) {
      console.log(`\n❌ Path not found: ${selectedPath}`);
      return;
    }

    this.scanner = new UnusedCSSScanner({
      dryRun: options.dryRun,
      backup: !options.noBackup,
      checkGit: !options.noGitCheck,
      configPath: options.config,
    });

    if (FileManager.isFile(selectedPath)) {
      await this.scanSingleFileInteractive(selectedPath);
      return;
    }

    const allFiles = FileManager.getAllFiles(selectedPath, ['.tsx', '.ts', '.jsx', '.js']);

    if (allFiles.length === 0) {
      console.log(`\n❌ No .tsx/.jsx/.ts/.js files found in ${selectedPath}`);
      return;
    }

    console.log(`\n✅ Found ${allFiles.length} file(s) in ${selectedPath}\n`);

    await this.scanAllFiles(allFiles);
  }

  private async scanSingleFileInteractive(file: string): Promise<void> {
    console.log(`\n🔍 Scanning ${file}...\n`);

    if (!this.scanner) return;

    const result = this.scanner.scanFile(file);

    if (!result || result.definedStyles.length === 0) {
      console.log('   ℹ️  No styles found in this file.\n');
      return;
    }

    if (result.unusedStyles.length === 0) {
      console.log('   ✅ No unused styles! This file is clean.\n');
      console.log(`   Total Styles: ${result.definedStyles.length} | All Used: ${result.usedStyles.length}\n`);
      return;
    }

    console.log(`   Total Defined: ${result.definedStyles.length} | Used: ${result.usedStyles.length} | Unused: ${result.unusedStyles.length}\n`);

    result.unusedStyles.forEach((style) => {
      console.log(`   ❌ ${style.name} (line ${style.startLine})`);
    });

    const deleteChoice = await this.askQuestion('\n   🗑️  Delete unused styles? (yes/no): ');

    if (deleteChoice.toLowerCase() === 'yes' || deleteChoice.toLowerCase() === 'y') {
      const deleteResult = this.scanner.deleteUnusedStyles(file, result.unusedStyles);
      if (deleteResult.success) {
        console.log(`   ✅ Removed ${deleteResult.deletedCount} unused style(s)`);
        if (deleteResult.backup) {
          console.log(`   💾 Backup created: ${deleteResult.backup.backupPath}`);
        }
      } else {
        console.log(`   ❌ Failed: ${deleteResult.error}`);
      }
    } else {
      console.log('   ❌ Skipped\n');
    }
  }

  private async scanAllFiles(files: string[]): Promise<void> {
    console.log('\n🔄 Scanning all files...\n');

    if (!this.scanner) return;

    const results: StyleUsage[] = [];

    for (const file of files) {
      const result = this.scanner.scanFile(file);
      if (result && result.definedStyles.length > 0) {
        results.push(result);
      }
    }

    const report = this.scanner.generateReport(results);
    console.log(report);

    const hasUnused = results.some((r) => r.unusedStyles.length > 0);

    if (hasUnused) {
      const deleteChoice = await this.askQuestion('\n🗑️  Delete all unused styles? (yes/no): ');

      if (deleteChoice.toLowerCase() === 'yes' || deleteChoice.toLowerCase() === 'y') {
        console.log('\n🔄 Deleting unused styles...\n');

        for (const result of results) {
          if (result.unusedStyles.length > 0) {
            const deleteResult = this.scanner.deleteUnusedStyles(result.file, result.unusedStyles);
            if (deleteResult.success) {
              console.log(`✅ Removed ${deleteResult.deletedCount} unused style(s) from ${result.file}`);
            }
          }
        }

        console.log('\n✅ Cleanup complete!');
      } else {
        console.log('\n❌ Cleanup cancelled.');
      }
    }
  }

  async run(args: string[]): Promise<void> {
    const { options, target } = this.parseArgs(args);

    if (options.help) {
      this.showHelp();
      this.close();
      return;
    }

    if (options.version) {
      this.showVersion();
      this.close();
      return;
    }

    if (!target || target === 'scan') {
      await this.interactiveScan(options);
      this.close();
      return;
    }

    // Non-interactive mode
    if (!FileManager.exists(target)) {
      console.error(`❌ File or folder not found: ${target}`);
      this.close();
      process.exit(1);
    }

    this.scanner = new UnusedCSSScanner({
      dryRun: options.dryRun,
      backup: !options.noBackup,
      checkGit: !options.noGitCheck,
      configPath: options.config,
    });

    // Safety check
    if (!options.noGitCheck && !options.dryRun) {
      this.scanner.checkSafety();
    }

    const results: StyleUsage[] = [];

    if (FileManager.isDirectory(target)) {
      const files = FileManager.getAllFiles(target, ['.tsx', '.ts', '.jsx', '.js']);
      console.log(`\n🔍 Scanning ${files.length} files in ${target}...\n`);

      for (const file of files) {
        const result = this.scanner.scanFile(file);
        if (result && result.definedStyles.length > 0) {
          results.push(result);
        }
      }
    } else {
      console.log(`\n🔍 Scanning ${target}...\n`);
      const result = this.scanner.scanFile(target);
      if (result && result.definedStyles.length > 0) {
        results.push(result);
      }
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(results, null, 2));
    } else {
      const report = this.scanner.generateReport(results);
      console.log(report);

      if (options.dryRun) {
        console.log('\n💡 This was a dry run. No files were modified.');
      }
    }

    this.close();

    if (results.some((r) => r.unusedStyles.length > 0)) {
      process.exit(1);
    }
  }

  close(): void {
    this.rl.close();
    if (this.scanner) {
      this.scanner.clear();
    }
  }
}

if (require.main === module) {
  const cli = new CLI();
  const args = process.argv.slice(2);

  cli.run(args).catch((error) => {
    console.error('Error:', error);
    cli.close();
    process.exit(1);
  });
}

export { CLI };
