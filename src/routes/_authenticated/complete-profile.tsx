import { createFileRoute, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BoxLogo } from "@/components/BoxLogo";
import { Home, Building2, Briefcase, Pencil, Trash2, Plus, ChevronLeft } from "lucide-react";
import { z } from "zod";
import { AddAddress, type EditAddress } from "@/components/AddAddress";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/complete-profile")({
  ssr: false,
  validateSearch: searchSchema,
  component: CompleteProfilePage,
});

const MAX_ADDRESSES = 5;

type AddressRow = {
  id: string;
  user_id: string;
  label: string | null;
  address_type: "house" | "apartment" | "office";
  floor_number: string | null;
  apartment_number: string | null;
  additional_info: string | null;
  full_address: string | null;
  latitude: number;
  longitude: number;
  is_default: boolean;
  created_at: string;
};

function typeIcon(t: AddressRow["address_type"]) {
  if (t === "apartment") return <Building2 className="h-5 w-5" />;
  if (t === "office") return <Briefcase className="h-5 w-5" />;
  return <Home className="h-5 w-5" />;
}

function typeLabel(t: AddressRow["address_type"]) {
  if (t === "apartment") return "Appartement";
  if (t === "office") return "Bureau";
  return "Maison";
}

function pickPrimary(rows: AddressRow[]): AddressRow | null {
  if (rows.length === 0) return null;
  const def = rows.find((r) => r.is_default);
  if (def) return def;
  return [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
}

function CompleteProfilePage() {
  const navigate = useNavigate();
  const router = useRouter();
  const search = useSearch({ from: "/_authenticated/complete-profile" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [addrLoading, setAddrLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<AddressRow | null>(null);
  const [promptChooseDefault, setPromptChooseDefault] = useState(false);

  const loadAddresses = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("addresses" as never)
      .select("*")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setAddresses(data as unknown as AddressRow[]);
    setAddrLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return;
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", u.id)
        .maybeSingle();
      const pp = (p ?? {}) as { full_name?: string | null; phone?: string | null };
      setName(pp.full_name ?? (meta.full_name as string) ?? (meta.name as string) ?? "");
      setPhone(pp.phone ?? u.phone ?? "");
      await loadAddresses();
    })();
  }, [loadAddresses]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Nom requis");
    setSavingProfile(true);
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setSavingProfile(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim(), phone: phone.trim() || null } as never)
      .eq("id", data.user.id);
    setSavingProfile(false);
    if (error) {
      // Violation d'unicité du téléphone (index profiles_phone_unique).
      if (error.code === "23505" || /profiles_phone_unique|phone/i.test(error.message)) {
        return toast.error("Ce numéro de téléphone est déjà utilisé par un autre compte.");
      }
      return toast.error(error.message);
    }
    toast.success("Profil enregistré");
    // « Enregistrer » sauvegarde uniquement le profil, puis renvoie vers la
    // destination (le panier le cas échéant). La commande n'est PAS créée ici :
    // elle l'est seulement via le bouton « Confirmer la commande » du panier.
    const dest = search.redirect ?? "/";
    navigate({ to: dest });
  }

  function openAdd() {
    if (addresses.length >= MAX_ADDRESSES) {
      toast.error(`Limite de ${MAX_ADDRESSES} adresses atteinte`);
      return;
    }
    setEditing(null);
    setShowAdd(true);
  }

  function openEdit(a: AddressRow) {
    setEditing(a);
    setShowAdd(true);
  }

  async function deleteAddress(a: AddressRow) {
    if (!confirm("Supprimer cette adresse ?")) return;
    const wasDefault = a.is_default;
    const { error } = await supabase
      .from("addresses" as never)
      .delete()
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Adresse supprimée");
    await loadAddresses();
    if (wasDefault) {
      // Do not auto-promote. If other addresses remain, prompt the user.
      const remaining = addresses.filter((x) => x.id !== a.id);
      if (remaining.length > 0) setPromptChooseDefault(true);
    }
  }

  async function setAsDefault(id: string) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    // Clear existing defaults, then set the chosen one
    const { error: clearErr } = await supabase
      .from("addresses" as never)
      .update({ is_default: false } as never)
      .eq("user_id", u.user.id);
    if (clearErr) return toast.error(clearErr.message);
    const { error } = await supabase
      .from("addresses" as never)
      .update({ is_default: true } as never)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Adresse par défaut mise à jour");
    setPromptChooseDefault(false);
    await loadAddresses();
  }

  const primary = pickPrimary(addresses);
  const otherAddresses = addresses.filter((a) => !primary || a.id !== primary.id);
  // Toutes les adresses, celle par défaut en premier puis les autres.
  const orderedAddresses = primary ? [primary, ...otherAddresses] : addresses;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <button
        onClick={() => router.history.back()}
        aria-label="Retour"
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border bg-card shadow-sm"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="mb-6">
        <BoxLogo size={72} />
      </div>

      {/* Carte unique : profil + adresse + enregistrer */}
      <div className="w-full max-w-md space-y-4 rounded-3xl border bg-card p-6 shadow-sm">
        {/* Name + phone form */}
        <form id="profile-form" onSubmit={saveProfile} className="space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-black">Complétez votre profil</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ces infos serviront pour vos commandes.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold">Nom complet</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prénom Nom"
              className="h-12 w-full rounded-xl border bg-input px-4"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold">Téléphone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+216 12 345 678"
              className="h-12 w-full rounded-xl border bg-input px-4"
            />
          </div>
        </form>

        {/* Address block */}
        <div className="space-y-3">
          <h2 className="text-lg font-black">Adresse de livraison</h2>

          {addrLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : orderedAddresses.length > 0 ? (
            <div className="space-y-3">
              {orderedAddresses.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-2xl border p-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[#E11D2E]">
                    {typeIcon(a.address_type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold">{a.label || typeLabel(a.address_type)}</p>
                      {a.is_default && (
                        <span className="rounded-full bg-[#E11D2E]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#E11D2E]">
                          Par défaut
                        </span>
                      )}
                    </div>
                    {a.full_address && (
                      <p className="mt-0.5 text-sm text-neutral-600 line-clamp-2">
                        {a.full_address}
                      </p>
                    )}
                    {a.address_type === "apartment" && (a.floor_number || a.apartment_number) && (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Étage {a.floor_number || "—"} · Porte {a.apartment_number || "—"}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => openEdit(a)}
                      className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100"
                      aria-label="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteAddress(a)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[#E11D2E] hover:bg-red-50"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={openAdd}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-dashed text-sm font-semibold"
              >
                <Plus className="h-4 w-4" /> Ajouter une adresse
              </button>
            </div>
          ) : (
            <button
              onClick={openAdd}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#E11D2E] font-bold text-white"
            >
              <Plus className="h-4 w-4" /> Ajouter une adresse
            </button>
          )}
        </div>

        <button
          type="submit"
          form="profile-form"
          disabled={savingProfile}
          className="h-12 w-full rounded-full bg-[#B22222] font-bold text-white disabled:opacity-50"
        >
          {savingProfile ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {showAdd && (
        <AddAddress
          onClose={() => setShowAdd(false)}
          onSaved={() => loadAddresses()}
          editing={
            editing
              ? ({
                  id: editing.id,
                  label: editing.label,
                  address_type: editing.address_type,
                  floor_number: editing.floor_number,
                  apartment_number: editing.apartment_number,
                  additional_info: editing.additional_info,
                  full_address: editing.full_address,
                  latitude: editing.latitude,
                  longitude: editing.longitude,
                  is_default: editing.is_default,
                } satisfies EditAddress)
              : null
          }
        />
      )}

      {promptChooseDefault && otherAddresses.length > 0 && (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md space-y-3 rounded-3xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-black">Choisir une adresse par défaut</h3>
            <p className="text-sm text-neutral-600">
              Vous avez supprimé votre adresse par défaut. Sélectionnez-en une autre, ou fermez pour
              ne rien changer.
            </p>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {otherAddresses.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAsDefault(a.id)}
                  className="flex w-full items-start gap-3 rounded-2xl border p-3 text-left hover:bg-neutral-50"
                >
                  <div className="mt-0.5 text-[#E11D2E]">{typeIcon(a.address_type)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{a.label || typeLabel(a.address_type)}</p>
                    {a.full_address && (
                      <p className="text-xs text-neutral-500 line-clamp-2">{a.full_address}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setPromptChooseDefault(false)}
              className="h-11 w-full rounded-full border font-semibold"
            >
              Plus tard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
