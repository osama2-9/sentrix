# SentriX

A comprehensive security middleware library for Express.js applications with built-in protection against common web vulnerabilities.

## Features

 **JWT Authentication** - Secure token-based authentication  
 **CSRF Protection** - Prevent Cross-Site Request Forgery attacks  
 **Rate Limiting** - Anti-DoS protection with Redis or in-memory storage  
 **Request Validation** - Type-safe validation with Zod  
 **XSS Protection** - Automatic input sanitization  
 **Security Headers** - HSTS, CSP, X-Frame-Options, and more  
 **Safe HTTP Client** - Domain allowlisting for outbound requests  
 **IP Extraction** - Proper client IP detection with proxy support  
 **Structured Logging** - Comprehensive logging with sensitive data redaction  

## Installation

```bash
npm install express zod jsonwebtoken xss ioredis node-fetch cookie-parser
```

## Quick Start

### 1. Configure Environment Variables

Create a `.env` file:

```bash
NODE_ENV=development
LOG_LEVEL=info
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
TRUST_PROXY=false
SAFE_DOMAINS=api.example.com
```

### 2. Basic Setup

```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import { sentrixMiddleware, sentrixErrorHandler } from './middleware/index.js';
import { config } from './config/index.js';

const app = express();

app.use(express.json());
app.use(cookieParser());

// Configure trust proxy if behind reverse proxy
if (config.trustProxy) {
    app.set('trust proxy', 1);
}

// Protected route example
app.post('/api/users',
    sentrixMiddleware({
        requireAuth: false,
        requireCSRF: false,
        enableDoS: true
    }),
    (req, res) => {
        res.json({ message: 'Success' });
    }
);

// Error handler MUST be last
app.use(sentrixErrorHandler);

app.listen(config.port);
```

## Usage Examples

### Request Validation with Zod

```typescript
import { z } from 'zod';

const createUserSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100),
        email: z.string().email(),
        age: z.number().min(18).optional(),
    })
});

app.post('/api/users',
    sentrixMiddleware({ schema: createUserSchema }),
    (req, res) => {
        // req.body is now validated and typed
        res.json({ user: req.body });
    }
);
```

### JWT Authentication

```typescript
app.get('/api/profile',
    sentrixMiddleware({ requireAuth: true }),
    (req, res) => {
        // req.user contains decoded JWT payload
        res.json({ user: req.user });
    }
);
```

### CSRF Protection

```typescript
// Issue token (on login or page load)
app.get('/api/csrf-token',
    generateCsrfMiddleware,
    (req, res) => {
        res.json({ token: res.locals.csrfToken });
    }
);

// Validate token on state-changing operations
app.post('/api/settings',
    sentrixMiddleware({
        requireAuth: true,
        requireCSRF: true
    }),
    (req, res) => {
        res.json({ message: 'Settings updated' });
    }
);
```

Client must send token in `x-csrf-token` header:

```javascript
fetch('/api/settings', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
    },
    body: JSON.stringify({ theme: 'dark' })
});
```

### Custom Rate Limiting

```typescript
app.post('/api/login',
    sentrixMiddleware({
        enableDoS: true,
        rateLimitOptions: {
            maxRequests: 5,           // 5 attempts
            windowMs: 15 * 60 * 1000  // per 15 minutes
        }
    }),
    (req, res) => {
        res.json({ message: 'Login successful' });
    }
);
```

### Safe HTTP Client

```typescript
import { SafeHttpClient } from './middleware/index.js';

const httpClient = new SafeHttpClient({
    domains: ['api.github.com'],
    timeoutMs: 5000,
    retries: 2
});

app.get('/api/external',
    sentrixMiddleware({ requireAuth: true }),
    async (req, res, next) => {
        try {
            const response = await httpClient.get('https://api.github.com/users/osama2-9');
            const data = await response.json();
            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);
```

## Configuration Options

### `sentrixMiddleware(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `schema` | `ZodType` | `undefined` | Zod schema for request validation |
| `requireAuth` | `boolean` | `false` | Enable JWT authentication |
| `requireCSRF` | `boolean` | `false` | Enable CSRF protection |
| `enableDoS` | `boolean` | `true` | Enable rate limiting |
| `rateLimitOptions` | `object` | See below | Custom rate limit settings |

#### Rate Limit Options

```typescript
{
    maxRequests: 100,          // Requests per window
    windowMs: 3600000,         // Window size (1 hour)
    maxPayloadSize: 1048576    // Max payload (1MB)
}
```

