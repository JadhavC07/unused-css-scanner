import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export class FileManager {
  static readFile(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    }
  }

  static writeFile(filePath: string, content: string): void {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error}`);
    }
  }

  static getAllFiles(
    dirPath: string,
    extensions: string[],
    ignorePatterns: RegExp[] = []
  ): string[] {
    const files: string[] = [];

    const traverse = (currentPath: string): void => {
      if (!fs.existsSync(currentPath)) {
        return;
      }

      if (this.shouldIgnore(currentPath, ignorePatterns)) {
        return;
      }

      const stat = fs.statSync(currentPath);

      if (stat.isDirectory()) {
        const items = fs.readdirSync(currentPath);
        for (const item of items) {
          traverse(path.join(currentPath, item));
        }
      } else if (stat.isFile()) {
        const ext = path.extname(currentPath);
        if (extensions.includes(ext)) {
          files.push(currentPath);
        }
      }
    };

    traverse(dirPath);
    return files;
  }

  static shouldIgnore(filePath: string, ignorePatterns: RegExp[]): boolean {
    return ignorePatterns.some((pattern) => pattern.test(filePath));
  }

  static createSourceFile(content: string, filePath: string): ts.SourceFile {
    return ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
  }

  static getLineNumber(sourceFile: ts.SourceFile, pos: number): number {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  static exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  static isDirectory(filePath: string): boolean {
    try {
      return fs.statSync(filePath).isDirectory();
    } catch {
      return false;
    }
  }

  static isFile(filePath: string): boolean {
    try {
      return fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  }
}
