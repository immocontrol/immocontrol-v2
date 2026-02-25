import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProperties } from "@/context/PropertyContext";
import { Building2, ChevronDown, ArrowRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  currentPropertyId: string;
}

const PropertyQuickSwitcher = ({ currentPropertyId }: Props) => {
  const { properties } = useProperties();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const others = properties.filter(p => p.id !== currentPropertyId);
  if (others.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary">
          <Building2 className="h-3 w-3" />
          Wechseln
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1" align="start">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
          Objekte ({others.length})
        </div>
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {others.map(p => (
            <button
              key={p.id}
              onClick={() => { navigate(`/objekt/${p.id}`); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-secondary transition-colors text-left"
            >
              <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{p.location} · {formatCurrency(p.monthlyCashflow)}/M</p>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default PropertyQuickSwitcher;
