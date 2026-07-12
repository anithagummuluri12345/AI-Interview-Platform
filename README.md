# AI Interview Platform

A production-grade mock interview coaching platform designed to evaluate candidate communication, technical skills, and vocabulary diversity in real-time.

---

## Project Overview
The AI Interview Platform is a flagship application enabling candidates to perform simulated, conversational voice/video mock interviews with an automated AI agent. The platform generates dynamic, job-tailored questions and delivers extensive, multi-dimensional feedback logs (transcriptions, sentiment analysis, speech rate, and filler-word detection) for candidate self-reflection and recruiter screening.

---

## Current Architecture
The system employs a decoupled, microservices-oriented architecture managed in a high-performance monorepo:
* **Frontend Web App (`apps/web`):** Built with Next.js 15, handling SEO, marketing pages, administrative portals, candidate dashboards, and visual report metrics.
* **WebSocket / REST Backend (`apps/api`):** Built with NestJS, serving as a stateful endpoint for real-time audio streams, WebSocket proxy configurations, and high-frequency candidate interaction.
* **Database Package (`packages/db`):** Shared database entities and query clients leveraging PostgreSQL and Drizzle ORM.
* **Shared Config Packages:** Centralized linting rules (`@repo/eslint-config`) and TypeScript models (`@repo/typescript-config`).

```
                    ┌────────────────────────┐
                    │      Next.js Web       │
                    │   http://localhost:3000│
                    └──────────┬─────────────┘
                               │ (REST & WebSockets)
                               ▼
                    ┌────────────────────────┐
                    │       NestJS API       │
                    │   http://localhost:4000│
                    └──────────┬─────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       ┌──────────────┐                ┌──────────────┐
       │  PostgreSQL  │                │    Redis     │
       │  Port 5432   │                │  Port 6379   │
       └──────────────┘                └──────────────┘
```

---

## Technology Stack
* **Monorepo:** Turborepo + PNPM Workspaces
* **Frontend:** Next.js 15 (App Router, React 19, TypeScript), Tailwind CSS v4, Shadcn UI, Zustand
* **Backend:** NestJS 11 (TypeScript, Express Engine, validation pipes, global error filters)
* **Database & Queue:** PostgreSQL (Neon) + Redis (Upstash) + Drizzle ORM + BullMQ
* **Real-time AI Loop:** Gemini 2.0 Live API (WebSockets) + Gemini 2.5 Pro / Flash
* **Containerization:** Docker & Docker Compose (dev postgres/redis instances)
* **CI/CD:** GitHub Actions CI Pipeline

---

## Prerequisites
Ensure the following software packages are installed locally:
* **Node.js:** v22.14.0 or higher
* **pnpm:** v11.10.0 or higher
* **Docker / Docker Desktop:** for running postgres & redis containers

---

## Environment Setup
Create local `.env` files in each workspace by copying their corresponding `.env.example` configurations.

1. **Root Configuration (`.env.example`):**
   ```bash
   DATABASE_URL=postgres://username:password@localhost:5432/database_name
   REDIS_URL=redis://localhost:6379
   PORT=4000
   NODE_ENV=development
   ```

2. **Frontend Configuration (`apps/web/.env.example`):**
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:4000
   ```

3. **Backend Configuration (`apps/api/.env.example`):**
   ```bash
   PORT=4000
   NODE_ENV=development
   DATABASE_URL=postgres://username:password@localhost:5432/database_name
   REDIS_URL=redis://localhost:6379
   ```

---

## Installation & Setup

1. **Clone the Repository & Navigate to Root:**
   ```bash
   git clone <repository_url>
   cd ai-interview-platform
   ```

2. **Install Workspace Dependencies:**
   ```bash
   pnpm install
   ```

3. **Approve Native Build Scripts:**
   ```bash
   pnpm approve-builds --all
   ```

4. **Spin up local Postgres and Redis databases:**
   ```bash
   docker-compose up -d
   ```

---

## Development & Production Commands

Run the following scripts from the repository root:

* **Start all apps in development mode (with hot reloading):**
  ```bash
  pnpm dev
  ```
* **Lint the entire workspace:**
  ```bash
  pnpm lint
  ```
* **Compile and build for production:**
  ```bash
  pnpm build
  ```
* **Verify TypeScript type correctness across all packages:**
  ```bash
  pnpm -r exec tsc --noEmit
  ```

---

## Running URLs
* **Frontend Application:** [http://localhost:3000](http://localhost:3000)
* **Backend API Gateway:** [http://localhost:4000](http://localhost:4000)
* **Backend Health Check:** [http://localhost:4000/health](http://localhost:4000/health)

---

## Current Project Status
* **Phase 1 (Complete):** Monorepo structure, Next.js web application, NestJS backend boilerplate, Drizzle database schemas, configurations linting, dockerized local databases, and GitHub Actions CI workflow are established.
* **Phase 2 (Pending Approval):** Resume parsing & question generator modules.
