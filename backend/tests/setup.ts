import dotenv from 'dotenv';

// Load test environment variables before any module imports
dotenv.config({ path: '.env.test' });

// Ensure NODE_ENV is test and connects strictly to isolated test database
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = process.env.DB_NAME_TEST || 'sabir_plastic_erp_test';
process.env.DB_NAME = process.env.DB_NAME_TEST;
