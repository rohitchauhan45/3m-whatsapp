/** Shared blue + gray UI tokens for a consistent classic admin look. */

export const ui = {
  btnPrimary:
    'inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-full text-sm font-medium hover:bg-brand-primaryDark transition-colors shadow-blue-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
  btnPrimaryLg:
    'inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-medium hover:bg-brand-primaryDark transition-colors shadow-blue-sm disabled:opacity-50 disabled:cursor-not-allowed',
  btnSecondary:
    'inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-gray-300 bg-white text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  btnDraft:
    'inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-amber-400 text-gray-900 rounded-xl text-sm font-semibold hover:bg-amber-500 transition-colors shadow-md shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed',
  btnPrimaryWide:
    'inline-flex items-center justify-center gap-2 px-8 py-3 bg-brand-primary text-white rounded-xl text-sm font-medium hover:bg-brand-primaryDark transition-colors shadow-blue-sm',
  btnGhostBlue:
    'inline-flex items-center gap-1 rounded-lg border border-brand-primary/25 bg-brand-pastel-blue px-2 py-1.5 text-sm font-semibold text-brand-primary transition-colors hover:border-brand-primary/40 hover:bg-brand-pastel-blue/80',
  tabBar: 'inline-flex items-center gap-1.5 rounded-full bg-gray-100 p-1.5 overflow-x-auto',
  tabActive:
    'px-4 py-2 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all bg-brand-primary text-white shadow-blue-sm',
  tabInactive:
    'px-4 py-2 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all text-gray-600 hover:text-brand-primary hover:bg-white',
  navActive: 'bg-gray-100 text-gray-900 font-medium',
  navInactive: 'text-gray-500 hover:text-gray-900',
  linkPrimary: 'text-sm font-semibold text-brand-primary hover:text-brand-primaryDark transition-colors',
  inputEditable:
    'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-base shadow-sm transition-colors hover:border-brand-primary/35 hover:bg-brand-pastel-blue/40 focus:border-brand-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/20 placeholder:text-gray-400',
  textAccent: 'text-brand-primary',
} as const;
