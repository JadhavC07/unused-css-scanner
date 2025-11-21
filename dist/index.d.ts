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
declare class UnusedCSSScanner {
    private options;
    private rl;
    constructor(options?: ScanOptions);
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
     * Interactive mode: Ask user which folder to scan
     */
    interactiveScan(): Promise<void>;
    /**
     * Scan all files at once
     */
    private scanAllFiles;
    /**
     * Scan files one by one
     */
    private scanFilesOneByOne;
    /**
     * Close readline interface
     */
    close(): void;
}
export default UnusedCSSScanner;
export { UnusedCSSScanner, StyleUsage, StyleDefinition, ScanOptions };
