/**
 * #17: Kontakte Duplikat-Erkennung mit Fuzzy-Matching
 * Detects potential duplicate contacts using string similarity.
 */
import { useMemo, useState } from "react";
import { Users, AlertTriangle, Merge, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Contact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}

interface DuplicateGroup {
  contacts: Contact[];
  reason: string;
  similarity: number;
}

/** Simple Levenshtein-based similarity (0-1) */
function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1;
  if (al.length === 0 || bl.length === 0) return 0;

  const maxLen = Math.max(al.length, bl.length);
  if (maxLen === 0) return 1;

  // Simple approach: longest common subsequence ratio
  const dp: number[][] = Array.from({ length: al.length + 1 }, () => Array(bl.length + 1).fill(0));
  for (let i = 1; i <= al.length; i++) {
    for (let j = 1; j <= bl.length; j++) {
      dp[i][j] = al[i - 1] === bl[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[al.length][bl.length] / maxLen;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()/+]/g, "").replace(/^0049/, "0").replace(/^49/, "0");
}

function findDuplicates(contacts: Contact[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < contacts.length; i++) {
    for (let j = i + 1; j < contacts.length; j++) {
      const a = contacts[i];
      const b = contacts[j];
      const pairKey = `${a.id}-${b.id}`;
      if (seen.has(pairKey)) continue;

      // Check exact email match
      if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) {
        seen.add(pairKey);
        groups.push({ contacts: [a, b], reason: "Gleiche E-Mail", similarity: 1 });
        continue;
      }

      // Check phone match (normalized)
      if (a.phone && b.phone) {
        const phoneA = normalizePhone(a.phone);
        const phoneB = normalizePhone(b.phone);
        if (phoneA.length >= 6 && phoneA === phoneB) {
          seen.add(pairKey);
          groups.push({ contacts: [a, b], reason: "Gleiche Telefonnummer", similarity: 1 });
          continue;
        }
      }

      // Fuzzy name match
      const nameSim = stringSimilarity(a.name, b.name);
      if (nameSim >= 0.8) {
        seen.add(pairKey);
        groups.push({
          contacts: [a, b],
          reason: `Ähnlicher Name (${Math.round(nameSim * 100)}%)`,
          similarity: nameSim,
        });
      }
    }
  }

  return groups.sort((a, b) => b.similarity - a.similarity);
}

interface ContactDuplicateDetectorProps {
  contacts: Contact[];
  onMerge?: (keepId: string, removeId: string) => void;
}

export function ContactDuplicateDetector({ contacts, onMerge }: ContactDuplicateDetectorProps) {
  const duplicates = useMemo(() => findDuplicates(contacts), [contacts]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleDuplicates = duplicates.filter(d => {
    const key = d.contacts.map(c => c.id).sort().join("-");
    return !dismissed.has(key);
  });

  if (visibleDuplicates.length === 0) return null;

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-gold" />
          {visibleDuplicates.length} mögliche Duplikat{visibleDuplicates.length > 1 ? "e" : ""} erkannt
        </h3>
      </div>

      <div className="space-y-2">
        {visibleDuplicates.slice(0, 5).map((group) => {
          const key = group.contacts.map(c => c.id).sort().join("-");
          return (
            <div key={key} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">
                  {group.contacts.map(c => c.name).join(" ↔ ")}
                </p>
                <p className="text-[10px] text-muted-foreground">{group.reason}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onMerge && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() => onMerge(group.contacts[0].id, group.contacts[1].id)}
                  >
                    <Merge className="h-3 w-3 mr-1" />
                    Zusammenführen
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setDismissed(prev => new Set([...prev, key]))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {visibleDuplicates.length > 5 && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          +{visibleDuplicates.length - 5} weitere mögliche Duplikate
        </p>
      )}
    </div>
  );
}

export default ContactDuplicateDetector;