## Security Best Practices

### 1. JWT Secret

**CRITICAL:** Always use a strong, random secret in production:

```bash
# Generate secure secret
openssl rand -base64 32

# Add to .env
JWT_SECRET=your-generated-secret-here
```

The application will **exit on startup** if `JWT_SECRET` is weak in production.

### 2. Trust Proxy Configuration

If your app is behind a reverse proxy (nginx, load balancer):

```bash
TRUST_PROXY=true
```

Then configure Express:

```typescript
if (config.trustProxy) {
    app.set('trust proxy', 1);
}
```

### 3. Redis for Distributed Systems

For apps running on multiple servers, use Redis for rate limiting:

```bash
REDIS_URL=redis://localhost:6379
```

Without Redis, rate limits are per-instance only.

### 4. Content Security Policy

Customize CSP directives in `config/index.ts`:

```typescript
cspDirectives: [
    "default-src 'self'",
    "script-src 'self' https://cdn.example.com",
    "style-src 'self' 'unsafe-inline'",
    // ... add your domains
]
```

### 5. HTTPS in Production

Always use HTTPS in production. The HSTS header is automatically set.

## Error Handling

All SentriX errors extend `SentriXError` with appropriate status codes:

```typescript
try {
    // Your code
} catch (error) {
    if (error instanceof AuthenticationError) {
        // 401 - Missing/invalid JWT
    } else if (error instanceof CSRFError) {
        // 403 - Invalid CSRF token
    } else if (error instanceof RateLimitError) {
        // 429 - Too many requests
    } else if (error instanceof ValidationError) {
        // 400 - Invalid request data
    }
}
```

The global error handler `sentrixErrorHandler` handles these automatically.

## Logging

SentriX uses structured logging with automatic sensitive data redaction:

```typescript
import { logger } from './utils/logger.js';

logger.info('User action', { userId: 123, action: 'login' });
logger.warn('Suspicious activity', { ip: '1.2.3.4' });
logger.error('Database error', error, { query: 'SELECT...' });
```

Sensitive fields (password, token, secret, etc.) are automatically redacted.

## Testing

Recommended test structure:

```typescript
import request from 'supertest';
import app from './app.js';

describe('POST /api/users', () => {
    it('should validate request body', async () => {
        const response = await request(app)
            .post('/api/users')
            .send({ name: '' }); // Invalid
        
        expect(response.status).toBe(400);
        expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should create user with valid data', async () => {
        const response = await request(app)
            .post('/api/users')
            .send({ name: 'John', email: 'john@example.com' });
        
        expect(response.status).toBe(200);
    });
});
```

## Production Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `JWT_SECRET` (min 32 chars)
- [ ] Configure `TRUST_PROXY` if behind reverse proxy
- [ ] Set up Redis for distributed rate limiting
- [ ] Review and adjust rate limit settings
- [ ] Configure CSP directives for your frontend
- [ ] Enable HTTPS/TLS
- [ ] Set appropriate log level (`warn` or `error`)
- [ ] Review SAFE_DOMAINS for HTTP client
- [ ] Test CSRF flow end-to-end
- [ ] Set up monitoring and alerting

## Architecture

```
src/
├── config/
│   └── index.ts          # Consolidated configuration
├── middleware/
│   └── index.ts          # Main middleware factory
├── security/
│   ├── authHardening.ts  # JWT + security headers
│   ├── csrf.ts           # CSRF protection
│   ├── antiDos.ts        # Rate limiting
│   ├── csp.ts            # Content Security Policy
│   └── xss.ts            # XSS sanitization
├── http/
│   ├── inboundFilter.ts  # Request validation
│   ├── sanitizeHeaders.ts # Header sanitization
│   └── safeHttpClient.ts # Safe outbound requests
├── utils/
│   ├── logger.ts         # Structured logging
│   ├── errors.ts         # Custom error classes
│   ├── asyncHandler.ts   # Async error wrapper
│   └── ipExtractor.ts    # IP detection
└── types/
    └── index.ts          # TypeScript definitions
```

## License

MIT

## Contributing

Contributions welcome! Please ensure:

1. All security fixes are thoroughly tested
2. New features include tests and documentation
3. Code follows TypeScript strict mode
4. Sensitive data is properly redacted in logs

## Support

For security issues, please email osamaalsrraj3@gmail.com (do not open public issues).

For bugs and features, open a GitHub issue.