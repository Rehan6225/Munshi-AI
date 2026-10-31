# ✅ Munshi AI: Completion Tracker

Everything needed to finish Munshi AI for **The Product Space AI Hackathon** (problem statement **#04: Personal Finance Coach with a Living Money Model**).

**Deadline:** 31 Oct, 11:59 PM IST
**Overall progress:** about 72%
**Rule:** everything must be **dynamic**. Every number, alert and status is calculated from real data, never hardcoded.

Legend: 🔴 not started · 🟡 in progress · 🟢 done

---

## 📋 Mandatory: problem statement #04

| # | Requirement | Status | Done | What exists | Still hardcoded / missing |
|---|---|---|---|---|---|
| 1 | Ingest messy bank data (PDF, CSV, SMS) with automatic categories | 🔴 | 0% | Nothing | No upload or paste flow. Categories come from keyword matching only |
| 2 | Correction loop: user fixes a category and the system learns the rule | 🟢 | 100% | ✅ Change any category → "Remember" refiles all past transactions from that merchant and future ones. "🧠 learned" badge, Learned rules list with usage count and delete. Voice: "Swiggy is food, not groceries, remember that". Suggestions calculated from each merchant's usual category | — |
| 3 | Recurring payments and subscriptions, with alerts on change or non-use | 🟢 | 90% | Detected from transactions, with price-hike, unused and new alerts, voice commands and buttons | Lost on refresh (no saving yet) |
| 4 | Persistent profile: income, fixed costs, emergency fund, goals with target dates | 🟢 | 95% | ✅ Money profile page: income, fixed costs (detected bills + your own), emergency fund (3–12 months of spending), goals with target, saved and date. Everything saves across refreshes | Nothing major |
| 5 | Goal planner with what-if simulation ("cut dining by 30%", "rent goes up") | 🟡 | 35% | ✅ Goal status (Ahead / On track / At risk / Done) and advice calculated from income, spending and deadlines | What-If page still says "Coming soon" |
| 6 | Nudges when spending drifts off plan | 🟡 | 40% | Subscription nudges are calculated | "Eating out +117%" comes from a fixed array. No budget plan to compare against |
| 7 | Monthly review report | 🟡 | 15% | One bar chart | Chart uses fixed demo numbers. No real report (income, spend, top categories, wins, suggestions) |
| 8 | Guardrails: educate and model scenarios, never recommend specific securities | 🟢 | 100% | ✅ Coach chat answers from your real numbers (Gemini, or on-device without a key). 3 guardrail layers: questions asking for stock/fund/crypto picks are refused before any AI runs, the AI is told never to name securities, and answers that do are blocked. Refusals teach instead (emergency fund, index funds vs stocks) and point to a SEBI-registered adviser | — |

## 🎙️ Hackathon must-haves

| Item | Score weight | Status | Notes |
|---|---|---|---|
| AI voice parsing ("450, no wait, 480" → ₹480; several expenses in one sentence) | Voice 20% + AI 20% | 🟡 85% | ✅ Gemini parsing via a server function (key stays on the server), with an on-device fallback that already handles fillers, "no wait" corrections and several spends per sentence. **Needs the Gemini key** in `.env` to switch on AI |
| Wispr Flow usage (dictate every prompt, fix and message) | 20% | 🟡 Ongoing | Judges check activity on the Wispr account |
| Live deployed URL | Required | 🔴 | Cloudflare (free); the project already builds for it |
| LinkedIn post (demo video + tag Wispr Flow and the organizers) | 15% | 🔴 | Posting at all earns 6/10; higher engagement earns up to 10 |
| Final submission | Required | 🔴 | Before 11:59 PM IST |

## ✨ UI upgrades (creativity and UX)

| # | Upgrade | Status | Why it matters |
|---|---|---|---|
| U1 | **"What Munshi heard"** card: raw speech with fillers and corrections struck through, then the clean entry | 🟢 | ✅ Built: fillers struck in grey, take-backs in red, editable entries, Save / Discard, Gemini or On-device badge |
| U2 | **Munshi persona**: avatar plus warm Hinglish replies ("Ho gaya! ₹480 Swiggy pe likh diya.") | 🟢 | ✅ Munshi ji avatar (logo, card, replies), Hinglish replies for every voice action, weekly nudges ("teesra Swiggy order"), dashboard greeting |
| U3 | **Munshi talks back**: spoken replies (free browser text-to-speech) | 🟢 🔒 Final | ✅ Speaks every reply with a **Hindi voice** (Google हिन्दी, then macOS Lekha), avatar pulses while talking, 🔊/🔇 toggle remembered, "Suniye aaj ka hisaab" spoken summary. **Locked: no further changes to the voice** |
| U4 | **Ledger (khata) look** for transactions (optional) | 🔴 | A distinct look, tied to the munshi idea |

## 🧱 Behind the scenes (needed for "dynamic")

| Item | Status | Details |
|---|---|---|
| Save data across refreshes | 🟢 | ✅ Transactions, profile, goals, learned rules, subscription check-ins and cancellations all saved in the browser |
| Remove hardcoded values | 🟡 | ✅ `MONTHLY_INCOME`, goal `status`/`note` text and demo `suggestedCategory` removed. Still left: `DEMO_EATING_OUT` (task 4) |
| **18 categories** in 4 groups (Commitments, Essentials, Lifestyle, Money moves) | 🟢 | ✅ Voice parser, Gemini prompt, learned rules, bill vs subscription detection, fixed costs, goals and demo data all use them. Investments count as saving, not spending |

---

## 🗺️ Build order

| Order | Task | Needs Gemini key? | Time | Status |
|---|---|---|---|---|
| 1 | Save data + profile form (#4), replacing the fixed income and goal text | No | 1 hr | 🟢 |
| 2 | Correction loop with real learned rules (#2) | No | 45 min | 🟢 |
| 3 | Calculated goal status + What-If simulator (#5) | No | 1.5 hr | 🟡 Goal status done; What-If left |
| 4 | Calculated nudges + monthly review from real transactions (#6, #7) | No | 1 hr | 🔴 |
| 5 | AI voice parsing + U1 "What Munshi heard" | **Yes** | 1 hr | 🟢 Built; add the key to enable Gemini |
| 6 | Import: CSV + SMS paste with AI categories (#1); PDF only if time allows | **Yes** | 1 hr | 🔴 |
| 7 | Coach with guardrails (#8) | **Yes** | 45 min | 🟢 Built; add the key for Gemini answers |
| 8 | U2 Munshi persona + U3 talk-back | No | 45 min | 🟢 |
| 9 | Deploy, then record the demo, then the LinkedIn post, then submit | No | 1 hr | 🔴 |
| — | U4 ledger look | No | Only if ahead | 🔴 |

## 🕓 Done log

Newest last. Every finished task gets a line here, along with whether it has been pushed to GitHub.

| When (31 Oct, IST) | What was done | Pushed? |
|---|---|---|
| Before 3:00 PM | Design and all pages built in Lovable | ✅ |
| 3:10 PM | Code moved to the `Munshi-AI` repo | ✅ |
| 3:15 PM | README rewritten for Munshi AI | ✅ |
| 3:25 PM | App renamed Pesa Pilot → Munshi AI; "Made by" line removed from README | ✅ |
| 3:50 PM | **#3 Recurring payment detection:** subscriptions detected from transactions; price-hike, unused and new alerts; voice check-ins ("I never use Hotstar"); 10 tests | ✅ |
| 4:00 PM | COMPLETION.md tracker created | ✅ |
| 4:55 PM | **Task 1, saving data + Money profile (#4):** everything saves across refreshes; new Money profile page (income, fixed costs, emergency fund, goals); goal status and advice calculated; "Start with my own numbers" option next to "Try with demo data"; Demo badge and Reset / switch button with confirmation; 8 tests | ✅ |
| 5:05 PM | **Task 2, correction loop (#2):** category picker on every transaction; "Remember" saves a rule and refiles past and future spends; 🧠 learned badge; Learned rules card; voice corrections ("Swiggy is food, not groceries"); calculated suggestions replace the hardcoded one; 11 tests | ✅ |
| 5:51 PM | **Task 5, voice parsing + U1 "What Munshi heard":** Gemini server function (key stays on the server) with an on-device fallback; handles fillers, "450, no wait, 480" and several spends per sentence; confirm card with struck-through speech, editable amounts and categories; 12 tests | ✅ (feature/Rehan/FinanceCoach) |
| 5:57 PM | **18 categories:** Rent & Housing, Utilities, EMIs, Insurance, Household help (incl. laundry), Education, Family support, Subscriptions, Groceries, Transport, Health, Food & Dining, Shopping, Entertainment, Personal care, Travel, Savings & Investments, Other; grouped picker; fixed-cost categories auto-fill fixed costs; SIPs excluded from spending; bills get no price or "new" alerts; old saved data migrated; 25 tests | ✅ (feature/Rehan/FinanceCoach) |
| 6:09 PM | **Task 8, Munshi ji persona + talk-back (U2, U3):** avatar as logo and in replies; warm Hinglish replies for spends, rules and subscriptions; weekly heads-up for repeat orders; spoken replies with an Indian-English voice and remembered mute; dashboard greeting with spoken summary; 12 tests including a full voice flow | ✅ (feature/Rehan/FinanceCoach) |
| 6:14 PM | **Fix: Munshi ji's Hindi pronunciation.** Every reply now also has a Devanagari version that a Hindi voice speaks (Google हिन्दी or macOS Lekha), so Hindi words and amounts sound right; the screen still shows Hinglish; Indian-English fallback when there's no Hindi voice; 3 tests | ✅ (feature/Rehan/FinanceCoach) |
| 6:24 PM | **Voice choice:** back to the Indian-English voice by default (the one that sounded right); Hindi voice is now optional via an EN / हि toggle next to 🔊, remembered per device | ⏳ Not yet |
| 6:26 PM | **Voice: Hindi only.** Reverted the English default and the EN / हि toggle; Munshi ji always speaks with a Hindi voice (Google हिन्दी first, then macOS Lekha) | ⏳ Not yet |
| 6:33 PM | **Task 7, Coach with guardrails (#8):** chat page with Munshi ji; answers from your numbers (where money went, can I afford X by month Y, spend on a merchant or category, how to save, goal status, concepts like SIPs); Gemini via a server function with an on-device fallback; 3-layer guardrail against stock/fund/crypto picks; "Educational only" label; suggestion chips; 28 tests | ⏳ Not yet |
| 6:34 PM | **Fix: Coach page crash.** The auto-scroll effect returned the Promise that newer Chrome gives back from scrollIntoView, which React then tried to call as a cleanup. Effect now returns nothing; the test stub mimics Chrome so this is caught | ⏳ Not yet |
| 6:40 PM | **Coach voice: amounts in English.** When a Coach answer is read aloud, numbers are spelled out as English words first ("₹1,980" → "one thousand nine hundred and eighty rupees"), so the Hindi voice no longer says them in Hindi. Coach page only; nothing else changed; 11 tests | ⏳ Not yet |
| 6:49 PM | **Coach audio + navigation fix:** Coach answers are read aloud automatically (amounts in English words), with a 🔊/🔇 mute button in the Coach header; any speech (e.g. the dashboard summary) stops when you switch pages; 2 tests | ⏳ Not yet |
