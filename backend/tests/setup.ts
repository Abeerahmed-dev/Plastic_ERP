import dotenv from 'dotenv';

// Load test environment variables before any module imports
dotenv.config({ path: '.env.test' });

// Ensure NODE_ENV is test
process.env.NODE_ENV = 'test';
