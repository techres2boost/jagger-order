import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";

const loadCompteClient = async () => (await import("@/components/CompteClient")).CompteClient;

function CompteClientLoader() {
  const [Component, setComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    let mounted = true;
    loadCompteClient().then((Loaded) => {
      if (mounted) setComponent(() => Loaded);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!Component) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p>Chargement…</p>
      </div>
    );
  }

  return <Component />;
}

export const Route = createFileRoute("/compte")({
  component: CompteClientLoader,
});
