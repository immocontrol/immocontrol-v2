import { useState, useRef } from "react";
import { Camera, Upload, Send, AlertTriangle, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface DamageReportProps {
  tenantId: string;
  propertyId: string;
  landlordId: string;
  unitLabel?: string;
}

const DAMAGE_CATEGORIES = [
  "Wasserschaden", "Heizung", "Elektrik", "Fenster/Türen",
  "Sanitär", "Schimmel", "Boden/Wand", "Dach/Fassade",
  "Aufzug", "Einbruch/Vandalismus", "Sonstiges",
];

const URGENCY_LEVELS = [
  { value: "low", label: "Gering", desc: "Kann warten", color: "bg-secondary text-muted-foreground" },
  { value: "medium", label: "Mittel", desc: "Zeitnah", color: "bg-gold/10 text-gold" },
  { value: "high", label: "Dringend", desc: "Sofort", color: "bg-loss/10 text-loss" },
];

/** Feature 5: Schadensmeldung mit Foto-Upload für Mieter-Portal */
export const DamageReport = ({ tenantId, propertyId, landlordId, unitLabel }: DamageReportProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Sonstiges",
    urgency: "medium",
    location: unitLabel || "",
  });

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 5 - photos.length);
    setPhotos(prev => [...prev, ...newFiles]);
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setPreviews(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Bitte Titel und Beschreibung ausfüllen");
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      // Upload photos to Supabase Storage
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const filePath = `${user.id}/damage-reports/${Date.now()}_${photo.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("property-documents")
          .upload(filePath, photo);
        if (!uploadErr) {
          photoUrls.push(filePath);
        }
      }

      // Create ticket as damage report
      const { error } = await supabase.from("tickets").insert({
        tenant_id: tenantId,
        property_id: propertyId,
        landlord_id: landlordId,
        title: `[Schadensmeldung] ${form.title}`,
        description: `**Kategorie:** ${form.category}\n**Dringlichkeit:** ${URGENCY_LEVELS.find(u => u.value === form.urgency)?.label}\n**Ort:** ${form.location}\n\n${form.description}${photoUrls.length > 0 ? `\n\n**Fotos:** ${photoUrls.length} Bild(er) hochgeladen` : ""}`,
        status: "open",
        priority: form.urgency,
      });

      if (error) throw error;

      toast.success("Schadensmeldung gesendet! Der Vermieter wurde benachrichtigt.");
      setForm({ title: "", description: "", category: "Sonstiges", urgency: "medium", location: unitLabel || "" });
      setPhotos([]);
      setPreviews([]);
      setOpen(false);
    } catch {
      toast.error("Fehler beim Senden der Schadensmeldung");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 w-full justify-start" variant="outline">
          <AlertTriangle className="h-4 w-4 text-loss" /> Schaden melden
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-loss" /> Schadensmeldung
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Titel / Kurzbeschreibung *</Label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="z.B. Wasserfleck an der Decke"
              className="h-9 text-sm"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Kategorie</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAMAGE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dringlichkeit</Label>
              <Select value={form.urgency} onValueChange={v => setForm(f => ({ ...f, urgency: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {URGENCY_LEVELS.map(u => (
                    <SelectItem key={u.value} value={u.value}>
                      <span className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${u.color}`}>{u.label}</span>
                        <span className="text-[10px] text-muted-foreground">{u.desc}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Wo genau?
            </Label>
            <Input
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="z.B. Badezimmer, Decke über der Badewanne"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Beschreibung *</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Beschreibe den Schaden möglichst genau: Wann aufgefallen? Wie groß? Was ist betroffen?"
              className="text-sm min-h-[100px]"
            />
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <Camera className="h-3 w-3" /> Fotos (max. 5)
            </Label>
            {previews.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {previews.map((src, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                    <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 hover:bg-background"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photos.length < 5 && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotos}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" /> Foto hinzufügen
                </Button>
              </>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            className="w-full gap-2"
            disabled={submitting || !form.title.trim() || !form.description.trim()}
          >
            <Send className="h-4 w-4" />
            {submitting ? "Wird gesendet..." : "Schadensmeldung absenden"}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Der Vermieter erhält eine Benachrichtigung und kann den Status unter Tickets einsehen.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
