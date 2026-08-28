"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { BirthdayPartyOption } from "@/lib/open-play/check-in-client";

export const PENDING_SELF_CHECK_IN_KEY = "jumpingjax:pending-self-check-in";

type Language = "en" | "es" | "fr" | "pt";
type VisitType = "birthday" | "open_play";
type Screen = "language" | "visit" | "form" | "complete";
type SearchState = "idle" | "searching" | "results" | "checking-in";
type WaiverMatch = {
  source: "native" | "legacy";
  participantId: string;
  firstName: string;
  lastName: string;
  ageYears: number;
  dobYmd: string;
};

const copy = {
  en: {
    language: "Choose your language",
    languageSub: "Select a language to begin",
    more: "More languages",
    welcome: "Welcome to Jumping Jax",
    hereFor: "What are you here for today?",
    birthday: "A birthday party",
    birthdaySub: "Join a party happening today",
    openPlay: "Open Play",
    openPlaySub: "Regular admission",
    chooseParty: "Choose the birthday party",
    noParties: "There are no birthday parties scheduled for today. Please ask the front desk for help.",
    back: "Back",
    heading: "Check yourself in",
    formSub: "Enter the name on the signed waiver. Age is optional.",
    first: "First name",
    last: "Last name",
    age: "Age (optional)",
    search: "Check for waiver",
    searching: "Checking for waiver…",
    chooseWaiver: "Choose the correct waiver",
    chooseWaiverSub: "Tap the correct person to continue.",
    attending: "Attending",
    payment: "How will you pay?",
    cash: "Cash",
    card: "Card",
    confirm: "Confirm I am at Jumping Jax",
    checking: "Checking in…",
    missing: "No current waiver found",
    missingSub: "Check the spelling and age, or sign a new waiver.",
    waiverPrompt: "No waiver yet? Sign one now.",
    signWaiver: "Sign a waiver",
    complete: "You’re checked in!",
    completeSub: "You’re all set. Please see the front desk if you need help.",
    another: "Check in another person",
    changeLanguage: "Change language",
  },
  es: {
    language: "Elige tu idioma",
    languageSub: "Selecciona un idioma para comenzar",
    more: "Más idiomas",
    welcome: "Bienvenido a Jumping Jax",
    hereFor: "¿A qué vienes hoy?",
    birthday: "Una fiesta de cumpleaños",
    birthdaySub: "Únete a una fiesta de hoy",
    openPlay: "Juego libre",
    openPlaySub: "Entrada regular",
    chooseParty: "Elige la fiesta de cumpleaños",
    noParties: "No hay fiestas programadas para hoy. Pide ayuda en la recepción.",
    back: "Atrás",
    heading: "Regístrate",
    formSub: "Escribe el nombre del formulario firmado. La edad es opcional.",
    first: "Nombre",
    last: "Apellido",
    age: "Edad (opcional)",
    search: "Buscar formulario",
    searching: "Buscando…",
    chooseWaiver: "Elige el formulario correcto",
    chooseWaiverSub: "Toca la persona correcta para continuar.",
    attending: "Asistiendo a",
    payment: "¿Cómo vas a pagar?",
    cash: "Efectivo",
    card: "Tarjeta",
    confirm: "Confirmar que estoy en Jumping Jax",
    checking: "Registrando…",
    missing: "No encontramos un formulario vigente",
    missingSub: "Revisa el nombre y la edad, o firma uno nuevo.",
    waiverPrompt: "¿No tienes formulario? Fírmalo ahora.",
    signWaiver: "Firmar formulario",
    complete: "¡Registro completado!",
    completeSub: "Todo está listo. Pide ayuda en la recepción si la necesitas.",
    another: "Registrar a otra persona",
    changeLanguage: "Cambiar idioma",
  },
  fr: {
    language: "Choisissez votre langue", languageSub: "Sélectionnez une langue pour commencer", more: "Plus de langues", welcome: "Bienvenue à Jumping Jax", hereFor: "Pourquoi êtes-vous ici aujourd’hui?", birthday: "Une fête d’anniversaire", birthdaySub: "Rejoindre une fête aujourd’hui", openPlay: "Jeu libre", openPlaySub: "Admission régulière", chooseParty: "Choisissez la fête", noParties: "Aucune fête n’est prévue aujourd’hui. Demandez de l’aide à l’accueil.", back: "Retour", heading: "Enregistrez-vous", formSub: "Entrez le nom sur la décharge signée. L’âge est facultatif.", first: "Prénom", last: "Nom", age: "Âge (facultatif)", search: "Rechercher la décharge", searching: "Recherche…", chooseWaiver: "Choisissez la bonne décharge", chooseWaiverSub: "Touchez la bonne personne pour continuer.", attending: "Participe à", payment: "Comment paierez-vous?", cash: "Espèces", card: "Carte", confirm: "Confirmer ma présence", checking: "Enregistrement…", missing: "Aucune décharge valide trouvée", missingSub: "Vérifiez le nom et l’âge, ou signez une nouvelle décharge.", waiverPrompt: "Pas encore de décharge? Signez-la maintenant.", signWaiver: "Signer une décharge", complete: "Vous êtes enregistré!", completeSub: "Tout est prêt. Adressez-vous à l’accueil si nécessaire.", another: "Enregistrer une autre personne", changeLanguage: "Changer de langue",
  },
  pt: {
    language: "Escolha seu idioma", languageSub: "Selecione um idioma para começar", more: "Mais idiomas", welcome: "Bem-vindo ao Jumping Jax", hereFor: "Por que você está aqui hoje?", birthday: "Uma festa de aniversário", birthdaySub: "Participar de uma festa de hoje", openPlay: "Brincadeira livre", openPlaySub: "Entrada regular", chooseParty: "Escolha a festa de aniversário", noParties: "Não há festas agendadas para hoje. Peça ajuda na recepção.", back: "Voltar", heading: "Faça seu check-in", formSub: "Digite o nome do termo assinado. A idade é opcional.", first: "Nome", last: "Sobrenome", age: "Idade (opcional)", search: "Procurar termo", searching: "Procurando…", chooseWaiver: "Escolha o termo correto", chooseWaiverSub: "Toque na pessoa correta para continuar.", attending: "Participando de", payment: "Como você vai pagar?", cash: "Dinheiro", card: "Cartão", confirm: "Confirmar que estou no Jumping Jax", checking: "Fazendo check-in…", missing: "Nenhum termo válido encontrado", missingSub: "Confira o nome e a idade ou assine um novo termo.", waiverPrompt: "Ainda não tem um termo? Assine agora.", signWaiver: "Assinar termo", complete: "Check-in concluído!", completeSub: "Tudo pronto. Fale com a recepção se precisar de ajuda.", another: "Fazer check-in de outra pessoa", changeLanguage: "Mudar idioma",
  },
} as const;

