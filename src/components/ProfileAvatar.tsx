import { useRef, useState } from "react";
import { User as UserIcon, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyAvatarChanged, useAvatar } from "@/lib/use-avatar";

const AVATAR_BUCKET = "avatars";
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  userId: string;
}

// Avatar cliquable + boutons Changer / Supprimer. Le bucket "avatars" est public,
// on stocke sous {user_id}/avatar.{ext} et on écrit l'URL publique dans profiles.avatar_url.
export function ProfileAvatar({ userId }: Props) {
  const { avatarUrl, refresh } = useAvatar(userId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      return toast.error("Format non supporté (JPG, PNG ou WEBP).");
    }
    if (file.size > MAX_BYTES) {
      return toast.error("Image trop lourde (5 Mo maximum).");
    }
    setBusy(true);
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl } as never)
        .eq("id", userId);
      if (dbErr) throw dbErr;
      notifyAvatarChanged(publicUrl);
      await refresh();
      toast.success("Photo de profil mise à jour");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!avatarUrl) return;
    if (!confirm("Supprimer votre photo de profil ?")) return;
    setBusy(true);
    try {
      // Supprime tous les avatars du dossier utilisateur (jpg/png/webp).
      const paths = ["jpg", "png", "webp"].map((e) => `${userId}/avatar.${e}`);
      await supabase.storage.from(AVATAR_BUCKET).remove(paths);
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: null } as never)
        .eq("id", userId);
      if (dbErr) throw dbErr;
      notifyAvatarChanged(null);
      await refresh();
      toast.success("Photo supprimée");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={avatarUrl ? "Changer la photo de profil" : "Ajouter une photo de profil"}
        className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 text-neutral-500 shadow-sm transition hover:brightness-95 disabled:opacity-60"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserIcon className="h-10 w-10" />
        )}
        <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-brand-foreground shadow">
          <Camera className="h-3.5 w-3.5" />
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="h-9 rounded-full bg-brand px-4 text-xs font-semibold text-brand-foreground disabled:opacity-50"
        >
          {busy ? "…" : avatarUrl ? "Changer la photo" : "Ajouter une photo"}
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="h-9 rounded-full border border-neutral-300 px-4 text-xs font-semibold text-neutral-700 disabled:opacity-50"
          >
            Supprimer la photo
          </button>
        )}
      </div>
    </div>
  );
}
