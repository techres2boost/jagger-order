import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MenuPage } from "@/components/MenuPage";

// Paramètre de requête optionnel : ?promo=WELCOME10 (bannière offre de bienvenue).
const searchSchema = z.object({
  promo: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  component: MenuPage,
});
