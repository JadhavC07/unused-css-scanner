#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as ts from "typescript";

interface StyleDefinition {
  name: string;
  startLine: number;
  endLine: number;
}

interface StyleUsage {
  file: string;
  definedStyles: StyleDefinition[];
  usedStyles: string[];
  unusedStyles: StyleDefinition[];
}

interface ScanOptions {
  files?: string[];
  extensions?: string[];
  ignorePatterns?: RegExp[];
  interactive?: boolean;
}

class UnusedCSSScanner {
  private options: Required<ScanOptions>;
  private rl: readline.Interface;
  private sourceFileCache: Map<string, ts.SourceFile> = new Map();

  constructor(options: ScanOptions = {}) {
    this.options = {
      files: options.files || [],
      extensions: options.extensions || [".tsx", ".ts", ".jsx", ".js"],
      ignorePatterns: options.ignorePatterns || [/node_modules/, /\.test\./],
      interactive:
        options.interactive !== undefined ? options.interactive : false,
    };

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

  private getLineNumber(sourceFile: ts.SourceFile, pos: number): number {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  private createSourceFile(content: string, filePath: string): ts.SourceFile {
    const cached = this.sourceFileCache.get(filePath);
    if (cached) return cached;

    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );

    this.sourceFileCache.set(filePath, sourceFile);
    return sourceFile;
  }

  private extractDefinedStyles(
    content: string,
    filePath: string
  ): StyleDefinition[] {
    const styles: StyleDefinition[] = [];
    const sourceFile = this.createSourceFile(content, filePath);

    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "StyleSheet" &&
        ts.isIdentifier(node.expression.name) &&
        node.expression.name.text === "create"
      ) {
        const arg = node.arguments[0];
        if (arg && ts.isObjectLiteralExpression(arg)) {
          arg.properties.forEach((prop) => {
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
              styles.push({
                name: prop.name.text,
                startLine: this.getLineNumber(sourceFile, prop.getStart()),
                endLine: this.getLineNumber(sourceFile, prop.getEnd()),
              });
            }
          });
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return styles;
  }

  private extractUsedStyles(content: string, filePath: string): string[] {
    const usedStyles = new Set<string>();
    const aliases = new Set<string>();
    const sourceFile = this.createSourceFile(content, filePath);

    // Collect aliases first
    const collectAliases = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isIdentifier(node.initializer) &&
        node.initializer.text === "styles" &&
        ts.isIdentifier(node.name)
      ) {
        aliases.add(node.name.text);
      }
      ts.forEachChild(node, collectAliases);
    };

    collectAliases(sourceFile);

    // Find all usages
    const visit = (node: ts.Node): void => {
      // styles.styleName or alias.styleName
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        ts.isIdentifier(node.name)
      ) {
        const objName = node.expression.text;
        if (objName === "styles" || aliases.has(objName)) {
          usedStyles.add(node.name.text);
        }
      }

      // styles["styleName"] or alias["styleName"]
      if (
        ts.isElementAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        ts.isStringLiteral(node.argumentExpression)
      ) {
        const objName = node.expression.text;
        if (objName === "styles" || aliases.has(objName)) {
          usedStyles.add(node.argumentExpression.text);
        }
      }

      // {...styles.container} in objects and JSX
      if (
        (ts.isSpreadAssignment(node) || ts.isJsxSpreadAttribute(node)) &&
        node.expression &&
        ts.isPropertyAccessExpression(node.expression)
      ) {
        const expr = node.expression;
        if (ts.isIdentifier(expr.expression) && ts.isIdentifier(expr.name)) {
          const objName = expr.expression.text;
          if (objName === "styles" || aliases.has(objName)) {
            usedStyles.add(expr.name.text);
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return Array.from(usedStyles);
  }

  private readFile(filePath: string): string | null {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      console.error(`❌ Error reading file ${filePath}:`, error);
      return null;
    }
  }

  private shouldIgnore(filePath: string): boolean {
    return this.options.ignorePatterns.some((pattern) =>
      pattern.test(filePath)
    );
  }

  private getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    try {
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        const fullPath = path.join(dirPath, file);

        if (this.shouldIgnore(fullPath)) continue;

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          this.getAllFiles(fullPath, arrayOfFiles);
        } else {
          const ext = path.extname(file);
          if (this.options.extensions.includes(ext)) {
            arrayOfFiles.push(fullPath);
          }
        }
      }

