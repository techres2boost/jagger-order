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
import { Trash, Edit, MapPinOff, LogOut, Check } from "lucide-react";
import { deliveryDistanceKm, DELIVERY_RADIUS_KM } from "@/lib/geo";
import { signAddressPhoto } from "@/lib/address-photo";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { BoxLogo } from "@/components/BoxLogo";
import { useTheme, THEME_LIST } from "@/lib/theme-context";

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
  city?: string | null;
  photo_url?: string | null;
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
  const { themeId, theme, setThemeId } = useTheme();

  // Addresses
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingAddress, setEditingAddress] = useState<EditAddress | null>(null);
  // URLs signées des miniatures de photo d'adresse (bucket privé).
  const [addressPhotos, setAddressPhotos] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        addresses
          .filter((a) => a.photo_url)
          .map(async (a) => [a.id, await signAddressPhoto(a.photo_url)] as const),
      );
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const [id, url] of entries) if (url) map[id] = url;
      setAddressPhotos(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [addresses]);

  // Delete account dialog
  const [openDelete, setOpenDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Email + liaison Google (Task 3).
  const [emailInput, setEmailInput] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);

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
      setEmailInput(u.user.email ?? "");

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
    // Téléphone vidé => null (reste hors de l'index unique partiel).
    const row = { full_name: profile.full_name.trim(), phone: profile.phone?.trim() || null };
    const { error } = await supabase.from("profiles").upsert({ id: user.id, ...row } as any);

    setLoading(false);
    if (error) {
      // Violation d'unicité du téléphone (index profiles_phone_unique).
      if (error.code === "23505" || /profiles_phone_unique|phone/i.test(error.message)) {
        return toast.error("Ce numéro de téléphone est déjà utilisé par un autre compte.");
      }
      return toast.error(error.message);
    }
    toast.success("Profil mis à jour");
    setEditing(false);
  }

  // Ajoute/modifie l'email du compte via le flux natif Supabase : updateUser
  // envoie un email de confirmation, l'adresse n'est vérifiée qu'après clic.
  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast.error("Adresse email invalide");
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email });
    setSavingEmail(false);
    if (error) {
      const code = (error as { code?: string }).code;
      if (
        code === "email_exists" ||
        /already|registered|exist|in use|utilis/i.test(error.message)
      ) {
        return toast.error("Cette adresse email est déjà utilisée par un autre compte.");
      }
      return toast.error(error.message);
    }
    toast.success(
      "Un email de confirmation vous a été envoyé. Cliquez sur le lien pour vérifier votre adresse.",
    );
  }

  // Liaison native d'un compte Google au compte courant (linkIdentity). Redirige
  // vers Google puis revient sur /compte ; l'identité est rattachée à l'utilisateur.
  async function linkGoogle() {
    setLinkingGoogle(true);
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/compte` },
    });
    if (error) {
      setLinkingGoogle(false);
      toast.error("Liaison Google impossible : " + error.message);
    }
    // Sinon le navigateur redirige vers Google (aucune navigation manuelle ici).
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
        return toast.error(
          serverError || error.message || "Échec lors de la suppression du compte",
        );
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Déconnecté");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  const initials = (profile?.full_name || user?.email || "?")
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* En-tête « Comptoir » : brique pleine, identité + signature du logo. */}
      <header className="warm-dots relative overflow-hidden bg-brand px-5 pb-9 pt-5">
        <div className="relative mx-auto flex max-w-2xl items-center justify-between">
          <h1 className="text-xl font-black text-brand-foreground">Mon compte</h1>
          <BoxLogo size={30} showWordmark={false} className="text-brand-foreground opacity-95" />
        </div>
        <div className="relative mx-auto mt-5 flex max-w-2xl items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-foreground text-xl font-black text-brand">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-black text-brand-foreground">
              {profile?.full_name || "—"}
            </div>
            {profile?.phone && (
              <div className="text-xs text-brand-foreground/75">{profile.phone}</div>
            )}
            {user?.email_confirmed_at && (
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand-foreground/20 px-2.5 py-1 text-[10px] font-bold text-brand-foreground">
                <Check className="h-3 w-3" /> Email vérifié
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4">
        {/* Avatar (photo réelle) — carte claire chevauchant l'en-tête pour rester lisible */}
        {user && (
          <div className="-mt-5 flex justify-center rounded-[22px] border border-border bg-card p-4 shadow-[0_16px_30px_-20px_rgba(46,30,23,0.4)]">
            <ProfileAvatar userId={user.id} />
          </div>
        )}

        <section className="mt-5 rounded-[22px] border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Nom</p>
              <p className="text-base font-semibold">{profile?.full_name || "—"}</p>
            </div>
            <div>
              <button
                className="rounded-full border border-border px-3 py-2 text-sm font-semibold"
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
                <button className="h-10 rounded-full bg-brand px-4 text-brand-foreground">
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="h-10 rounded-full border border-border px-4"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          <form onSubmit={saveEmail} className="mt-5 space-y-2 border-t border-border pt-4">
            <label className="text-sm text-muted-foreground">Adresse email</label>
            <Input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="vous@exemple.com"
            />
            {user?.email &&
              (user.email_confirmed_at ? (
                <p className="text-xs text-[color:var(--success)]">Email vérifié : {user.email}</p>
              ) : (
                <p className="text-xs text-amber-600">Email non vérifié.</p>
              ))}
            {user?.new_email && (
              <p className="text-xs text-amber-600">
                Changement en attente de confirmation : {user.new_email}
              </p>
            )}
            <button
              disabled={savingEmail}
              className="h-10 rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground disabled:opacity-50"
            >
              {savingEmail ? "Envoi…" : user?.email ? "Modifier l'email" : "Ajouter un email"}
            </button>
          </form>

          <div className="mt-5 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">Compte Google</p>
            {user?.identities?.some((i) => i.provider === "google") ? (
              <p className="mt-1 text-sm font-semibold text-[color:var(--success)]">
                Compte Google lié
              </p>
            ) : (
              <>
                <button
                  type="button"
                  disabled={linkingGoogle}
                  onClick={linkGoogle}
                  className="mt-2 h-10 rounded-full border border-border px-4 text-sm font-semibold disabled:opacity-50"
                >
                  {linkingGoogle ? "Redirection…" : "Lier mon compte Google"}
                </button>
                <p className="mt-2 text-xs text-muted-foreground/70">
                  Vérifiez d'abord votre email pour un rattachement automatique fiable.
                </p>
              </>
            )}
          </div>
        </section>

        {/* Apparence — preuve que l'architecture white-label fonctionne pour de
            vrai : changer de thème restyle l'app cliente entière (couleurs +
            emplacement logo), sans toucher à la structure des écrans. */}
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Apparence</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Démonstration white-label : chaque thème simule un restaurant client différent.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {THEME_LIST.map((t) => {
              const active = t.id === themeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  className={`press flex flex-col items-center gap-2 rounded-[18px] border-2 bg-card p-3 transition-all ${
                    active ? "shadow-[0_8px_20px_-10px_rgba(46,30,23,0.5)]" : "border-border"
                  }`}
                  style={active ? { borderColor: t.vars["--primary"] } : undefined}
                >
                  <span className="flex gap-1">
                    <span
                      className="h-6 w-6 rounded-full"
                      style={{ backgroundColor: t.vars["--primary"] }}
                    />
                    <span
                      className="h-6 w-6 rounded-full"
                      style={{ backgroundColor: t.vars["--secondary-warm"] }}
                    />
                    <span
                      className="h-6 w-6 rounded-full"
                      style={{ backgroundColor: t.vars["--accent-warm"] }}
                    />
                  </span>
                  <span className="text-xs font-bold">{t.label}</span>
                  {active && (
                    <Check className="h-3.5 w-3.5" style={{ color: t.vars["--primary"] }} />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Restaurant actif :{" "}
            <span className="font-semibold text-foreground">{theme.restaurantName}</span>
            {!theme.hasLogo && " · emplacement « LOGO CLIENT » en attente du vrai logo"}
          </p>
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
                className={`h-9 rounded-full px-3 text-sm font-semibold ${addresses.length >= 5 ? "border border-border bg-surface-2 text-muted-foreground" : "bg-brand text-brand-foreground"}`}
              >
                Ajouter une adresse
              </button>
            </div>
          </div>

          {addresses.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">Aucune adresse enregistrée.</p>
          )}

          <div className="mt-3 grid gap-3">
            {addresses.map((a) => {
              // Distance au restaurant via le helper partagé (aucune écriture en
              // base, purement de l'affichage). Hors zone si > rayon.
              const distanceKm = deliveryDistanceKm({ lat: a.latitude, lng: a.longitude });
              const outOfZone = distanceKm != null && distanceKm > DELIVERY_RADIUS_KM;
              return (
                <div
                  key={a.id}
                  className="overflow-hidden rounded-[20px] border border-border bg-card"
                >
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <strong>{a.label || "Adresse"}</strong>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs text-muted-foreground">{a.address_type}</span>
                            {distanceKm != null &&
                              (outOfZone ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                  <MapPinOff className="h-3 w-3" /> Hors zone de livraison
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-[color:var(--success)]/15 px-2 py-0.5 text-[10px] font-medium text-[color:var(--success)]">
                                  En zone de livraison
                                </span>
                              ))}
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{a.full_address}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => {
                            setEditingAddress(a as unknown as EditAddress);
                            setShowAdd(true);
                          }}
                          className="rounded-md border border-border p-2"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDeleteAddress(a.id)}
                          className="rounded-md border border-border p-2 text-destructive"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {addressPhotos[a.id] && (
                    <div className="h-32 w-full overflow-hidden border-t border-border">
                      <img
                        src={addressPhotos[a.id]}
                        alt="Photo du logement"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
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
              );
            })}
          </div>
          {addresses.length >= 5 && (
            <p className="mt-2 text-sm text-muted-foreground">Limite de 5 adresses atteinte.</p>
          )}
        </section>

        {/* Actions sensibles — isolées, jamais d'animation ludique ici. */}
        <section className="mt-8 space-y-3 pb-6">
          <button
            onClick={handleSignOut}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-[color:var(--primary)]/35 text-sm font-bold text-brand"
          >
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
          <div className="rounded-[20px] border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Actions sensibles</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Suppression définitive du compte et des données associées.
            </p>
            <div className="mt-4">
              <button
                onClick={() => setOpenDelete(true)}
                className="w-full rounded-full bg-destructive px-4 py-3 text-white"
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
              <button
                onClick={() => setOpenDelete(false)}
                className="rounded-md border border-border px-4 py-2"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || confirmText.trim().toUpperCase() !== "SUPPRIMER"}
                className="rounded-md bg-destructive px-4 py-2 text-white"
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
