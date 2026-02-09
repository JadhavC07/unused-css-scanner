import * as ts from 'typescript';
import { StyleDefinition, StyleUsage, ScanOptions, ScanResult, DeleteResult } from './types';
import { FileManager } from './file-manager';
import { BackupManager } from './backup-manager';
import { GitChecker } from './git-checker';
import { ConfigLoader } from './config';

export class UnusedCSSScanner {
  private options: Required<ScanOptions>;
  private backupManager: BackupManager;
  private sourceFileCache: Map<string, ts.SourceFile> = new Map();

  constructor(options: ScanOptions = {}) {
    const config = ConfigLoader.load(options.configPath);

    this.options = {
      files: options.files || [],
      extensions: options.extensions || config.extensions,
      ignorePatterns: this.convertIgnorePatternsToRegex(options.ignorePatterns || config.ignore),
      interactive: options.interactive ?? false,
      dryRun: options.dryRun ?? config.dryRun,
      backup: options.backup ?? config.backup,
      checkGit: options.checkGit ?? config.checkGit,
      configPath: options.configPath || '',
    };

    this.backupManager = new BackupManager();
  }

  private convertIgnorePatternsToRegex(patterns: string[] | RegExp[]): RegExp[] {
    return patterns.map(pattern => {
      if (pattern instanceof RegExp) {
        return pattern;
      }
      // Convert glob-like patterns to regex
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');
      return new RegExp(regexPattern);
    });
  }

