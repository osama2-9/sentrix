// Disable Redis in tests by setting environment variable
process.env.REDIS_URL = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long-for-testing';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Mock node-fetch to prevent ESM import issues
jest.mock('node-fetch', () => {
    return {
        __esModule: true,
        default: jest.fn(),
        Response: jest.fn(),
    };
});

// Cleanup after tests
afterAll(async () => {
    // Give time for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
});