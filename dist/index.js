#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnusedCSSScanner = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
class UnusedCSSScanner {
    constructor(options = {}) {
        this.config = null;
        this.watchMode = false;
        this.fileWatchers = [];
        this.options = {
            files: options.files || [],
            extensions: options.extensions || [".tsx", ".ts", ".jsx", ".js"],
            ignorePatterns: options.ignorePatterns || [/node_modules/, /\.test\./],
            interactive: options.interactive !== undefined ? options.interactive : false,
            autoFix: options.autoFix || false,
            silent: options.silent || false,
        };
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        // Load config file if exists
        this.loadConfig();
    }
    /**
     * Load configuration from .unused-css-scanner.json
     */
    loadConfig() {
        const configPath = path.join(process.cwd(), ".unused-css-scanner.json");
        if (fs.existsSync(configPath)) {
            try {
                const configContent = fs.readFileSync(configPath, "utf-8");
                this.config = JSON.parse(configContent);
                // Apply config to options
                if (this.config?.extensions) {
                    this.options.extensions = this.config.extensions;
                }
                if (this.config?.ignore) {
                    this.options.ignorePatterns = this.config.ignore.map((pattern) => new RegExp(pattern.replace(/\*/g, ".*")));
                }
                if (this.config?.autoFix !== undefined) {
                    this.options.autoFix = this.config.autoFix;
                }
                if (this.config?.silent !== undefined) {
                    this.options.silent = this.config.silent;
                }
                if (!this.options.silent) {
                    console.log("✅ Loaded config from .unused-css-scanner.json");
                }
            }
            catch (error) {
                console.error("❌ Error loading config file:", error);
            }
        }
    }
    /**
     * Create a default config file
     */
    createConfigFile() {
        const configPath = path.join(process.cwd(), ".unused-css-scanner.json");
        if (fs.existsSync(configPath)) {
            console.log("⚠️  Config file already exists: .unused-css-scanner.json");
            return;
        }
        const defaultConfig = {
            extensions: [".tsx", ".ts", ".jsx", ".js"],
            ignore: [
                "node_modules/**",
                "**/*.test.*",
                "**/*.spec.*",
                "dist/**",
                "build/**",
            ],
            autoFix: false,
            scanOnSave: false,
            watchFolders: ["src"],
            silent: false,
        };
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), "utf-8");
        console.log("✅ Created config file: .unused-css-scanner.json");
        console.log("\nEdit the file to customize your settings:");
        console.log("  - extensions: File types to scan");
        console.log("  - ignore: Patterns to ignore");
        console.log("  - autoFix: Auto-delete unused styles");
        console.log("  - scanOnSave: Watch files and scan on save");
        console.log("  - watchFolders: Folders to watch when scanOnSave is true");
        console.log("  - silent: Reduce console output\n");
    }
    /**
     * Start watch mode
     */
    startWatchMode() {
        if (!this.config) {
            console.log("❌ Config file not found. Run: unused-css-scanner init");
            return;
        }
        if (!this.config.scanOnSave) {
            console.log("❌ scanOnSave is disabled in config. Set it to true to use watch mode.");
            return;
        }
        const watchFolders = this.config.watchFolders || ["src"];
        this.watchMode = true;
        console.log("\n👀 Watch Mode Started");
        console.log("═".repeat(60));
        console.log(`Watching folders: ${watchFolders.join(", ")}`);
        console.log(`Auto-fix: ${this.config.autoFix ? "ON" : "OFF"}`);
        console.log("Press Ctrl+C to stop\n");
        for (const folder of watchFolders) {
            if (!fs.existsSync(folder)) {
                console.log(`⚠️  Folder not found: ${folder}`);
                continue;
            }
            const watcher = fs.watch(folder, { recursive: true }, (eventType, filename) => {
                if (!filename)
                    return;
                const ext = path.extname(filename);
                if (!this.options.extensions.includes(ext))
                    return;
                const filePath = path.join(folder, filename);
                if (this.shouldIgnore(filePath))
                    return;
                if (eventType === "change") {
                    this.handleFileChange(filePath);
                }
            });
            this.fileWatchers.push(watcher);
        }
        // Keep process running
        process.on("SIGINT", () => {
            this.stopWatchMode();
            process.exit(0);
        });
    }
    /**
     * Stop watch mode
     */
    stopWatchMode() {
        console.log("\n\n🛑 Stopping watch mode...");
        this.fileWatchers.forEach((watcher) => watcher.close());
        this.fileWatchers = [];
        console.log("✅ Watch mode stopped\n");
    }
    /**
     * Handle file change in watch mode
     */
    async handleFileChange(filePath) {
        if (!this.options.silent) {
            console.log(`\n📝 File changed: ${filePath}`);
        }
        // Wait a bit for file to be fully written
        await new Promise((resolve) => setTimeout(resolve, 100));
        const result = this.scanFile(filePath);
        if (!result || result.definedStyles.length === 0) {
            return;
        }
        if (result.unusedStyles.length === 0) {
            if (!this.options.silent) {
                console.log("   ✅ No unused styles");
            }
            return;
        }
        console.log(`   ⚠️  Found ${result.unusedStyles.length} unused style(s):`);
        result.unusedStyles.forEach((style) => {
            console.log(`      - ${style.name}`);
        });
        if (this.config?.autoFix) {
            const success = await this.removeUnusedStyles(filePath, result.unusedStyles);
            if (success) {
                console.log(`   ✅ Auto-fixed: Removed ${result.unusedStyles.length} unused style(s)`);
            }
        }
        else {
            console.log("   ℹ️  Set autoFix: true in config to auto-remove");
        }
    }
    /**
     * Ask user a question and return the answer
     */
    async askQuestion(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });
    }
    /**
     * Extract style names from StyleSheet.create() calls
     */
    extractDefinedStyles(content) {
        const styles = [];
        const styleSheetRegex = /StyleSheet\.create\s*\(\s*\{([\s\S]*?)\}\s*\)/;
        const match = content.match(styleSheetRegex);
        if (!match)
            return styles;
        const styleBlock = match[1];
        const blockStartIndex = match.index + match[0].indexOf("{") + 1;
        const styleDefinitionRegex = /(\w+)\s*:\s*\{[^}]*\}/g;
        let styleMatch;
        while ((styleMatch = styleDefinitionRegex.exec(styleBlock)) !== null) {
            const styleName = styleMatch[1];
            const styleStartPos = blockStartIndex + styleMatch.index;
            const styleEndPos = styleStartPos + styleMatch[0].length;
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
    extractUsedStyles(content) {
        const usedStyles = [];
        const directStyleRegex = /styles\.(\w+)/g;
        let match;
        while ((match = directStyleRegex.exec(content)) !== null) {
            usedStyles.push(match[1]);
        }
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
    readFile(filePath) {
        try {
            return fs.readFileSync(filePath, "utf-8");
        }
        catch (error) {
            console.error(`❌ Error reading file ${filePath}:`, error);
            return null;
        }
    }
    /**
     * Check if file should be ignored
     */
    shouldIgnore(filePath) {
        return this.options.ignorePatterns.some((pattern) => pattern.test(filePath));
    }
    /**
     * Get all files in a directory recursively
     */
    getAllFiles(dirPath, arrayOfFiles = []) {
        try {
            const files = fs.readdirSync(dirPath);
            files.forEach((file) => {
                const fullPath = path.join(dirPath, file);
                if (this.shouldIgnore(fullPath)) {
                    return;
                }
                if (fs.statSync(fullPath).isDirectory()) {
                    arrayOfFiles = this.getAllFiles(fullPath, arrayOfFiles);
                }
                else {
                    const ext = path.extname(file);
                    if (this.options.extensions.includes(ext)) {
                        arrayOfFiles.push(fullPath);
                    }
                }
            });
            return arrayOfFiles;
        }
        catch (error) {
            console.error(`❌ Error reading directory ${dirPath}:`, error);
            return arrayOfFiles;
        }
    }
    /**
     * Scan a single file for unused styles
     */
    scanFile(filePath) {
        if (this.shouldIgnore(filePath)) {
            return null;
        }
        const content = this.readFile(filePath);
        if (!content) {
            return null;
        }
        const definedStyles = this.extractDefinedStyles(content);
        const usedStyles = this.extractUsedStyles(content);
        const unusedStyles = definedStyles.filter((style) => !usedStyles.includes(style.name));
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
    async removeUnusedStyles(filePath, unusedStyles) {
        try {
            let content = this.readFile(filePath);
            if (!content)
                return false;
            const styleSheetRegex = /StyleSheet\.create\s*\(\s*\{([\s\S]*?)\}\s*\)/;
            const match = content.match(styleSheetRegex);
            if (!match)
                return false;
            let styleBlock = match[1];
            const originalStyleBlock = styleBlock;
            for (const unusedStyle of unusedStyles) {
                const styleNameEscaped = unusedStyle.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const styleDefRegex = new RegExp(`\\s*${styleNameEscaped}\\s*:\\s*\\{[^}]*\\}\\s*,?\\s*`, "g");
                styleBlock = styleBlock.replace(styleDefRegex, "");
            }
            styleBlock = styleBlock.replace(/,(\s*$)/g, "$1");
            styleBlock = styleBlock.replace(/,\s*,/g, ",");
            const newContent = content.replace(originalStyleBlock, styleBlock);
            fs.writeFileSync(filePath, newContent, "utf-8");
            return true;
        }
        catch (error) {
            console.error(`❌ Error removing styles from ${filePath}:`, error);
            return false;
        }
    }
    /**
     * Generate a report of unused styles
     */
    generateReport(results) {
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
        report += `   Usage Rate: ${totalDefined > 0 ? ((totalUsed / totalDefined) * 100).toFixed(2) : 0}%\n`;
        return report;
    }
    /**
     * Interactive mode
     */
    async interactiveScan() {
        console.log("\n🔍 Unused CSS Scanner - Interactive Mode\n");
        console.log("═".repeat(60));
        const inputPath = await this.askQuestion("\n📁 Enter the folder or file path to scan (e.g., src/ or App.tsx): ");
        if (!fs.existsSync(inputPath)) {
            console.log(`\n❌ Path not found: ${inputPath}`);
            this.rl.close();
            return;
        }
        const stat = fs.statSync(inputPath);
        let allFiles = [];
        if (stat.isFile()) {
            const ext = path.extname(inputPath);
            if (this.options.extensions.includes(ext)) {
                allFiles = [inputPath];
            }
            else {
                console.log(`\n❌ File type not supported. Only .tsx/.jsx/.ts/.js files are supported.`);
                this.rl.close();
                return;
            }
        }
        else if (stat.isDirectory()) {
            allFiles = this.getAllFiles(inputPath);
        }
        if (allFiles.length === 0) {
            console.log(`\n❌ No .tsx/.jsx/.ts/.js files found in ${inputPath}`);
            this.rl.close();
            return;
        }
        console.log(`\n✅ Found ${allFiles.length} file(s)\n`);
        if (allFiles.length === 1) {
            await this.scanSingleFileInteractive(allFiles[0]);
            this.rl.close();
            return;
        }
        const scanMode = await this.askQuestion("📋 Scan mode:\n   1) Scan all files at once\n   2) Scan files one by one\n\nChoose (1 or 2): ");
        if (scanMode === "1") {
            await this.scanAllFiles(allFiles);
        }
        else if (scanMode === "2") {
            await this.scanFilesOneByOne(allFiles);
        }
        else {
            console.log("\n❌ Invalid choice. Exiting.");
        }
        this.rl.close();
    }
    async scanSingleFileInteractive(file) {
        console.log(`\n🔍 Scanning ${file}...\n`);
        const result = this.scanFile(file);
        if (!result || result.definedStyles.length === 0) {
            console.log("   ℹ️  No styles found in this file.\n");
            return;
        }
        if (result.unusedStyles.length === 0) {
            console.log("   ✅ No unused styles! This file is clean.\n");
            console.log(`   Total Styles: ${result.definedStyles.length} | All Used: ${result.usedStyles.length}\n`);
            return;
        }
        console.log(`   Total Defined: ${result.definedStyles.length} | Used: ${result.usedStyles.length} | Unused: ${result.unusedStyles.length}\n`);
        result.unusedStyles.forEach((style) => {
            console.log(`   ❌ ${style.name}`);
        });
        const deleteChoice = await this.askQuestion("\n   🗑️  Delete unused styles from this file? (yes/no): ");
        if (deleteChoice.toLowerCase() === "yes" ||
            deleteChoice.toLowerCase() === "y") {
            const success = await this.removeUnusedStyles(file, result.unusedStyles);
            if (success) {
                console.log(`   ✅ Removed ${result.unusedStyles.length} unused style(s)\n`);
            }
        }
        else {
            console.log("   ❌ Skipped\n");
        }
    }
    async scanAllFiles(files) {
        console.log("\n🔄 Scanning all files...\n");
        const results = [];
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
            const deleteChoice = await this.askQuestion("\n🗑️  Do you want to delete all unused styles? (yes/no): ");
            if (deleteChoice.toLowerCase() === "yes" ||
                deleteChoice.toLowerCase() === "y") {
                console.log("\n🔄 Deleting unused styles...\n");
                for (const result of results) {
                    if (result.unusedStyles.length > 0) {
                        const success = await this.removeUnusedStyles(result.file, result.unusedStyles);
                        if (success) {
                            console.log(`✅ Removed ${result.unusedStyles.length} unused style(s) from ${result.file}`);
                        }
                    }
                }
                console.log("\n✅ Cleanup complete!");
            }
            else {
                console.log("\n❌ Cleanup cancelled.");
            }
        }
    }
    async scanFilesOneByOne(files) {
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
            console.log(`   Total Defined: ${result.definedStyles.length} | Used: ${result.usedStyles.length} | Unused: ${result.unusedStyles.length}\n`);
            result.unusedStyles.forEach((style) => {
                console.log(`   ❌ ${style.name}`);
            });
            const deleteChoice = await this.askQuestion("\n   🗑️  Delete unused styles from this file? (yes/no): ");
            if (deleteChoice.toLowerCase() === "yes" ||
                deleteChoice.toLowerCase() === "y") {
                const success = await this.removeUnusedStyles(file, result.unusedStyles);
                if (success) {
                    console.log(`   ✅ Removed ${result.unusedStyles.length} unused style(s)\n`);
                }
            }
            else {
                console.log("   ❌ Skipped\n");
            }
        }
        console.log("\n✅ Scan complete!");
    }
    close() {
        this.rl.close();
    }
}
exports.UnusedCSSScanner = UnusedCSSScanner;
exports.default = UnusedCSSScanner;
// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    const scanner = new UnusedCSSScanner({ interactive: true });
    const showHelp = () => {
        console.log(`
🔍 Unused CSS Scanner - Clean up your React Native StyleSheets

Usage:
  unused-css-scanner                Start interactive mode
  unused-css-scanner scan           Start interactive mode
  unused-css-scanner init           Create config file
  unused-css-scanner watch          Start watch mode (requires config)
  unused-css-scanner <file>         Scan a specific file
  unused-css-scanner <folder>       Scan all files in folder
  unused-css-scanner help           Show this help message
  unused-css-scanner --version      Show version

Commands:
  init                              Create .unused-css-scanner.json config file
  watch                             Watch files and auto-scan on save
  scan                              Interactive scan mode

Configuration File (.unused-css-scanner.json):
  {
    "extensions": [".tsx", ".ts", ".jsx", ".js"],
    "ignore": ["node_modules/**", "**/*.test.*"],
    "autoFix": false,              // Auto-delete unused styles
    "scanOnSave": true,            // Enable watch mode
    "watchFolders": ["src"],       // Folders to watch
    "silent": false                // Reduce console output
  }

Examples:
  unused-css-scanner init           # Create config file
  unused-css-scanner watch          # Start watching (needs config)
  unused-css-scanner scan           # Interactive mode
  unused-css-scanner src/           # Scan src folder
  unused-css-scanner App.tsx        # Scan single file

Options:
  --help, -h                        Show help
  --version, -v                     Show version

📦 Package: unused-css-scanner
🔗 NPM: https://www.npmjs.com/package/unused-css-scanner
`);
    };
    const showVersion = () => {
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8"));
            console.log(`unused-css-scanner v${packageJson.version}`);
        }
        catch {
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
    if (command === "init") {
        scanner.createConfigFile();
        process.exit(0);
    }
    if (command === "watch") {
        scanner.startWatchMode();
        // Keep running
    }
    else if (command === "scan" || args.length === 0) {
        scanner.interactiveScan().catch((error) => {
            console.error("Error:", error);
            scanner.close();
            process.exit(1);
        });
    }
    else {
        const target = args[0];
        if (!fs.existsSync(target)) {
            console.error(`❌ File or folder not found: ${target}`);
            process.exit(1);
        }
        const results = [];
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
        }
        else {
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
