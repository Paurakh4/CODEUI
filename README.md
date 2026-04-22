# CodeUI

<div align="center">

### The Last UI

`⚡ Prompt -> Generate -> Refine -> Ship`

AI-assisted interface generation with live preview, design tools, version history, authentication, billing, and export workflows.

</div>

```text
+----------------------------------------------------------------------------+
|  CODEUI                                                                    |
|  THE LAST UI                                                               |
|                                                                            |
|  Build interfaces at extreme speed with AI generation, visual editing,     |
|  direct code control, project history, and production-minded workflows.    |
+----------------------------------------------------------------------------+
|  Stack: Next.js 16 | React 19 | TypeScript | MongoDB | NextAuth | Stripe   |
+----------------------------------------------------------------------------+
```

## ✨ Overview

CodeUI is a full-stack AI website builder designed for fast iteration without hiding the implementation. Users can generate single-page interfaces from prompts, continue refining them through conversational AI edits, inspect and tweak elements visually, edit output directly in Monaco, and manage projects with version history, credits, subscriptions, and exports.

## 🎯 At A Glance

| Feature | What it gives you |
| --- | --- |
| ⚡ Prompt to UI | Generate single-page HTML and Tailwind layouts from natural language |
| 🧠 Follow-up refinement | Continue shaping the output through iterative AI updates |
| 🎨 Design mode | Select elements and adjust styles visually inside the preview |
| 💻 Code mode | Edit generated output directly with Monaco |
| 📱 Responsive preview | Switch between desktop, tablet, and mobile views |
| 🗂️ Project history | Save, restore, checkpoint, and manage versions |
| 🔐 Auth and billing | Google auth, credentials auth, credits, and Stripe flows |
| 🌍 Discover and admin | Public project gallery plus RBAC-backed admin tooling |

## 🧩 Experience Map

```text
+----------------+     +----------------+     +----------------+     +-------------+
|  Prompt Input  | --> |  AI Generation | --> |  Design / Code | --> |   Export    |
+----------------+     +----------------+     +----------------+     +-------------+
				 |                      |                       |                      |
				 v                      v                       v                      v
	project create         streamed updates         checkpoints             copy / save
	blank canvas           follow-up edits          restore history         HTML / TSX
```

## 🛠️ Tech Stack

```text
+-------------+-------------------------------------------------------------+
| Frontend    | Next.js App Router, React 19, TypeScript, Tailwind CSS      |
| UI          | Radix UI, shadcn/ui, Monaco Editor, Framer Motion           |
| Auth        | NextAuth v5, Google OAuth, credentials auth                 |
| Data        | MongoDB with Mongoose                                       |
| Billing     | Stripe subscriptions and credit top-ups                     |
| AI          | OpenRouter-backed multi-model generation with fallback      |
| Testing     | Vitest                                                      |
+-------------+-------------------------------------------------------------+
```

## 🗺️ Project Structure

```text
app/         Routes for landing, dashboard, discover, docs, auth, and admin
components/  Editor UI, modals, dashboard panels, discover views, shared UI
hooks/       Auth, credits, mobile, style history, and chat helpers
lib/         AI orchestration, auth, pricing, DB access, recovery, utilities
stores/      Client-side editor state
scripts/     Local development and MongoDB bootstrap scripts
test/        Focused integration and regression coverage
```

## 🚀 Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create your local environment file

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with the values your environment needs.

| Area | Required values |
| --- | --- |
| 🌐 App URL | `NEXT_PUBLIC_APP_URL` |
| 🗄️ Database | `MONGODB_URI` |
| 🔐 Auth | `AUTH_SECRET`, `AUTH_URL` |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| 🤖 AI | `OPENROUTER_API_KEY` |
| ✉️ Optional email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |
| 💳 Optional Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, subscription and top-up price IDs |
| 🛡️ Optional admin access | `ADMIN_EMAILS` |

### 3. Configure Google OAuth callbacks

