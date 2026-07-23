"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { X, LocateFixed, Search, Loader2, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  validateAddressPhoto,
  uploadAddressPhoto,
  signAddressPhoto,
} from "@/lib/address-photo";

// Leaflet default icon fix for bundlers
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const NOMINATIM_HEADERS: HeadersInit = { "Accept-Language": "fr" };
// Note: browsers block setting User-Agent; Nominatim identifies via Referer + Accept-Language.

type LatLng = { lat: number; lng: number };

async function nominatimSearch(
  q: string,
): Promise<Array<{ lat: number; lng: number; label: string }>> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) throw new Error("search failed");
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  return data.map((d) => ({
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    label: d.display_name,
  }));
}

type ReverseResult = { label: string | null; city: string | null };

async function nominatimReverse(lat: number, lng: number): Promise<ReverseResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: NOMINATIM_HEADERS });
    if (!res.ok) return { label: null, city: null };
    const data = (await res.json()) as {
      display_name?: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        county?: string;
      };
    };
    const a = data.address ?? {};
    // Ville structurée renvoyée par Nominatim (aucune donnée inventée) : on prend
    // le premier niveau administratif disponible du plus fin au plus large.
    const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null;
    return { label: data.display_name ?? null, city };
  } catch {
    return { label: null, city: null };
  }
}

function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom() < 15 ? 16 : map.getZoom());
  }, [center, map]);
  return null;
}

export type EditAddress = {
  id: string;
  label: string | null;
  address_type: "house" | "apartment" | "office";
  floor_number: string | null;
  apartment_number: string | null;
  additional_info: string | null;
  full_address: string | null;
  latitude: number;
  longitude: number;
  is_default: boolean;
  city?: string | null;
  photo_url?: string | null;
};

type Props = {
  onClose: () => void;
  onSaved?: (id: string) => void;
  editing?: EditAddress | null;
};

