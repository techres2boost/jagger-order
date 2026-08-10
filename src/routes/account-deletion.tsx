import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/account-deletion")({
  component: AccountDeletionPage,
});

function AccountDeletionPage() {
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
          <h1 className="text-lg font-black">Suppression de compte</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-brand">
            Jagger — par Res2Boost
          </p>
          <h2 className="mt-1 text-2xl font-black">Suppression de compte et de données</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Comment demander la suppression de votre compte Jagger et de vos données personnelles.
          </p>
        </div>

        {/* Comment supprimer */}
        <section className="rounded-[28px] border border-border bg-card p-6 shadow-[0_20px_40px_-24px_rgba(46,30,23,0.35)]">
          <h3 className="text-lg font-black">Comment supprimer votre compte</h3>
          <ol className="mt-3 ml-5 list-decimal space-y-3 text-sm">
            <li>
              <span className="font-semibold text-brand">Depuis l'application Jagger :</span> ouvrez
              l'onglet <strong>Compte</strong>, faites défiler jusqu'à la section{" "}
              <strong>Actions sensibles</strong>, puis appuyez sur{" "}
              <strong>« Supprimer mon compte et mes données »</strong>. Confirmez votre choix pour
              finaliser la suppression.
            </li>
            <li>
              <span className="font-semibold text-brand">Sans accès à l'application :</span> envoyez
              une demande par e-mail à{" "}
              <a href="mailto:tech@res2boost.com" className="font-semibold text-brand underline">
                tech@res2boost.com
              </a>{" "}
              en précisant le numéro de téléphone ou l'adresse e-mail associé à votre compte Jagger.
              Votre demande sera traitée dans les meilleurs délais.
            </li>
          </ol>
        </section>

        {/* Données supprimées */}
        <section className="mt-4 rounded-[28px] border border-border bg-card p-6 shadow-[0_20px_40px_-24px_rgba(46,30,23,0.35)]">
          <h3 className="text-lg font-black">Quelles données sont supprimées</h3>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Donnée</th>
                  <th className="px-3 py-2 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {[
                  "Profil (nom, coordonnées de connexion)",
                  "Adresses de livraison enregistrées",
                  "Messages échangés avec les livreurs",
                  "Avis et notes laissés",
                  "Historique des commandes passées",
                ].map((label) => (
                  <tr key={label} className="border-t border-border">
                    <td className="px-3 py-2.5">{label}</td>
                    <td className="px-3 py-2.5 font-semibold text-brand">Supprimé</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            La suppression de votre compte entraîne l'effacement définitif de l'ensemble des données
            ci-dessus, y compris l'historique de vos commandes. Cette action est irréversible.
          </p>
        </section>

        {/* Aide */}
        <section className="mt-4 rounded-[28px] border border-border bg-card p-6 shadow-[0_20px_40px_-24px_rgba(46,30,23,0.35)]">
          <h3 className="text-lg font-black">Besoin d'aide ?</h3>
          <div className="mt-3 rounded-2xl border border-border bg-surface-2 p-4 text-sm">
            Pour toute question concernant vos données ou votre demande de suppression,
            contactez-nous à{" "}
            <a href="mailto:tech@res2boost.com" className="font-semibold text-brand underline">
              tech@res2boost.com
            </a>
            .
          </div>
        </section>

        <footer className="mt-8 text-center text-sm text-muted-foreground">
          Jagger est un service de Res2Boost — Tunis, Tunisie
        </footer>
      </main>
    </div>
  );
}
