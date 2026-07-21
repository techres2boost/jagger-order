import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BoxLogo } from "@/components/BoxLogo";
import { z } from "zod";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
});

function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s|-/g, "");
  if (!trimmed) return null;
  // Must be E.164 format: +[country code][number]
  if (/^\+[1-9]\d{6,14}$/.test(trimmed)) return trimmed;
  return null;
}

async function upsertProfileFromUser() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    (meta.full_name as string) ||
    (meta.name as string) ||
    [meta.given_name, meta.family_name].filter(Boolean).join(" ").trim() ||
    null;
  const phone = user.phone || (meta.phone as string) || null;

  const patch: { full_name?: string; phone?: string } = {};
  if (fullName) patch.full_name = fullName;
  if (phone) patch.phone = phone;
  if (Object.keys(patch).length === 0) return;

  // Trigger already inserted the row; update non-empty fields only.
  await supabase.from("profiles").update(patch).eq("id", user.id);
}

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState("");
  const [localPhone, setLocalPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  async function goPostLogin() {
    await upsertProfileFromUser();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const roleValues = (roles ?? []).map((r) => r.role);
      if (roleValues.includes("admin")) return navigate({ to: "/admin" });
      if (roleValues.includes("livreur")) return navigate({ to: "/livreur" });
    }
    navigate({ to: search.redirect ?? "/" });
  }

  async function handleGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${search.redirect ?? "/"}` },
    });
    if (error) {
      setLoading(false);
      toast.error("Connexion Google échouée : " + error.message);
    }
    // Otherwise browser is redirecting; no navigate needed here.
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    // Le badge fixe "+216" est concaténé au numéro local pour obtenir l'E.164.
    const normalized = normalizePhone("+216" + localPhone);
    if (!normalized) {
      return toast.error("Numéro invalide. Format attendu : +216XXXXXXXX");
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
    setLoading(false);
    if (error) return toast.error("Envoi du code échoué : " + error.message);
    setPhone(normalized);
    setOtpSent(true);
    toast.success("Code envoyé par SMS");
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim()) return toast.error("Entrez le code reçu par SMS");
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otp.trim(),
      type: "sms",
    });
    if (error) {
      setLoading(false);
      return toast.error("Code invalide ou expiré");
    }
    await goPostLogin();
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <Link to="/" className="mb-6">
        <BoxLogo size={80} />
      </Link>

      <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-sm space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-black">Se connecter</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Continuez avec Google ou votre numéro de téléphone
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-full border bg-white font-semibold text-black shadow-sm hover:bg-neutral-50 disabled:opacity-50"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.8l-6.5 5C9.6 39.6 16.2 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.6 35.8 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z"
            />
          </svg>
          Continuer avec Google
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold uppercase text-muted-foreground">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {!otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-3">
            <label className="block text-sm font-semibold">Numéro de téléphone</label>
            <div className="flex h-12 items-stretch overflow-hidden rounded-xl border bg-input">
              <span className="flex shrink-0 items-center gap-1 border-r px-4 font-semibold">
                🇹🇳 +216
              </span>
              <input
                required
                type="tel"
                inputMode="tel"
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value)}
                placeholder="12 345 678"
                className="h-full w-full flex-1 bg-transparent px-4 outline-none"
              />
            </div>
            <button
              disabled={loading}
              className="h-12 w-full rounded-full bg-brand font-bold text-brand-foreground disabled:opacity-50"
            >
              {loading ? "Envoi…" : "Envoyer le code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <label className="block text-sm font-semibold">Code de vérification</label>
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              maxLength={6}
              className="h-12 w-full rounded-xl border bg-input px-4 text-center text-lg tracking-[0.5em] font-bold"
            />
            <p className="text-xs text-muted-foreground">Code envoyé au {phone}.</p>
            <button
              disabled={loading}
              className="h-12 w-full rounded-full bg-brand font-bold text-brand-foreground disabled:opacity-50"
            >
              {loading ? "Vérification…" : "Confirmer"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOtpSent(false);
                setOtp("");
              }}
              className="w-full text-sm font-semibold text-muted-foreground"
            >
              ← Changer de numéro
            </button>
          </form>
        )}
      </div>

      <Link to="/" className="mt-6 text-sm font-semibold text-muted-foreground">
        ← Continuer sans compte
      </Link>
    </div>
  );
}
