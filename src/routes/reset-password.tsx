import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BoxLogo } from "@/components/BoxLogo";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Mot de passe mis à jour");
    navigate({ to: "/app" });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <BoxLogo size={64} />
      <form
        onSubmit={handle}
        className="mt-6 w-full max-w-md space-y-4 rounded-3xl border bg-card p-6 shadow-sm"
      >
        <h1 className="text-2xl font-black">Nouveau mot de passe</h1>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nouveau mot de passe"
          className="h-12 w-full rounded-xl border bg-input px-4"
        />
        <button
          disabled={loading}
          className="h-12 w-full rounded-full bg-brand font-bold text-brand-foreground disabled:opacity-50"
        >
          {loading ? "…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
