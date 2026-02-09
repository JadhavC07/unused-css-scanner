// Example 1: Basic programmatic usage
import { UnusedCSSScanner } from 'unused-css-scanner';

const scanner = new UnusedCSSScanner({
  files: ['src/HomeScreen.tsx'],
  dryRun: true, // Preview changes
});

const result = scanner.scan();
console.log(result.report);

// Example 2: Scan entire directory
const dirScanner = new UnusedCSSScanner();
const dirResults = dirScanner.scanDirectory('src/components');

console.log(`Found ${dirResults.length} files with styles`);
console.log(`Total unused: ${dirResults.reduce((sum, r) => sum + r.unusedStyles.length, 0)}`);

// Example 3: Delete with backups
const deleteScanner = new UnusedCSSScanner({
  backup: true,
  checkGit: true,
});

const scanResults = deleteScanner.scanFile('src/App.tsx');
if (scanResults && scanResults.unusedStyles.length > 0) {
  const deleteResult = deleteScanner.deleteUnusedStyles(
    scanResults.file,
    scanResults.unusedStyles
  );

  if (deleteResult.success) {
    console.log(`✅ Deleted ${deleteResult.deletedCount} unused styles`);
    console.log(`💾 Backup: ${deleteResult.backup?.backupPath}`);
  }
}

// Example 4: Custom configuration
const customScanner = new UnusedCSSScanner({
  extensions: ['.tsx', '.jsx'],
  ignorePatterns: [/\.test\./, /\.stories\./, /node_modules/],
  backup: false,
  dryRun: true,
});

// Example 5: Restore from backup
const backupManager = deleteScanner.getBackupManager();
if (backupManager.hasBackup('src/App.tsx')) {
  backupManager.restoreBackup('src/App.tsx');
  console.log('✅ Restored from backup');
}

// Example 6: Batch processing
const batchScanner = new UnusedCSSScanner({ backup: true });
const files = ['src/Screen1.tsx', 'src/Screen2.tsx', 'src/Screen3.tsx'];

for (const file of files) {
  const result = batchScanner.scanFile(file);
  if (result && result.unusedStyles.length > 0) {
    console.log(`\n📄 ${file}:`);
    console.log(`   Unused: ${result.unusedStyles.map((s) => s.name).join(', ')}`);

    const deleteResult = batchScanner.deleteUnusedStyles(file, result.unusedStyles);
    if (deleteResult.success) {
      console.log(`   ✅ Cleaned up ${deleteResult.deletedCount} styles`);
    }
  }
}
