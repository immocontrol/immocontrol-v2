/**
 * MOB5-16: Mobile Avatar Group
 * Overlapping avatar group for tenants, contacts, or team members.
 * Shows +N indicator for overflow. Touch-optimized with expandable list.
 * Replaces MOB5-16 SparklineCard (MobileCompactWidget already has sparklines).
 */
import { useState, useCallback, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { User, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AvatarPerson {
  /** Unique ID */
  id: string;
  /** Display name */
  name: string;
  /** Avatar image URL */
  avatarUrl?: string;
  /** Role or subtitle */
  role?: string;
  /** Status */
  status?: "online" | "offline" | "away";
}

interface MobileAvatarGroupProps {
  /** People to display */
  people: AvatarPerson[];
  /** Max visible avatars before +N */
  maxVisible?: number;
  /** Avatar size */
  size?: "sm" | "md" | "lg";
  /** Click handler for individual avatar */
  onPersonClick?: (person: AvatarPerson) => void;
  /** Whether to show expandable list on +N click */
  expandable?: boolean;
  /** Additional class */
  className?: string;
}

const sizeConfig = {
  sm: { avatar: "w-7 h-7", text: "text-[10px]", overlap: "-ml-2", statusDot: "w-2 h-2" },
  md: { avatar: "w-9 h-9", text: "text-xs", overlap: "-ml-2.5", statusDot: "w-2.5 h-2.5" },
  lg: { avatar: "w-11 h-11", text: "text-sm", overlap: "-ml-3", statusDot: "w-3 h-3" },
};

const statusColors = {
  online: "bg-green-500",
  offline: "bg-gray-400",
  away: "bg-yellow-500",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Deterministic color from name
function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500",
    "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-red-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const MobileAvatarGroup = memo(function MobileAvatarGroup({
  people,
  maxVisible = 4,
  size = "md",
  onPersonClick,
  expandable = true,
  className,
}: MobileAvatarGroupProps) {
  const isMobile = useIsMobile();
  const [showList, setShowList] = useState(false);
  const config = sizeConfig[size];

  const visible = people.slice(0, maxVisible);
  const overflow = people.length - maxVisible;

  const handleOverflowClick = useCallback(() => {
    if (expandable) {
      setShowList(true);
    }
  }, [expandable]);

  return (
    <>
      <div className={cn("flex items-center", className)}>
        {/* Avatars */}
        <div className="flex items-center">
          {visible.map((person, index) => (
            <button
              key={person.id}
              onClick={() => onPersonClick?.(person)}
              className={cn(
                "relative rounded-full border-2 border-background",
                "hover:z-10 hover:scale-110 transition-transform",
                config.avatar,
                index > 0 && config.overlap,
                isMobile && "min-w-[36px] min-h-[36px]"
              )}
              style={{ zIndex: visible.length - index }}
              title={person.name}
              aria-label={person.name}
            >
              {person.avatarUrl ? (
                <img
                  src={person.avatarUrl}
                  alt={person.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className={cn(
                  "w-full h-full rounded-full flex items-center justify-center text-white font-medium",
                  config.text,
                  getAvatarColor(person.name)
                )}>
                  {getInitials(person.name)}
                </div>
              )}

              {/* Status dot */}
              {person.status && (
                <span className={cn(
                  "absolute bottom-0 right-0 rounded-full border-2 border-background",
                  config.statusDot,
                  statusColors[person.status]
                )} />
              )}
            </button>
          ))}

          {/* Overflow indicator */}
          {overflow > 0 && (
            <button
              onClick={handleOverflowClick}
              className={cn(
                "relative rounded-full border-2 border-background bg-muted",
                "flex items-center justify-center",
                config.avatar,
                config.overlap,
                "hover:bg-muted/80 transition-colors",
                isMobile && "min-w-[36px] min-h-[36px]"
              )}
              style={{ zIndex: 0 }}
              aria-label={`${overflow} weitere Person${overflow > 1 ? "en" : ""}`}
            >
              <span className={cn("font-medium text-muted-foreground", config.text)}>
                +{overflow}
              </span>
            </button>
          )}
        </div>

        {/* Name labels (optional for non-mobile) */}
        {!isMobile && people.length <= 3 && (
          <div className="ml-2 min-w-0">
            <p className="text-xs text-foreground truncate">
              {people.map(p => p.name.split(" ")[0]).join(", ")}
            </p>
          </div>
        )}
      </div>

      {/* Expanded list overlay */}
      {showList && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Personen">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowList(false)}
          />
          <div className={cn(
            "absolute bg-background rounded-2xl shadow-2xl border",
            "max-h-[60vh] w-[300px] overflow-hidden",
            "animate-in zoom-in-95 fade-in duration-200",
            isMobile ? "bottom-20 left-4 right-4 w-auto" : "bottom-4 left-1/2 -translate-x-1/2"
          )}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">
                {people.length} Person{people.length > 1 ? "en" : ""}
              </h3>
              <button
                onClick={() => setShowList(false)}
                className="p-1 rounded-full hover:bg-muted transition-colors"
                aria-label="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-[calc(60vh-52px)]">
              {people.map(person => (
                <button
                  key={person.id}
                  onClick={() => {
                    onPersonClick?.(person);
                    setShowList(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5",
                    "hover:bg-muted active:bg-muted/80 transition-colors text-left",
                    "border-b last:border-0",
                    isMobile && "min-h-[44px]"
                  )}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {person.avatarUrl ? (
                      <img
                        src={person.avatarUrl}
                        alt={`Avatar von ${person.name}`}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium",
                        getAvatarColor(person.name)
                      )}>
                        {getInitials(person.name)}
                      </div>
                    )}
                    {person.status && (
                      <span className={cn(
                        "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background",
                        statusColors[person.status]
                      )} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{person.name}</p>
                    {person.role && (
                      <p className="text-xs text-muted-foreground truncate">{person.role}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
});
