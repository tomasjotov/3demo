import { createApp } from './app.js';

/*
 * Embedding API for the hof page (arena3d.jsp):
 *
 *   import('<ctx>/js/plan3d/src/embed.js').then(m => m.mount(element, {
 *       base: '<ctx>',                         // server context path, e.g. '/hof'
 *       objectsBase: '<ctx>/assets/objects/',      // GLB object models (WEB-INF/assets/objects)
 *       charactersBase: '<ctx>/assets/characters/',// GLB character models (optional)
 *       getView: () => 1,                      // getPlanInfo ?view
 *       onTileClick: (x, y) => false           // return true = handled by the page (GM editor)
 *   }));
 *
 * Only one instance runs at a time; mounting again replaces it. The instance
 * stops by itself when its element is removed from the page.
 */
const CSS = `
.plan3d { position: relative; overflow: hidden; background: #1c211b; }
.plan3d canvas { display: block; }
.plan3d .plan3d-hud { position: absolute; left: 10px; top: 10px; max-width: calc(100% - 20px); padding: 8px 10px;
  background: rgba(20,24,20,.78); color: #eee; border: 1px solid rgba(255,255,255,.12); border-radius: 6px;
  font: 12px/1.45 Arial, sans-serif; pointer-events: none; }
.plan3d .plan3d-hud .title { font-weight: 700; margin-bottom: 3px; }
.plan3d .plan3d-hud .hint { color: #aaa; }
.plan3d .plan3d-hud .status { margin-top: 4px; color: #e9c879; }
.plan3d .plan3d-hud .status:first-child { margin-top: 0; }
.plan3d.plan3d-compact .plan3d-hud > div:not(.title):not(.status) { display: none; }
`;

let current = null;

export function mount(element, opts = {}) {
    unmount();
    if (!document.getElementById('plan3d-css')) {
        const st = document.createElement('style');
        st.id = 'plan3d-css';
        st.textContent = CSS;
        document.head.appendChild(st);
    }
    element.classList.add('plan3d');
    if (!element.style.height && element.clientHeight < 50) element.style.height = '600px';

    current = createApp({
        container: element,
        mode: opts.mode || 'server',
        base: opts.base ?? '',
        assetBase: opts.assetBase,
        objectsBase: opts.objectsBase,
        charactersBase: opts.charactersBase,
        fixtures: opts.fixtures,
        hud: 'create',
        hooks: { getView: opts.getView, onTileClick: opts.onTileClick }
    });
    window.__plan3d = current;
    return current;
}

export function unmount() {
    current?.dispose();
    current = null;
}
