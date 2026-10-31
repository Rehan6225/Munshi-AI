import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { LayoutDashboard, ArrowLeftRight, Repeat, Target, Sparkles, CalendarCheck, MessageCircle } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { VoiceBar } from "./voice-bar";
import { Onboarding } from "./onboarding";
import { useStore } from "@/lib/store";
import { ArrowLeftRight as Swap, LogOut, Trash2 } from "lucide-react";
import { ImportDialog } from "./import-dialog";
import { AssumedIncomeToast, IncomePrompt } from "./income-dialog";
import { SidebarFooter } from "@/components/ui/sidebar";

const NAV = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Transactions", url: "/transactions", icon: ArrowLeftRight },
  { title: "Subscriptions", url: "/subscriptions", icon: Repeat },
  { title: "Goals", url: "/goals", icon: Target },
  { title: "Plan Ahead", url: "/plan-ahead", icon: Sparkles },
  { title: "Monthly Review", url: "/monthly-review", icon: CalendarCheck },
  { title: "Coach", url: "/coach", icon: MessageCircle },
] as const;

function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        <Link to="/welcome" className="flex items-center gap-2.5 rounded-xl transition hover:opacity-80">
          <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">₹</div>
          <span className="text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">Munshi AI</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url} tooltip={item.title} className="h-10 rounded-xl">
                    <Link to={item.url}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <ResetButton />
      </SidebarFooter>
    </Sidebar>
  );
}

/** Switches between the demo and the user's own data, which are kept apart. */
function ResetButton() {
  const { mode, hasOwnData, loadDemo, showMine, reset } = useStore();
  const [confirming, setConfirming] = useState(false);
  if (!mode) return null;
  const item = "h-10 rounded-xl text-muted-foreground";
  if (mode === "demo") {
    return (
      <SidebarMenu className="gap-1">
        {hasOwnData && (
          <SidebarMenuButton onClick={showMine} tooltip="Switch to my data" className={item}>
            <Swap className="size-4" />
            <span>Switch to my data</span>
          </SidebarMenuButton>
        )}
        <SidebarMenuButton onClick={reset} tooltip="Exit demo" className={item}>
          <LogOut className="size-4" />
          <span>Exit demo</span>
        </SidebarMenuButton>
      </SidebarMenu>
    );
  }
  return (
    <SidebarMenu className="gap-1">
      <SidebarMenuButton onClick={loadDemo} tooltip="View the demo" className={item}>
        <Swap className="size-4" />
        <span>View the demo</span>
      </SidebarMenuButton>
      {confirming ? (
        <SidebarMenuButton
          onClick={() => {
            reset();
            setConfirming(false);
          }}
          onBlur={() => setConfirming(false)}
          tooltip="Tap again to delete all your data"
          className="h-10 rounded-xl bg-destructive/15 text-destructive hover:bg-destructive/25 hover:text-destructive"
        >
          <Trash2 className="size-4" />
          <span>Tap again to delete</span>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton onClick={() => setConfirming(true)} tooltip="Clear my data" className={item}>
          <Trash2 className="size-4" />
          <span>Clear my data</span>
        </SidebarMenuButton>
      )}
    </SidebarMenu>
  );
}

/** Makes it obvious when the numbers on screen are the demo's, not the user's. */
function DemoBadge() {
  const { mode, hasOwnData, showMine } = useStore();
  if (mode !== "demo") return null;
  return (
    <div className="ml-auto flex items-center gap-2 rounded-full border border-primary/30 bg-accent px-3 py-1 text-xs text-accent-foreground">
      <span className="size-1.5 rounded-full bg-primary" />
      <span>Demo data</span>
      <span className="text-muted-foreground">·</span>
      {hasOwnData ? (
        <button onClick={showMine} className="font-medium underline-offset-2 hover:underline">
          Switch to mine
        </button>
      ) : (
        <ImportDialog>
          <button className="font-medium underline-offset-2 hover:underline">Import mine</button>
        </ImportDialog>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { hydrated, mode } = useStore();
  // The landing page: always at /welcome, and at / until there's data to show.
  if (path === "/welcome" || (hydrated && !mode && path === "/")) return <Onboarding />;
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-2 px-4 md:px-8">
            <SidebarTrigger />
            <Link to="/welcome" className="font-semibold tracking-tight md:hidden">
              Munshi AI
            </Link>
            <DemoBadge />
          </header>
          <main className="flex-1 px-4 pb-12 md:px-8">
            <div key={path} className="mx-auto max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500">{children}</div>
          </main>
          <VoiceBar />
        </div>
      </div>
      <IncomePrompt />
      <AssumedIncomeToast />
    </SidebarProvider>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string | undefined; action?: ReactNode }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
