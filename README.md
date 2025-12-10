# SentriX

**Stop worrying about security. Start building.**

SentriX is a simple, all-in-one security package for Express.js that protects your API from common attacks. No security expertise needed – just install and use.

```bash
npm install sentrix
```

---

## Why SentriX?

Building a secure API is hard. You need to worry about:
- Hackers stealing tokens
- Bots spamming your endpoints  
- Form submission attacks
- Malicious code injection
- Invalid data breaking your app

**SentriX handles all of this automatically.** Just add one line of code.

---

## 30-Second Setup

### Step 1: Install
```bash
npm install sentrix express cookie-parser
```

### Step 2: Create `.env` file
```bash
JWT_SECRET=put-any-random-32-character-string-here-abc123
```

### Step 3: Add to your Express app
```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import { sentrixMiddleware, sentrixErrorHandler } from 'sentrix';

const app = express();

app.use(express.json());
app.use(cookieParser());

// ONE LINE = Full Security
app.post('/api/data', sentrixMiddleware(), (req, res) => {
    res.json({ message: 'This route is now protected!' });
});

// Error handler (catches all security errors)
app.use(sentrixErrorHandler);

app.listen(3000);
```

**Done!** Your API now has:
- Protection against bots and spam
- Safe from malicious code injection
- Security headers (blocks common attacks)
- Automatic rate limiting (100 requests/hour per user)

---

## When Do I Use What?

### Scenario 1: Public API (Anyone can access)
**Example:** Blog posts, product catalog, weather data

```typescript
app.get('/api/products', 
    sentrixMiddleware(),  // Basic security only
    (req, res) => {
        res.json({ products: [...] });
    }
);
```

**What it does:**
- Blocks spam/bots
- Prevents XSS attacks
- Adds security headers

---

### Scenario 2: Login-Protected (User must be logged in)
**Example:** User profile, account settings, private data

```typescript
app.get('/api/user/profile', 
    sentrixMiddleware({ requireAuth: true }),  // Requires login
    (req, res) => {
        // req.user has the logged-in user info
        res.json({ name: req.user.name });
    }
);
```

**What it does:**
- Checks user is logged in (via JWT token)
- Blocks unauthorized users (401 error)
- All the basic security too

**Client needs to send:**
```javascript
fetch('/api/user/profile', {
    headers: {
        'Authorization': 'Bearer USER_TOKEN_HERE'
    }
})
```

---

### Scenario 3: Form Submission (Changing data)
**Example:** Update profile, create post, delete item, payment

```typescript
// Step 1: Give user a CSRF token (when page loads)
app.get('/api/get-token', 
    generateCsrfMiddleware,
    (req, res) => {
        res.json({ token: res.locals.csrfToken });
    }
);

// Step 2: Require token when submitting form
app.post('/api/user/settings', 
    sentrixMiddleware({ 
        requireAuth: true,   // Must be logged in
        requireCSRF: true    // Must have valid token
    }),
    (req, res) => {
        res.json({ message: 'Settings saved!' });
    }
);
```

**What it does:**
- Prevents CSRF attacks (hackers can't forge requests)
- Ensures request came from your website

**Client code:**
```javascript
// Get token first
const { token } = await fetch('/api/get-token').then(r => r.json());

// Use token when submitting
fetch('/api/user/settings', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer USER_TOKEN',
        'x-csrf-token': token,  // Important!
        'Content-Type': 'application/json'
    },
    credentials: 'include',  // Important!
    body: JSON.stringify({ theme: 'dark' })
});
```

---

### Scenario 4: Validate User Input (Ensure data is correct)
**Example:** User registration, contact form, checkout

```typescript
import { z } from 'zod';

// Define what valid data looks like
const schema = z.object({
    body: z.object({
        email: z.string().email(),           // Must be valid email
        age: z.number().min(18),             // Must be 18+
        name: z.string().min(1).max(100)     // 1-100 characters
    })
});

app.post('/api/register', 
    sentrixMiddleware({ schema }),  // Auto-validates
    (req, res) => {
        // If code reaches here, data is valid!
        const { email, age, name } = req.body;
        res.json({ message: 'User registered!' });
    }
);
```

**What it does:**
- Checks data format before your code runs
- Returns clear error if invalid
- Prevents bad data from breaking your app

**Example responses:**

Valid request:
```json
{ "message": "User registered!" }
```

Invalid request:
```json
{
    "error": "Invalid request payload",
    "details": {
        "errors": [
            { "path": "body.email", "message": "Invalid email" },
            { "path": "body.age", "message": "Must be 18 or older" }
        ]
    }
}
```

---

### Scenario 5: Strict Rate Limits (High-security endpoints)
**Example:** Login, password reset, payment, admin actions

```typescript
app.post('/api/login', 
    sentrixMiddleware({
        rateLimitOptions: {
            maxRequests: 5,              // Only 5 tries
            windowMs: 15 * 60 * 1000     // Per 15 minutes
        }
    }),
    (req, res) => {
        // Login logic
        res.json({ token: 'user_token' });
    }
);
```

**What it does:**
- Limits login attempts (stops brute force attacks)
- Blocks user for 15 min after 5 failed tries
- Prevents account takeover

---

### Scenario 6: Call External APIs Safely
**Example:** Fetch GitHub data, Stripe payment, SendGrid emails

```typescript
import { SafeHttpClient } from 'sentrix';

const httpClient = new SafeHttpClient({
    domains: ['api.github.com', 'api.stripe.com'],  // Only these allowed
    timeoutMs: 5000,
    retries: 2
});

app.get('/api/github/:user',
    sentrixMiddleware({ requireAuth: true }),
    async (req, res, next) => {
        try {
            const response = await httpClient.get(
                `https://api.github.com/users/${req.params.user}`
            );
            const data = await response.json();
            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);
