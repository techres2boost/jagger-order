import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/verify-email")({
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const [cooldown, setCooldown] = useState(0);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/auth" });
      else if (data.user.email_confirmed_at || data.user.confirmed_at) navigate({ to: "/app" });
      else setEmail(data.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user?.email_confirmed_at || s?.user?.confirmed_at) navigate({ to: "/app" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function resend() {
    if (!email || cooldown > 0) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Nouveau lien envoyé");
      setCooldown(60);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <BrandLogo size={64} />
      <div className="mt-6 w-full max-w-md rounded-3xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent">
          <Mail className="h-8 w-8 text-brand" />
        </div>
        <h1 className="mt-4 text-2xl font-black">Vérifiez votre email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Un lien de confirmation a été envoyé{email ? ` à ${email}` : ""}.
          <br />
          Cliquez dessus pour activer votre compte.
        </p>
        <button
          onClick={resend}
          disabled={cooldown > 0}
          className="mt-6 h-11 w-full rounded-full bg-brand font-bold text-brand-foreground disabled:opacity-50"
        >
          {cooldown > 0 ? `Renvoyer dans ${cooldown}s` : "Renvoyer le lien"}
        </button>
        <p className="mt-4 text-xs text-muted-foreground">
          Lien expiré ou déjà utilisé ? Utilisez le bouton ci-dessus pour recevoir un nouveau lien.
        </p>
        <Link to="/app" className="mt-4 inline-block text-sm font-semibold text-muted-foreground">
          ← Consulter le menu
        </Link>
      </div>
    </div>
  );
}
