"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AddAddress, EditAddress } from "@/components/AddAddress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import { Trash, Edit } from "lucide-react";

// Types locaux

type Profile = { full_name?: string; phone?: string | null; email?: string | null };

type Address = {
  id: string;
  label?: string | null;
  address_type?: string | null;
  floor_number?: string | null;
  apartment_number?: string | null;
  additional_info?: string | null;
  full_address?: string | null;
  latitude: number;
  longitude: number;
  is_default?: boolean;
};

// Fix icon for leaflet marker

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export function CompteClient() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);

  // Addresses
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingAddress, setEditingAddress] = useState<EditAddress | null>(null);

  // Delete account dialog
  const [openDelete, setOpenDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(u.user);

      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .single();
      if (pErr) {
        const fallbackName =
          (u.user.user_metadata as unknown as { full_name?: string })?.full_name ?? "";
        setProfile({
          full_name: fallbackName,
          phone: (p as unknown as { phone?: string })?.phone ?? null,
          email: u.user.email ?? null,
        });
      } else {
        setProfile({ ...(p as Profile), email: u.user.email ?? null });
      }

      const { data: a } = await (supabase as any)
        .from("addresses")
        .select("*")
        .eq("user_id", u.user.id)
        .order("is_default", { ascending: false });
      setAddresses((a as unknown as Address[]) ?? []);


      setLoading(false);
    })();
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    if (!profile.full_name || profile.full_name.trim().length < 2)
      return toast.error("Nom invalide");
    setLoading(true);
    const row = { full_name: profile.full_name.trim(), phone: profile.phone ?? null };
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...row } as any);

    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Profil mis à jour");
    setEditing(false);
  }

  async function reloadAddresses() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: a } = await (supabase as any)
      .from("addresses")
      .select("*")
      .eq("user_id", u.user.id)
      .order("is_default", { ascending: false });
    setAddresses((a as unknown as Address[]) ?? []);
  }

  async function onDeleteAddress(id: string) {
    if (!confirm("Supprimer cette adresse ?")) return;
    const { error } = await (supabase as any).from("addresses").delete().eq("id", id);

    if (error) return toast.error(error.message);
    toast.success("Adresse supprimée");
    reloadAddresses();
  }

  async function handleDeleteAccount() {
    if (!user) return;
    if (confirmText.trim().toUpperCase() !== "SUPPRIMER") return;
    setDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
        "delete-account",
        { body: { user_id: user.id } },
      );

      if (error) {
        setDeleting(false);
        // Récupère le message d'erreur renvoyé par la fonction si disponible.
        let serverError: string | undefined;
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            serverError = (await ctx.json())?.error;
          } catch {
            /* ignore */
          }
        }
        return toast.error(serverError || error.message || "Échec lors de la suppression du compte");
      }

      if (data?.error) {
        setDeleting(false);
        return toast.error(data.error);
      }

      await supabase.auth.signOut();
      toast.success("Compte supprimé");
      window.location.href = "/auth";
    } catch (e: unknown) {
      setDeleting(false);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Erreur inattendue");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Chargement…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto max-w-2xl p-4">
        <h1 className="text-2xl font-bold">Mon compte</h1>

        <section className="mt-6 rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Nom</p>
              <p className="text-base font-semibold">{profile?.full_name || "—"}</p>
            </div>
            <div>
              <button
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => setEditing((s) => !s)}
              >
                {editing ? "Annuler" : "Modifier"}
              </button>
            </div>
          </div>

          {!editing ? (
            <div className="mt-4 space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Téléphone</p>
                <p className="text-base">{profile?.phone || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-base">{profile?.email || "—"}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={saveProfile} className="mt-4 space-y-3">
              <div>
                <label className="text-sm">Nom complet</label>
                <Input
                  value={profile?.full_name ?? ""}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm">Téléphone</label>
                <Input
                  value={profile?.phone ?? ""}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <button className="h-10 rounded-full bg-[#B22222] px-4 text-white">
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="h-10 rounded-full border px-4"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Adresses</h2>
            <div>
              <button
                disabled={addresses.length >= 5}
                onClick={() => {
                  setShowAdd(true);
                  setEditingAddress(null);
                }}
                className={`h-9 rounded-full px-3 text-sm font-semibold ${addresses.length >= 5 ? "border bg-neutral-100 text-neutral-400" : "bg-[#B22222] text-white"}`}
              >
                Ajouter une adresse
              </button>
            </div>
          </div>

          {addresses.length === 0 && (
            <p className="mt-3 text-sm text-neutral-500">Aucune adresse enregistrée.</p>
          )}

          <div className="mt-3 grid gap-3">
            {addresses.map((a) => (
              <div key={a.id} className="overflow-hidden rounded-xl border bg-white">
                <div className="p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between">
                        <strong>{a.label || "Adresse"}</strong>
                        <span className="text-xs text-neutral-400">{a.address_type}</span>
                      </div>
                      <p className="mt-2 text-sm text-neutral-600">{a.full_address}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => {
                          setEditingAddress(a as unknown as EditAddress);
                          setShowAdd(true);
                        }}
                        className="rounded-md border p-2"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDeleteAddress(a.id)}
                        className="rounded-md border p-2 text-red-600"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="relative z-0 h-32 w-full overflow-hidden">
                  <MapContainer
                    center={[a.latitude, a.longitude]}
                    zoom={15}
                    className="h-full w-full"
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[a.latitude, a.longitude]} icon={markerIcon} />
                  </MapContainer>
                </div>
              </div>
            ))}
          </div>
          {addresses.length >= 5 && (
            <p className="mt-2 text-sm text-neutral-500">Limite de 5 adresses atteinte.</p>
          )}
        </section>

        <section className="mt-8">
          <div className="rounded-xl border bg-white p-4">
            <h3 className="text-sm font-semibold text-neutral-800">Actions sensibles</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Suppression définitive du compte et des données associées.
            </p>
            <div className="mt-4">
              <button
                onClick={() => setOpenDelete(true)}
                className="w-full rounded-full bg-red-700 px-4 py-3 text-white"
              >
                Supprimer mon compte et mes données
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Add / Edit address modal */}
      {showAdd && (
        <AddAddress
          editing={editingAddress}
          onClose={async () => {
            setShowAdd(false);
            setEditingAddress(null);
            await reloadAddresses();
          }}
          onSaved={async () => {
            setShowAdd(false);
            await reloadAddresses();
          }}
        />
      )}

      {/* Delete account dialog */}
      <Dialog open={openDelete} onOpenChange={setOpenDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer mon compte</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Entrez votre mot de passe pour confirmer.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <label className="text-sm">Tapez SUPPRIMER pour confirmer</label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </div>

          <DialogFooter>
            <div className="mt-4 flex w-full justify-end gap-2">
              <button onClick={() => setOpenDelete(false)} className="rounded-md border px-4 py-2">
                Annuler
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || confirmText.trim().toUpperCase() !== "SUPPRIMER"}
                className="rounded-md bg-red-700 px-4 py-2 text-white"
              >
                {deleting ? "Suppression…" : "Confirmer la suppression"}
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
