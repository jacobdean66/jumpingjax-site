import type { WaiverLanguage } from "./localization";
const labels: Record<string, [string, string, string]> = {
  "Your group’s information": [
    "Información de su grupo",
    "Informations de votre groupe",
    "Informações do seu grupo",
  ],
  "Read, agree and sign": [
    "Leer, aceptar y firmar",
    "Lire, accepter et signer",
    "Ler, concordar e assinar",
  ],
  "Adult’s first name": [
    "Nombre del adulto",
    "Prénom de l’adulte",
    "Nome do adulto",
  ],
  "Adult’s last name": [
    "Apellido del adulto",
    "Nom de famille de l’adulte",
    "Sobrenome do adulto",
  ],
  "Adult’s email address": [
    "Correo electrónico del adulto",
    "Adresse courriel de l’adulte",
    "E-mail do adulto",
  ],
  "Adult’s phone number": [
    "Teléfono del adulto",
    "Téléphone de l’adulte",
    "Telefone do adulto",
  ],
  "Adult’s date of birth": [
    "Fecha de nacimiento del adulto",
    "Date de naissance de l’adulte",
    "Data de nascimento do adulto",
  ],
  "Child’s first name": [
    "Nombre del niño",
    "Prénom de l’enfant",
    "Nome da criança",
  ],
  "Child’s last name": [
    "Apellido del niño",
    "Nom de famille de l’enfant",
    "Sobrenome da criança",
  ],
  "Child’s date of birth": [
    "Fecha de nacimiento del niño",
    "Date de naissance de l’enfant",
    "Data de nascimento da criança",
  ],
  "Type your first name to sign": [
    "Escriba su nombre para firmar",
    "Saisissez votre prénom pour signer",
    "Digite seu nome para assinar",
  ],
  "Type your last name to sign": [
    "Escriba su apellido para firmar",
    "Saisissez votre nom de famille pour signer",
    "Digite seu sobrenome para assinar",
  ],
  "Add a playing adult": [
    "Agregar un adulto que juega",
    "Ajouter un adulte qui joue",
    "Adicionar um adulto que brinca",
  ],
  "Add another child": [
    "Agregar otro niño",
    "Ajouter un autre enfant",
    "Adicionar outra criança",
  ],
  "Agree and sign": [
    "Aceptar y firmar",
    "Accepter et signer",
    "Concordar e assinar",
  ],
  "Complete waiver": [
    "Completar exención",
    "Terminer la décharge",
    "Concluir termo",
  ],
  "Remove adult": ["Quitar adulto", "Supprimer l’adulte", "Remover adulto"],
  "Remove child": ["Quitar niño", "Supprimer l’enfant", "Remover criança"],
  "Back to group information": [
    "Volver a información del grupo",
    "Retour aux informations du groupe",
    "Voltar às informações do grupo",
  ],
  "Watching — Free": [
    "Observando — Gratis",
    "Spectateur — Gratuit",
    "Observando — Grátis",
  ],
  "Playing — $10": ["Jugando — $10", "Participant — 10 $", "Brincando — $10"],
};
export function groupText(text: string, language: WaiverLanguage): string {
  if (language === "en") return text;
  return (
    labels[text]?.[language === "es" ? 0 : language === "fr" ? 1 : 2] ?? text
  );
}
export const englishTermsHelp: Record<WaiverLanguage, string> = {
  en: "The official waiver terms and signing statements below are in English. Ask staff for help before agreeing if needed.",
  es: "Las condiciones oficiales y declaraciones de firma a continuación están en inglés. Pida ayuda al personal antes de aceptar si la necesita.",
  fr: "Les conditions officielles et déclarations de signature ci-dessous sont en anglais. Demandez de l’aide au personnel avant d’accepter si nécessaire.",
  pt: "Os termos oficiais e declarações de assinatura abaixo estão em inglês. Peça ajuda à equipe antes de concordar, se necessário.",
};
