export default () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ai_interview',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'super-secret-access-key',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    liveModel: process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-latest',
    reportTimeoutMs: parseInt(process.env.AI_REPORT_TIMEOUT_MS || '90000', 10),
    codingTimeoutMs: parseInt(process.env.AI_CODING_TIMEOUT_MS || '90000', 10),
  },
});
