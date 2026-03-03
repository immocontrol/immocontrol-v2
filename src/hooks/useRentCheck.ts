/**
 * #12: Automatische Mieteingangskontrolle — Monthly rent check hook.
 * Automatically checks if expected rent payments have been received and
 * shows alerts for missing or late payments.
 */
import { useMemo } from "react";

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  property_id: string;
  is_active: boolean;
  monthly_rent: number;
}

interface Payment {
  id: string;
  tenant_id: string;
  property_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
}

interface RentCheckResult {
  /** Tenants with missing payments for the current month */
  missingPayments: Array<{
    tenant: Tenant;
    expectedAmount: number;
    dueDate: string;
    daysOverdue: number;
  }>;
  /** Tenants with partial payments */
  partialPayments: Array<{
    tenant: Tenant;
    expectedAmount: number;
    paidAmount: number;
    shortfall: number;
  }>;
  /** Total expected rent for the month */
  totalExpected: number;
  /** Total received rent for the month */
  totalReceived: number;
  /** Collection rate as percentage */
  collectionRate: number;
  /** Number of tenants with confirmed payments */
  confirmedCount: number;
  /** Number of tenants with overdue payments */
  overdueCount: number;
}

export function useRentCheck(tenants: Tenant[], payments: Payment[]): RentCheckResult {
  return useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const activeTenants = tenants.filter((t) => t.is_active && t.monthly_rent > 0);

    // Current month payments
    const monthPayments = payments.filter((p) => {
      const d = new Date(p.due_date);
      const pm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return pm === currentMonth;
    });

    const totalExpected = activeTenants.reduce((s, t) => s + t.monthly_rent, 0);
    const totalReceived = monthPayments
      .filter((p) => p.status === "confirmed")
      .reduce((s, p) => s + Number(p.amount), 0);

    // Missing payments: active tenants without any payment this month
    const tenantsWithPayment = new Set(monthPayments.map((p) => p.tenant_id));
    const missingPayments = activeTenants
      .filter((t) => !tenantsWithPayment.has(t.id))
      .map((t) => {
        const dueDate = `${currentMonth}-01`;
        const daysOverdue = Math.max(0, Math.floor((now.getTime() - new Date(dueDate).getTime()) / 86400000));
        return {
          tenant: t,
          expectedAmount: t.monthly_rent,
          dueDate,
          daysOverdue,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // Partial payments: tenants who paid less than expected
    const partialPayments = activeTenants
      .filter((t) => {
        const paid = monthPayments
          .filter((p) => p.tenant_id === t.id && p.status === "confirmed")
          .reduce((s, p) => s + Number(p.amount), 0);
        return paid > 0 && paid < t.monthly_rent;
      })
      .map((t) => {
        const paidAmount = monthPayments
          .filter((p) => p.tenant_id === t.id && p.status === "confirmed")
          .reduce((s, p) => s + Number(p.amount), 0);
        return {
          tenant: t,
          expectedAmount: t.monthly_rent,
          paidAmount,
          shortfall: t.monthly_rent - paidAmount,
        };
      });

    const confirmedCount = monthPayments.filter((p) => p.status === "confirmed").length;
    const overdueCount = monthPayments.filter((p) => p.status === "overdue").length + missingPayments.length;
    const collectionRate = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;

    return {
      missingPayments,
      partialPayments,
      totalExpected,
      totalReceived,
      collectionRate,
      confirmedCount,
      overdueCount,
    };
  }, [tenants, payments]);
}
