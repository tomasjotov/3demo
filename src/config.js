// Runtime configuration shared by all modules (set by app.js / embed.js).
//   objectsBase    – URL folder with object models   (tree_oak_1.glb, …)
//   charactersBase – URL folder with character models (hero.glb, …)
// Standalone (Vite / static demo): ./assets/models/objects/, ./assets/models/characters/ (public/assets),
//   relative to the page, so the build works in any folder (e.g. /demo/hof3d/)
// Embedded in hof:   <ctx>/assets/objects/,    <ctx>/assets/characters/    (WEB-INF/assets)
export const config = {
    assetBase: './assets/',
    objectsBase: null,
    charactersBase: null
};

const slash = s => (s && !s.endsWith('/') ? s + '/' : s);

export function configure(opts = {}) {
    for (const k of ['assetBase', 'objectsBase', 'charactersBase']) {
        if (opts[k] !== undefined && opts[k] !== null) config[k] = slash(opts[k]);
    }
}

export const objectsBase = () => config.objectsBase || `${slash(config.assetBase)}models/objects/`;
export const charactersBase = () => config.charactersBase || `${slash(config.assetBase)}models/characters/`;
