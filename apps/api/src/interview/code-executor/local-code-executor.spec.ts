import { LocalCodeExecutor } from './local-code-executor.service';

describe('LocalCodeExecutor (Phase 11A unit tests)', () => {
  let executor: LocalCodeExecutor;

  beforeEach(() => {
    executor = new LocalCodeExecutor();
  });

  it('should successfully run a Javascript solution and pass matching test cases', async () => {
    // Stdin reading format matching problem lifecycle
    const code = `
      const fs = require('fs');
      const input = fs.readFileSync(0, 'utf-8').trim();
      const num = parseInt(input, 10);
      console.log(num * num);
    `;

    const testCases = [
      { input: '4', expectedOutput: '16' },
      { input: '5', expectedOutput: '25' },
    ];

    const result = await executor.execute(code, 'JAVASCRIPT', testCases);

    expect(result.status).toBe('ACCEPTED');
    expect(result.passedTests).toBe(2);
    expect(result.totalTests).toBe(2);
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should flag wrong answer if output does not match expected output', async () => {
    const code = `
      const fs = require('fs');
      const input = fs.readFileSync(0, 'utf-8').trim();
      console.log(input + " wrong");
    `;

    const testCases = [
      { input: 'hello', expectedOutput: 'hello correct' },
    ];

    const result = await executor.execute(code, 'JAVASCRIPT', testCases);

    expect(result.status).toBe('WRONG_ANSWER');
    expect(result.passedTests).toBe(0);
    expect(result.totalTests).toBe(1);
  });

  it('should catch runtime syntax crashes and return RUNTIME_ERROR', async () => {
    const code = `
      // Invalid code reference triggering runtime crash
      console.log(undefinedVar.prop);
    `;

    const testCases = [
      { input: 'test', expectedOutput: 'out' },
    ];

    const result = await executor.execute(code, 'JAVASCRIPT', testCases);

    expect(result.status).toBe('RUNTIME_ERROR');
    expect(result.passedTests).toBe(0);
    expect(result.error).toBe('Runtime Error');
  });

  it('should enforce execution timeout and return TIME_LIMIT_EXCEEDED for infinite loops', async () => {
    const code = `
      // Infinite loop to test SIGKILL timeout guard
      while (true) {}
    `;

    const testCases = [
      { input: 'test', expectedOutput: 'out' },
    ];

    const result = await executor.execute(code, 'JAVASCRIPT', testCases);

    expect(result.status).toBe('TIME_LIMIT_EXCEEDED');
    expect(result.error).toBe('Time Limit Exceeded');
  });
});
