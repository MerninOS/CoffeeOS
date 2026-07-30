"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge, Button, Checkbox, InlineBanner } from "@merninos/ui/instrument";
import { mono, overline, sans } from "@/lib/instrument/tokens";
import type { SyncCandidate, SyncStatus } from "@/lib/products/shopify-diff";

/**
 * The review step between "Sync Shopify" and anything being written.
 *
 * `data-surface="app"` ON THE CONTENT ROOT IS LOAD-BEARING, not defensive. Radix
 * portals this to <body>, i.e. OUTSIDE the AppShell subtree that scopes the
 * instrument token layer — without it every `var(--token)` inside resolves to
 * nothing and the dialog renders unstyled. Same reason ProductDialogs.tsx carries
 * it; it cost real time to find on /orders.
 *
 * Radix rather than instrument's Modal, also matching ProductDialogs: instrument's
 * Modal renders no `role="dialog"`, so it cannot be driven from a test.
 *
 * This component is PRESENTATIONAL. It never calls a server action — it hands a
 * selection up and lets the page decide. Which ids mean what is settled on the
 * server anyway, since the confirm path re-diffs there.
 */

const PANEL: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--shadow-modal)",
  padding: 0,
  overflow: "hidden",
  gap: 0,
  maxWidth: 760,
  width: "calc(100vw - 2rem)",
};

const HEAD: React.CSSProperties = {
  padding: "var(--space-5) var(--space-6)",
  borderBottom: "1px solid var(--hairline)",
  background: "var(--surface-sunken)",
};

const FOOT: React.CSSProperties = {
  padding: "var(--space-4) var(--space-6)",
  borderTop: "1px solid var(--hairline)",
  background: "var(--surface-sunken)",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
  alignItems: "center",
};

const TITLE: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontVariationSettings: "var(--display-settings)",
  fontWeight: "var(--display-weight)" as unknown as number,
  letterSpacing: "var(--display-tracking)",
  fontSize: "var(--fs-title)",
  textTransform: "uppercase",
  color: "var(--ink)",
};

const BODY: React.CSSProperties = {
  // A worksheet of hairline rules, not nested cards. At <500 products this
  // scrolls plainly — no virtualisation, which would cost the e2e suite its
  // ability to assert on rows that happen to be off-screen.
  maxHeight: "min(60vh, 520px)",
  overflowY: "auto",
  padding: 0,
};

const GROUP_HEAD: React.CSSProperties = {
  ...overline,
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "var(--space-3) var(--space-6)",
  borderBottom: "1px solid var(--hairline)",
  background: "var(--surface-sunken)",
  position: "sticky",
  top: 0,
  zIndex: 1,
};

const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "var(--space-3) var(--space-6)",
  borderBottom: "1px solid var(--hairline)",
};

const STATUS_TONE: Record<SyncStatus, "info" | "warning" | "neutral"> = {
  new: "info",
  changed: "warning",
  unchanged: "neutral",
};

const STATUS_LABEL: Record<SyncStatus, string> = {
  new: "New",
  changed: "Changed",
  unchanged: "Unchanged",
};

export interface SyncSelection {
  importIds: string[];
  excludeIds: string[];
}

