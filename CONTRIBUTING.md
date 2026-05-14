# Contributing to Shopping List App

Thank you for your interest in contributing to the Shopping List App. This document provides guidelines for contributing code, reporting issues, and participating in code reviews.

## How to Contribute

### Pull Request Process

1. **Fork the repository** and create a feature branch from `main`
2. **Make your changes** following the code style guidelines below
3. **Run tests locally** to ensure everything passes (see Testing Requirements)
4. **Push your branch** and open a pull request against `main`
5. **Respond to feedback** and make adjustments if requested

Pull requests are merged after CI passes and at least one code review approval.

### Development Setup

For detailed setup instructions, see:

- [README.md](./README.md) — Project overview, tech stack, and feature documentation
- [AGENTS.md](./AGENTS.md) — Development commands and agent instructions

Quick reference for local development:

```bash
# Backend setup
cd backend && bash run.sh

# Run backend tests
cd backend && pytest

# Frontend setup
cd frontend && bash run.sh

# Run frontend tests and linting
cd frontend && npm run test:run
cd frontend && npm run lint

# Run E2E tests (requires PostgreSQL)
bash run-e2e-tests.sh
```

## Code Style

### Backend (Python)

Follow these conventions for the FastAPI backend:

- **Formatting**: Use Black for code formatting
- **Imports**: Sort imports with `isort` (first-party, third-party, local)
- **Type Hints**: Include type hints for all function parameters and return values
- **Async**: Use async/await for all database and I/O operations
- **Naming**: Use `snake_case` for functions and variables, `PascalCase` for classes

Example:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from database import get_db
from models import User
from schemas import UserResponse

router = APIRouter(prefix="/api/users", tags=["users"])


async def get_current_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Get the currently authenticated user."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
```

Additional guidelines:

- Keep routes in `main.py` organized by resource (auth, lists, items)
- Use Pydantic schemas for request/response validation in `schemas.py`
- Use SQLAlchemy models defined in `models.py`
- Place reusable database operations in `crud.py`
- Handle errors with appropriate HTTPException status codes

### Frontend (TypeScript/React)

Follow these conventions for the React/Vite frontend:

- **Formatting**: Prettier handles formatting via editor integration
- **Imports**: Use absolute imports from `@/` alias for project modules
- **Components**: Use functional components with TypeScript interfaces
- **Hooks**: Extract reusable logic into custom hooks in `src/hooks/`
- **Naming**: Use `camelCase` for files, `PascalCase` for components

Example:

```typescript
import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { ShoppingList } from "@/types";

interface ListDetailProps {
  listId: string;
}

