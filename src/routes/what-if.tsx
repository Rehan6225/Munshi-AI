import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address for Plan Ahead, kept so saved links still work.
export const Route = createFileRoute("/what-if")({
  beforeLoad: () => {
    throw redirect({ to: "/plan-ahead", replace: true });
  },
});
