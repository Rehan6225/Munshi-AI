# Pesa Pilot

Build a personal finance coach web app called Pesa Pilot for Indian users. Use React, Tailwind, Zadcn UI, and Supabase.

Design:

- Dark theme, near-black background

- One accent color: emerald green

- Rounded 2xl cards, soft shadows, Inter fonts, lots of white space

Currency is INR with the rupee symbol and Indian number format: 1 lakh, with national India number format.

Fully responsive layout:

- Left sidebar with Dashboard, Transactions, Subscriptions, Goals, and What If, Monthly Review, and Coach

- A persistent voice command bar fixed at the bottom of every page: a wide text input with placeholder "Just say it" (example: "Spent 480 on Swiggy last night") and a mic icon. Users will dictate into it with Wispr Flow, so it must accept long, messy sentences.

Dashboard:

- Cards for this month's spend, savings rate, emergency fund progress, and next goal

- A spending-by-category donut chart

- A nudges panel

- Recent transaction list

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f0bb2a38-561f-4ce3-916d-a49247b0eb50).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
