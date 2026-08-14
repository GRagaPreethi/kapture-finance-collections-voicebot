import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Ban,
  BellRing,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Clock3,
  Code2,
  ExternalLink,
  FileText,
  Headphones,
  KeyRound,
  Layers3,
  MessageCircle,
  PhoneCall,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import {
  DemoActionInputAction,
  getGetAccountQueryKey,
  getGetDashboardQueryKey,
  getHealthCheckQueryKey,
  getListDispositionsQueryKey,
  getListPtpQueryKey,
  getListToolCallsQueryKey,
  useGetAccount,
  useGetDashboard,
  useHandleWebhook,
  useHealthCheck,
  useListDispositions,
  useListPtp,
  useListToolCalls,
  useResetDemo,
  useRunDemoAction,
  type DashboardSnapshot,
  type DemoActionInputAction as DemoAction,
  type Disposition,
  type PtpRecord,
  type ToolCallRecord,
  type WebhookInput,
} from '@workspace/api-client-react';

const scenarios: Array<{
  action: DemoAction;
  label: string;
  detail: string;
  icon: typeof Check;
  tone: string;
}> = [
  {
    action: DemoActionInputAction.VERIFY,
    label: 'Verify customer',
    detail: 'Authentication gate',
    icon: KeyRound,
    tone: 'teal',
  },
  {
    action: DemoActionInputAction.SUCCESSFUL_PTP,
    label: 'Successful PTP',
    detail: 'Promise to pay',
    icon: BadgeCheck,
    tone: 'gold',
  },
  {
    action: DemoActionInputAction.ALREADY_PAID,
    label: 'Already paid',
    detail: 'Close with care',
    icon: CircleCheck,
    tone: 'blue',
  },
  {
    action: DemoActionInputAction.DISPUTE,
    label: 'Dispute',
    detail: 'Route for review',
    icon: FileText,
    tone: 'plum',
  },
  {
    action: DemoActionInputAction.DNC,
    label: 'Do not call',
    detail: 'Respect preference',
    icon: Ban,
    tone: 'rose',
  },
  {
    action: DemoActionInputAction.HARDSHIP,
    label: 'Hardship',
    detail: 'Escalate safely',
    icon: BellRing,
    tone: 'orange',
  },
  {
    action: DemoActionInputAction.WRONG_PERSON,
    label: 'Wrong person',
    detail: 'End disclosure',
    icon: UserRound,
    tone: 'slate',
  },
  {
    action: DemoActionInputAction.HOSTILE_CALLER,
    label: 'Hostile caller',
    detail: 'De-escalate',
    icon: MessageCircle,
    tone: 'rose',
  },
  {
    action: DemoActionInputAction.NO_RESPONSE,
    label: 'No response',
    detail: 'No disclosure',
    icon: Clock3,
    tone: 'slate',
  },
];

const stateSteps = [
  {
    key: 'AUTH_PENDING',
    label: 'Authenticate',
    caption: 'Confirm identity before detail',
  },
  {
    key: 'AUTHENTICATED',
    label: 'Authenticated',
    caption: 'Safe to discuss account',
  },
  {
    key: 'NEGOTIATION',
    label: 'Understand',
    caption: 'Listen without pressure',
  },
  {
    key: 'ACTION',
    label: 'Take action',
    caption: 'Offer the approved next step',
  },
  {
    key: 'ESCALATED',
    label: 'Escalate',
    caption: 'Hand off when needed',
  },
  {
    key: 'CALL_ENDED',
    label: 'Close call',
    caption: 'Leave a clear disposition',
  },
];

const statusLabels: Record<string, string> = {
  PTP_AGREED: 'Promise to pay',
  ALREADY_PAID: 'Already paid',
  DISPUTED: 'Disputed',
  HARDSHIP_ESCALATED: 'Hardship escalated',
  WRONG_PERSON: 'Wrong person',
  DO_NOT_CALL: 'Do not call',
  CALLBACK_REQUEST: 'Callback requested',
  VERIFICATION_FAILED: 'Verification failed',
  NO_RESPONSE: 'No response',
  HOSTILE_CALLER: 'Hostile caller',
};

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'teal' | 'gold' | 'rose' | 'neutral' | 'blue';
}) {
  const tones = {
    teal: 'bg-[hsl(168_39%_29%/.11)] text-[hsl(168_39%_26%)] border-[hsl(168_39%_29%/.2)]',
    gold: 'bg-[hsl(35_78%_56%/.16)] text-[hsl(28_55%_31%)] border-[hsl(35_70%_46%/.28)]',
    rose: 'bg-[hsl(2_57%_47%/.1)] text-[hsl(2_57%_38%)] border-[hsl(2_57%_47%/.2)]',
    blue: 'bg-[hsl(203_45%_48%/.11)] text-[hsl(203_45%_33%)] border-[hsl(203_45%_48%/.2)]',
    neutral: 'bg-secondary text-muted-foreground border-border',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[.01em]',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <div className="mb-1 font-mono text-[10px] font-medium uppercase tracking-[.16em] text-muted-foreground">
          {eyebrow}
        </div>
        <h2 className="font-serif text-[22px] leading-tight text-foreground">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl border border-border bg-card p-5',
        className,
      )}
    >
      <div className="h-3 w-24 rounded bg-secondary" />
      <div className="mt-4 h-7 w-40 rounded bg-secondary" />
      <div className="mt-3 h-3 w-full rounded bg-secondary" />
    </div>
  );
}

