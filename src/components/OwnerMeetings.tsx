import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Users, Plus, Video, MapPin, Calendar, Vote, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { useProperties } from "@/context/PropertyContext";

interface MeetingRow {
  id: string;
  property_id: string;
  title: string;
  meeting_date: string;
  location: string | null;
  is_virtual: boolean;
  meeting_link: string | null;
  status: string;
  minutes: string | null;
  created_at: string;
}

interface ResolutionRow {
  id: string;
  meeting_id: string;
  resolution_number: number;
  title: string;
  description: string | null;
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
  result: string;
  created_at: string;
}

interface OwnerMeetingsProps {
  propertyId?: string;
}

const OwnerMeetings = ({ propertyId }: OwnerMeetingsProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { properties } = useProperties();
  const [open, setOpen] = useState(false);
  const [resOpen, setResOpen] = useState<string | null>(null);
  const [form, setForm] = useState({
    property_id: propertyId || "",
    title: "",
    meeting_date: "",
    location: "",
    is_virtual: false,
    meeting_link: "",
  });
  const [resForm, setResForm] = useState({ title: "", description: "", votes_for: 0, votes_against: 0, votes_abstain: 0, result: "angenommen" });

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["owner_meetings", propertyId],
    queryFn: async () => {
      let q = supabase.from("owner_meetings").select("*").order("meeting_date", { ascending: false });
      if (propertyId) q = q.eq("property_id", propertyId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: resolutions = [] } = useQuery({
    queryKey: ["meeting_resolutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_resolutions").select("*").order("resolution_number");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const addMeeting = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("owner_meetings").insert({
        user_id: user!.id,
        property_id: form.property_id,
        title: form.title,
        meeting_date: form.meeting_date,
        location: form.is_virtual ? "Online" : form.location,
        is_virtual: form.is_virtual,
        meeting_link: form.is_virtual ? form.meeting_link : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner_meetings"] });
      setOpen(false);
      toast.success("Versammlung angelegt");
    },
    onError: () => toast.error("Fehler"),
  });

  const addResolution = useMutation({
    mutationFn: async (meetingId: string) => {
      const existing = resolutions.filter((r: ResolutionRow) => r.meeting_id === meetingId);
      const { error } = await supabase.from("meeting_resolutions").insert({
        user_id: user!.id,
        meeting_id: meetingId,
        resolution_number: existing.length + 1,
        title: resForm.title,
        description: resForm.description || null,
        votes_for: resForm.votes_for,
        votes_against: resForm.votes_against,
        votes_abstain: resForm.votes_abstain,
        result: resForm.result,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting_resolutions"] });
      setResOpen(null);
      setResForm({ title: "", description: "", votes_for: 0, votes_against: 0, votes_abstain: 0, result: "angenommen" });
      toast.success("Beschluss hinzugefügt");
    },
  });

  const deleteMeeting = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("owner_meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner_meetings"] });
      toast.success("Gelöscht");
    },
  });

  const updateMeetingStatus = useMutation({
    mutationFn: async ({ id, status, minutes }: { id: string; status: string; minutes?: string }) => {
      const updates: Record<string, string> = { status };
      if (minutes) updates.minutes = minutes;
      const { error } = await supabase.from("owner_meetings").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner_meetings"] });
      toast.success("Status aktualisiert");
    },
  });

  const getPropertyName = (pid: string) => properties.find(p => p.id === pid)?.name || "–";

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" /> Eigentümerversammlungen
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" /> Versammlung</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neue Eigentümerversammlung</DialogTitle></DialogHeader>
            <div className="grid gap-3 mt-2">
              {!propertyId && (
                <div>
                  <Label>Objekt</Label>
                  <Select value={form.property_id} onValueChange={v => setForm(f => ({ ...f, property_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Objekt wählen" /></SelectTrigger>
                    <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Titel / Thema</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="z.B. Ordentliche ETV 2025" /></div>
              <div><Label>Datum & Uhrzeit</Label><Input type="datetime-local" value={form.meeting_date} onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_virtual} onCheckedChange={v => setForm(f => ({ ...f, is_virtual: v }))} />
                <Label className="text-xs">Virtuelle Versammlung</Label>
              </div>
              {form.is_virtual ? (
                <div><Label>Meeting-Link</Label><Input value={form.meeting_link} onChange={e => setForm(f => ({ ...f, meeting_link: e.target.value }))} placeholder="https://zoom.us/..." /></div>
              ) : (
                <div><Label>Ort</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Adresse" /></div>
              )}
              <Button onClick={() => addMeeting.mutate()} disabled={!form.title || !form.meeting_date || !form.property_id}>Anlegen</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Laden...</div>
      ) : meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Versammlungen geplant.</p>
      ) : (
        <Accordion type="single" collapsible className="space-y-2">
          {meetings.map((m: MeetingRow) => {
            const meetingResolutions = resolutions.filter((r: ResolutionRow) => r.meeting_id === m.id);
            const isPast = new Date(m.meeting_date) < new Date();
            return (
              <AccordionItem key={m.id} value={m.id} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        {m.title}
                        {m.is_virtual && <Video className="h-3.5 w-3.5 text-primary" />}
                        <Badge variant={m.status === "durchgeführt" ? "default" : m.status === "abgesagt" ? "destructive" : "secondary"} className="text-[10px]">
                          {m.status === "geplant" ? "Geplant" : m.status === "durchgeführt" ? "Durchgeführt" : "Abgesagt"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {new Date(m.meeting_date).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
                        {!propertyId && <span>· {getPropertyName(m.property_id)}</span>}
                        {m.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {m.location}</span>}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {/* Status actions */}
                    <div className="flex gap-2 flex-wrap">
                      {m.status === "geplant" && isPast && (
                        <Button size="sm" variant="outline" onClick={() => updateMeetingStatus.mutate({ id: m.id, status: "durchgeführt" })}>
                          Als durchgeführt markieren
                        </Button>
                      )}
                      {m.status === "geplant" && (
                        <Button size="sm" variant="outline" className="text-loss" onClick={() => updateMeetingStatus.mutate({ id: m.id, status: "abgesagt" })}>
                          Absagen
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-loss" onClick={() => deleteMeeting.mutate(m.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Löschen
                      </Button>
                    </div>

                    {/* Resolutions */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold flex items-center gap-1"><Vote className="h-3.5 w-3.5" /> Beschlüsse ({meetingResolutions.length})</h4>
                        <Dialog open={resOpen === m.id} onOpenChange={v => setResOpen(v ? m.id : null)}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" /> Beschluss</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Beschluss hinzufügen</DialogTitle></DialogHeader>
                            <div className="grid gap-3 mt-2">
                              <div><Label>Titel</Label><Input value={resForm.title} onChange={e => setResForm(f => ({ ...f, title: e.target.value }))} placeholder="z.B. Sanierung Dach" /></div>
                              <div><Label>Beschreibung</Label><Textarea value={resForm.description} onChange={e => setResForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
                              <div className="grid grid-cols-3 gap-2">
                                <div><Label className="text-xs">Dafür</Label><Input type="number" value={resForm.votes_for} onChange={e => setResForm(f => ({ ...f, votes_for: +e.target.value }))} /></div>
                                <div><Label className="text-xs">Dagegen</Label><Input type="number" value={resForm.votes_against} onChange={e => setResForm(f => ({ ...f, votes_against: +e.target.value }))} /></div>
                                <div><Label className="text-xs">Enthaltung</Label><Input type="number" value={resForm.votes_abstain} onChange={e => setResForm(f => ({ ...f, votes_abstain: +e.target.value }))} /></div>
                              </div>
                              <Select value={resForm.result} onValueChange={v => setResForm(f => ({ ...f, result: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="angenommen">Angenommen</SelectItem>
                                  <SelectItem value="abgelehnt">Abgelehnt</SelectItem>
                                  <SelectItem value="vertagt">Vertagt</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button onClick={() => addResolution.mutate(m.id)} disabled={!resForm.title}>Hinzufügen</Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      {meetingResolutions.length > 0 ? (
                        <div className="space-y-1.5">
                          {meetingResolutions.map((r: ResolutionRow) => (
                            <div key={r.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2">
                              <div>
                                <span className="text-xs font-medium">TOP {r.resolution_number}: {r.title}</span>
                                {r.description && <p className="text-[10px] text-muted-foreground">{r.description}</p>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">{r.votes_for}:{r.votes_against}:{r.votes_abstain}</span>
                                <Badge variant={r.result === "angenommen" ? "default" : r.result === "abgelehnt" ? "destructive" : "secondary"} className="text-[10px]">
                                  {r.result}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Keine Beschlüsse erfasst.</p>
                      )}
                    </div>

                    {/* Minutes */}
                    {m.minutes && (
                      <div>
                        <h4 className="text-xs font-semibold flex items-center gap-1 mb-1"><FileText className="h-3.5 w-3.5" /> Protokoll</h4>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{m.minutes}</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </Card>
  );
};

export default OwnerMeetings;
