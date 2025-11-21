# Unused CSS Scanner 🔍

A powerful npm package to scan React Native and React files to find unused CSS classes and StyleSheet definitions.

## Features

- ✅ Scans React Native `StyleSheet.create()` definitions
- ✅ Detects unused styles in your components
- ✅ Supports `.tsx`, `.ts`, `.jsx`, `.js` files
- ✅ Generates detailed reports with usage statistics
- ✅ CLI and programmatic API
- ✅ Customizable ignore patterns

## Installation

```bash
npm install unused-css-scanner --save-dev
# or
yarn add unused-css-scanner --dev
```

## Usage

### Interactive Mode (Recommended)

```bash
unused-css-scanner
# or
unused-css-scanner scan
```

This will:

1. Ask you which folder to scan
2. Let you choose scan mode (all at once or one by one)
3. Show detailed reports
4. Ask permission to delete unused styles

### Scan Specific Folder

```bash
unused-css-scanner src/
```

### Scan Single File

```bash
unused-css-scanner src/HomeScreen.tsx
```

### Show Help

```bash
unused-css-scanner help
# or
unused-css-scanner --help
```

### Show Version

```bash
unused-css-scanner --version
```

### Programmatic API

```typescript
import UnusedCSSScanner from "unused-css-scanner";

// Create scanner instance
const scanner = new UnusedCSSScanner({
  files: ["src/HomeScreen.tsx", "src/Profile.tsx"],
  extensions: [".tsx", ".ts", ".jsx", ".js"],
  ignorePatterns: [/node_modules/, /\.test\./],
});

// Scan files and get results
const { results, report } = scanner.scan();

console.log(report);

// Access detailed results
results.forEach((result) => {
  console.log(`File: ${result.file}`);
  console.log(`Unused styles: ${result.unusedStyles.join(", ")}`);
});
```

### Example with Your Code

Given this React Native component:

```tsx
<View style={styles.sectionHeader}>
  <Text style={styles.sectionTitle}>Popular PGs</Text>
  <TouchableOpacity onPress={allPG}>
    <Text style={styles.seeAll}>See All →</Text>
  </TouchableOpacity>
</View>
```

And StyleSheet:

```tsx
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { backgroundColor: Colors.primary },
  sectionHeader: { flexDirection: "row" },
  sectionTitle: { fontSize: FontSize.xxl },
  seeAll: { fontSize: FontSize.md },
  // ... more styles
});
```

**Output:**

```
📊 Unused CSS/Style Classes Report
══════════════════════════════════════════════════

📄 File: src/HomeScreen.tsx
   Defined: 15 | Used: 3 | Unused: 12
   ❌ Unused: container, header, searchSection, searchInput, ...

══════════════════════════════════════════════════
📈 Summary:
   Total Styles Defined: 15
   Total Styles Used: 3
   Total Styles Unused: 12
   Usage Rate: 20.00%
```

## API Reference

### `UnusedCSSScanner`

#### Constructor Options

```typescript
interface ScanOptions {
  files: string[]; // Array of file paths to scan
  styleFiles?: string[]; // Optional: specific style files
  extensions?: string[]; // File extensions to scan (default: ['.tsx', '.ts', '.jsx', '.js'])
  ignorePatterns?: RegExp[]; // Patterns to ignore (default: [/node_modules/, /\.test\./])
}
```

#### Methods

- `scanFile(filePath: string): StyleUsage | null` - Scan a single file
- `scanFiles(files?: string[]): StyleUsage[]` - Scan multiple files
- `generateReport(results: StyleUsage[]): string` - Generate text report
- `scan(files?: string[]): { results: StyleUsage[], report: string }` - Scan and generate report

#### Return Types

```typescript
interface StyleUsage {
  file: string; // File path
  definedStyles: string[]; // All defined style names
  usedStyles: string[]; // Used style names
  unusedStyles: string[]; // Unused style names
}
```

## Configuration Examples

### Ignore Specific Patterns

```typescript
const scanner = new UnusedCSSScanner({
  files: ["src/**/*.tsx"],
  ignorePatterns: [/node_modules/, /\.test\./, /\.stories\./, /__snapshots__/],
});
```

### Custom Extensions

```typescript
const scanner = new UnusedCSSScanner({
  files: ["src/**/*"],
  extensions: [".tsx", ".jsx", ".ts", ".js", ".mjs"],
});
```

## Integration with CI/CD

Add to your `package.json`:

```json
{
  "scripts": {
    "lint:css": "unused-css-scanner src/**/*.tsx",
    "precommit": "npm run lint:css"
  }
}
```

The CLI exits with code 1 if unused styles are found, making it perfect for CI/CD pipelines.

## Supported Patterns

The scanner detects:

- `style={styles.styleName}`
- `style={[styles.style1, styles.style2]}`
- `className="styleName"`
- `className={styles.styleName}`
- Any reference to `styles.styleName`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Chandan Jadhav

---

Made with ❤️ for cleaner React Native codebases

[![npm version](https://badge.fury.io/js/unused-css-scanner.svg)](https://www.npmjs.com/package/unused-css-scanner)
[![npm downloads](https://img.shields.io/npm/dm/unused-css-scanner.svg)](https://www.npmjs.com/package/unused-css-scanner)
