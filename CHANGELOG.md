# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2024-02-08

### Added
- **Backup System**: Automatic backups before deleting styles
- **Git Safety Checks**: Verify git status before modifications
- **Dry Run Mode**: Preview changes without modifying files (`--dry-run`)
- **Configuration File**: Support for `.unusedcssrc.json`
- **JSON Output**: Machine-readable output for CI/CD (`--format json`)
- **TypeScript Strict Mode**: Full type safety with strict checks
- **Comprehensive Tests**: 80%+ code coverage with Jest
- **ESLint & Prettier**: Code quality and formatting
- **GitHub Actions**: CI/CD pipeline
- **BackupManager**: Programmatic backup management API
- **GitChecker**: Git repository validation utilities
- **FileManager**: Centralized file operations
- **Better Error Handling**: Detailed error messages and recovery options
- **Progress Indicators**: Better user feedback during operations
- **Line Numbers**: Show line numbers in unused style reports

### Changed
- **Complete Refactor**: Modular architecture with separate utilities
- **Enhanced CLI**: More options and better UX
- **Improved Detection**: Better handling of edge cases
- **Performance**: Optimized file scanning and parsing
- **API Surface**: Cleaner, more intuitive programmatic API

### Fixed
- **Comma Handling**: Better trailing/leading comma management
- **Source File Caching**: Improved performance for large projects
- **Error Recovery**: Graceful handling of malformed files

### Breaking Changes
- Minimum Node.js version: 14.0.0
- New API signature for `UnusedCSSScanner` constructor
- Configuration file format changed

### Migration Guide from 1.x

```typescript
// Old (1.x)
const scanner = new UnusedCSSScanner({
  files: ['src/**/*.tsx'],
  styleFiles: ['src/styles.ts'],
});

// New (2.x)
const scanner = new UnusedCSSScanner({
  files: ['src/**/*.tsx'],
  backup: true,        // NEW: automatic backups
  checkGit: true,      // NEW: git safety
  dryRun: false,       // NEW: preview mode
  configPath: '.unusedcssrc.json', // NEW: config file
});
```

## [1.2.1] - 2024-01-15

### Fixed
- Minor bug fixes in file parsing
- Improved error messages

## [1.2.0] - 2024-01-10

### Added
- Interactive mode
- Better CLI help text

## [1.1.0] - 2023-12-20

### Added
- Support for aliased styles
- Spread operator detection

## [1.0.0] - 2023-12-01

### Added
- Initial release
- Basic StyleSheet scanning
- Unused style detection
- Simple CLI
