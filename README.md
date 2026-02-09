# Unused CSS Scanner 🔍

[![npm version](https://badge.fury.io/js/unused-css-scanner.svg)](https://www.npmjs.com/package/unused-css-scanner)
[![npm downloads](https://img.shields.io/npm/dm/unused-css-scanner.svg)](https://www.npmjs.com/package/unused-css-scanner)
[![CI](https://github.com/JadhavC07/unused-css-scanner/workflows/CI/badge.svg)](https://github.com/JadhavC07/unused-css-scanner/actions)
[![codecov](https://codecov.io/gh/JadhavC07/unused-css-scanner/branch/main/graph/badge.svg)](https://codecov.io/gh/JadhavC07/unused-css-scanner)

A production-grade npm package to scan React Native and React files to find and remove unused CSS classes and StyleSheet definitions with safety features like backups, git checks, and dry-run mode.

## ✨ Features

- ✅ **Scans React Native** `StyleSheet.create()` definitions
- ✅ **Detects unused styles** in your components
- ✅ **Multiple detection patterns** (direct, aliased, spread, bracket notation)
- ✅ **Automatic backups** before deletion
- ✅ **Git safety checks** to prevent accidental loss
- ✅ **Dry-run mode** to preview changes
- ✅ **Interactive & non-interactive** modes
- ✅ **Configuration file** support
- ✅ **JSON output** for CI/CD integration
- ✅ **TypeScript** with full type definitions
- ✅ **Comprehensive test suite** (80%+ coverage)
- ✅ **ESLint & Prettier** configured
- ✅ **GitHub Actions** CI/CD

## 📦 Installation

```bash
npm install unused-css-scanner --save-dev
# or
yarn add unused-css-scanner --dev
# or
pnpm add unused-css-scanner --dev
```

## 🚀 Quick Start

### Interactive Mode (Recommended)

```bash
npx unused-css-scanner
```

This will:
1. Show available folders
2. Let you select what to scan
3. Display detailed reports
4. Ask permission before deleting

### Command Line

```bash
# Scan specific folder
npx unused-css-scanner src/

# Scan single file
npx unused-css-scanner src/HomeScreen.tsx

# Dry run (see what would be deleted)
npx unused-css-scanner --dry-run src/

# JSON output for CI/CD
npx unused-css-scanner --format json src/
```

## 📖 Usage Examples

### Basic Usage

```bash
# Interactive mode
unused-css-scanner

# Scan folder
unused-css-scanner src/components

# Scan file
unused-css-scanner src/App.tsx
```

### With Options

```bash
# Dry run (no files modified)
unused-css-scanner --dry-run src/

# Don't create backups
unused-css-scanner --no-backup src/

# Skip git safety checks
unused-css-scanner --no-git-check src/

# Use custom config
unused-css-scanner --config .myconfig.json src/

# JSON output
unused-css-scanner --format json src/
```

### Programmatic API

```typescript
import { UnusedCSSScanner } from 'unused-css-scanner';

// Create scanner instance
const scanner = new UnusedCSSScanner({
  files: ['src/HomeScreen.tsx', 'src/Profile.tsx'],
  extensions: ['.tsx', '.ts', '.jsx', '.js'],
  ignorePatterns: [/node_modules/, /\.test\./],
  dryRun: false,
  backup: true,
  checkGit: true,
});

// Scan files
const { results, report, totalUnused, usageRate } = scanner.scan();

console.log(report);
console.log(`Found ${totalUnused} unused styles`);
console.log(`Usage rate: ${usageRate.toFixed(2)}%`);

// Delete unused styles
for (const result of results) {
  if (result.unusedStyles.length > 0) {
    const deleteResult = scanner.deleteUnusedStyles(
      result.file,
      result.unusedStyles
    );
    
    if (deleteResult.success) {
      console.log(`✅ Deleted ${deleteResult.deletedCount} styles from ${result.file}`);
      if (deleteResult.backup) {
        console.log(`💾 Backup: ${deleteResult.backup.backupPath}`);
      }
    }
  }
}
```

## ⚙️ Configuration

Create `.unusedcssrc.json` in your project root:

```json
{
  "ignore": [
    "node_modules/**",
    "**/*.test.*",
    "**/*.spec.*",
    "dist/**",
    "build/**"
  ],
  "extensions": [".tsx", ".ts", ".jsx", ".js"],
  "autoFix": false,
  "backup": true,
  "checkGit": true,
  "dryRun": false,
  "thresholds": {
    "maxStylesPerFile": 50,
    "minUsageRate": 80
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ignore` | `string[]` | `['node_modules/**', ...]` | Patterns to ignore |
| `extensions` | `string[]` | `['.tsx', '.ts', '.jsx', '.js']` | File extensions to scan |
| `autoFix` | `boolean` | `false` | Auto-delete unused styles |
| `backup` | `boolean` | `true` | Create backups before deletion |
| `checkGit` | `boolean` | `true` | Check git status before modifications |
| `dryRun` | `boolean` | `false` | Preview changes without modifying |
| `thresholds.maxStylesPerFile` | `number` | `50` | Warn if file has too many styles |
| `thresholds.minUsageRate` | `number` | `80` | Warn if usage rate is too low |

## 🔍 Detection Patterns

The scanner detects these patterns:

```tsx
// Direct access
<View style={styles.container} />

// Bracket notation
<View style={styles["container"]} />

// Aliasing
const s = styles;
<View style={s.container} />

// Spread operator
<View style={{ ...styles.container }} />

// Array of styles
<View style={[styles.container, styles.padding]} />
```

## 🛡️ Safety Features

### 1. Automatic Backups

Before deleting any styles, backups are automatically created:

```
.unused-css-backups/
  ├── HomeScreen.tsx.1707417600000.backup
  └── Profile.tsx.1707417601000.backup
```

Disable with `--no-backup` flag or `"backup": false` in config.

### 2. Git Safety Checks

The tool checks:
- ✓ Is this a git repository?
- ✓ Are there uncommitted changes?
- ✓ Current branch name

If unsafe, you'll see a warning. Bypass with `--no-git-check`.

### 3. Dry Run Mode

Preview changes without modifying files:

```bash
unused-css-scanner --dry-run src/
```

## 📊 Output Formats

### Text (Default)

```
📊 Unused CSS/Style Classes Report
════════════════════════════════════════════

📄 File: src/HomeScreen.tsx
   Total Defined: 15 | Used: 8 | Unused: 7

   ❌ unusedStyle1 (line 45)
   ❌ unusedStyle2 (line 52)
   ...

════════════════════════════════════════════
📈 Summary:
   Total Styles Defined: 50
   Total Styles Used: 35
   Total Styles Unused: 15
   Usage Rate: 70.00%
```

### JSON

```bash
unused-css-scanner --format json src/
```

```json
[
  {
    "file": "src/HomeScreen.tsx",
    "definedStyles": [
      { "name": "container", "startLine": 10, "endLine": 12 }
    ],
    "usedStyles": ["container"],
    "unusedStyles": []
  }
]
```

## 🔧 CI/CD Integration

### GitHub Actions

```yaml
name: Check Unused Styles

on: [push, pull_request]

jobs:
  check-styles:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npx unused-css-scanner --format json src/ > unused-styles.json
      - run: |
          if [ $(jq '[.[] | .unusedStyles | length] | add' unused-styles.json) -gt 0 ]; then
            echo "Found unused styles!"
            exit 1
          fi
```

### Package.json Scripts

```json
{
  "scripts": {
    "lint:css": "unused-css-scanner src/",
    "lint:css:fix": "unused-css-scanner src/ --auto-fix",
    "precommit": "unused-css-scanner --dry-run src/",
    "ci:check-styles": "unused-css-scanner --format json src/"
  }
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure tests pass (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📝 API Reference

### `UnusedCSSScanner`

#### Constructor

```typescript
new UnusedCSSScanner(options?: ScanOptions)
```

#### Methods

- `scanFile(filePath: string): StyleUsage | null`
- `scanFiles(files?: string[]): StyleUsage[]`
- `scanDirectory(dirPath: string): StyleUsage[]`
- `scan(files?: string[]): ScanResult`
- `deleteUnusedStyles(filePath: string, unusedStyles: StyleDefinition[]): DeleteResult`
- `generateReport(results: StyleUsage[]): string`
- `checkSafety(): boolean`
- `getBackupManager(): BackupManager`

### Types

```typescript
interface StyleDefinition {
  name: string;
  startLine: number;
  endLine: number;
  startPos: number;
  endPos: number;
}

interface StyleUsage {
  file: string;
  definedStyles: StyleDefinition[];
  usedStyles: string[];
  unusedStyles: StyleDefinition[];
}

interface ScanResult {
  results: StyleUsage[];
  report: string;
  totalDefined: number;
  totalUsed: number;
  totalUnused: number;
  usageRate: number;
}

interface DeleteResult {
  success: boolean;
  file: string;
  deletedCount: number;
  backup?: BackupInfo;
  error?: string;
}
```

## 🐛 Troubleshooting

### "No files modified" but I expected changes

- Check if `--dry-run` flag is set
- Verify git status (uncommitted changes may block modifications)
- Check ignore patterns in config

### Backup files not being created

- Ensure `backup: true` in config
- Check disk space
- Verify write permissions

### Git safety warnings

```bash
# Commit your changes first
git add .
git commit -m "Save work before cleanup"

# Or disable git checks
unused-css-scanner --no-git-check src/
```

## 📄 License

MIT © Chandan Jadhav

## 🙏 Acknowledgments

- Built with [TypeScript](https://www.typescriptlang.org/)
- Uses [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- Tested with [Jest](https://jestjs.io/)

---

**Made with ❤️ for cleaner React Native codebases**

📦 [npm](https://www.npmjs.com/package/unused-css-scanner) | 🐙 [GitHub](https://github.com/JadhavC07/unused-css-scanner) | 🐛 [Issues](https://github.com/JadhavC07/unused-css-scanner/issues)
