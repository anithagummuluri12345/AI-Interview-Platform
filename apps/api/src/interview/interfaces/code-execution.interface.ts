export interface CodeExecutionResult {
  stdout: string;
  stderr: string;
  error?: string;
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'TIME_LIMIT_EXCEEDED' | 'COMPILATION_ERROR' | 'RUNTIME_ERROR';
  executionTimeMs?: number;
  memoryUsedKb?: number;
  passedTests: number;
  totalTests: number;
}

export interface CodeExecutionProvider {
  execute(
    sourceCode: string,
    language: string,
    testCases: Array<{ input: string; expectedOutput: string }>,
  ): Promise<CodeExecutionResult>;
}
