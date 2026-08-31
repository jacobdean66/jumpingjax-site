export const WAIVER_LANGUAGES = ["en", "es", "fr", "pt"] as const;
export type WaiverLanguage = (typeof WAIVER_LANGUAGES)[number];

export function parseWaiverLanguage(value: string | null | undefined): WaiverLanguage {
  return WAIVER_LANGUAGES.includes(value as WaiverLanguage)
    ? (value as WaiverLanguage)
    : "en";
}

export const waiverLanguageNames: Record<WaiverLanguage, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  pt: "Português",
};

const translations = {
  en: {
    chooseLanguage: "Choose waiver language", waiver: "Jumping Jax waiver", website: "View Website",
    signerStep: "Who is signing?", participantsStep: "Who is covered?", legalStep: "Read and consent", signatureStep: "Sign the waiver", submitStep: "Submitting…", reviewStep: "Review and submit",
    intro: "Waivers are intended to remain valid for three years. Expired guests need a new waiver. This form does not collect Open Play admission payment.",
    partyWaiver: "Birthday party waiver", partyHelp: "Complete this before the Jumping Jax facility party. Staff will use the signed waiver during check-in.",
    fix: "Please fix the following", legalFirst: "Legal first name", legalLast: "Legal last name", email: "Email", phone: "Phone", dob: "Date of birth",
    guardianRule: "Important guardian rule", guardianHelp: "Every child must be covered by their own parent or legal guardian. A child from another family needs a waiver signed by that child’s own parent or legal guardian — not by a friend or host family.",
    adultSigner: "Adult signer (you)", includedSigner: "Included automatically as the adult signer on this waiver.", addParticipant: "Add participant",
    loadingTerms: "Loading the current waiver terms…", legalUnavailable: "Legal text unavailable", legalBlocked: "Online submission is blocked until the active waiver loads successfully.",
    courtesyTitle: "Official waiver terms", englishControls: "The English waiver is the controlling legal document. The selected-language version is provided to help you understand it.",
    consents: "Required consents", noPrecheck: "None of these boxes are pre-checked. Each must be confirmed separately.", risk: "I acknowledge the risks of participation described in the waiver terms.", terms: "I acknowledge and agree to the waiver terms.", guardianConsent: "I confirm I am the parent or legal guardian with authority to sign for every minor listed on this waiver.",
    signer: "Signer", participants: "Participants", adult: "adult signer", child: "child", coveredAdult: "adult", guardianSelected: "guardian selected", consentsStatus: "Consents", allChecked: "All required consents checked", incomplete: "Incomplete", signature: "Signature", provided: "Provided", missing: "Missing", legalText: "Legal text", loaded: "Loaded from server", unavailable: "Unavailable (submission blocked)", submitting: "Submitting your waiver… Please wait.",
    back: "Back", continue: "Continue", submit: "Submit waiver", help: "Need help?", contact: "Contact Jumping Jax",
    participant: "Participant", participantHelp: "Add every person covered by this waiver.", remove: "Remove", first: "First name", last: "Last name", participantType: "Participant type", selectGuardian: "Select guardian", guardian: "Parent or legal guardian on this waiver",
    signHelp: "Draw your signature with your finger or mouse. Page scrolling is locked while you are signing.", clear: "Clear", signNote: "Drawing confirms your intent to sign.",
    steps: { signer: "Signer", participants: "Participants", legal: "Legal", signature: "Sign", review: "Review" },
  },
  es: {
    chooseLanguage: "Elige el idioma del formulario", waiver: "Exención de responsabilidad de Jumping Jax", website: "Ver sitio web",
    signerStep: "¿Quién firma?", participantsStep: "¿Quién está incluido?", legalStep: "Leer y aceptar", signatureStep: "Firmar el formulario", submitStep: "Enviando…", reviewStep: "Revisar y enviar",
    intro: "El formulario está previsto para ser válido durante tres años. Los formularios vencidos deben renovarse. Aquí no se cobra la entrada de juego libre.",
    partyWaiver: "Formulario para fiesta de cumpleaños", partyHelp: "Complétalo antes de la fiesta en Jumping Jax. El personal utilizará el formulario firmado durante el registro.",
    fix: "Corrige lo siguiente", legalFirst: "Nombre legal", legalLast: "Apellido legal", email: "Correo electrónico", phone: "Teléfono", dob: "Fecha de nacimiento",
    guardianRule: "Regla importante del tutor", guardianHelp: "Cada menor debe estar cubierto por su propio padre, madre o tutor legal. Un menor de otra familia necesita un formulario firmado por su propio padre, madre o tutor legal, no por un amigo ni por la familia anfitriona.",
    adultSigner: "Adulto firmante (tú)", includedSigner: "Incluido automáticamente como adulto firmante.", addParticipant: "Agregar participante",
    loadingTerms: "Cargando los términos actuales…", legalUnavailable: "Texto legal no disponible", legalBlocked: "No se puede enviar el formulario hasta que carguen los términos vigentes.",
    courtesyTitle: "Términos oficiales del formulario", englishControls: "El formulario en inglés es el documento legal que prevalece. La versión en español se ofrece para ayudarte a comprenderlo.",
    consents: "Consentimientos obligatorios", noPrecheck: "Ninguna casilla está marcada de antemano. Debes confirmar cada una.", risk: "Reconozco los riesgos de participación descritos en los términos.", terms: "Reconozco y acepto los términos del formulario.", guardianConsent: "Confirmo que soy el padre, la madre o el tutor legal con autoridad para firmar por cada menor incluido.",
    signer: "Firmante", participants: "Participantes", adult: "adulto firmante", child: "menor", coveredAdult: "adulto", guardianSelected: "tutor seleccionado", consentsStatus: "Consentimientos", allChecked: "Todos confirmados", incomplete: "Incompleto", signature: "Firma", provided: "Proporcionada", missing: "Falta", legalText: "Texto legal", loaded: "Cargado del servidor", unavailable: "No disponible (envío bloqueado)", submitting: "Enviando el formulario… Espera.",
    back: "Atrás", continue: "Continuar", submit: "Enviar formulario", help: "¿Necesitas ayuda?", contact: "Contactar a Jumping Jax",
    participant: "Participante", participantHelp: "Agrega a cada persona incluida en este formulario.", remove: "Eliminar", first: "Nombre", last: "Apellido", participantType: "Tipo de participante", selectGuardian: "Seleccionar tutor", guardian: "Padre, madre o tutor legal en este formulario",
    signHelp: "Dibuja tu firma con el dedo o el ratón. La página no se desplazará mientras firmas.", clear: "Borrar", signNote: "Al dibujar confirmas tu intención de firmar.",
    steps: { signer: "Firmante", participants: "Personas", legal: "Legal", signature: "Firmar", review: "Revisar" },
  },
  fr: {
    chooseLanguage: "Choisissez la langue de la décharge", waiver: "Décharge de responsabilité Jumping Jax", website: "Voir le site",
    signerStep: "Qui signe?", participantsStep: "Qui est couvert?", legalStep: "Lire et consentir", signatureStep: "Signer la décharge", submitStep: "Envoi…", reviewStep: "Vérifier et envoyer",
    intro: "La décharge est prévue pour rester valide trois ans. Une décharge expirée doit être renouvelée. Ce formulaire ne perçoit pas l’entrée Jeu libre.",
    partyWaiver: "Décharge pour fête d’anniversaire", partyHelp: "Remplissez-la avant la fête à Jumping Jax. Le personnel utilisera la décharge signée lors de l’enregistrement.",
    fix: "Veuillez corriger les éléments suivants", legalFirst: "Prénom légal", legalLast: "Nom légal", email: "Courriel", phone: "Téléphone", dob: "Date de naissance",
    guardianRule: "Règle importante pour le tuteur", guardianHelp: "Chaque enfant doit être couvert par son propre parent ou tuteur légal. Un enfant d’une autre famille doit avoir une décharge signée par son propre parent ou tuteur légal, pas par un ami ni par la famille hôte.",
    adultSigner: "Adulte signataire (vous)", includedSigner: "Inclus automatiquement comme adulte signataire.", addParticipant: "Ajouter un participant",
    loadingTerms: "Chargement des conditions actuelles…", legalUnavailable: "Texte juridique indisponible", legalBlocked: "L’envoi est bloqué jusqu’au chargement des conditions en vigueur.",
    courtesyTitle: "Conditions officielles de la décharge", englishControls: "La décharge en anglais est le document juridique qui prévaut. La version française est fournie pour vous aider à la comprendre.",
    consents: "Consentements obligatoires", noPrecheck: "Aucune case n’est cochée à l’avance. Chacune doit être confirmée.", risk: "Je reconnais les risques de participation décrits dans la décharge.", terms: "Je reconnais et accepte les conditions de la décharge.", guardianConsent: "Je confirme être le parent ou tuteur légal autorisé à signer pour chaque mineur indiqué.",
    signer: "Signataire", participants: "Participants", adult: "adulte signataire", child: "enfant", coveredAdult: "adulte", guardianSelected: "tuteur sélectionné", consentsStatus: "Consentements", allChecked: "Tous confirmés", incomplete: "Incomplet", signature: "Signature", provided: "Fournie", missing: "Manquante", legalText: "Texte juridique", loaded: "Chargé du serveur", unavailable: "Indisponible (envoi bloqué)", submitting: "Envoi de la décharge… Veuillez patienter.",
    back: "Retour", continue: "Continuer", submit: "Envoyer la décharge", help: "Besoin d’aide?", contact: "Contacter Jumping Jax",
    participant: "Participant", participantHelp: "Ajoutez chaque personne couverte par cette décharge.", remove: "Supprimer", first: "Prénom", last: "Nom", participantType: "Type de participant", selectGuardian: "Choisir le tuteur", guardian: "Parent ou tuteur légal sur cette décharge",
    signHelp: "Dessinez votre signature avec le doigt ou la souris. Le défilement est bloqué pendant la signature.", clear: "Effacer", signNote: "Le dessin confirme votre intention de signer.",
    steps: { signer: "Signataire", participants: "Personnes", legal: "Juridique", signature: "Signer", review: "Vérifier" },
  },
  pt: {
    chooseLanguage: "Escolha o idioma do termo", waiver: "Termo de responsabilidade Jumping Jax", website: "Ver site",
    signerStep: "Quem está assinando?", participantsStep: "Quem está incluído?", legalStep: "Ler e concordar", signatureStep: "Assinar o termo", submitStep: "Enviando…", reviewStep: "Revisar e enviar",
    intro: "O termo deve permanecer válido por três anos. Termos vencidos precisam ser renovados. Este formulário não cobra a entrada de brincadeira livre.",
    partyWaiver: "Termo para festa de aniversário", partyHelp: "Preencha antes da festa no Jumping Jax. A equipe usará o termo assinado durante o check-in.",
    fix: "Corrija o seguinte", legalFirst: "Nome legal", legalLast: "Sobrenome legal", email: "E-mail", phone: "Telefone", dob: "Data de nascimento",
    guardianRule: "Regra importante do responsável", guardianHelp: "Cada criança deve ser incluída por seu próprio pai, mãe ou responsável legal. Uma criança de outra família precisa de um termo assinado por seu próprio responsável legal, não por um amigo ou pela família anfitriã.",
    adultSigner: "Adulto responsável (você)", includedSigner: "Incluído automaticamente como adulto responsável.", addParticipant: "Adicionar participante",
    loadingTerms: "Carregando os termos atuais…", legalUnavailable: "Texto legal indisponível", legalBlocked: "O envio fica bloqueado até que os termos atuais sejam carregados.",
    courtesyTitle: "Termos oficiais", englishControls: "O termo em inglês é o documento jurídico que prevalece. A versão em português é fornecida para ajudar na compreensão.",
    consents: "Consentimentos obrigatórios", noPrecheck: "Nenhuma caixa vem marcada. Cada uma deve ser confirmada.", risk: "Reconheço os riscos de participação descritos nos termos.", terms: "Reconheço e concordo com os termos.", guardianConsent: "Confirmo que sou pai, mãe ou responsável legal autorizado a assinar por cada menor incluído.",
    signer: "Responsável", participants: "Participantes", adult: "adulto responsável", child: "criança", coveredAdult: "adulto", guardianSelected: "responsável selecionado", consentsStatus: "Consentimentos", allChecked: "Todos confirmados", incomplete: "Incompleto", signature: "Assinatura", provided: "Fornecida", missing: "Ausente", legalText: "Texto legal", loaded: "Carregado do servidor", unavailable: "Indisponível (envio bloqueado)", submitting: "Enviando o termo… Aguarde.",
    back: "Voltar", continue: "Continuar", submit: "Enviar termo", help: "Precisa de ajuda?", contact: "Falar com Jumping Jax",
    participant: "Participante", participantHelp: "Adicione todas as pessoas incluídas neste termo.", remove: "Remover", first: "Nome", last: "Sobrenome", participantType: "Tipo de participante", selectGuardian: "Selecionar responsável", guardian: "Pai, mãe ou responsável legal neste termo",
    signHelp: "Desenhe sua assinatura com o dedo ou mouse. A página não rolará enquanto você assina.", clear: "Limpar", signNote: "O desenho confirma sua intenção de assinar.",
    steps: { signer: "Responsável", participants: "Pessoas", legal: "Legal", signature: "Assinar", review: "Revisar" },
  },
} as const;

