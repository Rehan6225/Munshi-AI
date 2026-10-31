import { createFileRoute } from "@tanstack/react-router";

// AppShell renders the landing page for this path; there's nothing to show inside the app layout.
export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Munshi AI — Talk to your money" },
      {
        name: "description",
        content: "Say what you spent the way you'd tell a friend. Munshi AI keeps the books.",
      },
    ],
  }),
  component: () => null,
});
