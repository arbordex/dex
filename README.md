# Arbor DEX

<p align="center">
  <img src="https://github.com/arbordex/brand/raw/main/logo/arbordex-mark-cyan.svg" alt="Arbor DEX Logo" width="180" />
</p>

**Arbor DEX** is a modular DEX (Decentralized Exchange) server built as a real DeFi application, with a strong focus on clarity, maintainability, and modern backend practices.

Think of it as a playground where you can see swaps, liquidity pools, and quotes in action, all
written in clean, understandable code.

The goal of this project is to **build up a DEX stack from the ground up** while exploring AMMs, liquidity, and DeFi architecture in a professional way. As the design evolves, concepts are implemented here as clean, well‑structured code rather than as throwaway experiments.

If others find this useful, want to contribute, or want to take it further, Arbor DEX is intentionally structured to be approachable for an open‑source DeFi community.

## What Arbor DEX Aims To Be

- 🧱 **A real application, not a scratchpad** – The codebase is treated like a production project: clear boundaries, sensible defaults, and consistent structure.
- 🌱 **A place to grow understanding** – New AMM/DeFi ideas are implemented here as the project evolves, with the code reflecting that learning journey.
- 🤝 **Open to contributors** – The repo is organized so that others can read, grasp, and build on it without having to reverse‑engineer ad‑hoc decisions.
- 🧩 **Modular and extensible** – Components such as pricing, swap logic, configuration, environment handling, and security are factored cleanly so they can be replaced or extended later.

You can treat this as:

- a reference implementation,
- a starting point for your own DEX backend,
- or a base to experiment with new DeFi mechanics.

## Feature Highlights

- 🚀 **Just works** – Development mode with hot reload out of the box.
- 🛡️ **Environment‑aware setup** – Distinct dev, staging, and production modes with HTTPS and security headers where it matters.
- 🔷 **Type‑safe** – Strict TypeScript configuration to keep things predictable and refactor‑friendly.
- ✨ **Linted and formatted** – ESLint and Markdown linting run on commit to keep the project tidy.
- 🧪 **Simple API test harness** – Basic tests to exercise endpoints against any environment using `TEST_BASE_URL`.

## Getting Started

### Prerequisites

Just need Node.js 18+ and npm (which comes with Node).