const languageChoices: Array<{ id: Language; label: string; native: string }> = [
  { id: "en", label: "English", native: "English" },
  { id: "es", label: "Spanish", native: "Español" },
  { id: "fr", label: "French", native: "Français" },
  { id: "pt", label: "Portuguese", native: "Português" },
];

const fieldClass = "mt-2 min-h-16 w-full rounded-2xl border-2 border-slate-300 bg-white px-5 text-xl outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100";
const choiceClass = "w-full rounded-[1.4rem] border-2 border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200";

export function SelfCheckInClient({
  birthdayParties,
  businessDayYmd,
}: {
  birthdayParties: BirthdayPartyOption[];
  businessDayYmd: string;
}) {
  const [language, setLanguage] = useState<Language | null>(null);
  const [showMoreLanguages, setShowMoreLanguages] = useState(false);
  const [screen, setScreen] = useState<Screen>("language");
  const [visitType, setVisitType] = useState<VisitType | null>(null);
  const [birthdayPartyId, setBirthdayPartyId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<WaiverMatch[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | null>(null);

  const t = copy[language ?? "en"];
  const selectedParty = useMemo(
    () => birthdayParties.find((party) => party.id === birthdayPartyId) ?? null,
    [birthdayParties, birthdayPartyId],
  );
  const waiverHref = selectedParty
    ? `/waiver?${new URLSearchParams({
        source: "facility-party",
        booking: selectedParty.id,
        date: businessDayYmd,
        arrival: "1",
      }).toString()}`
    : "/waiver";

  useEffect(() => {
    const saved = window.sessionStorage.getItem(PENDING_SELF_CHECK_IN_KEY);
    if (!saved) return;
    void Promise.resolve().then(() => {
      try {
        const pending = JSON.parse(saved) as { firstName?: string; lastName?: string; age?: number | null };
        setFirstName(pending.firstName ?? "");
        setLastName(pending.lastName ?? "");
        setAge(typeof pending.age === "number" ? String(pending.age) : "");
      } catch {
        window.sessionStorage.removeItem(PENDING_SELF_CHECK_IN_KEY);
      }
    });
  }, []);

  function resetResults() {
    setSearchState("idle");
    setMatches([]);
    setSelectedKey(null);
    setPaymentMethod(null);
    setError(null);
  }

  function chooseLanguage(next: Language) {
    setLanguage(next);
    setScreen("visit");
  }

  function chooseVisit(next: VisitType) {
    setVisitType(next);
    setBirthdayPartyId("");
    resetResults();
    if (next === "open_play") setScreen("form");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (searchState === "searching" || searchState === "checking-in") return;
    setSearchState("searching");
    setError(null);
    try {
      const response = await fetch("/api/open-play/self-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), age: age === "" ? null : Number(age) }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; matches?: WaiverMatch[]; error?: string } | null;
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Waiver search could not be completed.");
      setMatches(result.matches ?? []);
      setSearchState("results");
    } catch (caught) {
      setSearchState("idle");
      setError(caught instanceof Error ? caught.message : "Waiver search could not be completed.");
    }
  }

  async function checkIn(match: WaiverMatch) {
    if (searchState === "checking-in") return;
    setSearchState("checking-in");
    setError(null);
    try {
      const response = await fetch("/api/open-play/self-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          age: age === "" ? null : Number(age),
          mode: "check-in",
          source: match.source,
          participantId: match.participantId,
          paymentMethod: visitType === "birthday" ? "birthday_party" : paymentMethod,
          birthdayPartyId: visitType === "birthday" ? birthdayPartyId : null,
        }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; needsWaiver?: boolean; error?: string } | null;
      if (result?.needsWaiver) throw new Error("That waiver is no longer available. Please search again.");
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Check-in could not be completed.");
      window.sessionStorage.removeItem(PENDING_SELF_CHECK_IN_KEY);
      setScreen("complete");
    } catch (caught) {
      setSearchState("results");
      setError(caught instanceof Error ? caught.message : "Check-in could not be completed.");
    }
  }

  function startAnother() {
    setVisitType(null); setBirthdayPartyId(""); setFirstName(""); setLastName(""); setAge(""); resetResults(); setScreen("visit");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#cffafe_0,#fff8e8_46%,#fce7f3_100%)] px-4 py-7 text-slate-950 sm:py-12">
      <section className="mx-auto w-full max-w-2xl rounded-[2rem] border-2 border-white bg-white/95 p-5 shadow-[0_22px_60px_rgba(15,23,42,0.14)] sm:p-9">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-800">Jumping Jax Check-In</p>
          {language ? <button type="button" onClick={() => setScreen("language")} className="rounded-full bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-900">🌐 {t.changeLanguage}</button> : null}
        </div>

        {screen === "language" ? (
          <div className="py-5 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-cyan-100 text-3xl" aria-hidden="true">🌐</div>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">{t.language}</h1>
            <p className="mt-3 text-lg font-semibold text-slate-600">{t.languageSub}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {languageChoices.slice(0, showMoreLanguages ? 4 : 2).map((item) => (
                <button key={item.id} type="button" onClick={() => chooseLanguage(item.id)} className={choiceClass}>
                  <span className="block text-2xl font-black">{item.native}</span>
                  <span className="mt-1 block text-sm font-bold text-slate-500">{item.label}</span>
                </button>
              ))}
            </div>
            {!showMoreLanguages ? <button type="button" onClick={() => setShowMoreLanguages(true)} className="mt-6 font-black text-cyan-800 underline decoration-2 underline-offset-4">+ {t.more}</button> : null}
          </div>
        ) : null}

        {screen === "visit" ? (
          <div className="py-5">
            <h1 className="text-center text-4xl font-black tracking-tight sm:text-5xl">{t.welcome}</h1>
            <p className="mt-3 text-center text-lg font-semibold text-slate-600">{t.hereFor}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <button type="button" onClick={() => chooseVisit("birthday")} className={choiceClass}>
                <span className="text-4xl" aria-hidden="true">🎉</span><span className="mt-5 block text-2xl font-black">{t.birthday}</span><span className="mt-1 block font-semibold text-slate-600">{t.birthdaySub}</span>
              </button>
              <button type="button" onClick={() => chooseVisit("open_play")} className={choiceClass}>
                <span className="text-4xl" aria-hidden="true">🛝</span><span className="mt-5 block text-2xl font-black">{t.openPlay}</span><span className="mt-1 block font-semibold text-slate-600">{t.openPlaySub}</span>
              </button>
            </div>
            {visitType === "birthday" ? (
              <div className="mt-7 rounded-3xl border-2 border-orange-200 bg-orange-50 p-5">
                <h2 className="text-xl font-black text-orange-950">{t.chooseParty}</h2>
                {birthdayParties.length ? (
                  <div className="mt-4 grid gap-3">
                    {birthdayParties.map((party) => <button key={party.id} type="button" onClick={() => { setBirthdayPartyId(party.id); setScreen("form"); }} className="min-h-16 rounded-2xl border-2 border-orange-300 bg-white px-5 text-left text-lg font-black text-orange-950 transition hover:border-orange-600 focus-visible:ring-4 focus-visible:ring-orange-200">{party.label}</button>)}
                  </div>
                ) : <p className="mt-3 font-bold leading-7 text-amber-900">{t.noParties}</p>}
              </div>
            ) : null}
          </div>
        ) : null}

        {screen === "form" ? (
          <>
            <button type="button" onClick={() => { setScreen("visit"); setVisitType(null); }} className="mt-5 font-black text-cyan-800">← {t.back}</button>
            <h1 className="mt-4 text-center text-4xl font-black tracking-tight sm:text-5xl">{t.heading}</h1>
            {selectedParty ? <p className="mx-auto mt-4 max-w-lg rounded-2xl border-2 border-orange-200 bg-orange-50 p-4 text-center font-black text-orange-950">🎉 {t.attending}: {selectedParty.label}</p> : null}
            <p className="mx-auto mt-4 max-w-md text-center font-semibold leading-7 text-slate-600">{t.formSub}</p>
            <form onSubmit={submit} className="mt-7 grid gap-5">
              <label className="font-black text-slate-800">{t.first}<input autoComplete="given-name" value={firstName} onChange={(event) => { setFirstName(event.target.value); resetResults(); }} maxLength={100} required className={fieldClass} /></label>
              <label className="font-black text-slate-800">{t.last}<input autoComplete="family-name" value={lastName} onChange={(event) => { setLastName(event.target.value); resetResults(); }} maxLength={100} required className={fieldClass} /></label>
              <label className="font-black text-slate-800">{t.age}<input type="number" inputMode="numeric" min="0" max="120" value={age} onChange={(event) => { setAge(event.target.value); resetResults(); }} className={fieldClass} /></label>
              {error ? <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-800">{error}</p> : null}
              <button type="submit" disabled={searchState === "searching" || searchState === "checking-in"} className="min-h-16 rounded-full bg-emerald-600 px-6 text-xl font-black text-white shadow-[0_6px_0_#047857] active:translate-y-1 active:shadow-none disabled:opacity-60">{searchState === "searching" ? t.searching : t.search}</button>
            </form>

            {searchState === "results" || searchState === "checking-in" ? (
              <section className="mt-7" aria-live="polite">
                {matches.length ? <><h2 className="text-center text-2xl font-black">{t.chooseWaiver}</h2><p className="mt-2 text-center font-semibold text-slate-600">{t.chooseWaiverSub}</p><div className="mt-4 grid gap-3">
                  {matches.map((match) => {
                    const key = `${match.source}:${match.participantId}`;
                    const selected = selectedKey === key;
                    return <article key={key} className="rounded-2xl border-2 border-cyan-300 bg-cyan-50 p-4 text-cyan-950 shadow-sm">
                      <button type="button" aria-expanded={selected} disabled={searchState === "checking-in"} onClick={() => { setSelectedKey(selected ? null : key); setPaymentMethod(null); }} className="min-h-14 w-full text-left text-xl font-black disabled:opacity-60">{match.firstName} {match.lastName} <span className="block text-sm font-bold text-cyan-800">{t.age}: {match.ageYears}</span></button>
                      {selected ? <div className="border-t border-cyan-200 pt-4">
                        {visitType === "open_play" ? <fieldset><legend className="font-black">{t.payment}</legend><div className="mt-2 grid grid-cols-2 gap-2">{(["cash", "card"] as const).map((method) => <button key={method} type="button" aria-pressed={paymentMethod === method} onClick={() => setPaymentMethod(method)} className={paymentMethod === method ? "min-h-12 rounded-xl bg-emerald-600 font-black text-white" : "min-h-12 rounded-xl border-2 border-emerald-500 bg-white font-black text-emerald-900"}>{method === "cash" ? t.cash : t.card}</button>)}</div></fieldset> : null}
                        <button type="button" disabled={(visitType === "open_play" && !paymentMethod) || searchState === "checking-in"} onClick={() => void checkIn(match)} className="mt-4 min-h-14 w-full rounded-full bg-slate-950 px-5 text-lg font-black text-white disabled:opacity-45">{searchState === "checking-in" ? t.checking : t.confirm}</button>
                      </div> : null}
                    </article>;
                  })}
                </div></> : <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 text-center"><h2 className="text-xl font-black text-amber-950">{t.missing}</h2><p className="mt-2 font-semibold text-amber-900">{t.missingSub}</p></div>}
              </section>
            ) : null}
            <p className="mt-7 text-center text-sm font-semibold text-slate-600">{t.waiverPrompt}</p>
            <Link href={waiverHref} onClick={() => window.sessionStorage.setItem(PENDING_SELF_CHECK_IN_KEY, JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), age: age === "" ? null : Number(age) }))} className="mt-3 flex min-h-14 items-center justify-center rounded-full border-2 border-orange-300 bg-orange-50 px-5 text-lg font-black text-orange-900">{t.signWaiver}</Link>
          </>
        ) : null}

        {screen === "complete" ? (
          <div className="py-10 text-center" role="status"><div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-4xl" aria-hidden="true">✓</div><h1 className="mt-5 text-4xl font-black tracking-tight text-emerald-950">{t.complete}</h1>{selectedParty ? <p className="mt-4 rounded-2xl bg-orange-50 p-4 font-black text-orange-950">🎉 {selectedParty.label}</p> : null}<p className="mt-4 text-lg font-semibold leading-8 text-slate-700">{t.completeSub}</p><button type="button" onClick={startAnother} className="mt-8 min-h-14 w-full rounded-full bg-slate-950 px-6 text-lg font-black text-white">{t.another}</button></div>
        ) : null}
      </section>
    </main>
  );
}
