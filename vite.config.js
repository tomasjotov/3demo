import { defineConfig } from 'vite';

// The 3D client talks to the hof server (Tomcat, http://localhost:8080/hof).
// The proxy keeps everything on one origin, so the hof session cookie
// (JSESSIONID, path /hof) is sent with /hof/game/* requests.
// Start:   npm run dev   →   http://localhost:5173/  (rozcestník)
//          http://localhost:5173/game.html?server   live hof
//          http://localhost:5173/game.html?mock     replays public/fixtures/*
// Build:   npm run build →   dist/  (relative paths – upload the folder anywhere,
//          e.g. https://www.hrdinovefantasy.cz/demo/hof3d/)
export default defineConfig({
    base: './',
    server: {
        proxy: {
            '/hof': {
                target: process.env.HOF_URL || 'http://localhost:8080',
                changeOrigin: false
            }
        }
    },
    build: {
        rollupOptions: {
            input: {
                index: 'index.html',
                game: 'game.html',
                wardrobe: 'wardrobe.html',
                avatars: 'avatar-viewer.html',
                objects: 'object-assets.html',
                bestiary: 'bestiary.html'
            }
        }
    }
});
