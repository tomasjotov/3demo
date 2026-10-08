// Texts from the HoF res table (window.langTable, loaded by head.jsp) when embedded in HoF;
// the standalone three1 app shows the Czech default. Placeholders: {name}.
export function t(key, fallback, params) {
    const table = typeof window !== 'undefined' ? window.langTable : null;
    let s = (table && table[key]) || fallback;
    if (params) for (const k in params) s = s.split('{' + k + '}').join(params[k]);
    return s;
}
