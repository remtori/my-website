/** Import this first in test files so `process.env` is set before `@/env` parses. */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret-at-least-32-chars-long';
process.env.ADMIN_USERNAME ??= 'admin';
process.env.ADMIN_PASSWORD ??= 'secret';
