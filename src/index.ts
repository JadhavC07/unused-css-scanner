import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

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

  /**
   * Ask user a question and return the answer
   */
  private async askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * Extract style names from StyleSheet.create() calls
   */
  private extractDefinedStyles(content: string): StyleDefinition[] {
    const styles: StyleDefinition[] = [];
    const lines = content.split("\n");

    // Find StyleSheet.create block - match the entire block
    const styleSheetRegex = /StyleSheet\.create\s*\(\s*\{([\s\S]*?)\}\s*\)/;
    const match = content.match(styleSheetRegex);

    if (!match) return styles;

    const styleBlock = match[1];
    const blockStartIndex = match.index! + match[0].indexOf("{") + 1;

    // Split by style definitions - each style ends with },
    const styleDefinitionRegex = /(\w+)\s*:\s*\{[^}]*\}/g;
    let styleMatch;

    while ((styleMatch = styleDefinitionRegex.exec(styleBlock)) !== null) {
      const styleName = styleMatch[1];
      const styleStartPos = blockStartIndex + styleMatch.index;
      const styleEndPos = styleStartPos + styleMatch[0].length;

      // Calculate line numbers
      const startLine = content.substring(0, styleStartPos).split("\n").length;
      const endLine = content.substring(0, styleEndPos).split("\n").length;

      styles.push({
        name: styleName,
        startLine: startLine,
        endLine: endLine,
      });
    }

    return styles;
  }

  /**
   * Extract used style references from code
   */
  private extractUsedStyles(content: string): string[] {
    const usedStyles: string[] = [];

    // Match styles.styleName in any context
    const directStyleRegex = /styles\.(\w+)/g;
    let match;

    while ((match = directStyleRegex.exec(content)) !== null) {
      usedStyles.push(match[1]);
    }

    // Match className patterns
    const classNameRegex = /className\s*=\s*["'`]([^"'`]+)["'`]/g;
    while ((match = classNameRegex.exec(content)) !== null) {
      const classNames = match[1].split(/\s+/);
      usedStyles.push(...classNames);
    }

    return [...new Set(usedStyles)];
  }

  /**
   * Read file content safely
   */
  private readFile(filePath: string): string | null {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      console.error(`❌ Error reading file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Check if file should be ignored
   */
  private shouldIgnore(filePath: string): boolean {
    return this.options.ignorePatterns.some((pattern) =>
      pattern.test(filePath)
    );
  }

  /**
   * Get all files in a directory recursively
   */
  private getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    try {
      const files = fs.readdirSync(dirPath);

      files.forEach((file) => {
        const fullPath = path.join(dirPath, file);

        if (this.shouldIgnore(fullPath)) {
          return;
        }

        if (fs.statSync(fullPath).isDirectory()) {
          arrayOfFiles = this.getAllFiles(fullPath, arrayOfFiles);
        } else {
          const ext = path.extname(file);
          if (this.options.extensions.includes(ext)) {
            arrayOfFiles.push(fullPath);
          }
        }
      });

      return arrayOfFiles;
    } catch (error) {
      console.error(`❌ Error reading directory ${dirPath}:`, error);
      return arrayOfFiles;
    }
  }

  /**
   * Scan a single file for unused styles
   */
  public scanFile(filePath: string): StyleUsage | null {
    if (this.shouldIgnore(filePath)) {
      return null;
    }

    const content = this.readFile(filePath);
    if (!content) {
      return null;
    }

    const definedStyles = this.extractDefinedStyles(content);
    const usedStyles = this.extractUsedStyles(content);
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

  /**
   * Remove unused styles from a file
   */
  private async removeUnusedStyles(
    filePath: string,
    unusedStyles: StyleDefinition[]
  ): Promise<boolean> {
    try {
      let content = this.readFile(filePath);
      if (!content) return false;

      // Find StyleSheet.create block
      const styleSheetRegex = /StyleSheet\.create\s*\(\s*\{([\s\S]*?)\}\s*\)/;
      const match = content.match(styleSheetRegex);

      if (!match) return false;

      let styleBlock = match[1];
      const originalStyleBlock = styleBlock;

      // Remove each unused style definition
      for (const unusedStyle of unusedStyles) {
        // Match the exact style definition with proper escaping
        const styleNameEscaped = unusedStyle.name.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

        // Match style definition including all its content and trailing comma
        const styleDefRegex = new RegExp(
          `\\s*${styleNameEscaped}\\s*:\\s*\\{[^}]*\\}\\s*,?\\s*`,
          "g"
        );

        styleBlock = styleBlock.replace(styleDefRegex, "");
      }

      // Clean up extra commas and whitespace
      // Remove trailing comma before closing brace
      styleBlock = styleBlock.replace(/,(\s*$)/g, "$1");
      // Remove multiple consecutive commas
      styleBlock = styleBlock.replace(/,\s*,/g, ",");

      // Replace the old style block with the cleaned one
      const newContent = content.replace(originalStyleBlock, styleBlock);

      fs.writeFileSync(filePath, newContent, "utf-8");
      return true;
    } catch (error) {
      console.error(`❌ Error removing styles from ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Generate a report of unused styles
   */
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

  /**
   * Interactive mode: Ask user which folder to scan
   */
  public async interactiveScan(): Promise<void> {
    console.log("\n🔍 Unused CSS Scanner - Interactive Mode\n");
    console.log("═".repeat(60));

    // Ask for folder path
    const folderPath = await this.askQuestion(
      "\n📁 Enter the folder path to scan (e.g., src/): "
    );

    if (!fs.existsSync(folderPath)) {
      console.log(`\n❌ Folder not found: ${folderPath}`);
      this.rl.close();
      return;
    }

    // Get all files
    const allFiles = this.getAllFiles(folderPath);

    if (allFiles.length === 0) {
      console.log(`\n❌ No .tsx/.jsx/.ts/.js files found in ${folderPath}`);
      this.rl.close();
      return;
    }

    console.log(`\n✅ Found ${allFiles.length} file(s)\n`);

    // Ask scan mode
    const scanMode = await this.askQuestion(
      "📋 Scan mode:\n   1) Scan all files at once\n   2) Scan files one by one\n\nChoose (1 or 2): "
    );

    if (scanMode === "1") {
      await this.scanAllFiles(allFiles);
    } else if (scanMode === "2") {
      await this.scanFilesOneByOne(allFiles);
    } else {
      console.log("\n❌ Invalid choice. Exiting.");
    }

    this.rl.close();
  }

  /**
   * Scan all files at once
   */
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

    // Ask if user wants to delete unused styles
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

  /**
   * Scan files one by one
   */
  private async scanFilesOneByOne(files: string[]): Promise<void> {
    console.log("\n🔄 Scanning files one by one...\n");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`\n[${i + 1}/${files.length}] 📄 ${file}\n`);

      const result = this.scanFile(file);

      if (!result || result.definedStyles.length === 0) {
        console.log("   ℹ️  No styles found in this file.\n");
        continue;
      }

      if (result.unusedStyles.length === 0) {
        console.log("   ✅ No unused styles! This file is clean.\n");
        continue;
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
        const success = await this.removeUnusedStyles(
          file,
          result.unusedStyles
        );
        if (success) {
          console.log(
            `   ✅ Removed ${result.unusedStyles.length} unused style(s)\n`
          );
        }
      } else {
        console.log("   ❌ Skipped\n");
      }
    }

    console.log("\n✅ Scan complete!");
  }

  /**
   * Close readline interface
   */
  public close(): void {
    this.rl.close();
  }
}

// Export for use as a package
export default UnusedCSSScanner;
export { UnusedCSSScanner, StyleUsage, StyleDefinition, ScanOptions };

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  const scanner = new UnusedCSSScanner({ interactive: true });

  if (args.length === 0) {
    // Interactive mode
    scanner.interactiveScan().catch((error) => {
      console.error("Error:", error);
      scanner.close();
      process.exit(1);
    });
  } else {
    // Direct file scanning
    const results: StyleUsage[] = [];

    for (const file of args) {
      const result = scanner.scanFile(file);
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
