import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const DEBOUNCE_MS = 1500;

export function useWidgetLayout(layoutKey: string) {
  const { user } = useAuth();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadLayout = useCallback(async (): Promise<string[] | null> => {
    if (!user) return null;
    try {
      const { data } = await supabase
        .from("widget_layouts")
        .select("widget_order")
        .eq("user_id", user.id)
        .eq("layout_key", layoutKey)
        .maybeSingle();
      if (data?.widget_order && Array.isArray(data.widget_order)) {
        return data.widget_order as string[];
      }
    } catch {
      /* fall back to localStorage */
    }
    return null;
  }, [user, layoutKey]);

  const saveLayout = useCallback((order: string[]) => {
    if (!user) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await supabase
          .from("widget_layouts")
          .upsert(
            { user_id: user.id, layout_key: layoutKey, widget_order: order },
            { onConflict: "user_id,layout_key" }
          );
      } catch {
        /* silent fail — localStorage already saved */
      }
    }, DEBOUNCE_MS);
  }, [user, layoutKey]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { loadLayout, saveLayout };
}