  private extractDefinedStyles(content: string, filePath: string): StyleDefinition[] {
    const styles: StyleDefinition[] = [];
    const sourceFile = this.getSourceFile(content, filePath);

    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'StyleSheet' &&
        ts.isIdentifier(node.expression.name) &&
        node.expression.name.text === 'create'
      ) {
        const arg = node.arguments[0];
        if (arg && ts.isObjectLiteralExpression(arg)) {
          arg.properties.forEach((prop) => {
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
              styles.push({
                name: prop.name.text,
                startLine: FileManager.getLineNumber(sourceFile, prop.getStart()),
                endLine: FileManager.getLineNumber(sourceFile, prop.getEnd()),
                startPos: prop.getStart(sourceFile, false),
                endPos: prop.getEnd(),
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
    const sourceFile = this.getSourceFile(content, filePath);

    // Collect aliases
    const collectAliases = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isIdentifier(node.initializer) &&
        node.initializer.text === 'styles' &&
        ts.isIdentifier(node.name)
      ) {
        aliases.add(node.name.text);
      }
      ts.forEachChild(node, collectAliases);
    };

    collectAliases(sourceFile);

    // Find usages
    const visit = (node: ts.Node): void => {
      // styles.styleName or alias.styleName
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        ts.isIdentifier(node.name)
      ) {
        const objName = node.expression.text;
        if (objName === 'styles' || aliases.has(objName)) {
          usedStyles.add(node.name.text);
        }
      }

      // styles["styleName"]
      if (
        ts.isElementAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        ts.isStringLiteral(node.argumentExpression)
      ) {
        const objName = node.expression.text;
        if (objName === 'styles' || aliases.has(objName)) {
          usedStyles.add(node.argumentExpression.text);
        }
      }

      // {...styles.container}
      if (
        (ts.isSpreadAssignment(node) || ts.isJsxSpreadAttribute(node)) &&
        node.expression &&
        ts.isPropertyAccessExpression(node.expression)
      ) {
        const expr = node.expression;
        if (ts.isIdentifier(expr.expression) && ts.isIdentifier(expr.name)) {
          const objName = expr.expression.text;
          if (objName === 'styles' || aliases.has(objName)) {
            usedStyles.add(expr.name.text);
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return Array.from(usedStyles);
  }

  private getSourceFile(content: string, filePath: string): ts.SourceFile {
    const cached = this.sourceFileCache.get(filePath);
    if (cached) {
      return cached;
    }

    const sourceFile = FileManager.createSourceFile(content, filePath);
    this.sourceFileCache.set(filePath, sourceFile);
    return sourceFile;
  }

  public scanFile(filePath: string): StyleUsage | null {
    try {
      if (FileManager.shouldIgnore(filePath, this.options.ignorePatterns)) {
        return null;
      }

      const content = FileManager.readFile(filePath);
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
    } catch (error) {
      console.error(`Error scanning file ${filePath}:`, error);
      return null;
    }
  }

  public scanFiles(files?: string[]): StyleUsage[] {
    const targetFiles = files || this.options.files;
    const results: StyleUsage[] = [];

    for (const file of targetFiles) {
      const result = this.scanFile(file);
      if (result && result.definedStyles.length > 0) {
        results.push(result);
      }
    }

    return results;
  }

  public scanDirectory(dirPath: string): StyleUsage[] {
    const files = FileManager.getAllFiles(
      dirPath,
      this.options.extensions,
      this.options.ignorePatterns
    );

    return this.scanFiles(files);
  }

  public deleteUnusedStyles(
    filePath: string,
    unusedStyles: StyleDefinition[]
  ): DeleteResult {
    if (this.options.dryRun) {
      return {
        success: true,
        file: filePath,
        deletedCount: unusedStyles.length,
      };
    }

    try {
      // Create backup if enabled
      let backupInfo;
      if (this.options.backup) {
        backupInfo = this.backupManager.createBackup(filePath);
      }

      const content = FileManager.readFile(filePath);
      const sourceFile = this.getSourceFile(content, filePath);
      const unusedNames = new Set(unusedStyles.map((s) => s.name));
      const modifications: Array<{ start: number; end: number }> = [];

      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === 'StyleSheet' &&
          ts.isIdentifier(node.expression.name) &&
          node.expression.name.text === 'create'
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

      if (modifications.length === 0) {
        return {
          success: false,
          file: filePath,
          deletedCount: 0,
          error: 'No modifications found',
        };
      }

      // Sort in reverse order to preserve positions
      modifications.sort((a, b) => b.start - a.start);

      let newContent = content;
      for (const mod of modifications) {
        let { start, end } = mod;

        // Handle trailing comma
        const afterText = content.substring(end, end + 10);
        if (afterText.match(/^\s*,/)) {
          end += afterText.indexOf(',') + 1;
        } else {
          // Handle leading comma
          const beforeText = content.substring(Math.max(0, start - 10), start);
          const commaIndex = beforeText.lastIndexOf(',');
          if (commaIndex !== -1) {
            start = start - (beforeText.length - commaIndex);
          }
        }

        newContent = newContent.substring(0, start) + newContent.substring(end);
      }

      FileManager.writeFile(filePath, newContent);
      this.sourceFileCache.delete(filePath);

      return {
        success: true,
        file: filePath,
        deletedCount: modifications.length,
        backup: backupInfo,
      };
    } catch (error) {
      return {
        success: false,
        file: filePath,
        deletedCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public generateReport(results: StyleUsage[]): string {
    let report = '\n📊 Unused CSS/Style Classes Report\n';
    report += '═'.repeat(60) + '\n\n';

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
          report += `   ❌ ${style.name} (line ${style.startLine})\n`;
        });
        report += '\n';
      }
    }

    if (totalUnused === 0) {
      report += '✅ No unused styles found! Your code is clean.\n\n';
    }

    report += '═'.repeat(60) + '\n';
    report += '📈 Summary:\n';
    report += `   Total Styles Defined: ${totalDefined}\n`;
    report += `   Total Styles Used: ${totalUsed}\n`;
    report += `   Total Styles Unused: ${totalUnused}\n`;
    report += `   Usage Rate: ${
      totalDefined > 0 ? ((totalUsed / totalDefined) * 100).toFixed(2) : 0
    }%\n`;

    return report;
  }

  public scan(files?: string[]): ScanResult {
    const results = this.scanFiles(files);
    const report = this.generateReport(results);

    let totalDefined = 0;
    let totalUsed = 0;
    let totalUnused = 0;

    for (const result of results) {
      totalDefined += result.definedStyles.length;
      totalUsed += result.usedStyles.length;
      totalUnused += result.unusedStyles.length;
    }

    return {
      results,
      report,
      totalDefined,
      totalUsed,
      totalUnused,
      usageRate: totalDefined > 0 ? (totalUsed / totalDefined) * 100 : 0,
    };
  }

  public checkSafety(): boolean {
    if (!this.options.checkGit) {
      return true;
    }

    const gitStatus = GitChecker.check();
    return GitChecker.warnIfUnsafe(gitStatus);
  }

  public getBackupManager(): BackupManager {
    return this.backupManager;
  }

  public clear(): void {
    this.sourceFileCache.clear();
  }
}
