# Scripts Directory

This directory contains essential utility scripts for pavOS backend.

## Available Scripts

### 🧪 `testWhopIntegration.ts`
**Purpose:** Test Whop integration and smart routing logic

**Usage:**
```bash
npx tsx scripts/testWhopIntegration.ts
```

**What it tests:**
- ✅ Smart routing (Whop priority → Discord fallback)
- ✅ Database schema validation
- ✅ Field name verification (whopCustomerId)
- ✅ Multi-tenant isolation
- ✅ Lead creation with different sources

**When to run:**
- Before deploying to production
- After making changes to routing logic
- Before submitting to Whop for approval

---

### 👤 `createDemoUser.ts`
**Purpose:** Create a demo user for testing

**Usage:**
```bash
npx tsx scripts/createDemoUser.ts
```

**What it does:**
- Creates a test user with sample data
- Sets up initial Whop company connection
- Useful for local development

---

### 🌱 `seedDemo.ts`
**Purpose:** Seed database with demo data for testing

**Usage:**
```bash
npx tsx scripts/seedDemo.ts
```

**What it does:**
- Creates sample leads
- Creates sample deals
- Sets up test data for development
- Useful for testing UI with realistic data

---

## Running Scripts

All scripts use TypeScript and should be run with `tsx`:

```bash
# Install tsx globally (if not already installed)
npm install -g tsx

# Run any script
npx tsx scripts/SCRIPT_NAME.ts
```

## Environment Variables

Make sure your `.env` file is configured before running scripts:

```bash
# Required for all scripts
MONGODB_URI=your_mongodb_connection_string

# Required for Whop integration test
WHOP_API_KEY=your_whop_api_key
WHOP_CLIENT_ID=your_whop_client_id
WHOP_CLIENT_SECRET=your_whop_client_secret
```

## Notes

- All scripts connect to the database specified in `.env`
- Scripts automatically disconnect after completion
- Use caution when running seed scripts in production
- Test script is safe to run anytime (creates and cleans up test data)
