# Project Agents (Free Models Only)

This project uses a **multi-agent orchestration system** powered by OpenCode with **only free models** (via OpenCode Zen).

The central **@coordinator** (Big Pickle) decomposes tasks and delegates to specialized sub-agents.

## Core Agents

| Agent          | Role                              | Free Model                     | Temp | Key Strength                     |
|----------------|-----------------------------------|--------------------------------|------|----------------------------------|
| @coordinator   | Orchestrator                      | big-pickle                     | 0.1  | Planning & delegation            |
| @coder         | General Implementation            | minimax-m2.5-free              | 0.25 | Code writing                     |
| @backend       | Backend APIs & Logic              | minimax-m2.5-free              | 0.2  | Server-side & databases          |
| @frontend      | UI/UX & Components                | minimax-m2.5-free              | 0.25 | Frontend implementation          |
| @reviewer      | Code Quality & Review             | kimi-k2.5-free                 | 0.05 | Critical feedback                |
| @tester        | Testing                           | minimax-m2.5-free              | 0.2  | Test generation                  |
| @security      | Security Auditing                 | kimi-k2.5-free                 | 0.05 | Vulnerability detection          |
| @architect     | High-Level Design                 | big-pickle                     | 0.1  | Architecture & trade-offs        |
| @owner         | Decision Making & Approval        | big-pickle                     | 0.1  | Final sign-off & prioritization  |
| @docs          | Documentation                     | minimax-m2.5-free              | 0.25 | Technical writing                |
| @researcher    | Codebase Exploration              | big-pickle                     | 0.25 | Analysis & context               |
| @devops        | DevOps & Infrastructure           | minimax-m2.5-free              | 0.2  | Deployments & CI/CD              |
| @e2e           | E2E / Playwright Testing          | minimax-m2.5-free              | 0.2  | Browser test automation          |
| @prompter      | Prompt Engineering                | minimax-m2.5-free              | 0.7  | Prompt optimization              |

## Usage
- Start with `@coordinator` for best results.
- All models are free (as of April 2026). Run `/models` to confirm current availability.
- Big Pickle is used for coordination and deep reasoning tasks.
- Minimax M2.5 Free offers the best speed/quality balance for implementation.
- Kimi K2.5 Free is used for review & security (stronger critic among free options).

---
## Mandatory Security Policy

**Security review is non-negotiable.**

- Every feature, refactor, or code change **must** receive a security review from @security before final delivery.
- The @coordinator is responsible for enforcing this gate in every workflow.
- Violations of this policy are not allowed.

**Last updated**: April 2026  
**Free models only** — No paid API keys required.