      return arrayOfFiles;
    } catch (error) {
      console.error(`❌ Error reading directory ${dirPath}:`, error);
      return arrayOfFiles;
    }
  }

  public scanFile(filePath: string): StyleUsage | null {
    if (this.shouldIgnore(filePath)) return null;

    const content = this.readFile(filePath);
    if (!content) return null;

    const definedStyles = this.extractDefinedStyles(content, filePath);
    const usedStyles = this.extractUsedStyles(content, filePath);
    const unusedStyles = definedStyles.filter(
      (style) => !usedStyles.includes(style.name)
    );

    return {
      file: filePath,
      definedStyles,
      usedStyles,
      unusedStyles,
    };
  }

  private async removeUnusedStyles(
    filePath: string,
    unusedStyles: StyleDefinition[]
  ): Promise<boolean> {
    try {
      const content = this.readFile(filePath);
      if (!content) return false;

      const sourceFile = this.createSourceFile(content, filePath);
      const unusedNames = new Set(unusedStyles.map((s) => s.name));
      const modifications: Array<{ start: number; end: number }> = [];

      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === "StyleSheet" &&
          ts.isIdentifier(node.expression.name) &&
          node.expression.name.text === "create"
        ) {
          const arg = node.arguments[0];
          if (arg && ts.isObjectLiteralExpression(arg)) {
            arg.properties.forEach((prop) => {
              if (
                ts.isPropertyAssignment(prop) &&
                ts.isIdentifier(prop.name) &&
                unusedNames.has(prop.name.text)
              ) {
                modifications.push({
                  start: prop.getStart(sourceFile, false),
                  end: prop.getEnd(),
                });
              }
            });
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      if (modifications.length === 0) return false;

      modifications.sort((a, b) => b.start - a.start);

      let newContent = content;
      for (const mod of modifications) {
        let { start, end } = mod;

        const afterText = content.substring(end, end + 10);
        if (afterText.match(/^\s*,/)) {
          end += afterText.indexOf(",") + 1;
        } else {
          const beforeText = content.substring(Math.max(0, start - 10), start);
          const commaIndex = beforeText.lastIndexOf(",");
          if (commaIndex !== -1) {
            start = start - (beforeText.length - commaIndex);
          }
        }

        newContent = newContent.substring(0, start) + newContent.substring(end);
      }

      fs.writeFileSync(filePath, newContent, "utf-8");
      this.sourceFileCache.delete(filePath);
      return true;
    } catch (error) {
      console.error(`❌ Error removing styles from ${filePath}:`, error);
      return false;
    }
  }

  public generateReport(results: StyleUsage[]): string {
    let report = "\n📊 Unused CSS/Style Classes Report\n";
    report += "═".repeat(60) + "\n\n";

    let totalDefined = 0;
    let totalUsed = 0;
    let totalUnused = 0;

    for (const result of results) {
      totalDefined += result.definedStyles.length;
      totalUsed += result.usedStyles.length;
      totalUnused += result.unusedStyles.length;

      if (result.unusedStyles.length > 0) {
        report += `📄 File: ${result.file}\n`;
        report += `   Total Defined: ${result.definedStyles.length} | Used: ${result.usedStyles.length} | Unused: ${result.unusedStyles.length}\n\n`;

        result.unusedStyles.forEach((style) => {
          report += `   ❌ ${style.name}\n`;
        });
        report += "\n";
      }
    }

    if (totalUnused === 0) {
      report += "✅ No unused styles found! Your code is clean.\n\n";
    }

    report += "═".repeat(60) + "\n";
    report += `📈 Summary:\n`;
    report += `   Total Styles Defined: ${totalDefined}\n`;
    report += `   Total Styles Used: ${totalUsed}\n`;
    report += `   Total Styles Unused: ${totalUnused}\n`;
    report += `   Usage Rate: ${
      totalDefined > 0 ? ((totalUsed / totalDefined) * 100).toFixed(2) : 0
    }%\n`;

    return report;
  }

  private getFolders(): string[] {
    try {
      const items = fs.readdirSync(process.cwd());
      return items.filter((item) => {
        const fullPath = path.join(process.cwd(), item);
        return (
          fs.statSync(fullPath).isDirectory() &&
          !this.shouldIgnore(fullPath) &&
          !item.startsWith(".")
        );
      });
    } catch (error) {
      console.error(`❌ Error reading directory:`, error);
      return [];
    }
  }

  public async interactiveScan(): Promise<void> {
    console.log("\n🔍 Unused CSS Scanner - Interactive Mode\n");
    console.log("═".repeat(60));

    const folders = this.getFolders();

    if (folders.length === 0) {
      console.log("\n❌ No folders found in current directory.");
      this.rl.close();
      return;
    }

    console.log("\n📁 Available folders:\n");
    folders.forEach((folder, index) => {
      console.log(`   ${index + 1}) ${folder}`);
    });
    console.log(`   ${folders.length + 1}) Enter custom path`);
    console.log(`   0) Scan current directory (.)\n`);

    const folderChoice = await this.askQuestion(
      "Choose a folder (enter number): "
    );

    let selectedPath: string;

    if (folderChoice === "0") {
      selectedPath = ".";
    } else {
      const choice = parseInt(folderChoice);
      if (choice === folders.length + 1) {
        selectedPath = await this.askQuestion(
          "\n📁 Enter folder or file path: "
        );
      } else if (choice >= 1 && choice <= folders.length) {
        selectedPath = folders[choice - 1];
      } else {
        console.log("\n❌ Invalid choice. Exiting.");
        this.rl.close();
        return;
      }
    }

    if (!fs.existsSync(selectedPath)) {
      console.log(`\n❌ Path not found: ${selectedPath}`);
      this.rl.close();
      return;
    }

    const stat = fs.statSync(selectedPath);

    if (stat.isFile()) {
      const ext = path.extname(selectedPath);
      if (this.options.extensions.includes(ext)) {
        await this.scanSingleFileInteractive(selectedPath);
      } else {
        console.log(
          `\n❌ File type not supported. Only .tsx/.jsx/.ts/.js files are supported.`
        );
      }
      this.rl.close();
      return;
    }

    const allFiles = this.getAllFiles(selectedPath);

    if (allFiles.length === 0) {
      console.log(`\n❌ No .tsx/.jsx/.ts/.js files found in ${selectedPath}`);
      this.rl.close();
      return;
    }

    console.log(`\n✅ Found ${allFiles.length} file(s) in ${selectedPath}\n`);

    console.log("📋 What would you like to do?\n");
    console.log("   1) Scan entire folder");
    console.log("   2) Choose specific file to scan\n");

    const scanChoice = await this.askQuestion("Choose option (1 or 2): ");

    if (scanChoice === "1") {
      await this.scanAllFiles(allFiles);
    } else if (scanChoice === "2") {
      await this.chooseAndScanFile(allFiles);
    } else {
      console.log("\n❌ Invalid choice. Exiting.");
    }

    this.rl.close();
  }

  private async chooseAndScanFile(files: string[]): Promise<void> {
    console.log("\n📄 Available files:\n");

    files.forEach((file, index) => {
      const relativePath = path.relative(process.cwd(), file);
      console.log(`   ${index + 1}) ${relativePath}`);
    });

    const fileChoice = await this.askQuestion(
      `\nChoose a file (1-${files.length}): `
    );

    const choice = parseInt(fileChoice);

    if (choice >= 1 && choice <= files.length) {
      await this.scanSingleFileInteractive(files[choice - 1]);
    } else {
      console.log("\n❌ Invalid choice. Exiting.");
    }
  }

  private async scanSingleFileInteractive(file: string): Promise<void> {
    console.log(`\n🔍 Scanning ${file}...\n`);

    const result = this.scanFile(file);

    if (!result || result.definedStyles.length === 0) {
      console.log("   ℹ️  No styles found in this file.\n");
      return;
    }

    if (result.unusedStyles.length === 0) {
      console.log("   ✅ No unused styles! This file is clean.\n");
      console.log(
        `   Total Styles: ${result.definedStyles.length} | All Used: ${result.usedStyles.length}\n`
      );
      return;
    }

    console.log(
      `   Total Defined: ${result.definedStyles.length} | Used: ${result.usedStyles.length} | Unused: ${result.unusedStyles.length}\n`
    );

    result.unusedStyles.forEach((style) => {
      console.log(`   ❌ ${style.name}`);
    });

    const deleteChoice = await this.askQuestion(
      "\n   🗑️  Delete unused styles from this file? (yes/no): "
    );

    if (
      deleteChoice.toLowerCase() === "yes" ||
      deleteChoice.toLowerCase() === "y"
    ) {
      const success = await this.removeUnusedStyles(file, result.unusedStyles);
      if (success) {
        console.log(
          `   ✅ Removed ${result.unusedStyles.length} unused style(s)\n`
        );
      }
    } else {
      console.log("   ❌ Skipped\n");
    }
  }

  private async scanAllFiles(files: string[]): Promise<void> {
    console.log("\n🔄 Scanning all files...\n");

    const results: StyleUsage[] = [];

    for (const file of files) {
      const result = this.scanFile(file);
      if (result && result.definedStyles.length > 0) {
        results.push(result);
      }
    }

    const report = this.generateReport(results);
    console.log(report);

    const hasUnused = results.some((r) => r.unusedStyles.length > 0);

    if (hasUnused) {
      const deleteChoice = await this.askQuestion(
        "\n🗑️  Do you want to delete all unused styles? (yes/no): "
      );

      if (
        deleteChoice.toLowerCase() === "yes" ||
        deleteChoice.toLowerCase() === "y"
      ) {
        console.log("\n🔄 Deleting unused styles...\n");

        for (const result of results) {
          if (result.unusedStyles.length > 0) {
            const success = await this.removeUnusedStyles(
              result.file,
              result.unusedStyles
            );
            if (success) {
              console.log(
                `✅ Removed ${result.unusedStyles.length} unused style(s) from ${result.file}`
              );
            }
          }
        }

        console.log("\n✅ Cleanup complete!");
      } else {
        console.log("\n❌ Cleanup cancelled.");
      }
    }
  }

  public close(): void {
    this.rl.close();
    this.sourceFileCache.clear();
  }
}

