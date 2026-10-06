// Public identifiers, not credentials. The old account is permanently closed.
// Keep Ads tracking disabled until the replacement account's rental-request action is verified.
export const GOOGLE_ADS_TAG_ID: string | null = null;
export const GOOGLE_ADS_RENTAL_CONVERSION_LABEL: string | null = null;
export const GOOGLE_ADS_RENTAL_DESTINATION: string | null =
  GOOGLE_ADS_TAG_ID && GOOGLE_ADS_RENTAL_CONVERSION_LABEL
    ? `${GOOGLE_ADS_TAG_ID}/${GOOGLE_ADS_RENTAL_CONVERSION_LABEL}`
    : null;