export function waiverCopy(language: WaiverLanguage) {
  return translations[language];
}

const TRANSLATED_LEGAL_VERSION_ID = "280ab829-afa0-4c31-aff7-d2ee0ffb3fa3";

export function localizedWaiverLegalHtml(
  language: WaiverLanguage,
  versionId?: string | null,
): string | null {
  if (language === "en" || versionId !== TRANSLATED_LEGAL_VERSION_ID) return null;
  const date = new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : language, {
    timeZone: "America/New_York", year: "numeric", month: "long", day: "numeric",
  }).format(new Date());

  if (language === "es") return `<h1>Exención de responsabilidad de Jumping Jax LLC</h1><p>Como condición para participar en todas las actividades de las instalaciones de Jumping Jax LLC, el ${date}, acepto lo siguiente:</p><p>Entiendo que participar en las atracciones y juegos de Jumping Jax conlleva riesgos. Las lesiones pueden incluir raspaduras, moretones, cortaduras y lesiones más graves, incluida parálisis o muerte. Acepto y asumo plenamente estos riesgos, incluidos los causados por la negligencia de otros participantes, por mí, mi hijo o la persona bajo mi tutela.</p><p>Reconozco que los operadores me han informado sobre el uso correcto y los posibles peligros. Soy la única persona responsable de decidir si yo, mi hijo o la persona bajo mi tutela participa. Con pleno conocimiento de estos riesgos, libero y mantengo indemne a Jumping Jax LLC, sus propietarios, funcionarios, directores y gerentes, así como a sus herederos, sucesores y cesionarios, por dicha participación.</p><p>Acepto seguir todas las reglas de seguridad y entiendo que no cumplirlas puede causar la expulsión del establecimiento. También autorizo el uso de fotografías tomadas por fotógrafos de Jumping Jax LLC en las que aparezca la persona firmante, para el sitio web o medios impresos de Jumping Jax LLC.</p><p>POR LA PRESENTE LIBERO, RENUNCIO Y ABANDONO TODA RECLAMACIÓN, CONOCIDA O DESCONOCIDA, QUE YO, MI HIJO O LA PERSONA BAJO MI TUTELA PUEDA TENER AHORA O EN EL FUTURO CONTRA JUMPING JAX LLC, SUS MIEMBROS, FUNCIONARIOS, INSTRUCTORES, OPERADORES, AGENTES O REPRESENTANTES, RELACIONADA CON CUALQUIER ACTO, OMISIÓN, DECLARACIÓN O SUCESO DURANTE O RELACIONADO CON SUS ACTIVIDADES. ESTO INCLUYE, SIN LIMITACIÓN, RESPONSABILIDAD DIRECTA, INDIRECTA, VICARIA, CONSECUENTE E INCIDENTAL, LESIONES PERSONALES, MUERTE, PÉRDIDA ECONÓMICA Y CUALQUIER OTRO DAÑO.</p><p>Al firmar, entiendo que este acuerdo obliga a mí, mi hijo o la persona bajo mi tutela y a nuestros herederos, sucesores y cesionarios. Certifico que tengo edad legal y capacidad mental, y que soy el padre, la madre o el tutor legal del menor por quien firmo o que tengo el permiso expreso de su padre, madre o tutor legal.</p><section><h2>Entrada de adultos durante Juego Libre</h2><p>Los adultos que solamente observan entran gratis; los adultos que juegan pagan $7. Si un adulto pasa de observar a jugar durante la misma visita, la entrada de $7 debe registrarse y pagarse en efectivo o con tarjeta.</p></section>`;
  if (language === "fr") return `<h1>Décharge de responsabilité de Jumping Jax LLC</h1><p>En contrepartie de ma participation à toutes les activités de Jumping Jax LLC, le ${date}, j’accepte ce qui suit :</p><p>Je comprends que les attractions et jeux comportent des risques. Les blessures peuvent inclure éraflures, ecchymoses, coupures et blessures plus graves, notamment paralysie ou décès. J’accepte et assume entièrement ces risques, y compris ceux résultant de la négligence d’autres participants, pour moi-même, mon enfant ou mon pupille.</p><p>Je reconnais que les opérateurs m’ont informé de l’utilisation correcte et des dangers possibles. Je suis seul responsable de la décision de nous laisser participer. En pleine connaissance de ces risques, je libère et dégage de toute responsabilité Jumping Jax LLC, ses propriétaires, dirigeants, administrateurs et gérants, ainsi que leurs héritiers, successeurs et ayants droit, relativement à cette participation.</p><p>J’accepte de respecter toutes les règles de sécurité et comprends que leur non-respect peut entraîner l’expulsion des lieux. J’autorise également l’utilisation de photographies prises par les photographes de Jumping Jax LLC sur lesquelles apparaît le signataire, sur le site Web ou dans les médias imprimés de Jumping Jax LLC.</p><p>JE LIBÈRE, RENONCE ET ABANDONNE PAR LA PRÉSENTE TOUTE RÉCLAMATION, CONNUE OU INCONNUE, QUE MOI-MÊME, MON ENFANT OU MON PUPILLE POURRAIT AVOIR MAINTENANT OU PLUS TARD CONTRE JUMPING JAX LLC, SES MEMBRES, DIRIGEANTS, INSTRUCTEURS, OPÉRATEURS, AGENTS OU REPRÉSENTANTS, LIÉE À TOUT ACTE, OMISSION, DÉCLARATION OU ÉVÉNEMENT PENDANT OU EN RAPPORT AVEC LES ACTIVITÉS. CELA COMPREND, SANS S’Y LIMITER, LA RESPONSABILITÉ DIRECTE, INDIRECTE, DU FAIT D’AUTRUI, CONSÉCUTIVE ET ACCESSOIRE, LES BLESSURES, LE DÉCÈS, LES PERTES ÉCONOMIQUES ET TOUT AUTRE DOMMAGE.</p><p>En signant, je comprends que cet accord lie moi-même, mon enfant ou mon pupille ainsi que nos héritiers, successeurs et ayants droit. Je certifie avoir l’âge légal et la capacité mentale, et être le parent ou tuteur légal de l’enfant ou avoir l’autorisation expresse de son parent ou tuteur légal.</p><section><h2>Admission des adultes au Jeu libre</h2><p>Les adultes qui regardent entrent gratuitement; les adultes qui jouent paient 7 $. Si un adulte passe de spectateur à joueur pendant la même visite, l’entrée de 7 $ doit être enregistrée et payée en espèces ou par carte.</p></section>`;
  return `<h1>Termo de responsabilidade da Jumping Jax LLC</h1><p>Como condição para participar de todas as atividades nas instalações da Jumping Jax LLC, em ${date}, concordo com o seguinte:</p><p>Entendo que participar das atrações e jogos envolve riscos. Lesões podem incluir arranhões, hematomas, cortes e lesões mais graves, inclusive paralisia ou morte. Aceito e assumo integralmente esses riscos, inclusive os decorrentes da negligência de outros participantes, por mim, meu filho ou pessoa sob minha tutela.</p><p>Reconheço que os operadores me informaram sobre o uso correto e os possíveis perigos. Sou o único responsável pela decisão de permitir nossa participação. Com pleno conhecimento dos riscos, isento e mantenho indenes a Jumping Jax LLC, seus proprietários, administradores, diretores e gerentes, bem como seus herdeiros, sucessores e cessionários, em relação à participação.</p><p>Concordo em seguir todas as regras de segurança e entendo que o descumprimento pode resultar na expulsão do local. Também autorizo o uso de fotografias tiradas por fotógrafos da Jumping Jax LLC nas quais o signatário apareça, no site ou em materiais impressos da Jumping Jax LLC.</p><p>POR MEIO DESTE TERMO, ISENTO, RENUNCIO E ABRO MÃO DE TODAS AS REIVINDICAÇÕES, CONHECIDAS OU DESCONHECIDAS, QUE EU, MEU FILHO OU PESSOA SOB MINHA TUTELA POSSA TER AGORA OU NO FUTURO CONTRA A JUMPING JAX LLC, SEUS MEMBROS, ADMINISTRADORES, INSTRUTORES, OPERADORES, AGENTES OU REPRESENTANTES, RELACIONADAS A QUALQUER ATO, OMISSÃO, DECLARAÇÃO OU OCORRÊNCIA DURANTE OU RELACIONADA ÀS ATIVIDADES. ISSO INCLUI, SEM LIMITAÇÃO, RESPONSABILIDADE DIRETA, INDIRETA, VICÁRIA, CONSEQUENCIAL E INCIDENTAL, LESÃO PESSOAL, MORTE, PERDA ECONÔMICA E OUTROS DANOS DE QUALQUER NATUREZA.</p><p>Ao assinar, entendo que este acordo vincula a mim, meu filho ou pessoa sob minha tutela e nossos herdeiros, sucessores e cessionários. Declaro que tenho idade legal e capacidade mental e que sou pai, mãe ou responsável legal da criança por quem assino, ou que tenho permissão expressa de seu pai, mãe ou responsável legal.</p><section><h2>Entrada de adultos na Brincadeira Livre</h2><p>Adultos que apenas observam entram gratuitamente; adultos que brincam pagam $7. Se um adulto passar de observador a participante durante a mesma visita, a entrada de $7 deverá ser registrada e paga em dinheiro ou cartão.</p></section>`;
}

export function localizeWaiverError(message: string, language: WaiverLanguage): string {
  if (language === "en") return message;
  const generic = language === "es" ? "Revisa este campo." : language === "fr" ? "Vérifiez ce champ." : "Revise este campo.";
  if (/required|please check|please confirm/i.test(message)) return language === "es" ? "Este campo es obligatorio." : language === "fr" ? "Ce champ est obligatoire." : "Este campo é obrigatório.";
  if (/valid email/i.test(message)) return language === "es" ? "Escribe un correo electrónico válido." : language === "fr" ? "Saisissez un courriel valide." : "Digite um e-mail válido.";
  if (/date of birth/i.test(message)) return language === "es" ? "Escribe una fecha de nacimiento válida." : language === "fr" ? "Saisissez une date de naissance valide." : "Digite uma data de nascimento válida.";
  if (/signature/i.test(message)) return language === "es" ? "Dibuja tu firma." : language === "fr" ? "Dessinez votre signature." : "Desenhe sua assinatura.";
  return generic;
}
