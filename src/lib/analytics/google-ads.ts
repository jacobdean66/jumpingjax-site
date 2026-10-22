// Public identifiers, not credentials. Verified in replacement account 715-139-9909
// on October 22, 2026: "Rental request saved", conversion action 7823548968.
// Dispatch only after a rental request is saved, with its ID for deduplication.
export const GOOGLE_ADS_TAG_ID: string | null = "AW-18496526460";
export const GOOGLE_ADS_RENTAL_CONVERSION_LABEL: string | null = "geWdCKjEx5IdEPyw6vNE";
export const GOOGLE_ADS_RENTAL_DESTINATION: string | null =
  GOOGLE_ADS_TAG_ID && GOOGLE_ADS_RENTAL_CONVERSION_LABEL
    ? `${GOOGLE_ADS_TAG_ID}/${GOOGLE_ADS_RENTAL_CONVERSION_LABEL}`
    : null;