function NavRail({
  onReset,
  isResetting,
}: {
  onReset: () => void;
  isResetting: boolean;
}) {
  return (
    <aside className="hidden min-h-[100dvh] w-[248px] shrink-0 flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] lg:flex">
      <div className="border-b border-[hsl(var(--sidebar-border))] px-6 pb-6 pt-7">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]">
            <Zap size={18} strokeWidth={2.4} />
          </div>

          <div>
            <div className="font-serif text-[21px] leading-none">
              Kapture
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[.2em] text-[hsl(var(--sidebar-foreground)/.56)]">
              Collections
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-7">
        <div className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.45)]">
          Control room
        </div>

        <div className="space-y-1">
          <div
            data-testid="nav-overview"
            className="flex items-center gap-3 rounded-lg bg-[hsl(var(--sidebar-accent))] px-3 py-2.5 text-sm font-semibold"
          >
            <Activity
              size={16}
              className="text-[hsl(var(--sidebar-primary))]"
            />
            Overview
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]" />
          </div>

          {[
            { icon: Layers3, label: 'Session map' },
            { icon: Headphones, label: 'Voice reference' },
            { icon: BookOpen, label: 'Review guide' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[hsl(var(--sidebar-foreground)/.65)]"
            >
              <Icon size={16} />
              {label}
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.58)] p-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold">
            <span className="animate-pulse-dot h-2 w-2 rounded-full bg-[hsl(var(--sidebar-primary))]" />
            Demo environment
          </div>

          <p className="text-[11px] leading-relaxed text-[hsl(var(--sidebar-foreground)/.56)]">
            In-memory session. Safe to run every scenario as often as you need.
          </p>

          <button
            data-testid="button-reset-demo-sidebar"
            onClick={onReset}
            disabled={isResetting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[hsl(var(--sidebar-border))] px-3 py-2 text-[11px] font-semibold text-[hsl(var(--sidebar-foreground)/.78)] transition hover:bg-[hsl(var(--sidebar-accent))] disabled:opacity-50"
          >
            <RotateCcw
              size={13}
              className={isResetting ? 'animate-spin' : ''}
            />
            {isResetting ? 'Resetting' : 'Reset session'}
          </button>
        </div>
      </div>

      <div className="border-t border-[hsl(var(--sidebar-border))] px-6 py-5">
        <div className="flex items-center gap-2 text-[11px] text-[hsl(var(--sidebar-foreground)/.56)]">
          <ShieldCheck
            size={14}
            className="text-[hsl(var(--sidebar-primary))]"
          />
          Privacy-safe by design
        </div>

        <div className="mt-1 pl-[22px] font-mono text-[9px] text-[hsl(var(--sidebar-foreground)/.34)]">
          BUILD 0.4.7 · MAYA
        </div>
      </div>
    </aside>
  );
}

function Metric({
  label,
  value,
  note,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: typeof Activity;
  accent: string;
}) {
  return (
    <div className="group rounded-xl border border-border bg-card p-4 shadow-[0_2px_12px_hsl(222_31%_18%/.025)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_hsl(222_31%_18%/.07)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
          {label}
        </span>

        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg',
            accent,
          )}
        >
          <Icon size={14} />
        </span>
      </div>

      <div className="mt-3 font-serif text-[28px] leading-none text-foreground">
        {value}
      </div>

      <div className="mt-2 text-[11px] text-muted-foreground">
        {note}
      </div>
    </div>
  );
}

