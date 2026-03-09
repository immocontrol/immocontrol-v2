/**
 * Läuft Dokument- und Darlehens-Fristen und erzeugt ggf. In-App- und Browser-Benachrichtigungen.
 * Wird einmal z. B. in AppLayout eingebunden, wenn der Nutzer eingeloggt ist.
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { checkDocumentExpiry, checkLoanMilestones } from "@/lib/pushNotifications";

const DOC_DAYS = 30;
const LOAN_DAYS = 90;

export function useNotificationChecks() {
  const { user } = useAuth();

  const { data: docExpiries = [] } = useQuery({
    queryKey: ["notification_checks_doc_expiry", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("document_expiries")
        .select("id, name, expiry_date")
        .eq("user_id", user.id)
        .order("expiry_date");
      return (data || []) as Array<{ id: string; name: string; expiry_date: string }>;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["notification_checks_loans", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("loans")
        .select("id, bank_name, fixed_interest_until")
        .eq("user_id", user.id)
        .not("fixed_interest_until", "is", null);
      return (data || []) as Array<{ id: string; bank_name: string | null; fixed_interest_until: string | null }>;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!user) return;
    const docsForApi = docExpiries.map((d) => ({
      id: d.id,
      name: d.name,
      expiryDate: d.expiry_date,
    }));
    const loansForApi = loans.map((l) => ({
      id: l.id,
      bankName: l.bank_name ?? undefined,
      fixedInterestEndDate: l.fixed_interest_until,
    }));
    checkDocumentExpiry(docsForApi, DOC_DAYS);
    checkLoanMilestones(loansForApi, LOAN_DAYS);
  }, [user, docExpiries, loans]);
}
