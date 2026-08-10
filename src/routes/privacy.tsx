import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            aria-label="Retour à l'accueil"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <BrandLogo size={30} showWordmark={false} />
          <h1 className="text-lg font-black">Politique de confidentialité</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="rounded-[28px] border border-border bg-card p-6 shadow-[0_20px_40px_-24px_rgba(46,30,23,0.35)]">
          <h2 className="text-2xl font-black">Politique de confidentialité — Jagger</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dernière mise à jour : 29 juillet 2026
          </p>
          <p className="mt-4 text-sm leading-relaxed text-foreground">
            Jagger (« l’Application ») est une application de commande et de livraison de repas éditée
            par Res2Boost. La présente politique de confidentialité explique quelles données nous
            collectons, pourquoi, et comment elles sont utilisées et protégées.
          </p>

          <Section title="1. Données que nous collectons">
            <h4 className="font-bold">1.1 Données de compte</h4>
            <p className="text-sm text-muted-foreground">
              Lors de la création de votre compte, nous collectons :
            </p>
            <ul className="ml-5 list-disc space-y-1 text-sm">
              <li>Votre nom</li>
              <li>
                Votre numéro de téléphone (utilisé pour la connexion et la confirmation de commande)
              </li>
              <li>Votre adresse e-mail (si connexion via Google)</li>
            </ul>

            <h4 className="mt-4 font-bold">1.2 Données de localisation</h4>
            <ul className="ml-5 list-disc space-y-1 text-sm">
              <li>
                <span className="font-semibold">Clients :</span> l'adresse de livraison saisie
                manuellement lors de la commande.
              </li>
              <li>
                <span className="font-semibold">Livreurs :</span> la position GPS du livreur est
                collectée en temps réel pendant qu'une livraison est en cours, afin de permettre le
                suivi de la commande et l'optimisation des trajets. Cette localisation n'est pas
                collectée en dehors des périodes de livraison active.
              </li>
            </ul>

            <h4 className="mt-4 font-bold">1.3 Données de commande</h4>
            <p className="text-sm text-muted-foreground">
              Historique des commandes, articles commandés, montants, restaurant concerné, et
              évaluations données (plats, commande, livreur).
            </p>

            <h4 className="mt-4 font-bold">1.4 Notifications</h4>
            <p className="text-sm text-muted-foreground">
              Avec votre autorisation, l'Application envoie des notifications push pour vous
              informer de l'état de votre commande (confirmation, préparation, en livraison, livrée)
              et d'éventuelles offres du restaurant. Vous pouvez désactiver ces notifications à tout
              moment dans les réglages de votre appareil ou de l'Application.
            </p>
          </Section>

          <Section title="2. Paiement">
            <p className="text-sm text-muted-foreground">
              Le paiement des commandes s'effectue exclusivement en espèces à la livraison. Aucune
              donnée de carte bancaire ou d'information financière n'est collectée, stockée ou
              traitée par l'Application.
            </p>
          </Section>

          <Section title="3. Comment nous utilisons vos données">
            <p className="text-sm text-muted-foreground">
              Nous utilisons les données collectées pour :
            </p>
            <ul className="ml-5 list-disc space-y-1 text-sm">
              <li>Traiter et livrer vos commandes</li>
              <li>Vous authentifier et sécuriser votre compte</li>
              <li>Vous envoyer des notifications relatives à vos commandes</li>
              <li>Permettre le suivi en temps réel de la livraison</li>
              <li>Améliorer nos services et la qualité de livraison</li>
            </ul>
          </Section>

          <Section title="4. Partage des données">
            <p className="text-sm text-muted-foreground">Vos données ne sont partagées qu'avec :</p>
            <ul className="ml-5 list-disc space-y-1 text-sm">
              <li>Le restaurant concerné, pour la préparation de votre commande</li>
              <li>Le livreur assigné, pour effectuer la livraison</li>
              <li>
                Nos prestataires techniques (hébergement, base de données) dans le cadre strict du
                fonctionnement de l'Application
              </li>
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">
              Nous ne vendons ni ne louons vos données personnelles à des tiers à des fins
              commerciales.
            </p>
          </Section>

          <Section title="5. Conservation des données">
            <p className="text-sm text-muted-foreground">
              Vos données sont conservées aussi longtemps que votre compte est actif. Les données de
              localisation GPS des livreurs ne sont conservées que pour la durée nécessaire au suivi
              de la livraison et à des fins de support en cas de litige.
            </p>
          </Section>

          <Section title="6. Vos droits">
            <p className="text-sm text-muted-foreground">Vous pouvez à tout moment :</p>
            <ul className="ml-5 list-disc space-y-1 text-sm">
              <li>Demander l'accès à vos données personnelles</li>
              <li>Demander la correction ou la suppression de vos données</li>
              <li>Retirer votre consentement aux notifications push</li>
              <li>Supprimer votre compte</li>
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">
              Pour toute demande, contactez-nous à l'adresse indiquée ci-dessous.
            </p>
          </Section>

          <Section title="7. Sécurité">
            <p className="text-sm text-muted-foreground">
              Nous mettons en œuvre des mesures techniques raisonnables (authentification sécurisée,
              chiffrement des communications) pour protéger vos données contre tout accès non
              autorisé.
            </p>
          </Section>

          <Section title="8. Modifications de cette politique">
            <p className="text-sm text-muted-foreground">
              Cette politique de confidentialité peut être mise à jour périodiquement. Toute
              modification importante sera communiquée via l'Application.
            </p>
          </Section>

          <Section title="9. Contact">
            <p className="text-sm text-muted-foreground">
              Pour toute question concernant cette politique de confidentialité, contactez-nous à :{" "}
              <a href="mailto:contact@res2boost.com" className="font-semibold text-brand underline">
                contact@res2boost.com
              </a>
            </p>
          </Section>

          <p className="mt-8 border-t pt-4 text-sm font-semibold text-muted-foreground">
            Res2Boost — Jagger
          </p>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="text-lg font-black">{title}</h3>
      <div className="mt-2 space-y-2 text-foreground">{children}</div>
    </section>
  );
}