export function AddAddress({ onClose, onSaved, editing = null }: Props) {
  const [center, setCenter] = useState<LatLng | null>(
    editing ? { lat: editing.latitude, lng: editing.longitude } : null,
  );
  const [centerError, setCenterError] = useState(false);
  const [marker, setMarker] = useState<LatLng | null>(
    editing ? { lat: editing.latitude, lng: editing.longitude } : null,
  );
  const [step, setStep] = useState<"map" | "details">("map");

  // Search
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ lat: number; lng: number; label: string }>>([]);

  // Details
  const [addressText, setAddressText] = useState(editing?.full_address ?? "");
  const [reverseFailed, setReverseFailed] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [addressType, setAddressType] = useState<"house" | "apartment" | "office">(
    editing?.address_type ?? "house",
  );
  const [floor, setFloor] = useState(editing?.floor_number ?? "");
  const [apt, setApt] = useState(editing?.apartment_number ?? "");
  const [additional, setAdditional] = useState(editing?.additional_info ?? "");
  const [label, setLabel] = useState(editing?.label ?? "");
  const [isDefault, setIsDefault] = useState(editing?.is_default ?? false);
  const [saving, setSaving] = useState(false);

  // Ville dérivée du reverse-geocode (Feature 5). Conservée si déjà présente.
  const [city, setCity] = useState(editing?.city ?? "");

  // Photo optionnelle (Feature 3).
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  // True quand l'URL signée existante n'arrive pas à charger (bucket vide,
  // policy, projet changé…). On bascule alors sur l'état "Ajouter/Changer".
  const [previewBroken, setPreviewBroken] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const geocodedRef = useRef(false);

  // Miniature de la photo existante (édition) via URL signée fraîche à chaque
  // ouverture du formulaire (le composant est re-monté par le parent).
  useEffect(() => {
    let revoked = false;
    setPreviewBroken(false);
    if (editing?.photo_url) {
      signAddressPhoto(editing.photo_url).then((url) => {
        if (!revoked && url) setPhotoPreview(url);
      });
    }
    return () => {
      revoked = true;
    };
  }, [editing?.photo_url]);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier
    if (!file) return;
    const err = validateAddressPhoto(file);
    if (err) {
      setPhotoError(err);
      return;
    }
    setPhotoError(null);
    setRemovePhoto(false);
    setPreviewBroken(false);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function openPhotoPicker() {
    photoInputRef.current?.click();
  }

  function clearPhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError(null);
    setPreviewBroken(false);
    setRemovePhoto(true);
  }

  // Geocode restaurant address once for default center
  useEffect(() => {
    if (editing) return;
    if (geocodedRef.current) return;
    geocodedRef.current = true;
    (async () => {
      try {
        const res = await nominatimSearch("Av. Slimen Ben Slimen, Tunis");
        if (res.length > 0) {
          const c = { lat: res[0].lat, lng: res[0].lng };
          setCenter(c);
          setMarker(c);
        } else {
          setCenterError(true);
        }
      } catch {
        setCenterError(true);
      }
    })();
  }, []);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await nominatimSearch(query.trim());
      setResults(res);
      if (res.length === 0) toast.info("Aucun résultat");
    } catch {
      toast.error("Recherche indisponible");
    } finally {
      setSearching(false);
    }
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) return toast.error("Géolocalisation non disponible");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(c);
        setMarker(c);
      },
      (err) => toast.error("Position indisponible : " + err.message),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function confirmLocation() {
    if (!marker) return;
    setReverseLoading(true);
    setReverseFailed(false);
    const { label, city: revCity } = await nominatimReverse(marker.lat, marker.lng);
    setReverseLoading(false);
    if (label) {
      setAddressText(label);
    } else {
      setAddressText("");
      setReverseFailed(true);
    }
    // On ne remplace la ville que si le reverse en a trouvé une (sinon on garde
    // celle déjà présente en édition, jamais de valeur inventée).
    if (revCity) setCity(revCity);
    setStep("details");
  }

  async function save() {
    if (!marker) return;
    if (addressType === "apartment" && (!floor.trim() || !apt.trim())) {
      return toast.error("Étage et numéro de porte requis");
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSaving(false);
      return toast.error("Connexion requise");
    }

    const row = {
      user_id: u.user.id,
      label: label.trim() || null,
      address_type: addressType,
      floor_number: addressType === "apartment" ? floor.trim() : null,
      apartment_number: addressType === "apartment" ? apt.trim() : null,
      additional_info: additional.trim() || null,
      full_address: addressText.trim() || null,
      latitude: marker.lat,
      longitude: marker.lng,
      is_default: isDefault,
      city: city.trim() || null,
    };

    let resultId: string | null = null;
    let error: { message: string } | null = null;
    if (editing) {
      const res = await supabase
        .from("addresses" as never)
        .update(row as never)
        .eq("id", editing.id)
        .select("id")
        .single();
      error = res.error;
      resultId = (res.data as { id: string } | null)?.id ?? editing.id;
    } else {
      const res = await supabase
        .from("addresses" as never)
        .insert(row as never)
        .select("id")
        .single();
      error = res.error;
      resultId = (res.data as { id: string } | null)?.id ?? null;
    }
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    // Gestion de la photo une fois l'id d'adresse connu (chemin = {uid}/{id}/…).
    let photoWarning: string | null = null;
    if (resultId && photoFile) {
      const { path, error: upErr } = await uploadAddressPhoto(u.user.id, resultId, photoFile);
      if (upErr || !path) {
        photoWarning = "Adresse enregistrée, mais la photo n'a pas pu être envoyée.";
      } else {
        const { error: linkErr } = await supabase
          .from("addresses" as never)
          .update({ photo_url: path } as never)
          .eq("id", resultId);
        if (linkErr) photoWarning = "Adresse enregistrée, mais la photo n'a pas pu être liée.";
      }
    } else if (resultId && removePhoto && editing?.photo_url) {
      await supabase
        .from("addresses" as never)
        .update({ photo_url: null } as never)
        .eq("id", resultId);
    }

    setSaving(false);
    if (photoWarning) toast.warning(photoWarning);
    else toast.success(editing ? "Adresse mise à jour" : "Adresse enregistrée");
    if (resultId) onSaved?.(resultId);
    onClose();
  }

  const mapReady = center !== null;

  return (
    // z-index cohérent avec le design system : la modale/plein écran passe sous
    // la bottom nav (--z-bottom-nav) qui reste ainsi visible et fonctionnelle,
    // tandis que le bouton de confirmation est dégagé au-dessus d'elle (voir plus bas).
    <div className="fixed inset-0 z-[var(--z-product-modal)] flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <button
          onClick={step === "details" ? () => setStep("map") : onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-base font-bold">
          {step === "map" ? "Choisir sur la carte" : "Détails de l'adresse"}
        </h2>
        <div className="w-10" />
      </div>

      {step === "map" ? (
        <div className="relative flex-1">
          {!mapReady && !centerError && (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement de la carte…
            </div>
          )}
          {centerError && !mapReady && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-neutral-600">
                Impossible de localiser le restaurant. Vérifiez votre connexion.
              </p>
              <button
                onClick={() => {
                  geocodedRef.current = false;
                  setCenterError(false);
                }}
                className="rounded-full bg-[#E11D2E] px-5 py-2 text-sm font-bold text-white"
              >
                Réessayer
              </button>
            </div>
          )}
          {mapReady && center && (
            <MapContainer
              center={[center.lat, center.lng]}
              zoom={16}
              className="h-full w-full"
              zoomControl={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <Recenter center={center} />
              {marker && (
                <Marker
                  position={[marker.lat, marker.lng]}
                  icon={markerIcon}
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
                      const ll = e.target.getLatLng();
                      setMarker({ lat: ll.lat, lng: ll.lng });
                    },
                  }}
                />
              )}
            </MapContainer>
          )}

          {/* My location button */}
          {mapReady && (
            <button
              onClick={useMyLocation}
              className="absolute right-4 top-4 z-[500] flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold shadow-md ring-1 ring-black/5"
            >
              <LocateFixed className="h-4 w-4 text-[#E11D2E]" />
              Ma position
            </button>
          )}

          {/* Search bar + results */}
          {mapReady && (
            // paddingBottom dynamique = padding d'origine (1rem) + hauteur réelle de
            // la bottom nav mesurée au runtime (--bottom-nav-height, cf. BottomNavBar).
            // Aucune valeur en dur : sur un écran sans nav la variable vaut 0px.
            // Le bouton de confirmation reste ainsi visible au-dessus de la nav, et
            // la barre de recherche/résultats (au-dessus, séparés par space-y-2) ne
            // le chevauchent pas.
            <div
              className="absolute inset-x-0 bottom-0 z-[500] space-y-2 bg-gradient-to-t from-white via-white/95 to-transparent p-4 pt-8"
              style={{ paddingBottom: "calc(1rem + var(--bottom-nav-height))" }}
            >
              {results.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-2xl border bg-white shadow-lg">
                  {results.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCenter({ lat: r.lat, lng: r.lng });
                        setMarker({ lat: r.lat, lng: r.lng });
                        setResults([]);
                        setQuery("");
                      }}
                      className="block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-neutral-50"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={runSearch}
                className="flex items-center gap-2 rounded-full border bg-white px-3 shadow-md"
              >
                <Search className="h-4 w-4 text-neutral-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Chercher par rue, quartier…"
                  className="h-11 flex-1 bg-transparent outline-none"
                />
                {searching && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
              </form>
              <button
                onClick={confirmLocation}
                disabled={!marker || reverseLoading}
                className="h-12 w-full rounded-full bg-[#E11D2E] font-bold text-white shadow-lg disabled:opacity-50"
              >
                {reverseLoading ? "Chargement…" : "Confirmer cette position"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-md space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold">Adresse</label>
              <textarea
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                rows={3}
                placeholder="Rue, immeuble, ville…"
                className="w-full rounded-xl border bg-white p-3 text-sm"
              />
              {reverseFailed && (
                <p className="text-xs text-neutral-500">
                  Adresse non trouvée automatiquement, vous pouvez la saisir manuellement.
                </p>
              )}
              {marker && (
                <p className="text-xs text-neutral-400">
                  {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Type de logement</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: "house", l: "Maison" },
                  { v: "apartment", l: "Appartement" },
                  { v: "office", l: "Bureau" },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setAddressType(opt.v as typeof addressType)}
                    className={`h-10 rounded-full border px-4 text-sm font-semibold transition ${
                      addressType === opt.v
                        ? "border-[#E11D2E] bg-[#E11D2E] text-white"
                        : "border-neutral-300 bg-white text-neutral-800"
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            {addressType === "apartment" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-semibold">Étage</label>
                  <input
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="h-11 w-full rounded-xl border bg-white px-3 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold">N° de porte</label>
                  <input
                    value={apt}
                    onChange={(e) => setApt(e.target.value)}
                    className="h-11 w-full rounded-xl border bg-white px-3 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-semibold">Informations complémentaires</label>
              <textarea
                value={additional}
                onChange={(e) => setAdditional(e.target.value)}
                rows={2}
                placeholder="Point de repère, instructions livreur…"
                className="w-full rounded-xl border bg-white p-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Photo du logement (optionnel)</label>
              {/* Input file toujours monté : déclenché par "Ajouter" ou "Changer". */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={onPickPhoto}
                className="hidden"
              />
              {photoPreview && !previewBroken ? (
                <div className="space-y-2">
                  <div className="relative w-full overflow-hidden rounded-xl border">
                    <img
                      key={photoPreview}
                      src={photoPreview}
                      alt="Photo du logement"
                      className="h-40 w-full object-cover"
                      onError={() => setPreviewBroken(true)}
                    />
                    <button
                      type="button"
                      onClick={clearPhoto}
                      className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-red-600 shadow"
                      aria-label="Retirer la photo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={openPhotoPicker}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                  >
                    <ImagePlus className="h-4 w-4" />
                    Changer la photo
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openPhotoPicker}
                  className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed bg-neutral-50 text-sm text-neutral-500 hover:bg-neutral-100"
                >
                  <ImagePlus className="h-5 w-5" />
                  {previewBroken ? "Photo indisponible — en ajouter une" : "Ajouter une photo"}
                </button>
              )}
              {photoError ? (
                <p className="text-xs text-red-600">{photoError}</p>
              ) : (
                <p className="text-xs text-neutral-400">JPG ou PNG, 2 Mo maximum.</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold">Label</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Maison, Bureau…"
                className="h-11 w-full rounded-xl border bg-white px-3 text-sm"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 accent-[#E11D2E]"
              />
              Définir comme adresse par défaut
            </label>

            <button
              onClick={save}
              disabled={saving}
              className="h-12 w-full rounded-full bg-[#E11D2E] font-bold text-white disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Enregistrer l'adresse"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