- [Download Node.js](https://nodejs.org)

### Setup (3 steps)

```bash
# 1. Clone it
git clone https://github.com/arbordex/dex.git
cd dex

# 2. Install dependencies
npm install

# 3. Run it (that's it!)
npm start
```

You'll see the server running at `http://localhost:3000`.

Don't need to configure anything. Sensible defaults are built in. But if you want to, copy `.env.example` to `.env` and update values as needed. All variables have defaults, so you only change what you need.

## Configuration

Key configuration lives at the repo root for editor auto-detection:

- **`.env` / `.env.example`**: Environment variables (port, host, NODE_ENV, etc.)
- **`tsconfig.json`**: TypeScript compiler settings with strict mode and bundler module resolution
- **`eslint.config.js`**: Code style rules (auto-enforced on commit)
- **`.markdownlintrc.json`**: Documentation linting rules

Supporting scripts and hooks stay grouped in `config/`:

- **`config/scripts/start.js`**: Smart startup script that detects your environment based on `NODE_ENV` and sets behavior
- **`config/.husky/`**: Git hooks (auto-lints on commit)

TypeScript uses bundler module resolution, which means you can import `.ts` files directly in your source code without writing `.js` extensions. The build and runtime handle it transparently.

## Running It Different Ways

```bash
# Development (watch mode, auto-reload)
npm start

# Build for production
npm run build

# Run production build locally (to test how it'll actually run)
npm run start:built

# Staging (tests production behavior but easier to debug)
NODE_ENV=staging npm run start:staging
```

## What's Inside

```text
src/                    # Your actual code lives here
├── index.ts           # Express server
├── config.ts          # Environment setup (dev/staging/prod)
└── security.ts        # Security headers and middleware

tests/                  # Tests go here
├── api.test.ts        # Basic API tests

.env.example            # Environment variables template
tsconfig.json           # TypeScript config
eslint.config.js        # Code style rules
.markdownlintrc.json    # Markdown lint rules

config/                 # Helper scripts and hooks
├── .husky/            # Git hooks (auto-lints on commit)
└── scripts/
  └── start.js       # Smart start script that picks dev/prod
```

The idea is simple:

- **Everything you need to configure is in `config/`**, and
- **Everything you code on goes in `src/`**.

No dotfiles scattered everywhere.

## Commands You'll Probably Use

| Command | What it does |
|---------|-------------|
| `npm start` | Smart start (dev mode with hot reload by default) |
| `npm run dev` | Development mode with hot reload (same as `npm start`) |
| `npm run build` | Compile TypeScript to JavaScript in `dist/` |
| `npm test` | Run API tests (server must be running) |
| `npm run lint` | Check code style with ESLint |
| `npm run lint:fix` | Auto-fix code style issues |
| `npm run start:built` | Build and run in production mode (for local testing) |
| `npm run start:staging` | Run pre-built code in staging mode with HTTPS enforcement |
| `npm run start:prod` | Run pre-built code in production mode |

## The API

### Endpoints

The endpoints are intentionally small and focused so they’re easy to evolve as the DEX design matures:

```text
GET /               # Health check, says hello
POST /add-liquidity # Add liquidity to a pool
POST /buy           # Buy tokens via swap
POST /sell          # Sell tokens via swap
POST /quote         # Get a quote for a swap
```

Treat these as starting points; as the AMM and routing logic becomes richer, these handlers will follow.

## How Environments Work

Set `NODE_ENV` to control behavior. The smart startup script (`config/scripts/start.js`) picks the right mode automatically.

### Development (Default)

```bash
npm start
# or
NODE_ENV=development npm start
```

- Runs directly from TypeScript source using `tsx watch`
- Hot reloads when you save files
- No HTTPS enforcement for convenience of local development
- Full console output for debugging
- Best for development and testing

### Staging

```bash
npm run build
NODE_ENV=staging npm run start:staging
```

- Runs compiled code (production-like)
- Enforces HTTPS (good for testing HTTPS locally)
- Includes all security headers
- Great for testing production behavior before deploying

### Production

```bash
npm run build
NODE_ENV=production npm run start:prod
```

- Runs compiled code
- Enforces HTTPS
- Full security headers enabled
- Use this for actual deployments

**Quick way to test production locally:**

```bash
npm run start:built
```

This builds and runs in production mode so you can verify everything works before shipping.

## Writing Code

At the moment, all endpoints are consolidated within a single index endpoint and all tests are consolidated into a single api test file.
However, going forward, as individual endpoint complexity grows, we plan to decompose the api endpoints to individual endpoint modules.

### Adding an Endpoint

Edit `src/index.ts`:

```typescript
app.post('/your-endpoint', (req, res) => {
  // Your logic here
  res.json({ message: 'It works!' });
});
```

Save it. The server hot-reloads. Done.

### Writing Tests

Tests are simple fetch-based checks. Add them to `tests/api.test.ts`:

```typescript
async function testYourEndpoint(): Promise<void> {
  const response = await fetch(`${BASE_URL}/your-endpoint`);
  const data = await response.json();

  if (response.status === 200) {
    results.push({ name: 'POST /your-endpoint', passed: true });
  } else {
    results.push({
      name: 'POST /your-endpoint',
      passed: false,
      error: 'Unexpected response',
    });
  }
}
```

**Run tests** (server must be running in another terminal):

```bash
# Terminal 1: Start the server
npm start

# Terminal 2: Run tests
npm test

# Test against different ports
TEST_BASE_URL=http://localhost:4000 npm test

# Test against staging/production
TEST_BASE_URL=https://staging.example.com npm test
```

Tests use environment variable `TEST_BASE_URL` so you can test any server without changing code.

### Keep Code Clean

Linting happens automatically when you commit:

```bash
npm run lint      # Check for issues
npm run lint:fix  # Auto-fix issues
```

TypeScript catches type errors, ESLint keeps things consistent. You're good.

## Security (Staging & Production Only)

Security features are only active in staging and production environments. Development mode skips them for ease of debugging.

When running with `NODE_ENV=staging` or `NODE_ENV=production`, you get:

- 🔒 **HTTPS enforcement**: Redirects HTTP to HTTPS
- 🧱**HSTS**: Tells browsers to always use HTTPS
- 🛡️**Security headers**:
  - `Content-Security-Policy`: Restricts what content can load
  - `X-Frame-Options`: Prevents clickjacking attacks
  - `X-Content-Type-Options`: Prevents MIME sniffing
  - `X-XSS-Protection`: Enables browser XSS filters
  - `Referrer-Policy`: Controls referrer information
- 🕵️**Server info hiding**: Removes `X-Powered-By` header

All implemented with minimal dependencies. No heavy security frameworks needed.

## Troubleshooting

**Port 3000 is taken?**

```bash
PORT=5000 npm start
```

**TypeScript errors after changes?**

```bash
npm run lint:fix && npm run build
```

**Tests won't connect?**

Make sure the server is running:

```bash
npm start        # Terminal 1
npm test         # Terminal 2 (after server is ready)
```

## Contributing

Want to add something?

1. Create a branch (`git checkout -b feature/your-idea`)
2. Make changes
3. Auto-linting runs when you commit
4. Push and open a PR

That's it. Pre-commit hooks handle code quality.

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

## Project Documentation

- **[CONTRIBUTING.md](CONTRIBUTING.md)** – How to contribute code and improvements
- **[README.md](README.md)** – This file (getting started, API reference, and architecture)

## Architecture

### Core Modules

- **`src/index.ts`** – Express server with API endpoints. Each endpoint is documented with JSDoc comments.
- **`src/config.ts`** – Environment configuration with validation. Provides type-safe config object with sensible defaults.
- **`src/security.ts`** – Security middleware for headers, HTTPS enforcement (staging/prod only), and protection against common attacks.

### Design Principles

- **Configuration separated** – All config in `config/` directory, not scattered in root
- **Clean source** – Only application code in `src/`, no dotfiles
- **Modular** – Components can be replaced or extended independently
- **Type-safe** – TypeScript strict mode enforced throughout
- **Simple** – When complexity grows, decompose thoughtfully (e.g., endpoints to separate modules)

### Future Evolution

As the project grows:

- Endpoints may be decomposed to separate modules when individual complexity warrants it
- AMM logic will be factored into dedicated modules
- Database layer can be added without changing the endpoint structure
- Multiple AMM implementations can be supported via plugin pattern

## 📝 Commit Convention

We follow **scoped conventional commits** with a semantic structure that makes commit history scannable and automated tooling-friendly.

### Format

```text
<type>(<scope>): <short description>

<long description>

<footer>
```

### Type & Scope

| Type | Use | Scope Examples |
|------|-----|----------------|
| **feat** | New feature or endpoint | `api`, `swap`, `liquidity`, `quote`, `security` |
| **fix** | Bug fix | `swap`, `pricing`, `config`, `types` |
| **docs** | Documentation update | `readme`, `api-ref`, `contributing` |
| **test** | Add/update tests | `api`, `security`, `config` |
| **style** | Code style/format | `eslint`, `prettier` |
| **refactor** | Code restructure | `api`, `config`, `types` |
| **perf** | Performance improvement | `swap`, `pricing`, `query` |
| **chore** | Maintenance/tooling | `deps`, `build`, `ci` |
| **ci** | CI/CD changes | `github-actions`, `workflow` |

### Examples

```bash
feat(api): add /quote endpoint for swap price estimates

Implement GET /quote?from=USDC&to=USDT&amount=1000
to return estimated output and price impact.

Uses constant-product AMM formula and includes
slippage warning.

Fixes #12
Closes #15
```

```bash
fix(swap): correct fee calculation in constant-product formula

Previously used pre-fee liquidity; now correctly applies
fee deduction before output calculation.

Affects POST /buy and POST /sell endpoints.

Fixes #23
```

```bash
docs(readme): update API endpoints and configuration examples

Add POST /add-liquidity endpoint documentation.
Expand configuration section with .env variable descriptions.
Add architecture diagram (ASCII).

Closes #40
```

### Footer Format

Include references to GitHub issues/PRs in the footer:

- `Fixes #<number>`  -  Closes the issue
- `Closes #<number>`  -  Closes the issue
- `Related: #<number>`  -  References without closing
- `Refs: <url>`  -  External references

### Writing Tips

1. **Type**: Use lowercase; match the semantic meaning of your change.
2. **Scope**: Use lowercase, match actual areas of the repo (api, swap, config, types, etc.).
3. **Short description**: Imperative mood ("add", "fix", "update"), max 50 chars, no period.
4. **Long description**: Wrap at 72 chars, explain *why* and *what*, not *how*; use bullets for clarity.
5. **Footer**: Always link to issues/PRs so reviewers have context.

---

## Learn More

- [Express.js docs](https://expressjs.com)
- [TypeScript handbook](https://www.typescriptlang.org/docs)
- [DeFi primer](https://ethereum.org/en/defi)
- [How AMMs work](https://uniswap.org)
- [Arbordex Brand Guidelines](https://github.com/arbodex/brand) – Logo, colors, and typography

## Questions or Issues?

- [Open an issue](https://github.com/arbodex/arbordex/issues)
- [Start a discussion](https://github.com/arbodex/arbordex/discussions)

## Made with ❤️

For developers learning DeFi, one swap at a time.

Created by: [Sayak Sarkar](https://github.com/sayak-sarkar)

Links: [GitHub](https://github.com/arbodex/arbordex) • [Docs](https://github.com/arbodex/arbordex#readme)

---
