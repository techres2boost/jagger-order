import { createFileRoute } from "@tanstack/react-router";
import { MenuPage } from "@/components/MenuPage";

export const Route = createFileRoute("/")({
  component: MenuPage,
});
