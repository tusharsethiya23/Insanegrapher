/**
 * Contact details used by the Export (contact) section and the end credits.
 * Anything left empty is simply hidden.
 *
 * TODO: fill these in before launch.
 */
export const CONTACT = {
  // Where enquiries go. Digits only, with country code, no + or spaces: '919876543210'
  whatsapp: '',
  // Shown as a tap-to-call link: '+91 98765 43210'
  phone: '',
  email: '',
  // Handle without the @: 'insanegrapher'
  instagram: '',
  // One line under the form: 'Raipur, Chhattisgarh · available across India'
  location: '',

  // Project types the visitor picks from ("presets" in the export dialog)
  presets: ['Wedding', 'Event', 'Music video', 'Travel', 'Brand film'],

  // Optional budget slider. null = hidden.
  // e.g. { min: 10000, max: 200000, step: 5000, currency: '₹' }
  budget: null,
};