Google OAuth must allow these redirect URIs:

- `http://localhost:3000/api/auth/callback/google`
- `https://your-production-domain/api/auth/callback/google`

If those redirect URIs are missing, Google sign-in will fail with a `redirect_uri_mismatch` error.

### 4. Start the app

For macOS with automatic MongoDB bootstrap:

```bash
pnpm dev:local
```

For a standard Next.js dev run:

```bash
pnpm dev
```

Open `http://localhost:3000` after the server starts.

## 🧪 Useful Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Next.js development server |
| `pnpm dev:local` | Prepare local MongoDB on macOS, then start Next.js |
| `pnpm build` | Create a production build |
| `pnpm start` | Run the production server |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run the Vitest suite |
| `pnpm db:setup` | Install and start MongoDB locally on macOS |
| `pnpm db:ping` | Ping the configured MongoDB instance |
| `pnpm db:status` | Show MongoDB service status |
| `pnpm db:start` | Start the MongoDB Homebrew service |
| `pnpm db:stop` | Stop the MongoDB Homebrew service |

## 🧠 Core Workflow

1. Start from the dashboard with a prompt or a blank canvas.
2. Generate the first interface from AI.
3. Refine output with follow-up prompts, design mode, or direct code edits.
4. Save checkpoints and restore earlier versions when needed.
5. Preview across breakpoints and export when the result is ready.

```text
+-----------+    +-----------+    +------------+    +-----------+    +--------+
| Dashboard | -> | AI Output | -> | Design/Code| -> | Checkpoint| -> | Export |
+-----------+    +-----------+    +------------+    +-----------+    +--------+
```

## 🧭 Key Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page, pricing, and sign-in entry points |
| `/dashboard` | User dashboard, credits, project list, and account controls |
| `/project/[id]` | Main editor with chat, preview, design mode, and code mode |
| `/discover` | Public gallery of shareable projects |
| `/docs` | Internal quick-start documentation |
| `/admin` | Admin modules for users, billing, models, and moderation |

## 🧱 Product Surface

```text
+--------------------+-------------------------------------------------------+
| Generation         | Prompt-based project creation and follow-up AI edits  |
| Editing            | Visual design mode plus direct code editing           |
| Persistence        | Saved projects, autosave, favorites, version history  |
| Accounts           | Google OAuth, credentials auth, profile, preferences  |
| Billing            | Credits, tiers, Stripe subscriptions, top-ups         |
| Discovery          | Public gallery and shareable project flows            |
| Admin              | RBAC-backed admin operations and billing visibility   |
+--------------------+-------------------------------------------------------+
```

## 🔎 Development Notes

- `pnpm dev:local` is tailored for macOS and uses Homebrew to prepare MongoDB.
- If SMTP is not configured locally, verification and password reset links fall back to local debug output instead of email delivery.
- Stripe is optional for basic local development, but billing flows need valid Stripe keys and price IDs.
- MongoDB-backed user and project state powers dashboard, discover, auth, and admin flows.
- Runtime AI model availability is controlled through environment configuration and the public model catalog.

## ✅ Testing

Run the full test suite with:

```bash
pnpm test
```

The repository also includes focused regression coverage for billing, recovery, auth, and admin behavior under `test/` and `lib/*.test.ts`.

## 🌐 Deployment Notes

This project is set up as a Next.js app and is suitable for Vercel-style deployment. For production:

- Set all required environment variables.
- Add the production Google OAuth callback URL.
- Configure the Stripe webhook to point to `/api/stripe/webhook`.
- Point `NEXT_PUBLIC_APP_URL` at the deployed domain.

## 📌 Current Status

CodeUI is an actively developed AI interface generation platform with:

- ⚡ prompt-driven project creation
- 🧠 follow-up AI refinement with recovery logic
- 🎨 visual design editing plus direct code editing
- 💳 account tiers, credits, and billing
- 🌍 public project discovery and admin operations
