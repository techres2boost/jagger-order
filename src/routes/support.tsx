import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/support")({
  component: SupportPage,
});

function SupportPage() {
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
          <h1 className="text-lg font-black">Support</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-brand">
            Jagger — par Res2Boost
          </p>
          <h2 className="mt-1 text-2xl font-black">Aide &amp; support</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Une question sur une commande, votre compte ou l'application ? Nous sommes là pour vous
            aider.
          </p>
        </div>

        {/* Nous contacter */}
        <section className="rounded-[28px] border border-border bg-card p-6 shadow-[0_20px_40px_-24px_rgba(46,30,23,0.35)]">
          <h3 className="text-lg font-black">Nous contacter</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Le moyen le plus rapide d'obtenir de l'aide est de nous écrire par e-mail. Notre équipe
            vous répond généralement sous 24 à 48 heures (jours ouvrés).
          </p>
          <div className="mt-3 rounded-2xl border border-border bg-surface-2 p-4 text-sm">
            <p>
              <span className="font-semibold">E-mail :</span>{" "}
              <a href="mailto:contact@res2boost.com" className="font-semibold text-brand underline">
                contact@res2boost.com
              </a>
            </p>
            <p className="mt-2 text-muted-foreground">
              Pour un traitement plus rapide, indiquez le numéro de téléphone ou l'adresse e-mail
              associé à votre compte Jagger, ainsi que le numéro de commande concerné le cas échéant.
            </p>
          </div>
        </section>

        {/* Questions fréquentes */}
        <section className="mt-4 rounded-[28px] border border-border bg-card p-6 shadow-[0_20px_40px_-24px_rgba(46,30,23,0.35)]">
          <h3 className="text-lg font-black">Questions fréquentes</h3>

          <div className="mt-3 space-y-4 text-sm">
            <div>
              <h4 className="font-bold">Un problème avec ma commande</h4>
              <p className="text-muted-foreground">
                Suivez l'état de votre commande directement dans l'application, onglet{" "}
                <strong>Commandes</strong>. En cas de retard, d'erreur ou d'article manquant,
                contactez-nous par e-mail en précisant votre numéro de commande.
              </p>
            </div>

            <div>
              <h4 className="font-bold">Paiement</h4>
              <p className="text-muted-foreground">
                Le paiement s'effectue en espèces à la livraison. Aucune donnée bancaire n'est
                collectée par l'application.
              </p>
            </div>

            <div>
              <h4 className="font-bold">Mon compte</h4>
              <p className="text-muted-foreground">
                Vous pouvez gérer votre profil depuis l'onglet <strong>Compte</strong>. Pour
                supprimer votre compte et vos données, consultez la page{" "}
                <Link to="/account-deletion" className="font-semibold text-brand underline">
                  Suppression de compte
                </Link>
                .
              </p>
            </div>

            <div>
              <h4 className="font-bold">Confidentialité</h4>
              <p className="text-muted-foreground">
                Découvrez quelles données nous collectons et comment elles sont utilisées dans notre{" "}
                <Link to="/privacy" className="font-semibold text-brand underline">
                  Politique de confidentialité
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-8 text-center text-sm text-muted-foreground">
          Jagger est un service de Res2Boost — Tunis, Tunisie
        </footer>
      </main>
    </div>
  );
}
