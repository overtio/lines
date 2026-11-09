/**
 * Whether a browser is a phone's or a tablet's, from its user agent and touch points. An iPad's
 * says it's a Mac, so it's told by its touch screen, which no Mac has; Windows and Linux laptops
 * can have one and are still computers.
 */
export const onPhoneOrTablet = (ua: string, touchPoints: number) => /iPhone|iPad|Android/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
