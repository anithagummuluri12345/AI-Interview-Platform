import { Injectable, Logger } from '@nestjs/common';
import { CodeExecutionProvider, CodeExecutionResult } from '../interfaces/code-execution.interface';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class LocalCodeExecutor implements CodeExecutionProvider {
  private readonly logger = new Logger(LocalCodeExecutor.name);

  async execute(
    sourceCode: string,
    language: string,
    testCases: Array<{ input: string; expectedOutput: string }>,
  ): Promise<CodeExecutionResult> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-exec-'));
    let executionTimeMs = 0;
    let passedTests = 0;
    let stdoutAcc = '';
    let stderrAcc = '';

    try {
      const config = this.getLanguageConfig(language, tempDir);
      const filePath = path.join(tempDir, config.fileName);
      fs.writeFileSync(filePath, sourceCode);

      // 1. Compilation Step (if compileCmd is specified)
      if (config.compileCmd) {
        // Double check if compilation utility is available locally, otherwise fallback with clean error
        try {
          const compileRes = await this.runProcess(config.compileCmd, config.compileArgs || [], '', 5000);
          if (compileRes.code !== 0) {
            return {
              stdout: '',
              stderr: compileRes.stderr || 'Compilation failed',
              error: 'Compilation Error',
              status: 'COMPILATION_ERROR',
              passedTests: 0,
              totalTests: testCases.length,
            };
          }
        } catch (err: any) {
          this.logger.warn(`Compiler ${config.compileCmd} not available locally. Failing gracefully.`, err);
          return {
            stdout: '',
            stderr: `Compiler ${config.compileCmd} is not installed or available on PATH in local environment.`,
            error: 'Compilation Error',
            status: 'COMPILATION_ERROR',
            passedTests: 0,
            totalTests: testCases.length,
          };
        }
      }

      // 2. Execution Step for each testcase
      for (const tc of testCases) {
        const start = Date.now();
        let execRes;
        try {
          execRes = await this.runProcess(config.command, config.args, tc.input, 3000);
        } catch (err: any) {
          this.logger.warn(`Runner command ${config.command} failed to execute locally.`, err);
          return {
            stdout: stdoutAcc,
            stderr: stderrAcc + `\nLocal runner ${config.command} failed to execute: ${err.message}`,
            error: 'Runtime Error',
            status: 'RUNTIME_ERROR',
            executionTimeMs: Date.now() - start,
            passedTests,
            totalTests: testCases.length,
          };
        }

        executionTimeMs += Date.now() - start;

        if (execRes.timeout) {
          return {
            stdout: stdoutAcc,
            stderr: stderrAcc + `\nTest case timed out (Limit: 3000ms)`,
            error: 'Time Limit Exceeded',
            status: 'TIME_LIMIT_EXCEEDED',
            executionTimeMs,
            passedTests,
            totalTests: testCases.length,
          };
        }

        if (execRes.code !== 0) {
          return {
            stdout: stdoutAcc + `\n${execRes.stdout}`,
            stderr: stderrAcc + `\n${execRes.stderr}`,
            error: 'Runtime Error',
            status: 'RUNTIME_ERROR',
            executionTimeMs,
            passedTests,
            totalTests: testCases.length,
          };
        }

        const cleanOut = execRes.stdout.trim();
        const cleanExpected = tc.expectedOutput.trim();

        if (cleanOut === cleanExpected) {
          passedTests++;
        }
        stdoutAcc += `Case Input: ${tc.input}\nOutput: ${execRes.stdout}\n`;
        stderrAcc += execRes.stderr;
      }

      return {
        stdout: stdoutAcc,
        stderr: stderrAcc,
        status: passedTests === testCases.length ? 'ACCEPTED' : 'WRONG_ANSWER',
        executionTimeMs: Math.round(executionTimeMs / Math.max(1, testCases.length)),
        passedTests,
        totalTests: testCases.length,
      };
    } catch (err: any) {
      this.logger.error('Code execution system failure', err);
      return {
        stdout: '',
        stderr: err.message || 'Unknown code execution engine failure',
        status: 'RUNTIME_ERROR',
        passedTests: 0,
        totalTests: testCases.length,
      };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {
        this.logger.warn('Failed to clean up transient execution directory', err);
      }
    }
  }

  private runProcess(
    command: string,
    args: string[],
    input: string,
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string; code: number | null; timeout: boolean }> {
    return new Promise((resolve, reject) => {
      let child;
      try {
        child = spawn(command, args);
      } catch (err) {
        return reject(err);
      }

      let stdout = '';
      let stderr = '';
      let timer: NodeJS.Timeout | null = null;
      let finished = false;

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        resolve({ stdout, stderr, code, timeout: false });
      });

      child.on('error', (err: any) => {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        reject(err);
      });

      if (input) {
        child.stdin.write(input);
      }
      child.stdin.end();

      timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore kill failures
        }
        resolve({ stdout, stderr, code: null, timeout: true });
      }, timeoutMs);
    });
  }

  private getLanguageConfig(
    language: string,
    tempDir: string,
  ): {
    fileName: string;
    command: string;
    args: string[];
    compileCmd?: string;
    compileArgs?: string[];
  } {
    const lang = language.toUpperCase();
    const isWindows = process.platform === 'win32';
    const binaryExt = isWindows ? '.exe' : '';

    switch (lang) {
      case 'JAVASCRIPT':
        return {
          fileName: 'solution.js',
          command: 'node',
          args: ['--max-old-space-size=128', path.join(tempDir, 'solution.js')],
        };
      case 'TYPESCRIPT':
        return {
          fileName: 'solution.ts',
          command: 'node',
          args: [path.join(tempDir, 'solution.ts')],
        };
      case 'PYTHON':
        return {
          fileName: 'solution.py',
          command: isWindows ? 'python' : 'python3',
          args: [path.join(tempDir, 'solution.py')],
        };
      case 'JAVA':
        return {
          fileName: 'Solution.java',
          command: 'java',
          args: ['-Xmx128m', '-cp', tempDir, 'Solution'],
          compileCmd: 'javac',
          compileArgs: [path.join(tempDir, 'Solution.java')],
        };
      case 'CPP':
        return {
          fileName: 'solution.cpp',
          command: path.join(tempDir, `solution${binaryExt}`),
          args: [],
          compileCmd: 'g++',
          compileArgs: ['-O3', path.join(tempDir, 'solution.cpp'), '-o', path.join(tempDir, `solution${binaryExt}`)],
        };
      case 'C':
        return {
          fileName: 'solution.c',
          command: path.join(tempDir, `solution${binaryExt}`),
          args: [],
          compileCmd: 'gcc',
          compileArgs: ['-O3', path.join(tempDir, 'solution.c'), '-o', path.join(tempDir, `solution${binaryExt}`)],
        };
      default:
        throw new Error(`Unsupported programming language: ${language}`);
    }
  }
}