export default UnusedCSSScanner;
export { UnusedCSSScanner, StyleUsage, StyleDefinition, ScanOptions };

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const scanner = new UnusedCSSScanner({ interactive: true });

  const showHelp = (): void => {
    console.log(`
🔍 Unused CSS Scanner - Clean up your React Native StyleSheets

Usage:
  unused-css-scanner                Start interactive mode
  unused-css-scanner scan           Start interactive mode
  unused-css-scanner <file>         Scan a specific file
  unused-css-scanner <folder>       Scan all files in folder
  unused-css-scanner help           Show this help message
  unused-css-scanner --version      Show version

Examples:
  unused-css-scanner                    # Interactive mode with folder selection
  unused-css-scanner scan               # Interactive mode
  unused-css-scanner src/               # Scan src folder
  unused-css-scanner App.tsx            # Scan single file

Supported Patterns:
  ✓ styles.container                   # Direct access
  ✓ styles["container"]                # Bracket notation
  ✓ const s = styles; s.container      # Aliasing
  ✓ {...styles.container}              # Spread operator

Options:
  --help, -h                            Show help
  --version, -v                         Show version

📦 Package: unused-css-scanner
🔗 NPM: https://www.npmjs.com/package/unused-css-scanner
`);
  };

  const showVersion = (): void => {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8")
      );
      console.log(`unused-css-scanner v${packageJson.version}`);
    } catch {
      console.log("unused-css-scanner");
    }
  };

  if (command === "help" || command === "--help" || command === "-h") {
    showHelp();
    process.exit(0);
  }

  if (command === "--version" || command === "-v") {
    showVersion();
    process.exit(0);
  }

  if (command === "scan" || args.length === 0) {
    scanner.interactiveScan().catch((error) => {
      console.error("Error:", error);
      scanner.close();
      process.exit(1);
    });
  } else {
    const target = args[0];

    if (!fs.existsSync(target)) {
      console.error(`❌ File or folder not found: ${target}`);
      process.exit(1);
    }

    const results: StyleUsage[] = [];
    const stat = fs.statSync(target);

    if (stat.isDirectory()) {
      const files = scanner["getAllFiles"](target);
      console.log(`\n🔍 Scanning ${files.length} files in ${target}...\n`);

      for (const file of files) {
        const result = scanner.scanFile(file);
        if (result && result.definedStyles.length > 0) {
          results.push(result);
        }
      }
    } else {
      console.log(`\n🔍 Scanning ${target}...\n`);
      const result = scanner.scanFile(target);
      if (result && result.definedStyles.length > 0) {
        results.push(result);
      }
    }

    const report = scanner.generateReport(results);
    console.log(report);

    scanner.close();

    if (results.some((r) => r.unusedStyles.length > 0)) {
      process.exit(1);
    }
  }
}
