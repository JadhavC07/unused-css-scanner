import * as fs from 'fs';
import * as path from 'path';
import { BackupInfo } from './types';

export class BackupManager {
  private backups: Map<string, BackupInfo> = new Map();
  private backupDir: string;

  constructor(backupDir: string = '.unused-css-backups') {
    this.backupDir = path.join(process.cwd(), backupDir);
  }

  createBackup(filePath: string): BackupInfo {
    const timestamp = Date.now();
    const fileName = path.basename(filePath);
    const backupFileName = `${fileName}.${timestamp}.backup`;
    const backupPath = path.join(this.backupDir, backupFileName);

    try {
      // Create backup directory if it doesn't exist
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      // Copy file to backup
      fs.copyFileSync(filePath, backupPath);

      const backupInfo: BackupInfo = {
        originalPath: filePath,
        backupPath,
        timestamp,
      };

      this.backups.set(filePath, backupInfo);
      return backupInfo;
    } catch (error) {
      throw new Error(`Failed to create backup for ${filePath}: ${error}`);
    }
  }

  restoreBackup(filePath: string): boolean {
    const backupInfo = this.backups.get(filePath);
    if (!backupInfo) {
      throw new Error(`No backup found for ${filePath}`);
    }

    try {
      fs.copyFileSync(backupInfo.backupPath, filePath);
      return true;
    } catch (error) {
      throw new Error(`Failed to restore backup for ${filePath}: ${error}`);
    }
  }

  restoreAll(): number {
    let restored = 0;
    for (const [filePath] of this.backups) {
      try {
        this.restoreBackup(filePath);
        restored++;
      } catch (error) {
        console.error(`Failed to restore ${filePath}:`, error);
      }
    }
    return restored;
  }

  deleteBackup(filePath: string): boolean {
    const backupInfo = this.backups.get(filePath);
    if (!backupInfo) {
      return false;
    }

    try {
      fs.unlinkSync(backupInfo.backupPath);
      this.backups.delete(filePath);
      return true;
    } catch (error) {
      console.error(`Failed to delete backup for ${filePath}:`, error);
      return false;
    }
  }

  deleteAllBackups(): number {
    let deleted = 0;
    for (const [filePath] of this.backups) {
      if (this.deleteBackup(filePath)) {
        deleted++;
      }
    }

    // Remove backup directory if empty
    try {
      if (fs.existsSync(this.backupDir)) {
        const files = fs.readdirSync(this.backupDir);
        if (files.length === 0) {
          fs.rmdirSync(this.backupDir);
        }
      }
    } catch (error) {
      console.error('Failed to remove backup directory:', error);
    }

    return deleted;
  }

  getBackupInfo(filePath: string): BackupInfo | undefined {
    return this.backups.get(filePath);
  }

  hasBackup(filePath: string): boolean {
    return this.backups.has(filePath);
  }

  getBackupCount(): number {
    return this.backups.size;
  }
}