```

**What it does:**
- Only allows calls to approved domains
- Blocks calls to malicious sites
- Auto-retries on failure
- Times out if too slow

---

## Complete Example (Real App)

```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { 
    sentrixMiddleware, 
    sentrixErrorHandler,
    generateCsrfMiddleware 
} from 'sentrix';

const app = express();

app.use(express.json());
app.use(cookieParser());

// PUBLIC ROUTES

// Health check
app.get('/health', 
    sentrixMiddleware({ enableDoS: false }),  // No rate limit
    (req, res) => res.json({ status: 'ok' })
);

// Get products (public)
app.get('/api/products', 
    sentrixMiddleware(),  // Basic security
    (req, res) => res.json({ products: [] })
);

// Get CSRF token
app.get('/api/csrf-token',
    generateCsrfMiddleware,
    (req, res) => res.json({ token: res.locals.csrfToken })
);

// Login (strict rate limit)
const loginSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(8)
    })
});

app.post('/api/login',
    sentrixMiddleware({
        schema: loginSchema,
        rateLimitOptions: { maxRequests: 5, windowMs: 900000 }
    }),
    (req, res) => {
        // Check credentials, generate JWT
        res.json({ token: 'generated_jwt_token' });
    }
);

// PROTECTED ROUTES (Login Required)

// Get user profile
app.get('/api/user/profile',
    sentrixMiddleware({ requireAuth: true }),
    (req, res) => {
        res.json({ 
            userId: req.user.id,
            name: req.user.name 
        });
    }
);

// Update profile
const updateSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100),
        bio: z.string().max(500).optional()
    })
});

app.put('/api/user/profile',
    sentrixMiddleware({
        schema: updateSchema,
        requireAuth: true,
        requireCSRF: true
    }),
    (req, res) => {
        // Update user in database
        res.json({ message: 'Profile updated!' });
    }
);

// Create post
const postSchema = z.object({
    body: z.object({
        title: z.string().min(1).max(200),
        content: z.string().min(1)
    })
});

app.post('/api/posts',
    sentrixMiddleware({
        schema: postSchema,
        requireAuth: true,
        requireCSRF: true
    }),
    (req, res) => {
        // Save post to database
        res.json({ message: 'Post created!', post: req.body });
    }
);

// ERROR HANDLER (MUST BE LAST)
app.use(sentrixErrorHandler);

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
```

---

## Configuration

### Environment Variables (`.env` file)

```bash
# Required
JWT_SECRET=your-32-char-secret-here-change-this-in-production

# Optional (with defaults)
NODE_ENV=development           # development, production, or test
LOG_LEVEL=info                # debug, info, warn, error
PORT=3000
TRUST_PROXY=false             # Set true if behind nginx/load balancer
SAFE_DOMAINS=api.example.com  # Comma-separated
REDIS_URL=redis://localhost:6379  # For distributed rate limiting
```

### Generate Strong JWT Secret

```bash
# On Mac/Linux
openssl rand -base64 32

# Copy output to .env
JWT_SECRET=the-random-string-from-above
```

---

## Common Issues & Solutions

### "Missing JWT token" error
**Problem:** Frontend not sending Authorization header

**Solution:**
```javascript
fetch('/api/profile', {
    headers: {
        'Authorization': `Bearer ${yourToken}`  // Add this!
    }
})
```

### "Invalid CSRF token" error
**Problem:** Not including token or cookies

**Solution:**
```javascript
fetch('/api/settings', {
    headers: {
        'x-csrf-token': token  // Add this!
    },
    credentials: 'include'  // AND this!
})
```

### "Too many requests" error (429)
**Problem:** Hit rate limit

**Solutions:**
- Wait 15-60 minutes (depends on endpoint)
- Or increase limit in production:
```typescript
sentrixMiddleware({
    rateLimitOptions: {
        maxRequests: 1000,  // Increase for production
        windowMs: 3600000   // 1 hour
    }
})
```

### Rate limiting not working across servers
**Problem:** Running multiple server instances

**Solution:** Use Redis
```bash
# Install Redis
brew install redis  # Mac
sudo apt install redis  # Linux

# Start Redis
redis-server

# Add to .env
REDIS_URL=redis://localhost:6379
```

---

## All Options

```typescript
sentrixMiddleware({
    // Validation
    schema: zodSchema,           // Validate request with Zod

    // Authentication
    requireAuth: false,          // true = require JWT token

    // CSRF Protection  
    requireCSRF: false,          // true = require CSRF token

    // Rate Limiting
    enableDoS: true,             // false = disable rate limiting
    rateLimitOptions: {
        maxRequests: 100,        // Max requests per window
        windowMs: 3600000,       // 1 hour window
        maxPayloadSize: 1048576  // Max 1MB request size
    }
})
```

---

## Ready for Production?

Checklist before deploying:

- [ ] Change `JWT_SECRET` to strong random value
- [ ] Set `NODE_ENV=production` in .env
- [ ] Enable `TRUST_PROXY=true` if using nginx/load balancer
- [ ] Set up Redis for multi-server rate limiting
- [ ] Use HTTPS (not HTTP)
- [ ] Set `LOG_LEVEL=warn` or `error`
- [ ] Test all endpoints with real frontend
- [ ] Monitor error logs


---

## License

MIT License - use it however you want!


