import { execSync } from 'child_process';
import { GitStatus } from './types';

export class GitChecker {
  static check(directory: string = process.cwd()): GitStatus {
    const isGitRepo = this.isGitRepository(directory);

    if (!isGitRepo) {
      return {
        isGitRepo: false,
        hasUncommittedChanges: false,
        branch: null,
      };
    }

    return {
      isGitRepo: true,
      hasUncommittedChanges: this.hasUncommittedChanges(directory),
      branch: this.getCurrentBranch(directory),
    };
  }

  private static isGitRepository(directory: string): boolean {
    try {
      execSync('git rev-parse --git-dir', {
        cwd: directory,
        stdio: 'pipe',
      });
      return true;
    } catch {
      return false;
    }
  }

  private static hasUncommittedChanges(directory: string): boolean {
    try {
      const output = execSync('git status --porcelain', {
        cwd: directory,
        encoding: 'utf-8',
      });
      return output.trim().length > 0;
    } catch {
      return false;
    }
  }

  private static getCurrentBranch(directory: string): string | null {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: directory,
        encoding: 'utf-8',
      });
      return branch.trim();
    } catch {
      return null;
    }
  }

  static warnIfUnsafe(gitStatus: GitStatus): boolean {
    if (!gitStatus.isGitRepo) {
      console.warn('\n⚠️  Warning: Not a git repository. Changes cannot be reverted.');
      return false;
    }

    if (gitStatus.hasUncommittedChanges) {
      console.warn('\n⚠️  Warning: You have uncommitted changes.');
      console.warn('   It\'s recommended to commit your changes before running this tool.');
      return false;
    }

    console.log(`✓ Git repository clean (branch: ${gitStatus.branch})`);
    return true;
  }
}
