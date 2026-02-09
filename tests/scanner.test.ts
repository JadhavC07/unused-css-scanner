import * as fs from 'fs';
import * as path from 'path';
import { UnusedCSSScanner } from '../src/scanner';

describe('UnusedCSSScanner', () => {
  const testDir = path.join(__dirname, 'fixtures');
  const testFile = path.join(testDir, 'test-component.tsx');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    const testContent = `
import { View, StyleSheet, Text } from 'react-native';

const TestComponent = () => {
  const styles = StyleSheet.create({
    container: { flex: 1 },
    used: { color: 'red' },
    unused: { fontSize: 16 },
    alsoUnused: { padding: 10 },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.used}>Hello</Text>
    </View>
  );
};

export default TestComponent;
    `;

    fs.writeFileSync(testFile, testContent);
  });

  afterEach(() => {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }

    // Clean up backups
    const backupDir = path.join(process.cwd(), '.unused-css-backups');
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
  });

  describe('scanFile', () => {
    it('should detect defined and used styles', () => {
      const scanner = new UnusedCSSScanner();
      const result = scanner.scanFile(testFile);

      expect(result).not.toBeNull();
      expect(result!.definedStyles).toHaveLength(4);
      expect(result!.usedStyles).toContain('container');
      expect(result!.usedStyles).toContain('used');
    });

    it('should detect unused styles', () => {
      const scanner = new UnusedCSSScanner();
      const result = scanner.scanFile(testFile);

      expect(result).not.toBeNull();
      expect(result!.unusedStyles).toHaveLength(2);
      
      const unusedNames = result!.unusedStyles.map(s => s.name);
      expect(unusedNames).toContain('unused');
      expect(unusedNames).toContain('alsoUnused');
    });

    it('should return null for non-existent files', () => {
      const scanner = new UnusedCSSScanner();
      const result = scanner.scanFile('non-existent.tsx');

      expect(result).toBeNull();
    });

    it('should handle files with no styles', () => {
      const emptyFile = path.join(testDir, 'empty.tsx');
      fs.writeFileSync(emptyFile, 'const x = 1;');

      const scanner = new UnusedCSSScanner();
      const result = scanner.scanFile(emptyFile);

      expect(result).not.toBeNull();
      expect(result!.definedStyles).toHaveLength(0);

      fs.unlinkSync(emptyFile);
    });
  });

  describe('scanFiles', () => {
    it('should scan multiple files', () => {
      const file2 = path.join(testDir, 'test2.tsx');
      fs.writeFileSync(file2, `
        import { StyleSheet } from 'react-native';
        const styles = StyleSheet.create({ test: {} });
      `);

      const scanner = new UnusedCSSScanner({ files: [testFile, file2] });
      const results = scanner.scanFiles();

      expect(results).toHaveLength(2);

      fs.unlinkSync(file2);
    });
  });

  describe('deleteUnusedStyles', () => {
    it('should delete unused styles', () => {
      const scanner = new UnusedCSSScanner({ backup: true });
      const result = scanner.scanFile(testFile);

      expect(result).not.toBeNull();
      const deleteResult = scanner.deleteUnusedStyles(testFile, result!.unusedStyles);

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.deletedCount).toBe(2);
      expect(deleteResult.backup).toBeDefined();

      const newContent = fs.readFileSync(testFile, 'utf-8');
      expect(newContent).not.toContain('unused:');
      expect(newContent).not.toContain('alsoUnused:');
      expect(newContent).toContain('container:');
      expect(newContent).toContain('used:');
    });

    it('should create backup when enabled', () => {
      const scanner = new UnusedCSSScanner({ backup: true });
      const result = scanner.scanFile(testFile);

      expect(result).not.toBeNull();
      const deleteResult = scanner.deleteUnusedStyles(testFile, result!.unusedStyles);

      expect(deleteResult.backup).toBeDefined();
      expect(fs.existsSync(deleteResult.backup!.backupPath)).toBe(true);
    });

    it('should not modify files in dry run mode', () => {
      const scanner = new UnusedCSSScanner({ dryRun: true });
      const result = scanner.scanFile(testFile);

      const originalContent = fs.readFileSync(testFile, 'utf-8');

      expect(result).not.toBeNull();
      const deleteResult = scanner.deleteUnusedStyles(testFile, result!.unusedStyles);

      const newContent = fs.readFileSync(testFile, 'utf-8');

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.deletedCount).toBe(2);
      expect(newContent).toBe(originalContent);
    });

    it('should not create backup when disabled', () => {
      const scanner = new UnusedCSSScanner({ backup: false });
      const result = scanner.scanFile(testFile);

      expect(result).not.toBeNull();
      const deleteResult = scanner.deleteUnusedStyles(testFile, result!.unusedStyles);

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.backup).toBeUndefined();
    });
  });

  describe('generateReport', () => {
    it('should generate text report', () => {
      const scanner = new UnusedCSSScanner();
      const results = scanner.scanFiles([testFile]);
      const report = scanner.generateReport(results);

      expect(report).toContain('Unused CSS/Style Classes Report');
      expect(report).toContain('unused');
      expect(report).toContain('alsoUnused');
      expect(report).toContain('Summary');
    });

    it('should show clean message when no unused styles', () => {
      const cleanFile = path.join(testDir, 'clean.tsx');
      fs.writeFileSync(cleanFile, `
        import { StyleSheet } from 'react-native';
        const styles = StyleSheet.create({ used: {} });
        const x = styles.used;
      `);

      const scanner = new UnusedCSSScanner();
      const results = scanner.scanFiles([cleanFile]);
      const report = scanner.generateReport(results);

      expect(report).toContain('No unused styles found');

      fs.unlinkSync(cleanFile);
    });
  });

  describe('scan', () => {
    it('should return complete scan result', () => {
      const scanner = new UnusedCSSScanner();
      const scanResult = scanner.scan([testFile]);

      expect(scanResult.results).toHaveLength(1);
      expect(scanResult.totalDefined).toBe(4);
      expect(scanResult.totalUsed).toBe(2);
      expect(scanResult.totalUnused).toBe(2);
      expect(scanResult.usageRate).toBe(50);
      expect(scanResult.report).toContain('Summary');
    });
  });

  describe('style detection patterns', () => {
    it('should detect aliased styles', () => {
      const aliasFile = path.join(testDir, 'alias.tsx');
      fs.writeFileSync(aliasFile, `
        import { StyleSheet } from 'react-native';
        const styles = StyleSheet.create({ 
          used: {},
          unused: {}
        });
        const s = styles;
        const x = s.used;
      `);

      const scanner = new UnusedCSSScanner();
      const result = scanner.scanFile(aliasFile);

      expect(result).not.toBeNull();
      expect(result!.usedStyles).toContain('used');
      expect(result!.unusedStyles.map(s => s.name)).toContain('unused');

      fs.unlinkSync(aliasFile);
    });

    it('should detect spread styles', () => {
      const spreadFile = path.join(testDir, 'spread.tsx');
      fs.writeFileSync(spreadFile, `
        import { StyleSheet } from 'react-native';
        const styles = StyleSheet.create({ 
          used: {},
          unused: {}
        });
        const x = { ...styles.used };
      `);

      const scanner = new UnusedCSSScanner();
      const result = scanner.scanFile(spreadFile);

      expect(result).not.toBeNull();
      expect(result!.usedStyles).toContain('used');

      fs.unlinkSync(spreadFile);
    });

    it('should detect bracket notation styles', () => {
      const bracketFile = path.join(testDir, 'bracket.tsx');
      fs.writeFileSync(bracketFile, `
        import { StyleSheet } from 'react-native';
        const styles = StyleSheet.create({ 
          used: {},
          unused: {}
        });
        const x = styles["used"];
      `);

      const scanner = new UnusedCSSScanner();
      const result = scanner.scanFile(bracketFile);

      expect(result).not.toBeNull();
      expect(result!.usedStyles).toContain('used');

      fs.unlinkSync(bracketFile);
    });
  });
});
