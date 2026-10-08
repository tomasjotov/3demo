// Map tiles: mostly grass, a winding dirt road, a branch to the houses and
// small sandy patches around the cacti / campfire.
const W = 30, H = 22;
const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
};

function tileAt(x, y) {
    // main road west → east
    const roadY = Math.round(12 + 2 * Math.sin(x / 4.2));
    if (y === roadY || (y === roadY + 1 && hash(x, y) > .55)) return 'dirt';
    // branch north to the houses (x = 9..10, y = 5)
    if (x === 10 && y >= 6 && y < roadY) return 'dirt';
    // sandy patches
    const patches = [[12, 15, 2.3], [18, 17, 2.1], [22, 9, 1.6], [16.5, 4, 1.8]];
    for (const [px, py, r] of patches) {
        const d = Math.hypot(x - px, y - py);
        if (d < r - .4 * hash(x, y)) return d < r * .55 ? 'sand' : 'sand2';
    }
    const h = hash(x, y);
    return h < .14 ? 'grass3' : h < .45 ? 'grass2' : 'grass';
}

export const mapData = {
    width: W,
    height: H,
    tiles: Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => tileAt(x, y)))
};
