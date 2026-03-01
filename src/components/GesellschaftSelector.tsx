import { useState, useRef, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";

const DEFAULT_OPTIONS = ["Privat", "eGbR"];

interface GesellschaftSelectorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

interface CustomCompany {
  id: string;
  name: string;
}

const GesellschaftSelector = ({ value, onChange, error }: GesellschaftSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: customCompanies = [] } = useQuery<CustomCompany[]>({
    queryKey: queryKeys.customCompanies.all,
    queryFn: async () => {
      const { data, error } = await supabase
        /* FIX-18: Replace `as any` with typed table name cast */
        .from("custom_companies" as never)
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as CustomCompany[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        /* FIX-19: Replace `as any` with typed casts */
        .from("custom_companies" as never)
        .insert({ user_id: user.id, name } as Record<string, unknown>);
      if (error) throw error;
    },
    onSuccess: (_data, name) => {
      qc.invalidateQueries({ queryKey: queryKeys.customCompanies.all });
      onChange(name);
      setNewName("");
      setAdding(false);
      toast.success("Gesellschaft hinzugefuegt");
    },
    onError: () => toast.error("Fehler beim Hinzufuegen"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        /* FIX-20: Replace `as any` with typed table name cast */
        .from("custom_companies" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.customCompanies.all });
      toast.success("Gesellschaft geloescht");
    },
    onError: () => toast.error("Fehler beim Loeschen"),
  });

  const allOptions = [
    ...DEFAULT_OPTIONS.map((name) => ({ id: name, name, isDefault: true })),
    ...customCompanies.map((c) => ({ ...c, isDefault: false })),
  ];

  const filtered = search.trim()
    ? allOptions.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : allOptions;

  const handleAdd = useCallback(() => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const exists = allOptions.some((o) => o.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      toast.error("Gesellschaft existiert bereits");
      return;
    }
    addMutation.mutate(trimmed);
  }, [newName, allOptions, addMutation]);

  const handleDelete = useCallback(
    (e: React.MouseEvent, company: CustomCompany) => {
      e.stopPropagation();
      if (value === company.name) onChange("");
      deleteMutation.mutate(company.id);
    },
    [value, onChange, deleteMutation]
  );

  useEffect(() => {
    if (adding && addInputRef.current) addInputRef.current.focus();
  }, [adding]);

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            type="button"
            aria-expanded={open}
            className={cn("w-full h-9 justify-between text-sm font-normal", !value && "text-muted-foreground")}
          >
            {value || "Gesellschaft waehlen"}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="p-2 border-b">
            <Input
              placeholder="Suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Keine Ergebnisse</p>
            )}
            {filtered.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "flex items-center w-full rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  value === option.name && "bg-accent"
                )}
                onClick={() => { onChange(option.name); setOpen(false); setSearch(""); }}
              >
                <Check className={cn("mr-2 h-3.5 w-3.5 shrink-0", value === option.name ? "opacity-100" : "opacity-0")} />
                <span className="flex-1 text-left truncate">{option.name}</span>
                {!option.isDefault && (
                  <button
                    type="button"
                    className="ml-2 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={(e) => handleDelete(e, option)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </button>
            ))}
          </div>
          <div className="border-t p-2">
            {adding ? (
              <div className="flex gap-1.5">
                <Input
                  ref={addInputRef}
                  placeholder="Name der Gesellschaft"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
                    if (e.key === "Escape") { setAdding(false); setNewName(""); }
                  }}
                  className="h-8 text-sm"
                />
                <Button type="button" size="sm" className="h-8 px-3 shrink-0" onClick={handleAdd} disabled={addMutation.isPending}>
                  OK
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="w-full h-8 justify-start text-sm gap-1.5" onClick={() => setAdding(true)}>
                <Plus className="h-3.5 w-3.5" /> Neue Gesellschaft
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default GesellschaftSelector;
