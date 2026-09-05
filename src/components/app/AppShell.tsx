import { ReactNode, useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Building2,
  CheckCheck,
  ChevronRight,
  CircleUserRound,
  FileText,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  PanelLeft,
  ScrollText,
  ShieldCheck,
  Users,
  Loader2,
  GitBranch,
  CalendarClock,
  BadgePercent,
  ClipboardCheck,
  SearchCheck,
  Activity,
  FileClock,
  Home,
} from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Role } from "@/convex/schema";
import { timeAgo } from "@/lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean };

const applicantNav: NavItem[] = [
  { to: "/applicant/dashboard", label: "Dashboard", icon: <LayoutGrid className="size-4" />, end: true },
  { to: "/applicant/applications", label: "My Applications", icon: <FileText className="size-4" /> },
  { to: "/applicant/journey", label: "Approval Journey", icon: <GitBranch className="size-4" /> },
  { to: "/applicant/documents", label: "Documents", icon: <ClipboardCheck className="size-4" /> },
  { to: "/applicant/compliance", label: "Compliance", icon: <CalendarClock className="size-4" /> },
  { to: "/applicant/schemes", label: "Schemes", icon: <BadgePercent className="size-4" /> },
  { to: "/applicant/notifications", label: "Notifications", icon: <Bell className="size-4" /> },
  { to: "/applicant/activity", label: "Activity", icon: <Activity className="size-4" /> },
  { to: "/applicant/profile", label: "Business Profile", icon: <Building2 className="size-4" /> },
];

const departmentNav: NavItem[] = [
  { to: "/department/dashboard", label: "Overview", icon: <LayoutGrid className="size-4" />, end: true },
  { to: "/department/applications", label: "Application Queue", icon: <FileText className="size-4" /> },
  { to: "/department/queries", label: "Queries", icon: <SearchCheck className="size-4" /> },
  { to: "/department/inspections", label: "Inspections", icon: <ClipboardCheck className="size-4" /> },
  { to: "/department/sla", label: "SLA Monitoring", icon: <Activity className="size-4" /> },
  { to: "/department/rules", label: "Regulatory Rules", icon: <ListChecks className="size-4" /> },
  { to: "/department/reports", label: "Reports", icon: <FileClock className="size-4" /> },
  { to: "/department/audit", label: "Audit Log", icon: <ScrollText className="size-4" /> },
];

const adminNav: NavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: <LayoutGrid className="size-4" />, end: true },
  { to: "/admin/rules", label: "Regulatory Rules", icon: <ListChecks className="size-4" /> },
  { to: "/admin/users", label: "Users & Roles", icon: <Users className="size-4" /> },
  { to: "/admin/audit", label: "Audit Log", icon: <ScrollText className="size-4" /> },
];

export function roleHome(role?: string): string {
  switch (role) {
    case "applicant":
      return "/applicant/dashboard";
    case "dept_officer":
    case "dept_supervisor":
      return "/department/dashboard";
    case "admin":
      return "/admin/dashboard";
    default:
      return "/auth/applicant";
  }
}

export function RequireRole({
  children,
  roles,
}: {
  children: ReactNode;
  roles: Role[];
}) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth/applicant?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  if (!user?.role || !roles.includes(user.role as Role)) {
    return <Navigate to={roleHome(user?.role)} replace />;
  }
  return children;
}

function NotificationsBell() {
  const notifications = useQuery(api.notifications.myNotifications);
  const unread = useQuery(api.notifications.unreadCount);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const navigate = useNavigate();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground" aria-label="Notifications">
          <Bell className="size-[18px]" />
          {!!unread && (
            <span className="absolute top-1.5 right-1.5 flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-[13px] font-medium">Notifications</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={() => markAllRead()}
          >
            <CheckCheck className="size-3.5" /> Mark all read
          </Button>
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {!notifications || notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n._id}
                type="button"
                onClick={() => {
                  markAllRead();
                  if (n.link) navigate(n.link);
                }}
                className="flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left last:border-0 hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    n.read ? "bg-neutral-300" : "bg-amber-500",
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium">{n.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.message}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground/70">{timeAgo(n._creationTime)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const roleLabel =
    user?.role === "applicant"
      ? "Applicant"
      : user?.role === "dept_officer"
        ? "Department Officer"
        : user?.role === "dept_supervisor"
          ? "Department Supervisor"
          : "System Administrator";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-md border px-1.5 py-1 pr-2 hover:bg-muted/50"
          aria-label="User menu"
        >
          <span className="flex size-7 items-center justify-center rounded-sm bg-neutral-900 text-white">
            <CircleUserRound className="size-4" />
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-xs font-medium leading-4">{user?.name ?? "User"}</span>
            <span className="block text-[10px] leading-3.5 text-muted-foreground">{roleLabel}</span>
          </span>
          <ChevronRight className="hidden size-3.5 text-muted-foreground sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-xs font-medium">{user?.name}</p>
          <p className="text-[11px] text-muted-foreground">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate(roleHome(user?.role))}>
          <Home className="size-4" /> Go to dashboard
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600"
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Wordmark() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/")}
      className="flex items-center gap-2 px-1"
      aria-label="ApprovalArc home"
    >
      <span className="flex size-6 items-center justify-center rounded-[4px] bg-neutral-900 text-white">
        <PanelLeft className="size-3.5" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">ApprovalArc</span>
    </button>
  );
}

function SidebarNav({ items, contextLabel }: { items: NavItem[]; contextLabel?: string }) {
  const { pathname } = useLocation();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b px-4">
        <Wordmark />
      </div>
      {contextLabel && (
        <div className="border-b px-4 py-2.5">
          <p className="truncate text-[11px] leading-4 text-muted-foreground">{contextLabel}</p>
        </div>
      )}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {items.map((item) => {
          const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-neutral-100 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t px-4 py-3">
        <p className="text-[10px] leading-4 text-muted-foreground">
          Government portals process individual approvals.
          <br />
          ApprovalArc manages the journey across them.
        </p>
      </div>
    </div>
  );
}

export default function AppShell({
  nav,
  contextLabel,
  simulation = false,
}: {
  nav: NavItem[];
  contextLabel?: string;
  simulation?: boolean;
}) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const topContext = user?.role === "applicant" ? contextLabel : contextLabel;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-sidebar lg:block">
        <SidebarNav items={nav} contextLabel={topContext} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <span className="lg:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Menu">
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <SidebarNav items={nav} contextLabel={topContext} />
                </SheetContent>
              </Sheet>
            </span>
            <span className="truncate text-[13px] text-muted-foreground sm:text-sm">
              {topContext ?? "ApprovalArc"}
            </span>
            {simulation && (
              <Badge variant="outline" className="hidden shrink-0 border-amber-200 bg-amber-50 text-amber-700 sm:inline-flex">
                Prototype gateway — simulation
              </Badge>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationsBell />
            <Separator orientation="vertical" className="mx-1 h-5" />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export { applicantNav, departmentNav, adminNav, ShieldCheck as _deprecated };