function FieldDiffTable({ candidate }: { candidate: SyncCandidate }) {
  const rows = [
    ...candidate.diffs.map((diff) => ({ scope: "Product", ...diff })),
    ...candidate.variantDiffs.flatMap((variantDiff) => {
      const label = `Variant ${variantDiff.shopifyVariantId.split("/").pop()}`;
      if (variantDiff.kind === "added") {
        return [{ scope: label, field: "—", current: "not stored", incoming: "will be added" }];
      }
      if (variantDiff.kind === "removed") {
        return [{ scope: label, field: "—", current: "stored", incoming: "will be removed" }];
      }
      return variantDiff.diffs.map((diff) => ({ scope: label, ...diff }));
    }),
  ];

  return (
    <div style={{ marginTop: 8, borderTop: "1px solid var(--hairline)" }} data-testid="field-diffs">
      {rows.map((row, index) => (
        <div
          key={`${row.scope}-${row.field}-${index}`}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(90px, 1fr) minmax(70px, 1fr) 2fr",
            gap: 8,
            padding: "6px 0",
            fontSize: "var(--fs-caption)",
          }}
        >
          <span style={{ ...overline, fontSize: "var(--fs-overline)" }}>{row.scope}</span>
          <span style={{ ...mono, fontSize: "var(--fs-caption)", color: "var(--ink-muted)" }}>
            {row.field}
          </span>
          <span style={{ ...sans, fontSize: "var(--fs-caption)" }}>
            <span style={{ color: "var(--ink-muted)", textDecoration: "line-through" }}>
              {row.current ?? "—"}
            </span>
            <span style={{ color: "var(--ink-subtle)" }}> → </span>
            <span style={{ color: "var(--ink)" }}>{row.incoming ?? "—"}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function CandidateRow({
  candidate,
  selected,
  onToggle,
}: {
  candidate: SyncCandidate;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // Must match the rows FieldDiffTable renders, which flattens a changed variant
  // into one row per field. Counting each VariantDiff as one made a variant whose
  // title and price both moved read "Show 1 change" above a two-row table.
  const changeCount =
    candidate.diffs.length +
    candidate.variantDiffs.reduce(
      (total, variantDiff) =>
        total + (variantDiff.kind === "changed" ? variantDiff.diffs.length : 1),
      0
    );

  return (
    <div style={ROW} data-testid="sync-candidate" data-shopify-id={candidate.shopifyId}>
      <Checkbox checked={selected} onChange={onToggle} aria-label={`Import ${candidate.title}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ ...sans, fontWeight: 500 }}>{candidate.title}</span>
          <Badge tone={STATUS_TONE[candidate.status]} size="sm">
            {STATUS_LABEL[candidate.status]}
          </Badge>
          {candidate.excluded && (
            <Badge tone="neutral" variant="outline" size="sm">
              Previously declined
            </Badge>
          )}
        </div>

        {candidate.status === "changed" && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              style={{
                ...mono,
                fontSize: "var(--fs-caption)",
                color: "var(--ink-muted)",
                background: "none",
                border: "none",
                padding: "4px 0",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {expanded ? "Hide" : "Show"} {changeCount} change
              {changeCount === 1 ? "" : "s"}
            </button>
            {expanded && <FieldDiffTable candidate={candidate} />}
          </>
        )}
      </div>
    </div>
  );
}

function Group({
  title,
  candidates,
  selectedIds,
  onToggle,
  onToggleAll,
  defaultOpen,
  note,
}: {
  title: string;
  candidates: SyncCandidate[];
  selectedIds: Set<string>;
  onToggle: (shopifyId: string) => void;
  onToggleAll: (shopifyIds: string[], next: boolean) => void;
  defaultOpen: boolean;
  note?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (candidates.length === 0) return null;

  const ids = candidates.map((candidate) => candidate.shopifyId);
  const selectedHere = ids.filter((id) => selectedIds.has(id)).length;

  return (
    <section data-testid={`sync-group-${title.toLowerCase()}`}>
      <div style={GROUP_HEAD}>
        <Checkbox
          checked={selectedHere === ids.length && ids.length > 0}
          indeterminate={selectedHere > 0 && selectedHere < ids.length}
          onChange={() => onToggleAll(ids, selectedHere !== ids.length)}
          aria-label={`Select all ${title}`}
        />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          style={{ ...overline, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          {title} · {candidates.length} {open ? "▾" : "▸"}
        </button>
      </div>
      {open && (
        <>
          {note}
          {candidates.map((candidate) => (
            <CandidateRow
              key={candidate.shopifyId}
              candidate={candidate}
              selected={selectedIds.has(candidate.shopifyId)}
              onToggle={() => onToggle(candidate.shopifyId)}
            />
          ))}
        </>
      )}
    </section>
  );
}

export function SyncReviewDialog({
  open,
  onOpenChange,
  candidates,
  isSyncing,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: SyncCandidate[];
  isSyncing: boolean;
  onConfirm: (selection: SyncSelection) => void;
}) {
  const groups = useMemo(() => {
    const visible = candidates.filter((candidate) => !candidate.excluded);
    return {
      changed: visible.filter((candidate) => candidate.status === "changed"),
      new: visible.filter((candidate) => candidate.status === "new"),
      unchanged: visible.filter((candidate) => candidate.status === "unchanged"),
      ignored: candidates.filter((candidate) => candidate.excluded),
    };
  }, [candidates]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showIgnored, setShowIgnored] = useState(false);

  // Defaults: new and changed checked, unchanged and ignored not. Selecting an
  // unchanged product is a no-op write, and an ignored one was declined on
  // purpose — pre-checking either would undo a decision the operator made.
  useEffect(() => {
    setSelectedIds(
      new Set([...groups.changed, ...groups.new].map((candidate) => candidate.shopifyId))
    );
    setShowIgnored(false);
  }, [groups]);

  /**
   * Declining is a real gesture on its own, not a side effect of importing.
   *
   * "Shopify has three new products and I want none of them" is the whole point
   * of the feature, and it was unreachable: the confirm button was gated on
   * `selectedIds.size === 0`, so unchecking everything greyed it out and the
   * only exit was Cancel — which writes nothing, leaving those products to
   * reappear on every future preview with no way to say no.
   *
   * Only NEW products count. Unchecking a changed or unchanged one records
   * nothing (see exclusionsToRecord), so it must not enable the button either —
   * otherwise confirm would be live while doing nothing at all.
   */
  const declineCount = useMemo(
    () =>
      groups.new.filter((candidate) => !selectedIds.has(candidate.shopifyId)).length,
    [groups, selectedIds]
  );

  const toggle = (shopifyId: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(shopifyId)) next.delete(shopifyId);
      else next.add(shopifyId);
      return next;
    });

  const toggleAll = (shopifyIds: string[], select: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of shopifyIds) {
        if (select) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const confirm = () =>
    onConfirm({
      importIds: [...selectedIds],
      // Everything not selected is declined. The server decides what that MEANS
      // — it only records exclusions for products it independently classified as
      // new, so declining an update never banishes a product already in use.
      excludeIds: candidates
        .map((candidate) => candidate.shopifyId)
        .filter((shopifyId) => !selectedIds.has(shopifyId)),
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-surface="app" style={PANEL} data-testid="sync-review-dialog">
        <DialogHeader style={HEAD}>
          <DialogTitle style={TITLE}>Review Shopify sync</DialogTitle>
          <DialogDescription
            style={{
              ...sans,
              fontSize: "var(--fs-caption)",
              color: "var(--ink-muted)",
              marginTop: 4,
            }}
          >
            Nothing has been imported yet. Pick what to bring into CoffeeOS.
          </DialogDescription>
        </DialogHeader>

        <div style={BODY}>
          {candidates.length === 0 && (
            <div style={{ ...sans, padding: "var(--space-6)", color: "var(--ink-muted)" }}>
              Shopify returned no products.
            </div>
          )}

          <Group
            title="Changed"
            candidates={groups.changed}
            selectedIds={selectedIds}
            onToggle={toggle}
            onToggleAll={toggleAll}
            defaultOpen
            note={
              <div style={{ padding: "var(--space-3) var(--space-6) 0" }}>
                <InlineBanner tone="warning">
                  Importing these overwrites the CoffeeOS values with Shopify&apos;s. If you edited
                  a product here, that edit is what will be replaced.
                </InlineBanner>
              </div>
            }
          />

          <Group
            title="New"
            candidates={groups.new}
            selectedIds={selectedIds}
            onToggle={toggle}
            onToggleAll={toggleAll}
            defaultOpen
          />

          <Group
            title="Unchanged"
            candidates={groups.unchanged}
            selectedIds={selectedIds}
            onToggle={toggle}
            onToggleAll={toggleAll}
            defaultOpen={false}
          />

          {groups.ignored.length > 0 && !showIgnored && (
            <div style={{ padding: "var(--space-4) var(--space-6)" }}>
              <button
                type="button"
                onClick={() => setShowIgnored(true)}
                data-testid="reveal-ignored"
                style={{
                  ...mono,
                  fontSize: "var(--fs-caption)",
                  color: "var(--ink-muted)",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Show {groups.ignored.length} previously declined
              </button>
            </div>
          )}

          {showIgnored && (
            <Group
              title="Ignored"
              candidates={groups.ignored}
              selectedIds={selectedIds}
              onToggle={toggle}
              onToggleAll={toggleAll}
              defaultOpen
              note={
                <div style={{ padding: "var(--space-3) var(--space-6) 0" }}>
                  <InlineBanner tone="neutral">
                    Checking one of these imports it and stops it being declined.
                  </InlineBanner>
                </div>
              }
            />
          )}
        </div>

        <DialogFooter style={FOOT}>
          <span
            style={{ ...mono, fontSize: "var(--fs-caption)", color: "var(--ink-muted)" }}
            data-testid="sync-selection-count"
          >
            {selectedIds.size} selected
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <Button variant="tertiary" onClick={() => onOpenChange(false)} disabled={isSyncing}>
              Cancel
            </Button>
            <Button
              onClick={confirm}
              disabled={isSyncing || (selectedIds.size === 0 && declineCount === 0)}
            >
              {isSyncing
                ? "Working…"
                : selectedIds.size > 0
                  ? `Import ${selectedIds.size}`
                  : `Decline ${declineCount}`}
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
