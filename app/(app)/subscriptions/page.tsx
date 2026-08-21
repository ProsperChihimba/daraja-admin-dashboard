"use client";
import * as React from "react";
import { toast } from "sonner";

import api from "@/lib/axiosInstance";
import { useAdminResource } from "@/lib/useAdminResource";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/PageStates";
import { DangerousActionModal } from "@/components/common/DangerousActionModal";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Pagination } from "@/components/common/Pagination";
import { StatTile, StatTileSkeleton } from "@/components/overview/StatTile";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status_badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PackageDialog } from "@/components/billing/PackageDialog";
import { DiscountDialog } from "@/components/billing/DiscountDialog";
import { formatMoney, formatNumber, formatDate, formatDateTime } from "@/lib/format";
import type {
  Package,
  DiscountCode,
  PaymentRow,
  PaymentStatus,
  Paginated,
  OverviewStats,
} from "@/types/admin";

const PAYMENTS_PAGE_SIZE = 100;

export default function SubscriptionsPage() {
  // ---- Revenue KPIs ----
  const { data: stats, loading: statsLoading, error: statsError } =
    useAdminResource<OverviewStats>("/admin/overview/stats/");

  // ---- Packages ----
  const {
    data: packages,
    loading: packagesLoading,
    error: packagesError,
    refetch: refetchPackages,
  } = useAdminResource<Package[]>("/admin/packages/");
  const [packageDialogOpen, setPackageDialogOpen] = React.useState(false);
  const [editingPackage, setEditingPackage] = React.useState<Package | null>(null);
  const [deactivatingPackage, setDeactivatingPackage] = React.useState<Package | null>(null);

  // ---- Discounts ----
  const {
    data: discounts,
    loading: discountsLoading,
    error: discountsError,
    refetch: refetchDiscounts,
  } = useAdminResource<DiscountCode[]>("/admin/discounts/");
  const [discountDialogOpen, setDiscountDialogOpen] = React.useState(false);
  const [editingDiscount, setEditingDiscount] = React.useState<DiscountCode | null>(null);

  // ---- Payments ----
  const [paymentsPage, setPaymentsPage] = React.useState(1);
  const [paymentsStatus, setPaymentsStatus] = React.useState<"" | PaymentStatus>("");
  const {
    data: paymentsData,
    loading: paymentsLoading,
    error: paymentsError,
    refetch: refetchPayments,
  } = useAdminResource<Paginated<PaymentRow>>("/admin/payments/", {
    page: paymentsPage,
    status: paymentsStatus || undefined,
  });

  const packageColumns: Column<Package>[] = [
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <div>
          <div className="font-medium text-text">{p.name}</div>
          {p.description ? (
            <div className="text-xs text-text-muted">{p.description}</div>
          ) : null}
        </div>
      ),
    },
    { key: "price", header: "Price", render: (p) => formatMoney(p.price) },
    { key: "duration_days", header: "Duration", render: (p) => `${p.duration_days} days` },
    {
      key: "is_active",
      header: "Active",
      render: (p) => (
        <StatusBadge variant={p.is_active ? "success" : "neutral"}>
          {p.is_active ? "Active" : "Inactive"}
        </StatusBadge>
      ),
    },
    { key: "sort_order", header: "Sort", render: (p) => formatNumber(p.sort_order) },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (p) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingPackage(p);
              setPackageDialogOpen(true);
            }}
          >
            Edit
          </Button>
          {p.is_active ? (
            <Button variant="destructive" size="sm" onClick={() => setDeactivatingPackage(p)}>
              Deactivate
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const discountColumns: Column<DiscountCode>[] = [
    {
      key: "code",
      header: "Code",
      render: (d) => <span className="font-mono font-medium text-text">{d.code}</span>,
    },
    {
      key: "off",
      header: "Off",
      render: (d) => (d.percent_off ? `${d.percent_off}%` : formatMoney(d.amount_off ?? 0)),
    },
    {
      key: "is_active",
      header: "Active",
      render: (d) => (
        <StatusBadge variant={d.is_active ? "success" : "neutral"}>
          {d.is_active ? "Active" : "Inactive"}
        </StatusBadge>
      ),
    },
    {
      key: "uses",
      header: "Uses",
      render: (d) =>
        `${formatNumber(d.used_count)}${d.max_uses ? ` / ${formatNumber(d.max_uses)}` : ""}`,
    },
    { key: "valid_until", header: "Valid until", render: (d) => formatDate(d.valid_until) },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (d) => (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingDiscount(d);
              setDiscountDialogOpen(true);
            }}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  const paymentColumns: Column<PaymentRow>[] = [
    { key: "order_id", header: "Order", render: (p) => p.order_id },
    { key: "org", header: "MFI", render: (p) => p.org },
    { key: "amount", header: "Amount", render: (p) => formatMoney(p.amount) },
    { key: "method", header: "Method", render: (p) => p.method || "—" },
    {
      key: "status",
      header: "Status",
      render: (p) => (
        <StatusBadge
          variant={p.status === "paid" ? "success" : p.status === "pending" ? "warning" : "danger"}
        >
          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
        </StatusBadge>
      ),
    },
    { key: "paid_at", header: "Paid at", render: (p) => formatDateTime(p.paid_at ?? p.created_at) },
    { key: "package_name", header: "Package", render: (p) => p.package_name || "—" },
  ];

  return (
    <>
      <PageHeader
        title="Subscriptions & Revenue"
        subtitle="Plans, discount codes, and payments across all MFIs"
      />

      {statsError ? null : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsLoading || !stats ? (
            Array.from({ length: 4 }).map((_, i) => <StatTileSkeleton key={i} />)
          ) : (
            <>
              <StatTile
                label="Revenue (this month)"
                value={formatMoney(stats.revenue.this_month)}
                sub={`${formatMoney(stats.revenue.total)} all-time`}
              />
              <StatTile
                label="Pending payments"
                value={formatNumber(stats.revenue.pending_payments)}
              />
              <StatTile
                label="Failed payments"
                value={formatNumber(stats.revenue.failed_payments)}
              />
              <StatTile
                label="Active subscriptions"
                value={formatNumber(stats.subscriptions.active)}
              />
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Packages</CardTitle>
            <CardAction>
              <Button
                size="sm"
                onClick={() => {
                  setEditingPackage(null);
                  setPackageDialogOpen(true);
                }}
              >
                New package
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {packagesError ? (
              <ErrorState message={packagesError} onRetry={refetchPackages} />
            ) : (
              <DataTable<Package>
                columns={packageColumns}
                rows={packages ?? []}
                loading={packagesLoading}
                emptyMessage="No packages yet."
                rowKey={(p) => p.id}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Discount codes</CardTitle>
            <CardAction>
              <Button
                size="sm"
                onClick={() => {
                  setEditingDiscount(null);
                  setDiscountDialogOpen(true);
                }}
              >
                New code
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {discountsError ? (
              <ErrorState message={discountsError} onRetry={refetchDiscounts} />
            ) : (
              <DataTable<DiscountCode>
                columns={discountColumns}
                rows={discounts ?? []}
                loading={discountsLoading}
                emptyMessage="No discount codes yet."
                rowKey={(d) => d.id}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
            <CardAction>
              <Select
                value={paymentsStatus || "all"}
                onValueChange={(v) => {
                  setPaymentsStatus(v === "all" ? "" : (v as PaymentStatus));
                  setPaymentsPage(1);
                }}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </CardAction>
          </CardHeader>
          <CardContent>
            {paymentsError ? (
              <ErrorState message={paymentsError} onRetry={refetchPayments} />
            ) : (
              <>
                <DataTable<PaymentRow>
                  columns={paymentColumns}
                  rows={paymentsData?.results ?? []}
                  loading={paymentsLoading}
                  emptyMessage="No payments found."
                  rowKey={(p) => p.id}
                />
                {paymentsData ? (
                  <Pagination
                    page={paymentsPage}
                    count={paymentsData.count}
                    pageSize={PAYMENTS_PAGE_SIZE}
                    onPage={setPaymentsPage}
                  />
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <PackageDialog
        open={packageDialogOpen}
        onOpenChange={setPackageDialogOpen}
        package={editingPackage}
        onDone={() => {
          setPackageDialogOpen(false);
          void refetchPackages();
        }}
      />

      <DiscountDialog
        open={discountDialogOpen}
        onOpenChange={setDiscountDialogOpen}
        discount={editingDiscount}
        onDone={() => {
          setDiscountDialogOpen(false);
          void refetchDiscounts();
        }}
      />

      {deactivatingPackage ? (
        <DangerousActionModal
          open={!!deactivatingPackage}
          onOpenChange={(o) => {
            if (!o) setDeactivatingPackage(null);
          }}
          title={`Deactivate ${deactivatingPackage.name}`}
          impact="This package will be hidden from new subscriptions."
          confirmLabel="Deactivate"
          requireReason={false}
          onConfirm={async () => {
            try {
              await api.delete(`/admin/packages/${deactivatingPackage.id}/`);
              toast.success(`${deactivatingPackage.name} deactivated`);
              setDeactivatingPackage(null);
              void refetchPackages();
            } catch {
              toast.error("Failed to deactivate package");
              throw new Error("failed");
            }
          }}
        />
      ) : null}
    </>
  );
}