function ConversationState({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  const activeIndex = Math.max(
    stateSteps.findIndex((step) => step.key === snapshot.currentState),
    0,
  );

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[0_2px_12px_hsl(222_31%_18%/.025)] sm:p-6">
      <SectionHeading
        eyebrow="01 / live trace"
        title="Conversation state"
        action={
          <StatusPill
            tone={
              snapshot.authenticationStatus === 'VERIFIED'
                ? 'teal'
                : snapshot.authenticationStatus === 'FAILED'
                  ? 'rose'
                  : 'gold'
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {(snapshot.currentState ?? 'AUTH_PENDING').replace('_', ' ')}
          </StatusPill>
        }
      />

      <div className="relative mt-7">
        <div className="absolute left-[13px] top-3 h-[calc(100%-24px)] w-px bg-border" />

        <div className="space-y-5">
          {stateSteps.map((step, index) => {
            const complete = index < activeIndex;
            const active = index === activeIndex;

            return (
              <div
                key={step.key}
                className={cn(
                  'relative flex gap-4 transition-opacity',
                  !active && !complete && 'opacity-45',
                )}
              >
                <div
                  className={cn(
                    'z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-card',
                    complete &&
                      'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-primary-foreground',
                    active &&
                      'border-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-[0_0_0_4px_hsl(35_78%_56%/.13)]',
                    !active &&
                      !complete &&
                      'border-border text-muted-foreground',
                  )}
                >
                  {complete ? (
                    <Check size={13} />
                  ) : active ? (
                    <span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />
                  ) : (
                    <CircleDashed size={13} />
                  )}
                </div>

                <div className="min-w-0 pt-0.5">
                  <div
                    className={cn(
                      'text-[13px] font-semibold',
                      active && 'text-[hsl(var(--primary))]',
                    )}
                  >
                    {step.label}

                    {active && (
                      <span className="ml-2 font-mono text-[9px] uppercase tracking-[.14em] text-[hsl(var(--accent))]">
                        current
                      </span>
                    )}
                  </div>

                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {step.caption}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-7 rounded-lg border border-[hsl(168_39%_29%/.16)] bg-[hsl(168_39%_29%/.055)] p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.08em] text-[hsl(var(--primary))]">
          <ShieldCheck size={14} />
          Customer-safe disclosure
        </div>

        <p
          data-testid="text-first-message"
          className="mt-2 text-[13px] leading-relaxed text-foreground"
        >
          “{snapshot.firstMessage}”
        </p>

        <div className="mt-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.11em] text-muted-foreground">
          <KeyRound size={12} />
          No account details before verification
        </div>
      </div>
    </section>
  );
}

function AccountCard({
  snapshot,
  account,
}: {
  snapshot: DashboardSnapshot;
  account?: DashboardSnapshot['account'];
}) {
  const safeAccount = account ?? snapshot.account;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[0_2px_12px_hsl(222_31%_18%/.025)] sm:p-6">
      <SectionHeading
        eyebrow="02 / safe account view"
        title="Account context"
        action={
          <StatusPill tone={safeAccount.authenticated ? 'teal' : 'gold'}>
            {safeAccount.authenticated ? (
              <BadgeCheck size={12} />
            ) : (
              <KeyRound size={12} />
            )}
            {safeAccount.authenticated ? 'Verified' : 'Pending'}
          </StatusPill>
        }
      />

      <div className="flex items-center gap-3 border-b border-border pb-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(35_78%_56%/.2)] font-serif text-lg text-[hsl(28_55%_31%)]">
          {safeAccount.customerName
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)}
        </div>

        <div>
          <div
            data-testid="text-customer-name"
            className="font-semibold"
          >
            {safeAccount.customerName}
          </div>

          <div
            data-testid="text-account-id"
            className="mt-0.5 font-mono text-[10px] text-muted-foreground"
          >
            {safeAccount.accountId}
          </div>
        </div>

        <div className="ml-auto text-right">
          <div className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
            State
          </div>

          <div
            data-testid="status-account-state"
            className="mt-1 text-[11px] font-semibold"
          >
            {(safeAccount.currentState ?? 'AUTH_PENDING').replace('_', ' ')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-4 pt-5">
        <div>
          <div className="text-[10px] uppercase tracking-[.09em] text-muted-foreground">
            Loan type
          </div>

          <div
            data-testid="text-loan-type"
            className="mt-1 text-[13px] font-semibold"
          >
            {safeAccount.loanType ?? 'Not disclosed'}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[.09em] text-muted-foreground">
            Days past due
          </div>

          <div
            data-testid="text-days-past-due"
            className="mt-1 text-[13px] font-semibold"
          >
            {safeAccount.daysPastDue ?? '—'}
            {safeAccount.daysPastDue !== null &&
            safeAccount.daysPastDue !== undefined
              ? ' days'
              : ''}
          </div>
        </div>

        <div className="col-span-2 rounded-lg bg-secondary/70 p-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[.09em] text-muted-foreground">
              Overdue amount
            </div>

            <ArrowUpRight
              size={14}
              className="text-muted-foreground"
            />
          </div>

          <div
            data-testid="text-overdue-amount"
            className="mt-1 font-serif text-[25px]"
          >
            {formatMoney(safeAccount.overdueAmount)}
          </div>
        </div>
      </div>
    </section>
  );
}

function ScenarioRunner({
  running,
  onRun,
}: {
  running?: DemoAction;
  onRun: (action: DemoAction) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[0_2px_12px_hsl(222_31%_18%/.025)] sm:p-6">
      <SectionHeading
        eyebrow="03 / review harness"
        title="Run a scenario"
        action={
          <span className="font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">
            9 paths
          </span>
        }
      />

      <p className="mb-4 max-w-[38ch] text-[12px] leading-relaxed text-muted-foreground">
        Each path runs against the real in-memory contract. Watch the gate,
        tool calls, and final disposition move together.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {scenarios.map(
          ({ action, label, detail, icon: Icon, tone }) => {
            const isRunning = running === action;

            const toneClasses: Record<string, string> = {
              teal: 'text-[hsl(168_39%_29%)] bg-[hsl(168_39%_29%/.07)]',
              gold: 'text-[hsl(28_55%_31%)] bg-[hsl(35_78%_56%/.13)]',
              blue: 'text-[hsl(203_45%_33%)] bg-[hsl(203_45%_48%/.09)]',
              plum: 'text-[hsl(273_25%_40%)] bg-[hsl(273_25%_51%/.1)]',
              rose: 'text-[hsl(2_57%_38%)] bg-[hsl(2_57%_47%/.08)]',
              orange: 'text-[hsl(18_61%_37%)] bg-[hsl(18_61%_50%/.1)]',
              slate: 'text-muted-foreground bg-secondary',
            };

            return (
              <button
                data-testid={`button-scenario-${action.toLowerCase()}`}
                key={action}
                onClick={() => onRun(action)}
                disabled={Boolean(running)}
                className="group flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3 text-left transition hover:-translate-y-0.5 hover:border-[hsl(var(--accent)/.6)] hover:shadow-[0_4px_13px_hsl(222_31%_18%/.06)] disabled:cursor-wait disabled:opacity-60"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    toneClasses[tone],
                  )}
                >
                  {isRunning ? (
                    <RefreshCw size={15} className="animate-spin" />
                  ) : (
                    <Icon size={15} />
                  )}
                </span>

                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold">
                    {label}
                  </span>

                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                    {isRunning ? 'Running path…' : detail}
                  </span>
                </span>

                <ChevronRight
                  size={14}
                  className="ml-auto shrink-0 text-muted-foreground transition group-hover:translate-x-0.5"
                />
              </button>
            );
          },
        )}
      </div>
    </section>
  );
}

function ToolActivity({
  records,
  loading,
}: {
  records: ToolCallRecord[];
  loading: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[0_2px_12px_hsl(222_31%_18%/.025)] sm:p-6">
      <SectionHeading
        eyebrow="04 / observable tools"
        title="Tool activity"
        action={
          <StatusPill tone="teal">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Live
          </StatusPill>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="animate-pulse rounded-lg bg-secondary/70 p-3"
            >
              <div className="h-3 w-28 rounded bg-secondary" />
              <div className="mt-2 h-2 w-3/4 rounded bg-secondary" />
            </div>
          ))}
        </div>
      ) : records.length === 0 ? (
        <div
          data-testid="empty-tool-calls"
          className="rounded-lg border border-dashed border-border p-8 text-center"
        >
          <Code2
            className="mx-auto text-muted-foreground"
            size={20}
          />
          <p className="mt-2 text-[12px] font-semibold">
            No tools called yet
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Run a scenario to see Maya's safe actions here.
          </p>
        </div>
      ) : (
        <div className="scrollbar-thin max-h-[278px] space-y-2 overflow-y-auto pr-1">
          {records.slice(0, 8).map((record) => (
            <div
              data-testid={`row-tool-call-${record.id}`}
              key={record.id}
              className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/45 p-3"
            >
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                  record.success
                    ? 'bg-[hsl(168_39%_29%/.1)] text-[hsl(168_39%_29%)]'
                    : 'bg-[hsl(2_57%_47%/.1)] text-[hsl(2_57%_47%)]',
                )}
              >
                {record.success ? (
                  <Check size={13} />
                ) : (
                  <X size={13} />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[11px] font-medium">
                    {record.toolName}
                  </span>

                  <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                    {formatTime(record.createdAt)}
                  </span>
                </div>

                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {record.summary}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function OutcomeLedger({
  dispositions,
  ptps,
  loading,
}: {
  dispositions: Disposition[];
  ptps: PtpRecord[];
  loading: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[0_2px_12px_hsl(222_31%_18%/.025)] sm:p-6">
      <SectionHeading
        eyebrow="05 / outcome ledger"
        title="Dispositions & PTP"
        action={
          <FileText
            size={17}
            className="text-muted-foreground"
          />
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="animate-pulse h-12 rounded-lg bg-secondary/70"
            />
          ))}
        </div>
      ) : dispositions.length === 0 && ptps.length === 0 ? (
        <div
          data-testid="empty-outcomes"
          className="rounded-lg border border-dashed border-border p-8 text-center"
        >
          <CircleDashed
            className="mx-auto text-muted-foreground"
            size={20}
          />
          <p className="mt-2 text-[12px] font-semibold">
            No outcomes recorded
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            A disposition will appear after a scenario completes.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {dispositions.slice(0, 4).map((item) => (
            <div
              data-testid={`row-disposition-${item.id}`}
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/45 p-3"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[hsl(35_78%_56%/.15)] text-[hsl(28_55%_31%)]">
                <FileText size={13} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold">
                  {statusLabels[item.status] ?? item.status}
                </div>

                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {item.notes || 'No reviewer notes'} ·{' '}
                  {formatDate(item.createdAt)}
                </div>
              </div>

              <ChevronRight
                size={13}
                className="text-muted-foreground"
              />
            </div>
          ))}

          {ptps.slice(0, 3).map((ptp) => (
            <div
              data-testid={`row-ptp-${ptp.id}`}
              key={ptp.id}
              className="flex items-center gap-3 rounded-lg border border-[hsl(168_39%_29%/.17)] bg-[hsl(168_39%_29%/.045)] p-3"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[hsl(168_39%_29%/.12)] text-[hsl(168_39%_29%)]">
                <BadgeCheck size={13} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold">
                  PTP · {formatMoney(ptp.amount)}
                </div>

                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatDate(ptp.date)} ·{' '}
                  {ptp.paymentLinkSent
                    ? 'Payment link sent'
                    : 'Link not sent'}
                </div>
              </div>

              <StatusPill tone="teal">active</StatusPill>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function VoiceCard({
  voice,
}: {
  voice: DashboardSnapshot['voice'];
}) {
  return (
    <section className="relative overflow-hidden rounded-xl bg-[hsl(var(--sidebar))] p-5 text-[hsl(var(--sidebar-foreground))] sm:p-6">
      <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full border border-[hsl(var(--accent)/.25)]" />
      <div className="absolute -right-4 -top-6 h-24 w-24 rounded-full border border-[hsl(var(--accent)/.22)]" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.16em] text-[hsl(var(--sidebar-foreground)/.55)]">
            <Volume2
              size={13}
              className="text-[hsl(var(--sidebar-primary))]"
            />
            Approved voice reference
          </div>

          <StatusPill tone="gold">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {voice.status}
          </StatusPill>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <h3
              data-testid="text-voice-name"
              className="font-serif text-[25px]"
            >
              {voice.name}
            </h3>

            <p
              data-testid="text-voice-description"
              className="mt-1 max-w-[31ch] text-[11px] leading-relaxed text-[hsl(var(--sidebar-foreground)/.62)]"
            >
              {voice.description}
            </p>
          </div>

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--accent)/.35)] bg-[hsl(var(--accent)/.12)] text-[hsl(var(--sidebar-primary))]">
            <Headphones size={19} />
          </div>
        </div>

        <audio
          data-testid="audio-voice-reference"
          className="mt-5 h-9 w-full"
          controls
          preload="metadata"
          src={voice.referenceFile}
          aria-label="Approved Clara voice reference preview"
        />

        <div className="mt-3 flex items-center justify-between border-t border-[hsl(var(--sidebar-border))] pt-3">
          <span className="font-mono text-[9px] text-[hsl(var(--sidebar-foreground)/.45)]">
            {voice.provider} · {voice.voiceId ?? 'reference-only'}
          </span>

          <a
            data-testid="link-voice-reference"
            href={voice.referenceFile}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] font-semibold text-[hsl(var(--sidebar-primary))]"
          >
            Open reference
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </section>
  );
}

export default function ControlRoom() {
  const queryClient = useQueryClient();

  const [running, setRunning] = useState<
    DemoAction | undefined
  >();

  const [notice, setNotice] = useState('');
  const [webhookResult, setWebhookResult] = useState('');

  const health = useHealthCheck({
    query: {
      queryKey: getHealthCheckQueryKey(),
      refetchInterval: 30000,
    },
  });

  const dashboard = useGetDashboard({
    query: {
      queryKey: getGetDashboardQueryKey(),
    },
  });

  const snapshot = dashboard.data;

  const accountId = snapshot?.account.accountId ?? '';

  const account = useGetAccount(accountId, {
    query: {
      enabled: Boolean(accountId),
      queryKey: getGetAccountQueryKey(accountId),
    },
  });

  const dispositions = useListDispositions({
    query: {
      queryKey: getListDispositionsQueryKey(),
    },
  });

  const ptps = useListPtp({
    query: {
      queryKey: getListPtpQueryKey(),
    },
  });

  const tools = useListToolCalls({
    query: {
      queryKey: getListToolCallsQueryKey(),
    },
  });

  const reset = useResetDemo();
  const runAction = useRunDemoAction();
  const webhook = useHandleWebhook();

  const applySnapshot = (next: DashboardSnapshot) => {
    queryClient.setQueryData(
      getGetDashboardQueryKey(),
      next,
    );

    queryClient.invalidateQueries({
      queryKey: getGetAccountQueryKey(next.account.accountId),
    });

    queryClient.invalidateQueries({
      queryKey: getListDispositionsQueryKey(),
    });

    queryClient.invalidateQueries({
      queryKey: getListPtpQueryKey(),
    });

    queryClient.invalidateQueries({
      queryKey: getListToolCallsQueryKey(),
    });
  };

  const handleReset = () => {
    setNotice('');

    reset.mutate(undefined, {
      onSuccess: (next) => {
        applySnapshot(next);
        setNotice(
          'Session reset. Ready for another review pass.',
        );
      },
      onError: () =>
        setNotice(
          'Reset did not complete. Try again.',
        ),
    });
  };

  const handleRun = (action: DemoAction) => {
    setRunning(action);
    setNotice('');

    runAction.mutate(
      {
        data: {
          action,
        },
      },
      {
        onSuccess: (next) => {
          applySnapshot(next);
          setRunning(undefined);

          setNotice(
            `${
              scenarios.find(
                (item) => item.action === action,
              )?.label ?? 'Scenario'
            } complete.`,
          );
        },

        onError: () => {
          setRunning(undefined);
          setNotice(
            'Scenario did not complete. The demo session is unchanged.',
          );
        },
      },
    );
  };

  const handleWebhook = () => {
    const payload: WebhookInput = {
      message: {
        type: 'tool-calls',
        toolCalls: [
          {
            id: 'reviewer-check-1',
            function: {
              name: 'get_account',
              arguments: {
                accountId: accountId || 'demo',
              },
            },
          },
        ],
      },
    };

    setWebhookResult('');

    webhook.mutate(
      {
        data: payload,
      },
      {
        onSuccess: (result) =>
          setWebhookResult(
            result.results[0]?.result ??
              'Tool call acknowledged.',
          ),

        onError: () =>
          setWebhookResult(
            'Webhook rejected. Check the tool contract and try again.',
          ),
      },
    );
  };

  if (dashboard.isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <div className="flex min-h-[100dvh]">
          <div className="hidden w-[248px] bg-[hsl(var(--sidebar))] lg:block" />

          <main className="flex-1 p-5 sm:p-8">
            <div className="mx-auto max-w-[1440px]">
              <div className="mb-8 h-12 w-2/3 animate-pulse rounded bg-secondary" />

              <div className="grid gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <SkeletonCard key={item} />
                ))}
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
                <SkeletonCard className="h-[440px]" />
                <SkeletonCard className="h-[440px]" />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (dashboard.isError || !snapshot) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <CircleAlert
            className="mx-auto text-[hsl(var(--destructive))]"
            size={28}
          />

          <h1 className="mt-4 font-serif text-2xl">
            The control room is offline
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            The dashboard snapshot could not be loaded. Confirm
            the API server is running, then retry.
          </p>

          <button
            data-testid="button-retry-dashboard"
            onClick={() => dashboard.refetch()}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <RefreshCw size={15} />
            Retry snapshot
          </button>
        </div>
      </div>
    );
  }

  const toolRecords = tools.data ?? snapshot.toolCalls;
  const dispositionRecords =
    dispositions.data ?? snapshot.dispositions;
  const ptpRecords = ptps.data ?? snapshot.ptpRecords;

  const serviceHealthy =
    health.data?.status === 'ok' ||
    health.data?.status === 'healthy' ||
    Boolean(health.data);

  return (
    <div className="noise min-h-[100dvh] bg-background">
      <div className="flex min-h-[100dvh]">
        <NavRail
          onReset={handleReset}
          isResetting={reset.isPending}
        />

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border/80 bg-[hsl(var(--background)/.9)] px-5 py-4 backdrop-blur-md sm:px-8">
            <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary text-primary-foreground lg:hidden">
                  <Zap size={17} />
                </div>

                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[.17em] text-muted-foreground">
                    Kapture Finance / development
                  </div>

                  <div className="mt-1 text-[13px] font-semibold">
                    Collections control room
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div
                  data-testid="status-api-health"
                  className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-semibold sm:flex"
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      health.isLoading
                        ? 'bg-[hsl(var(--accent))]'
                        : serviceHealthy
                          ? 'bg-[hsl(var(--primary))]'
                          : 'bg-[hsl(var(--destructive))]',
                    )}
                  />

                  API{' '}
                  {health.isLoading
                    ? 'checking'
                    : serviceHealthy
                      ? 'healthy'
                      : 'unavailable'}
                </div>

                <button
                  data-testid="button-reset-demo-header"
                  onClick={handleReset}
                  disabled={reset.isPending}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-semibold transition hover:border-[hsl(var(--accent)/.6)] disabled:opacity-50"
                >
                  <RotateCcw
                    size={13}
                    className={
                      reset.isPending
                        ? 'animate-spin'
                        : ''
                    }
                  />

                  <span className="hidden sm:inline">
                    {reset.isPending
                      ? 'Resetting…'
                      : 'Reset demo'}
                  </span>
                </button>

                <div
                  data-testid="avatar-maya"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(35_78%_56%/.2)] font-serif text-sm text-[hsl(28_55%_31%)]"
                >
                  M
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1440px] px-5 pb-12 pt-7 sm:px-8 sm:pt-9">
            <div className="animate-rise-in flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 animate-pulse-dot rounded-full bg-[hsl(var(--accent))]" />

                  <span className="font-mono text-[10px] font-medium uppercase tracking-[.17em] text-muted-foreground">
                    Session in progress
                  </span>
                </div>

                <h1 className="max-w-[650px] font-serif text-[clamp(2.25rem,5vw,4.35rem)] leading-[.94] tracking-[-.04em] text-foreground">
                  A respectful call,
                  <br />
                  <span className="text-[hsl(var(--primary))]">
                    made observable.
                  </span>
                </h1>

                <p className="mt-4 max-w-[570px] text-[13px] leading-relaxed text-muted-foreground">
                  Review Maya, the voice collections specialist,
                  as she protects customer identity, explains the
                  next step, and knows when to stop.
                </p>
              </div>

              <div className="paper-grid flex min-w-[230px] items-center gap-3 rounded-xl border border-border bg-card/60 p-3.5 md:mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(168_39%_29%/.1)] text-[hsl(var(--primary))]">
                  <Bot size={18} />
                </div>

                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground">
                    Active agent
                  </div>

                  <div
                    data-testid="text-agent-name"
                    className="mt-0.5 text-sm font-semibold"
                  >
                    {snapshot.agentName}{' '}
                    <span className="text-muted-foreground">
                      ·
                    </span>{' '}
                    {snapshot.companyName}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid animate-rise-in gap-3 delay-1 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Calls in demo"
                value={snapshot.metrics.totalCalls}
                note="Across this session"
                icon={PhoneCall}
                accent="bg-[hsl(203_45%_48%/.11)] text-[hsl(203_45%_33%)]"
              />

              <Metric
                label="Successful PTP"
                value={snapshot.metrics.successfulPtp}
                note="Promises captured"
                icon={BadgeCheck}
                accent="bg-[hsl(35_78%_56%/.15)] text-[hsl(28_55%_31%)]"
              />

              <Metric
                label="Escalations"
                value={snapshot.metrics.escalations}
                note="Human review paths"
                icon={BellRing}
                accent="bg-[hsl(273_25%_51%/.11)] text-[hsl(273_25%_40%)]"
              />

              <Metric
                label="Tool success"
                value={`${snapshot.metrics.toolSuccessRate}%`}
                note={`${snapshot.metrics.dncCount} do-not-call flags`}
                icon={ShieldCheck}
                accent="bg-[hsl(168_39%_29%/.11)] text-[hsl(168_39%_29%)]"
              />
            </div>

            {notice && (
              <div
                data-testid="status-action-notice"
                className={cn(
                  'mt-4 flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-[12px] font-medium animate-rise-in',
                  notice.includes('did not')
                    ? 'border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.07)] text-[hsl(var(--destructive))]'
                    : 'border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.06)] text-[hsl(var(--primary))]',
                )}
              >
                <CircleCheck size={15} />
                {notice}

                <button
                  data-testid="button-dismiss-notice"
                  onClick={() => setNotice('')}
                  className="ml-auto rounded p-1 hover:bg-secondary"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="mt-5 grid animate-rise-in gap-5 delay-2 lg:grid-cols-[1.15fr_.85fr]">
              <ConversationState snapshot={snapshot} />

              <div className="space-y-5">
                <AccountCard
                  snapshot={snapshot}
                  account={account.data}
                />

                <VoiceCard voice={snapshot.voice} />
              </div>
            </div>

            <div className="mt-5 animate-rise-in delay-3">
              <ScenarioRunner
                running={running}
                onRun={handleRun}
              />
            </div>

            <div className="mt-5 grid animate-rise-in gap-5 delay-4 lg:grid-cols-2">
              <ToolActivity
                records={toolRecords}
                loading={tools.isLoading}
              />

              <OutcomeLedger
                dispositions={dispositionRecords}
                ptps={ptpRecords}
                loading={
                  dispositions.isLoading ||
                  ptps.isLoading
                }
              />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
              <section className="rounded-xl border border-border bg-[hsl(35_78%_56%/.08)] p-5 sm:p-6">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-[hsl(28_55%_31%)]">
                  <Sparkles size={14} />
                  Reviewer's lens
                </div>

                <h2 className="mt-3 max-w-[540px] font-serif text-[25px] leading-tight">
                  Watch for the small pauses that make a safe call
                  feel human.
                </h2>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {[
                    [
                      '01',
                      'Gate first',
                      'Maya never names a balance until authentication succeeds.',
                    ],
                    [
                      '02',
                      'Tools leave a trail',
                      'Every lookup and decision is visible, with a success state.',
                    ],
                    [
                      '03',
                      'A clear ending',
                      'The final disposition matches what the customer actually said.',
                    ],
                  ].map(([number, title, copy]) => (
                    <div
                      data-testid={`text-review-principle-${number}`}
                      key={number}
                      className="border-t border-[hsl(28_55%_31%/.2)] pt-3"
                    >
                      <div className="font-mono text-[10px] text-[hsl(28_55%_31%/.65)]">
                        {number}
                      </div>

                      <div className="mt-2 text-[12px] font-bold text-[hsl(28_55%_31%)]">
                        {title}
                      </div>

                      <p className="mt-1.5 text-[11px] leading-relaxed text-[hsl(28_55%_31%/.75)]">
                        {copy}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5 shadow-[0_2px_12px_hsl(222_31%_18%/.025)] sm:p-6">
                <SectionHeading
                  eyebrow="Optional / contract check"
                  title="Webhook harness"
                  action={
                    <Code2
                      size={17}
                      className="text-muted-foreground"
                    />
                  }
                />

                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Send a Vapi-compatible{' '}
                  <span className="font-mono text-[10px] text-foreground">
                    get_account
                  </span>{' '}
                  tool call through the same webhook path used
                  in production.
                </p>

                <button
                  data-testid="button-test-webhook"
                  onClick={handleWebhook}
                  disabled={webhook.isPending}
                  className="mt-5 flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-[11px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  <Send size={14} />
                  {webhook.isPending
                    ? 'Sending tool call…'
                    : 'Send test tool call'}
                </button>

                {webhookResult && (
                  <div
                    data-testid="text-webhook-result"
                    className="mt-4 rounded-lg border border-[hsl(var(--primary)/.18)] bg-[hsl(var(--primary)/.055)] p-3 font-mono text-[10px] leading-relaxed text-[hsl(var(--primary))]"
                  >
                    <span className="mr-2 text-muted-foreground">
                      result
                    </span>
                    {webhookResult}
                  </div>
                )}
              </section>
            </div>

            <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-border pt-5 text-[10px] text-muted-foreground sm:flex-row">
              <span
                data-testid="text-session-id"
                className="font-mono"
              >
                SESSION {snapshot.sessionId}
              </span>

              <span className="flex items-center gap-1.5">
                <ShieldCheck size={12} />
                Customer data shown here is deliberately safe for
                review.
              </span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