export function ListDetail({ listId }: ListDetailProps) {
  const [list, setList] = useState<ShoppingList | null>(null);
  const { token } = useAuth();

  const fetchList = useCallback(async () => {
    const response = await fetch(`/api/lists/${listId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    setList(data);
  }, [listId, token]);

  return (
    <div>
      <h1>{list?.name}</h1>
      {/* ... */}
    </div>
  );
}
```

Additional guidelines:

- Define types in `src/types/index.ts`
- Use the API client from `src/api/client.ts` for HTTP requests
- Extract reusable components to `src/components/`
- Add tests alongside components with `.test.tsx` or `.test.ts` extension
- Handle loading and error states in components
- Use the Toast context for user feedback (`src/context/ToastContext.tsx`)

## Testing Requirements

All tests must pass before a pull request can be merged. Run tests locally before pushing.

### Backend Tests

The backend uses pytest with markers to categorize tests:

```bash
# Run all tests
cd backend && pytest

# Run specific test categories
cd backend && pytest tests/test_unit/          # Unit tests only
cd backend && pytest -m integration          # Integration tests
cd backend && pytest -m security             # Security tests

# Run a specific test
cd backend && pytest -v -k "test_name"
```

Test conventions:

- Place unit tests in `tests/test_unit/`
- Place integration tests in `tests/test_integration/`
- Place security tests in `tests/test_security/`
- Use the fixtures defined in `conftest.py` for authenticated clients and test data
- Tests require PostgreSQL — start with `cd backend && docker compose up -d`

### Frontend Tests

The frontend uses Vitest for testing:

```bash
# Run tests
cd frontend && npm run test:run

# Run tests in watch mode
cd frontend && npm run test

# Run linting
cd frontend && npm run lint
```

Test conventions:

- Co-locate tests with components using `.test.tsx` or `.test.ts`
- Use the setup in `src/test/setup.ts` for test utilities
- Mock API calls when testing components in isolation

### E2E Tests

The project uses Playwright for end-to-end browser tests:

```bash
# Run all E2E tests (starts PostgreSQL, installs deps, runs Playwright)
bash run-e2e-tests.sh

# Run a single test file
bash run-e2e-tests.sh e2e/lists.spec.ts

# Run against specific browser
bash run-e2e-tests.sh --project=chromium

# Run Playwright directly (requires PostgreSQL running)
cd frontend && npx playwright test
```

E2E tests are located in `frontend/e2e/` and run automatically in CI on PRs to `main` and `dev` branches.

### Smoke Tests

Post-deployment smoke tests in `backend/smoke_test.py` verify the API surface:

```bash
python backend/smoke_test.py <BASE_URL> <REGISTRATION_KEY>
```

## Commit Messages

Use clear, descriptive commit messages that explain what changed and why. Two formats are accepted:

### Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:

```
feat(lists): add share_code generation endpoint
fix(auth): resolve JWT expiration edge case
docs: update API endpoint documentation
test: add integration tests for list sharing
```

### Simple Descriptive Messages

If conventional commits feel too rigid, use clear descriptive messages:

```
Add user registration endpoint with invite code validation
Fix React key prop warning in list items
Update PostgreSQL connection string for Azure deployment
```

Avoid vague messages like "fix stuff" or "update code".

## Branch Naming

Use descriptive branch names with these prefixes:

- `feature/` — New features
  - `feature/add-list-sharing`
  - `feature/dark-mode-toggle`
- `fix/` — Bug fixes
  - `fix/jwt-expiration-handling`
  - `fix/item-sort-order`
- `refactor/` — Code refactoring
  - `refactor/api-client`
- `docs/` — Documentation updates
  - `docs/api-documentation`
- `test/` — Adding tests
  - `test/integration-tests`

Avoid generic names like `fix1` or `my-changes`.

## Code Review Process

### What to Expect

1. **Automated checks** run first — CI verifies:
   - Backend: pytest passes with all tests
   - Frontend: lint and tests pass
   - Frontend: build completes successfully

2. **Code review** — A maintainer will review your changes and check for:
   - Correctness and completeness
   - Code style consistency
   - Test coverage for new features
   - Security considerations

3. **Feedback** — Reviewers may request:
   - Additional tests
   - Code improvements
   - Documentation updates
   - Clarifications

### How to Get Your PR Reviewed Quickly

- Keep PRs focused and reasonably sized
- Link related issues in the PR description
- Include context about what changed and why
- Respond to feedback promptly
- Push additional commits to address issues

## Reporting Issues

### Bug Reports

To report a bug, create an issue with:

1. **Clear title** describing the problem
2. **Steps to reproduce** — Include minimal reproduction steps
3. **Expected behavior** — What should happen
4. **Actual behavior** — What actually happens
5. **Environment** — OS, Python version, Node version, browser
6. **Screenshots** — If applicable

### Feature Requests

To request a feature:

1. **Clear title** describing the feature
2. **Problem or use case** — Why this feature is needed
3. **Proposed solution** — How it should work
4. **Alternatives considered** — Other approaches evaluated

### Security Issues

For security vulnerabilities, do not open a public issue. Instead, contact the maintainer directly through private channels or through GitHub's security advisory system.

## Additional Resources

- [README.md](./README.md) — Project documentation
- [AGENTS.md](./AGENTS.md) — Development commands
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Azure deployment guide
- GitHub Actions: [.github/workflows/test.yml](./.github/workflows/test.yml)

## Questions?

If you have questions about contributing, open an issue with the `question` label or reach out through the project's discussion board.