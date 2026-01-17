import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { join } from 'path';
import { existsSync } from 'fs';

export interface UpdateOptions {
  repositoryUrl: string;
  branch: string;
  workingDirectory?: string;
}

export interface UpdateProgress {
  stage: 'fetching' | 'resetting' | 'installing' | 'completed' | 'error';
  message: string;
  percentage?: number;
  error?: string;
}

export class SystemUpdater extends EventEmitter {
  private isUpdating: boolean = false;
  private currentProcess: any = null;

  async update(options: UpdateOptions): Promise<void> {
    if (this.isUpdating) {
      throw new Error('Update already in progress');
    }

    this.isUpdating = true;
    const workingDir = options.workingDirectory || process.cwd();

    try {
      // Validate repository URL
      if (!this.isValidRepositoryUrl(options.repositoryUrl)) {
        throw new Error('Invalid repository URL');
      }

      // Validate working directory
      if (!existsSync(workingDir)) {
        throw new Error('Working directory does not exist');
      }

      // Check if it's a git repository
      if (!this.isGitRepository(workingDir)) {
        throw new Error('Working directory is not a git repository');
      }

      // Fetch latest changes
      await this.fetchChanges(workingDir, options.repositoryUrl, options.branch);
      
      // Reset to latest commit
      await this.resetToBranch(workingDir, options.branch);
      
      // Install dependencies
      await this.installDependencies(workingDir);
      
      this.emit('progress', {
        stage: 'completed',
        message: 'Update completed successfully',
        percentage: 100
      });

    } catch (error) {
      this.emit('progress', {
        stage: 'error',
        message: 'Update failed',
        error: error.message
      });
      throw error;
    } finally {
      this.isUpdating = false;
      this.currentProcess = null;
    }
  }

  private isValidRepositoryUrl(url: string): boolean {
    // Basic validation for GitHub URLs
    const githubPattern = /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/;
    return githubPattern.test(url);
  }

  private isGitRepository(directory: string): boolean {
    return existsSync(join(directory, '.git'));
  }

  private async fetchChanges(workingDir: string, repositoryUrl: string, branch: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.emit('progress', {
        stage: 'fetching',
        message: 'Fetching latest changes from repository...',
        percentage: 0
      });

      // Add remote if not exists
      const addRemote = spawn('git', ['remote', 'add', 'upstream', repositoryUrl], {
        cwd: workingDir,
        stdio: 'pipe'
      });

      addRemote.on('close', (code) => {
        // Continue even if remote already exists
        this.performFetch(workingDir, branch, resolve, reject);
      });
    });
  }

  private performFetch(workingDir: string, branch: string, resolve: () => void, reject: (error: Error) => void): void {
    const fetch = spawn('git', ['fetch', 'upstream', branch], {
      cwd: workingDir,
      stdio: 'pipe'
    });

    this.currentProcess = fetch;

    let output = '';
    let errorOutput = '';

    fetch.stdout.on('data', (data) => {
      output += data.toString();
      this.emit('output', data.toString());
    });

    fetch.stderr.on('data', (data) => {
      errorOutput += data.toString();
      this.emit('output', data.toString());
    });

    fetch.on('close', (code) => {
      if (code === 0) {
        this.emit('progress', {
          stage: 'fetching',
          message: 'Fetch completed',
          percentage: 25
        });
        resolve();
      } else {
        reject(new Error(`Fetch failed with code ${code}: ${errorOutput}`));
      }
    });

    fetch.on('error', (error) => {
      reject(new Error(`Fetch process error: ${error.message}`));
    });
  }

  private async resetToBranch(workingDir: string, branch: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.emit('progress', {
        stage: 'resetting',
        message: `Resetting to ${branch} branch...`,
        percentage: 25
      });

      const reset = spawn('git', ['reset', '--hard', `upstream/${branch}`], {
        cwd: workingDir,
        stdio: 'pipe'
      });

      this.currentProcess = reset;

      let output = '';
      let errorOutput = '';

      reset.stdout.on('data', (data) => {
        output += data.toString();
        this.emit('output', data.toString());
      });

      reset.stderr.on('data', (data) => {
        errorOutput += data.toString();
        this.emit('output', data.toString());
      });

      reset.on('close', (code) => {
        if (code === 0) {
          this.emit('progress', {
            stage: 'resetting',
            message: 'Reset completed',
            percentage: 50
          });
          resolve();
        } else {
          reject(new Error(`Reset failed with code ${code}: ${errorOutput}`));
        }
      });

      reset.on('error', (error) => {
        reject(new Error(`Reset process error: ${error.message}`));
      });
    });
  }

  private async installDependencies(workingDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.emit('progress', {
        stage: 'installing',
        message: 'Installing dependencies...',
        percentage: 50
      });

      // Check if package.json exists
      const packageJsonPath = join(workingDir, 'package.json');
      if (!existsSync(packageJsonPath)) {
        this.emit('progress', {
          stage: 'installing',
          message: 'No package.json found, skipping dependency installation',
          percentage: 75
        });
        resolve();
        return;
      }

      const install = spawn('npm', ['install'], {
        cwd: workingDir,
        stdio: 'pipe'
      });

      this.currentProcess = install;

      let output = '';
      let errorOutput = '';

      install.stdout.on('data', (data) => {
        output += data.toString();
        this.emit('output', data.toString());
      });

      install.stderr.on('data', (data) => {
        errorOutput += data.toString();
        this.emit('output', data.toString());
      });

      install.on('close', (code) => {
        if (code === 0) {
          this.emit('progress', {
            stage: 'installing',
            message: 'Dependencies installed successfully',
            percentage: 75
          });
          resolve();
        } else {
          reject(new Error(`npm install failed with code ${code}: ${errorOutput}`));
        }
      });

      install.on('error', (error) => {
        reject(new Error(`Install process error: ${error.message}`));
      });
    });
  }

  public cancel(): void {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
    
    this.isUpdating = false;
    
    this.emit('progress', {
      stage: 'error',
      message: 'Update cancelled by user'
    });
  }

  public isUpdateInProgress(): boolean {
    return this.isUpdating;
  }

  public getCurrentProcess(): any {
    return this.currentProcess;
  }
}

export default SystemUpdater;