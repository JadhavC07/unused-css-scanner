export interface StyleDefinition {
  name: string;
  startLine: number;
  endLine: number;
  startPos: number;
  endPos: number;
}

export interface StyleUsage {
  file: string;
  definedStyles: StyleDefinition[];
  usedStyles: string[];
  unusedStyles: StyleDefinition[];
}

export interface ScanOptions {
  files?: string[];
  extensions?: string[];
  ignorePatterns?: RegExp[];
  interactive?: boolean;
  dryRun?: boolean;
  backup?: boolean;
  checkGit?: boolean;
  configPath?: string;
}

export interface Config {
  ignore?: string[];
  extensions?: string[];
  autoFix?: boolean;
  backup?: boolean;
  checkGit?: boolean;
  dryRun?: boolean;
  thresholds?: {
    maxStylesPerFile?: number;
    minUsageRate?: number;
  };
}

export interface ScanResult {
  results: StyleUsage[];
  report: string;
  totalDefined: number;
  totalUsed: number;
  totalUnused: number;
  usageRate: number;
}

export interface BackupInfo {
  originalPath: string;
  backupPath: string;
  timestamp: number;
}

export interface GitStatus {
  isGitRepo: boolean;
  hasUncommittedChanges: boolean;
  branch: string | null;
}

export interface DeleteResult {
  success: boolean;
  file: string;
  deletedCount: number;
  backup?: BackupInfo;
  error?: string;
}
