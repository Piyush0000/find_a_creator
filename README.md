# EVOC Labs — Find a Creator (UGC Ad Network)

A managed, business-grade **UGC Video Ad Marketplace** for Direct-to-Consumer (D2C) brands and on-camera content creators.

---

## 🏛️ Business Architecture & Core Principles

1. **Pure Content / Ad Creative Model:**
   * Creators **do not** promote products on their personal social media profiles.
   * They act as on-camera UGC (User-Generated Content) creators who shoot high-converting ad videos (unboxing, testimonials, problem-solution hooks, routines) based on structured brand briefs.
2. **Strict Privacy & Anti-Disintermediation ("Upwork Guard"):**
   * Creator personal contact info (email, phone, direct social handles) is **100% masked** from merchants.
   * Automated regex & NLP filters intercept any attempt to share contact information in briefs or notes.
3. **2-Stage Private Review Gate:**
   * **Stage 1 (Upload):** Creator uploads draft video. It is **100% PRIVATE**, visible only to EVOC Ops.
   * **Stage 2 (EVOC Review):** EVOC Ops checks script adherence, hook quality, lighting, and verifies no contact info is leaked.
   * **Stage 3 (Merchant Review):** Unlocks privately inside the Merchant Portal for final brand review.
   * **Stage 4 (Asset Handoff):** Once approved, the merchant downloads the final high-res ad creative to run in Meta/YouTube ad campaigns.
4. **Zero Direct Cash Transfer & Purchase-Driven EVOC Points:**
   * Merchants pay EVOC via a recurring SaaS subscription.
   * Creators are awarded **EVOC Points** (redeemable balance) whenever customer purchases occur via the ad campaign.
5. **UTM Attribution (Method 1 — Zero Coupon Conflict):**
   * Ad links use UTM parameters: `?utm_content=evoc_cr_[id]`.
   * Merchants can freely run their own store-wide coupons (`WELCOME10`, `DIWALI20`) with zero conflict. The background cookie guarantees creator points upon checkout.

---

## 📂 Monorepo Structure

```
find_a_creator/
├── apps/
│   └── web/                   # Next.js 14 App Router (Merchant, Creator & Admin portals)
├── services/
│   ├── api/                   # Core REST API (Express / NestJS TypeScript Service)
│   └── worker/                # Background worker (WhatsApp alerts, mature points settlement)
├── packages/
│   ├── database/              # Prisma ORM schema, migrations, seed script, client export
│   └── types/                 # Shared TypeScript interfaces, Enums, Zod DTOs, Anti-Leak patterns
├── infra/
│   ├── docker-compose.infra.yml # Postgres 16 & Redis 7 for local dev
│   ├── docker-compose.yml       # Full-stack containerization (Postgres, Redis, API, Worker, Web)
│   └── postgres/init.sql        # Database extensions
├── Makefile                   # Developer productivity shortcuts
├── pnpm-workspace.yaml        # Workspace package definitions
├── turbo.json                 # Turborepo task pipeline
└── README.md                  # System manual
```

---

## 🚀 Quick Start Guide for Developers

### Prerequisites:
* **Node.js**: v20 or v22
* **pnpm**: `npm install -g pnpm`
* **Docker Desktop** (Optional if using local Postgres)

---

### Step 1: Install Dependencies
```bash
pnpm install
```

### Step 2: Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
```

### Step 3: Start Infrastructure (PostgreSQL & Redis)

#### Option A: Using Docker (Recommended - 1 Command)
```bash
make infra-up
# or: docker compose -f infra/docker-compose.infra.yml up -d
```

#### Option B: Using Local PostgreSQL (No Docker Required)
If you prefer running a local database, ensure PostgreSQL is running on port `5432` and update your `.env`:
```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/evoc_creator_db?schema=public"
```

---

### Step 4: Run Migrations & Seed Sample Data
```bash
make db-migrate
make db-seed
```
*(This sets up your tables and seeds sample masked creators, a merchant, and a super admin).*

---

### Step 5: Start All Applications in Development Mode
```bash
make dev
# or: pnpm dev
```

Your services are now live:
* 🌐 **Web Portals (Next.js):** [http://localhost:3000](http://localhost:3000)
  * Merchant Directory: `http://localhost:3000/creators`
  * Video Brief Form: `http://localhost:3000/brief`
  * Creator Dashboard: `http://localhost:3000/dashboard`
  * Admin Moderation: `http://localhost:3000/moderation`
* 🔌 **REST API (Backend):** [http://localhost:4000](http://localhost:4000)
  * Health Check: `http://localhost:4000/healthz`
* 🗄️ **Prisma Studio (Visual DB):** `make db-studio`

---

## 🛠️ Makefile Command Reference

| Command | Action |
|---|---|
| `make infra-up` | Starts Postgres & Redis containers in the background |
| `make infra-down` | Stops the local containers safely |
| `make dev` | Starts Next.js Web, API, and Worker simultaneously with hot-reloading |
| `make build` | Builds all monorepo packages and apps |
| `make db-migrate` | Applies Prisma database migrations |
| `make db-seed` | Seeds database with initial creators & brands |
| `make db-studio` | Launches Prisma Studio GUI to view database records |
| `make lint` | Runs linter checks across all packages |
| `make clean` | Clears `.next`, `dist`, and build caches |

---

## 🔌 API Endpoints Summary

### Creator Directory
* `GET /api/creators`: Fetches filtered list of creators (with PII strictly masked).
* `GET /api/creators/:id`: Fetches single creator portfolio & past performance.

### Collaborations & 2-Stage Review
* `POST /api/collabs`: Merchant submits brief (scanned by Anti-Leak filter; dual-dispatches to Creator & Super Admin).
* `PATCH /api/collabs/:id/evoc-review`: EVOC Ops reviews draft (Stage 1 gatekeeper).
* `PATCH /api/collabs/:id/merchant-approval`: Merchant approves video (Stage 2 gatekeeper; delivers high-res ad asset).

### Checkout Webhooks
* `POST /api/webhooks/order-completed`: Ingests EVOC Checkout purchase events, verifies UTM creator attribution, credits EVOC Points to ledger, and triggers real-time WhatsApp alert.

---

## 🔒 Security & Code Standards
* **NEVER commit secrets or `.env` files.**
* **Never expose unmasked email/phone in API responses.**
* Run `pnpm lint` and `pnpm format` before opening a pull request.
