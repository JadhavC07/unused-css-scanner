#!/usr/bin/env node
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
interface ConfigFile {
    extensions?: string[];
    ignore?: string[];
    autoFix?: boolean;
    scanOnSave?: boolean;
    watchFolders?: string[];
    silent?: boolean;
}
interface ScanOptions {
    files?: string[];
    extensions?: string[];
    ignorePatterns?: RegExp[];
    interactive?: boolean;
    autoFix?: boolean;
    silent?: boolean;
}
declare class UnusedCSSScanner {
    private options;
    private rl;
    private config;
    private watchMode;
    private fileWatchers;
    constructor(options?: ScanOptions);
    /**
     * Load configuration from .unused-css-scanner.json
     */
    private loadConfig;
    /**
     * Create a default config file
     */
    createConfigFile(): void;
    /**
     * Start watch mode
     */
    startWatchMode(): void;
    /**
     * Stop watch mode
     */
    private stopWatchMode;
    /**
     * Handle file change in watch mode
     */
    private handleFileChange;
    /**
     * Ask user a question and return the answer
     */
    private askQuestion;
    /**
     * Extract style names from StyleSheet.create() calls
     */
    private extractDefinedStyles;
    /**
     * Extract used style references from code
     */
    private extractUsedStyles;
    /**
     * Read file content safely
     */
    private readFile;
    /**
     * Check if file should be ignored
     */
    private shouldIgnore;
    /**
     * Get all files in a directory recursively
     */
    private getAllFiles;
    /**
     * Scan a single file for unused styles
     */
    scanFile(filePath: string): StyleUsage | null;
    /**
     * Remove unused styles from a file
     */
    private removeUnusedStyles;
    /**
     * Generate a report of unused styles
     */
    generateReport(results: StyleUsage[]): string;
    /**
     * Interactive mode
     */
    interactiveScan(): Promise<void>;
    private scanSingleFileInteractive;
    private scanAllFiles;
    private scanFilesOneByOne;
    close(): void;
}
export default UnusedCSSScanner;
export { UnusedCSSScanner, StyleUsage, StyleDefinition, ScanOptions, ConfigFile, };
