export function telegramLangToNLLB(code) {
  if (!code) return null;
  const map = {
    ru: 'rus_Cyrl', en: 'eng_Latn', de: 'deu_Latn', fr: 'fra_Latn', es: 'spa_Latn', it: 'ita_Latn', pt: 'por_Latn', nl: 'nld_Latn', pl: 'pol_Latn', tr: 'tur_Latn',
    th: 'tha_Thai', vi: 'vie_Latn', id: 'ind_Latn', ms: 'msa_Latn', ja: 'jpn_Jpan', ko: 'kor_Hang',
    zh: 'zho_Hans', 'zh-hans': 'zho_Hans', 'zh-cn': 'zho_Hans', 'zh-hant': 'zho_Hant', 'zh-tw': 'zho_Hant', 'zh-hk': 'zho_Hant',
    hi: 'hin_Deva', bn: 'ben_Beng', ta: 'tam_Taml', te: 'tel_Telu', mr: 'mar_Deva', gu: 'guj_Gujr', pa: 'pan_Guru',
    km: 'khm_Khmr', lo: 'lao_Laoo', my: 'mya_Mymr', fil: 'tgl_Latn', tl: 'tgl_Latn',
    ar: 'arb_Arab', fa: 'pes_Arab', ur: 'urd_Arab',
    uk: 'ukr_Cyrl', he: 'heb_Hebr', el: 'ell_Grek', cs: 'ces_Latn', hu: 'hun_Latn', sv: 'swe_Latn', da: 'dan_Latn', fi: 'fin_Latn', no: 'nob_Latn'
  };
  const key = code.toLowerCase().split('_')[0];
  return map[key] ?? null;
}
