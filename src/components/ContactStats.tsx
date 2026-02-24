import { Wrench, Building, Shield, Briefcase, Users } from "lucide-react";

interface ContactStatsProps {
  contacts: Array<{ category: string }>;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Wrench; color: string }> = {
  Handwerker: { icon: Wrench, color: "text-blue-500 bg-blue-500/10" },
  Hausverwaltung: { icon: Building, color: "text-gold bg-gold/10" },
  Versicherung: { icon: Shield, color: "text-profit bg-profit/10" },
  Sonstiges: { icon: Briefcase, color: "text-muted-foreground bg-secondary" },
};

const ContactStats = ({ contacts }: ContactStatsProps) => {
  const counts = contacts.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span className="font-medium">{contacts.length}</span> gesamt
      </div>
      {Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => {
        const count = counts[cat] || 0;
        if (count === 0) return null;
        const Icon = cfg.icon;
        return (
          <div key={cat} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium ${cfg.color}`}>
            <Icon className="h-3 w-3" />
            {count} {cat}
          </div>
        );
      })}
    </div>
  );
};

export default ContactStats;
