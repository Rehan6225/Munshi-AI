import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Repeat,
  Target,
  Sparkles,
  CalendarCheck,
  MessageCircle,
  UserRound,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { MunshiAvatar } from "./munshi";
import { VoiceBar } from "./voice-bar";
import { Onboarding } from "./onboarding";
import { stopSpeaking } from "@/lib/speech";
import { useStore } from "@/lib/store";
import { ArrowLeftRight as Swap, LogOut, Trash2 } from "lucide-react";
import { ImportDialog } from "./import-dialog";
import { AssumedIncomeToast, IncomePrompt } from "./income-dialog";
import { SidebarFooter } from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const NAV = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Transactions", url: "/transactions", icon: ArrowLeftRight },
  { title: "Subscriptions", url: "/subscriptions", icon: Repeat },
  { title: "Goals", url: "/goals", icon: Target },
  { title: "Plan Ahead", url: "/plan-ahead", icon: Sparkles },
  { title: "Monthly Review", url: "/monthly-review", icon: CalendarCheck },
  { title: "Coach", url: "/coach", icon: MessageCircle },
  { title: "Money profile", url: "/profile", icon: UserRound },
] as const;

function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { mode } = useStore();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <Link
            to="/welcome"
            className="flex items-center gap-2.5 rounded-xl transition hover:opacity-80"
          >
            <MunshiAvatar size="sm" />
            <span className="text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              Munshi AI
            </span>
          </Link>
          {mode === "demo" && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-foreground group-data-[collapsible=icon]:hidden">
              Demo
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={path === item.url}
                    tooltip={item.title}
                    className="h-10 rounded-xl"
                  >
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
  const { mode, hasOwnData, loadDemo, startOwn, reset } = useStore();
  const [confirming, setConfirming] = useState(false);
  if (!mode) return null;
  const item = "h-10 rounded-xl text-muted-foreground";
  if (mode === "demo") {
    return (
      <SidebarMenu className="gap-1">
        {hasOwnData && (
          <SidebarMenuButton onClick={startOwn} tooltip="Switch to my data" className={item}>
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
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogTrigger asChild>
          <SidebarMenuButton tooltip="Clear my data" className={item}>
            <Trash2 className="size-4" />
            <span>Clear my data</span>
          </SidebarMenuButton>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your data?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes your transactions, profile, goals and learned rules from this browser.
              The demo isn't affected. It can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my data</AlertDialogCancel>
            <AlertDialogAction onClick={reset}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarMenu>
  );
}

/** Makes it obvious when the numbers on screen are the demo's, with a way to your own. */
function DemoBadge() {
  const { mode, hasOwnData, startOwn } = useStore();
  if (mode !== "demo") return null;
  return (
    <div className="ml-auto flex items-center gap-2 rounded-full border border-primary/30 bg-accent px-3 py-1 text-xs text-accent-foreground">
      <span className="size-1.5 rounded-full bg-primary" />
      <span>Demo data</span>
      <span className="text-muted-foreground">·</span>
      {hasOwnData ? (
        <button onClick={startOwn} className="font-medium underline-offset-2 hover:underline">
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
  // Leaving a page stops whatever Munshi was saying there (e.g. the dashboard summary).
  useEffect(() => {
    stopSpeaking();
  }, [path]);
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
            <div
              key={path}
              className="mx-auto max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500"
            >
              {children}
            </div>
          </main>
          {/* The Coach page has its own question box. */}
          {path !== "/coach" && <VoiceBar />}
        </div>
      </div>
      <IncomePrompt />
      <AssumedIncomeToast />
    </SidebarProvider>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode;
}) {
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
