import * as fs from 'fs';
import * as path from 'path';
import { Config } from './types';

const DEFAULT_CONFIG: Required<Config> = {
  ignore: ['node_modules/**', '**/*.test.*', '**/*.spec.*', 'dist/**', 'build/**'],
  extensions: ['.tsx', '.ts', '.jsx', '.js'],
  autoFix: false,
  backup: true,
  checkGit: true,
  dryRun: false,
  thresholds: {
    maxStylesPerFile: 50,
    minUsageRate: 80,
  },
};

export class ConfigLoader {
  private static CONFIG_FILES = [
    '.unusedcssrc.json',
    '.unusedcssrc',
    'unusedcss.config.json',
  ];

  static load(configPath?: string): Required<Config> {
    if (configPath) {
      return this.loadFromPath(configPath);
    }

    for (const fileName of this.CONFIG_FILES) {
      const filePath = path.join(process.cwd(), fileName);
      if (fs.existsSync(filePath)) {
        return this.loadFromPath(filePath);
      }
    }

    return DEFAULT_CONFIG;
  }

  private static loadFromPath(filePath: string): Required<Config> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const userConfig = JSON.parse(content) as Partial<Config>;
      return this.mergeConfig(userConfig);
    } catch (error) {
      console.warn(`Warning: Failed to load config from ${filePath}:`, error);
      return DEFAULT_CONFIG;
    }
  }

  private static mergeConfig(userConfig: Partial<Config>): Required<Config> {
    return {
      ignore: userConfig.ignore || DEFAULT_CONFIG.ignore,
      extensions: userConfig.extensions || DEFAULT_CONFIG.extensions,
      autoFix: userConfig.autoFix ?? DEFAULT_CONFIG.autoFix,
      backup: userConfig.backup ?? DEFAULT_CONFIG.backup,
      checkGit: userConfig.checkGit ?? DEFAULT_CONFIG.checkGit,
      dryRun: userConfig.dryRun ?? DEFAULT_CONFIG.dryRun,
      thresholds: {
        maxStylesPerFile: userConfig.thresholds?.maxStylesPerFile ?? DEFAULT_CONFIG.thresholds.maxStylesPerFile,
        minUsageRate: userConfig.thresholds?.minUsageRate ?? DEFAULT_CONFIG.thresholds.minUsageRate,
      },
    };
  }

  static getDefault(): Required<Config> {
    return { ...DEFAULT_CONFIG };
  }
}
