import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
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
import { RotateCcw } from "lucide-react";
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
  { title: "What If", url: "/what-if", icon: Sparkles },
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
          <MunshiAvatar size="sm" />
          <span className="text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Munshi AI
          </span>
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

function ResetButton() {
  const { mode, reset } = useStore();
  if (!mode) return null;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <SidebarMenuButton
          tooltip="Reset / switch"
          className="h-10 rounded-xl text-muted-foreground"
        >
          <RotateCcw className="size-4" />
          <span>Reset / switch</span>
        </SidebarMenuButton>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start over?</AlertDialogTitle>
          <AlertDialogDescription>
            {mode === "demo"
              ? "This clears the demo data. You can load it again or start with your own numbers."
              : "This deletes your transactions, profile and goals from this browser. It can't be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep my data</AlertDialogCancel>
          <AlertDialogAction onClick={reset}>Start over</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { hydrated, mode } = useStore();
  // Leaving a page stops whatever Munshi was saying there (e.g. the dashboard summary).
  useEffect(() => {
    stopSpeaking();
  }, [path]);
  if (hydrated && !mode && path === "/") return <Onboarding />;
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-2 px-4 md:px-8">
            <SidebarTrigger />
            <span className="font-semibold tracking-tight md:hidden">Munshi AI</span>
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
    </SidebarProvider>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string | undefined }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1.5 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
