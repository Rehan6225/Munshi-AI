<div align="center">

# 🪔 Munshi AI

### Your personal accountant you can talk to.

**Say what you spent the way you'd tell a friend. Munshi keeps the books, catches money leaks, and tells you what to do next.**

`Voice-first` · `Built for India 🇮🇳` · `₹ / lakh-crore formatting` · `Built by voice with Wispr Flow`

</div>

---

## 💡 The problem

Budgeting apps sort your transactions into categories and stop there. They don't know your goals, they don't learn when you fix a mistake, and logging an expense feels like filling out a form, so most people give up within a week.

For most Indians, money already has a *munshi*: the old-school accountant who listened, kept the books, and quietly warned you when things looked off. **Munshi AI brings that back, in your pocket, and you just talk to it.**

## 🎙️ How it works

```
 🗣️  "uh, so I spent like 450 on Swiggy last night, no wait, 480"
                              │
                              ▼
 🧠  Munshi understands  →  ₹480 · Swiggy · Food · yesterday
                              │
                              ▼
 📒  Logged, categorised, and checked against your budget and goals
```

Speak naturally, filler words and self-corrections included. Dictate with **Wispr Flow** (or the built-in 🎤 mic), and Munshi turns messy speech into clean, structured entries.

## ✨ Features

| | Feature | What it does |
|---|---|---|
| 🎙️ | **Voice command bar** | A command bar on every page. Speak or type long, messy sentences: *"paid 200 auto and 150 chai with friends"* |
| 📊 | **Dashboard** | Monthly spend, savings rate, emergency-fund progress, next goal, a spend-by-category donut, and nudges |
| 🧾 | **Smart transactions** | Detects merchants and categories, and flags entries that look miscategorised (Swiggy tagged as *Groceries*?) |
| 🔁 | **Subscription radar** | Catches **forgotten subscriptions** (Hotstar unused for 4 months) and **sneaky price hikes** (Netflix ₹499 → ₹649) |
| 🎯 | **Goals that talk back** | Emergency fund, Goa trip, new laptop: each one marked *On track*, *At risk* or *Ahead*, with the monthly amount you need |
| 📅 | **Monthly review** | A report card for the month: where your money went and what changed |
| 🔮 | **Plan Ahead** | *"What if my rent goes up by ₹3,000?"*: see how your savings and goals shift |
| 🤖 | **Coach** | Ask *"can I afford a ₹40k phone in March?"* and get answers based on your real numbers *(in progress)* |

### 🛡️ Guardrails
Munshi **educates and models scenarios. It never recommends specific stocks, mutual funds or crypto.** Ask it for one and it explains the concept instead and points you to a SEBI-registered advisor.

## 🛠️ Tech stack

- **Framework:** React 19 + [TanStack Start](https://tanstack.com/start) (file-based routing, SSR)
- **UI:** Tailwind CSS, shadcn/ui (Radix), Lucide icons, Recharts
- **Voice in:** [Wispr Flow](https://wisprflow.ai) dictation, plus the browser Web Speech API (`en-IN`)
- **Build / deploy:** Vite + Nitro, targeting Cloudflare
- **Tests:** Vitest + Testing Library

## 🚀 Run it locally

You need **Node.js 20+**.

```bash
git clone https://github.com/Rehan6225/Munshi-AI.git
cd Munshi-AI
npm install
npm run dev
```

Open **http://localhost:5173** and click **"Try with demo data"** to see Munshi with realistic Indian spending: Swiggy, Zomato, rent, a forgotten Hotstar subscription and more.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run test` | Run tests |
| `npm run lint` | Lint the codebase |

## 🗂️ Project structure

```
src/
├── routes/            # One file per page (TanStack file-based routing)
│   ├── index.tsx          → Dashboard
│   ├── transactions.tsx   → Transactions
│   ├── subscriptions.tsx  → Subscription radar
│   ├── goals.tsx          → Goals
│   ├── plan-ahead.tsx     → Plan Ahead simulator
│   ├── monthly-review.tsx → Monthly review
│   └── coach.tsx          → Coach chat
├── components/
│   ├── voice-bar.tsx      # 🎙️ the always-on voice command bar
│   ├── onboarding.tsx     # "Talk to your money" landing screen
│   ├── app-shell.tsx      # Sidebar + layout
│   └── ui/                # shadcn/ui components
└── lib/
    ├── parse-command.ts   # Speech → { amount, merchant, category, date }
    ├── store.tsx          # App state + demo data
    └── format.ts          # ₹ and Indian number formatting (1,00,000)
```

## 🗺️ Roadmap

- [x] Dashboard, transactions, subscriptions, goals, monthly review
- [x] Voice command bar with Wispr Flow and mic input
- [x] Detection of forgotten subscriptions and price hikes
- [ ] AI parsing for self-corrections ("450, no wait, 480") and multiple expenses in one sentence
- [ ] Learns from corrections: fix a category once and Munshi remembers it as a rule
- [ ] Plan Ahead: goal-timeline charts
- [ ] Coach chat grounded in your own data
- [ ] 🔊 Munshi talks back, with Hinglish voice replies (*"Ho gaya! ₹480 Swiggy pe add kar diya."*)
- [ ] Import bank CSV / PDF / transaction SMS

## 🏆 Built for

**The Product Space AI Hackathon**, problem statement **04: Personal Finance Coach with a Living Money Model**.

The whole app was built **by voice**: every prompt, spec and fix was dictated with **Wispr Flow**.
