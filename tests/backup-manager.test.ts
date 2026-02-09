import * as fs from 'fs';
import * as path from 'path';
import { BackupManager } from '../src/backup-manager';

describe('BackupManager', () => {
  const testDir = path.join(__dirname, 'fixtures');
  const testFile = path.join(testDir, 'test.txt');
  const backupDir = path.join(process.cwd(), '.test-backups');
  let manager: BackupManager;

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    manager = new BackupManager('.test-backups');
    fs.writeFileSync(testFile, 'original content');
  });

  afterEach(() => {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('createBackup', () => {
    it('should create backup file', () => {
      const backupInfo = manager.createBackup(testFile);

      expect(backupInfo.originalPath).toBe(testFile);
      expect(fs.existsSync(backupInfo.backupPath)).toBe(true);
      expect(fs.readFileSync(backupInfo.backupPath, 'utf-8')).toBe('original content');
    });

    it('should create backup directory if not exists', () => {
      expect(fs.existsSync(backupDir)).toBe(false);
      manager.createBackup(testFile);
      expect(fs.existsSync(backupDir)).toBe(true);
    });

    it('should throw error for non-existent file', () => {
      expect(() => manager.createBackup('non-existent.txt')).toThrow();
    });
  });

  describe('restoreBackup', () => {
    it('should restore file from backup', () => {
      manager.createBackup(testFile);
      
      fs.writeFileSync(testFile, 'modified content');
      expect(fs.readFileSync(testFile, 'utf-8')).toBe('modified content');

      manager.restoreBackup(testFile);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe('original content');
    });

    it('should throw error if no backup exists', () => {
      expect(() => manager.restoreBackup(testFile)).toThrow();
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup file', () => {
      const backupInfo = manager.createBackup(testFile);

      expect(fs.existsSync(backupInfo.backupPath)).toBe(true);
      manager.deleteBackup(testFile);
      expect(fs.existsSync(backupInfo.backupPath)).toBe(false);
    });

    it('should return false if no backup exists', () => {
      const result = manager.deleteBackup(testFile);
      expect(result).toBe(false);
    });
  });

  describe('getBackupInfo', () => {
    it('should return backup info', () => {
      const created = manager.createBackup(testFile);
      const info = manager.getBackupInfo(testFile);

      expect(info).toBeDefined();
      expect(info!.originalPath).toBe(created.originalPath);
      expect(info!.backupPath).toBe(created.backupPath);
    });

    it('should return undefined if no backup', () => {
      const info = manager.getBackupInfo(testFile);
      expect(info).toBeUndefined();
    });
  });

  describe('hasBackup', () => {
    it('should return true when backup exists', () => {
      manager.createBackup(testFile);
      expect(manager.hasBackup(testFile)).toBe(true);
    });

    it('should return false when no backup', () => {
      expect(manager.hasBackup(testFile)).toBe(false);
    });
  });

  describe('getBackupCount', () => {
    it('should return correct count', () => {
      expect(manager.getBackupCount()).toBe(0);
      
      manager.createBackup(testFile);
      expect(manager.getBackupCount()).toBe(1);
      
      const file2 = path.join(testDir, 'test2.txt');
      fs.writeFileSync(file2, 'content');
      manager.createBackup(file2);
      expect(manager.getBackupCount()).toBe(2);
      
      fs.unlinkSync(file2);
    });
  });

  describe('restoreAll', () => {
    it('should restore all backups', () => {
      const file2 = path.join(testDir, 'test2.txt');
      fs.writeFileSync(file2, 'original2');

      manager.createBackup(testFile);
      manager.createBackup(file2);

      fs.writeFileSync(testFile, 'modified1');
      fs.writeFileSync(file2, 'modified2');

      const restored = manager.restoreAll();

      expect(restored).toBe(2);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe('original content');
      expect(fs.readFileSync(file2, 'utf-8')).toBe('original2');

      fs.unlinkSync(file2);
    });
  });

  describe('deleteAllBackups', () => {
    it('should delete all backups', () => {
      const file2 = path.join(testDir, 'test2.txt');
      fs.writeFileSync(file2, 'content');

      const backup1 = manager.createBackup(testFile);
      const backup2 = manager.createBackup(file2);

      const deleted = manager.deleteAllBackups();

      expect(deleted).toBe(2);
      expect(fs.existsSync(backup1.backupPath)).toBe(false);
      expect(fs.existsSync(backup2.backupPath)).toBe(false);

      fs.unlinkSync(file2);
    });
  });
});
