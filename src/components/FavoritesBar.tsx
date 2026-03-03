/**
 * #9: Favoriten/Schnellzugriff-Leiste — Pin frequently used objects/pages
 */
import { useState, useEffect, useCallback } from "react";
import { Star, X, Building2 } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { useNavigate } from "react-router-dom";

interface Favorite {
  id: string;
  type: "property" | "page";
  label: string;
  path: string;
}

const STORAGE_KEY = "immo-favorites";

function loadFavorites(): Favorite[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveFavorites(favs: Favorite[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}

export function FavoritesBar() {
  const { properties } = useProperties();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Favorite[]>(loadFavorites);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  const addFavorite = useCallback((fav: Favorite) => {
    setFavorites(prev => {
      if (prev.some(f => f.id === fav.id)) return prev;
      return [...prev, fav];
    });
    setShowAdd(false);
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavorites(prev => prev.filter(f => f.id !== id));
  }, []);

  const availableProperties = properties.filter(p => !favorites.some(f => f.id === p.id));

  if (favorites.length === 0 && !showAdd) {
    return (
      <button
        onClick={() => setShowAdd(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-dashed border-border hover:border-primary/30"
      >
        <Star className="h-3.5 w-3.5" />
        Favoriten hinzufügen
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {favorites.map(fav => (
        <button
          key={fav.id}
          onClick={() => navigate(fav.path)}
          className="group flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors"
        >
          <Star className="h-3 w-3 text-primary fill-primary" />
          <span className="truncate max-w-[120px]">{fav.label}</span>
          <button
            onClick={e => { e.stopPropagation(); removeFavorite(fav.id); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-secondary"
            aria-label="Entfernen"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </button>
      ))}

      {showAdd ? (
        <div className="flex items-center gap-1">
          {availableProperties.slice(0, 5).map(p => (
            <button
              key={p.id}
              onClick={() => addFavorite({ id: p.id, type: "property", label: p.name, path: `/objekt/${p.id}` })}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-secondary transition-colors"
            >
              <Building2 className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-[100px]">{p.name}</span>
            </button>
          ))}
          <button onClick={() => setShowAdd(false)} className="p-1 rounded hover:bg-secondary">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="p-1.5 rounded-lg border border-dashed border-border hover:border-primary/30 transition-colors"
          aria-label="Favorit hinzufügen"
        >
          <Star className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

export function useIsFavorite(id: string): { isFavorite: boolean; toggle: () => void } {
  const [favorites, setFavorites] = useState<Favorite[]>(loadFavorites);

  const toggle = useCallback(() => {
    setFavorites(prev => {
      const next = prev.some(f => f.id === id)
        ? prev.filter(f => f.id !== id)
        : [...prev, { id, type: "property" as const, label: "", path: `/objekt/${id}` }];
      saveFavorites(next);
      return next;
    });
  }, [id]);

  return {
    isFavorite: favorites.some(f => f.id === id),
    toggle,
  };
}

export default FavoritesBar;
