# Contributing to Arbor DEX

Thank you for your interest in contributing to Arbor DEX! This document provides guidelines and instructions for making contributions that align with the project's values of clarity, quality, and approachability.

## Before You Start

- Read the [README.md](README.md) to understand what Arbor DEX is and how it works
- Review [LICENSE](LICENSE) - Arbor DEX is Apache-2.0 licensed
- Familiarize yourself with the [Getting Started](#getting-started) section

## Core Values

Arbor DEX is built on these principles:

1. **Clarity** - Code and documentation should be easy to understand
2. **Quality** - Professional standards applied throughout
3. **Accessibility** - Welcoming to contributors and learners
4. **Modernity** - Tech-forward practices (TypeScript, strict linting)
5. **Warmth** - Collaborative, not gatekeeping

Please keep these in mind when contributing.

## Getting Started

### Setup

```bash
# Clone the repository
git clone https://github.com/arbordex/dex.git
cd dex

# Install dependencies
npm install

# Start development server
npm start

# In another terminal, run tests
npm test
```

### Development Workflow

1. Create a branch for your work:

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. Make your changes (see sections below for specific guidelines)

3. Commit your changes - linting happens automatically via git hooks:

   ```bash
   git commit -m "description of changes"
   ```

4. Push to your branch:

   ```bash
   git push origin feature/your-feature-name
   ```

5. Open a Pull Request on GitHub

## Code Guidelines

### TypeScript & JavaScript

- **Use TypeScript** for all new code in `src/`
- **Strict mode enabled** - Type safety is required
- **File structure**:
  - Source code: `src/`
  - Tests: `tests/`
  - Configuration: `config/`

### Style & Formatting

Code style is enforced automatically via pre-commit hooks:

- **Semicolons**: Required (`;`)
- **Quotes**: Single quotes (`'`) for strings
- **Indentation**: 2 spaces
- **Line length**: Keep reasonable (aim for <100 characters)
- **Console statements**: Use `console.error()` or `console.warn()` only (not `console.log()`)

Auto-fix issues:

```bash
npm run lint:fix
```

Check without fixing:

```bash
npm run lint
```

### Comments & Documentation

- Add **JSDoc comments** to all functions and modules:

  ```typescript
  /**
   * Brief description of what this does
   * 
   * Longer explanation if needed
   * 
   * @param {Type} paramName - Description of parameter
   * @returns {Type} Description of return value
   */
  export function myFunction(paramName: string): string {
    // Implementation
  }
  ```

- Comment **why**, not **what** (code should be clear about what it does):

  ```typescript
  // ✅ Good: Explains the reason
  // HTTPS is enforced in staging to test production behavior locally
  if (config.isStaging) { ... }

  // ❌ Bad: Just repeats the code
  // If staging, enforce HTTPS
  if (config.isStaging) { ... }
  ```

- Keep comments up-to-date with code changes

### Error Handling

- Return meaningful error messages
- Log errors with `console.error()` including context:

  ```typescript
  console.error('Failed to start server:', err.message);
  ```

- In production, consider security (don't expose sensitive paths)

## Testing

### Running Tests

```bash
# Terminal 1: Start the server
npm start

# Terminal 2: Run tests
npm test

# Test against different ports/environments
TEST_BASE_URL=http://localhost:4000 npm test
TEST_BASE_URL=https://staging.example.com npm test
```

### Writing Tests

Add tests to `tests/api.test.ts`:

```typescript
async function testYourFeature(): Promise<void> {
  try {
    const response = await fetch(`${BASE_URL}/your-endpoint`);
    const data = await response.json();

    if (response.status === 200 && data.someField === expectedValue) {
      results.push({ name: 'Your Test Name', passed: true });
    } else {
      results.push({
        name: 'Your Test Name',
        passed: false,
        error: `Expected X, got ${data.someField}`,
      });
    }
  } catch (error) {
    results.push({
      name: 'Your Test Name',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

**Test guidelines:**

- Write descriptive test names
- Test both success and failure paths
- Include the test in the main test run
- Keep tests fast (avoid long delays)

## Documentation

### README Updates

If your changes affect how users interact with the project, update:

- `README.md` - Main documentation
- `config/.env.example` - If you add environment variables

### Commit Message Guidelines

We follow **scoped conventional commits** for clear, scannable history and automated tooling compatibility.

**Format:**

```text
<type>(<scope>): <short description>

<long description>

<footer>
```

**Example:**

```bash
feat(api): add /quote endpoint for swap price estimates

Implement GET /quote?from=USDC&to=USDT&amount=1000
to return estimated output and price impact.

Uses constant-product AMM formula and includes
slippage warning.

Fixes #12
Closes #15
```

**Type & Scope:**

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

**Writing Tips:**

1. **Short description**: Imperative mood ("add", "fix", "update"), max 50 chars, no period.
2. **Long description**: Wrap at 72 chars, explain *why* and *what*, not *how*; use bullets.
3. **Scope**: Use lowercase, match actual areas (`api`, `swap`, `config`, `types`, etc.).
4. **Footer**: Always link to issues/PRs:
   - `Fixes #<number>`  -  Closes the issue
   - `Closes #<number>`  -  Closes the issue
   - `Related: #<number>`  -  References without closing
   - `Refs: <url>`  -  External references

See **[README.md](README.md#-commit-convention)** for full details and more examples.

## Pull Request Process

1. **Fill out the PR template** with:
   - Description of changes
   - Motivation and context
   - Testing done
   - Any breaking changes

2. **Tests must pass** - CI will run linting and any automated tests

3. **Code review** - At least one maintainer will review

4. **Address feedback** - Make requested changes, push to same branch

5. **Merge** - Maintainer will merge once approved

## What We're Looking For

✅ **Good contributions:**

- Clear, understandable code with good naming
- Thorough comments explaining the "why"
- Tests for new functionality
- Updated documentation
- Follows existing patterns in the codebase
- Respects the project's values

❌ **What won't be accepted:**

- Code that violates the style guidelines
- Changes without tests
- Breaking changes without discussion
- External dependencies without strong justification
- Code that contradicts the brand values (honesty, clarity, warmth)

## Common Patterns

### Adding a New Endpoint

1. Add handler to `src/index.ts`:

   ```typescript
   /**
    * POST /my-endpoint - Clear description
    * @param {Request} req - Express request
    * @param {Response} res - Express response
    * @returns {object} Response object
    */
   app.post('/my-endpoint', (req, res) => {
     // Implementation
     res.json({ result: 'success' });
   });
   ```

2. Add test to `tests/api.test.ts`:

   ```typescript
   async function testMyEndpoint(): Promise<void> {
     // Test implementation
   }
   
   // Call in runTests()
   ```

3. Document in README.md under "The API"

4. Test locally:

   ```bash
   npm start      # Terminal 1
   npm test       # Terminal 2
   ```

### Adding Configuration

1. Add to `config/.env.example` with clear documentation
2. Update `src/config.ts` to read and validate the variable
3. Document defaults and valid values in the example file

## Questions?

- Check existing [issues](https://github.com/arbodex/arbordex/issues)
- Start a [discussion](https://github.com/arbodex/arbordex/discussions)
- Open an issue for bugs or feature requests

## Licensing

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

---

**Thank you for helping build Arbordex!** We're excited to grow the DEX together with the community.

🌳 Build DeFi. Grow Together. 💙
