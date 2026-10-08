# Three.js RPG Prototype

Výrazně rozšířený základ pro převod 2.5D izometrického RPG na 3D renderer.

**Běžící demo:** https://www.hrdinovefantasy.cz/demo/hof3d/ (obsah složky `deploy/` po `npm run export:demo`)

## Co prototyp obsahuje

- 2D herní souřadnice `x/y`
- Three.js 3D renderer
- ortografickou izometrickou kameru
- 30 × 22 mapu
- několik typů terénu
- dekorace: stromy, skály, kaktusy, domy, palmy
- více NPC
- hráče
- kolize s objekty a hranicí mapy
- plynulý pohyb
- idle / walk / attack stavový animační systém
- jednoduché 3D modely generované v runtime
- oddělenou game logiku a renderer
- data mapy, postav a objektů oddělená v `src/data`
- camera follow
- zoom a rotaci kamery
- výšky terénu
- depth řešený skutečným 3D depth bufferem
- základní stíny
- připravenou abstrakci pro pozdější GLB/GLTF modely

## Spuštění

Po rozbalení:

```bash
npm install
npm run dev
```

Potom otevři URL, kterou vypíše Vite.

Alternativně lze projekt spustit jednoduchým HTTP serverem, protože Three.js je načítán z CDN. Pro plný npm workflow ale doporučuji `npm install`.

## Struktura

```text
src/
├── main.js
├── style.css
├── game/
│   ├── Game.js
│   ├── Character.js
│   ├── GameObject.js
│   └── World.js
├── renderer/
│   ├── Renderer.js
│   ├── CameraController.js
│   ├── CharacterRenderer.js
│   ├── ObjectRenderer.js
│   └── TerrainRenderer.js
├── data/
│   ├── map.js
│   ├── characters.js
│   └── objects.js
├── input/
│   └── InputManager.js
└── utils/
    └── constants.js
```

## Přechod na skutečné 3D modely

`CharacterRenderer` je oddělený od `Character`, takže později lze runtime model nahradit GLB:

```js
const loader = new GLTFLoader();
loader.load('/models/characters/knight.glb', ...);
```

Stejný princip lze použít pro objekty.

Doporučené animace modelu:

```text
idle
walk
run
attack
hit
death
```

Game logika přitom zůstává stejná.


## V0.3 – modely, animace a klikací pohyb

Nově:

- `ModelManager` + `GLTFLoader`
- cache GLB modelů
- `AnimationController` přes `THREE.AnimationMixer`
- automatické přehrávání `idle`, `walk`, `attack`, `hit`, `death`
- fallback geometrie, pokud GLB není přítomné
- kliknutí na terén nastaví cíl pohybu
- WASD/šipky stále fungují
- kamera stále sleduje hráče a lze ji otáčet Q/E

Modely lze vložit například:

```text
public/assets/models/characters/
├── hero.glb
├── guard.glb
├── merchant.glb
└── bandit.glb
```

Animace v GLB by měly být pojmenované:

```text
idle
walk
attack
hit
death
```

Není nutné mít modely pro spuštění projektu; fallback zůstává funkční.


## V0.4 – combat animation prototype

Controls:

- `R` — attack
- `T` — defend/block
- `WASD` / arrows — movement
- left click — move to location
- `Q/E` — camera rotation
- mouse wheel — zoom

Without GLB assets, attack is represented by a weapon swing and attack arc.
Defense raises the shield and shows a subtle guard field.

With GLB assets, animations named `attack` and `defend` are used automatically.


## 2D grid movement

The game logic is a 2D grid; Three.js is only the renderer. Characters occupy one grid cell and move from cell to cell. Orthogonal and diagonal steps both count as one movement.

Mouse interaction:
- Hover a cell: the cell is highlighted.
- First click on a reachable cell: an A* path is calculated and displayed.
- Second click on the same destination: the player follows the path cell by cell.
- Click a character: calls a dummy character method.
- Diagonal movement does not cut through blocked corners.

The path length is exposed as the number of movement steps, so it can later be combined directly with RPG movement attributes/action points.


### Pohyb v8 směrech
A* používá 8 sousedních polí (4 přímé + 4 diagonální). Diagonální krok stojí 1 pohyb. Při stejně dlouhých cestách se preferuje cesta s menším počtem diagonálních kroků, takže kliknutí přesně vodorovně/svisle vede rovně.


### Animace a postoje
- `K` = klek / vstát
- `L` = leh / vstát
- `Shift` během pohybu = běh
- `R` = útok
- `T` = obrana
- GLB animace: `idle`, `walk`, `run`, `kneel`, `lie`, `attack`, `defend`, `hit`, `death`.


### Kamera
- Držení prostředního tlačítka myši + pohyb myší = rotace kamery kolem avatara.
- Kolečko = zoom.
- Q/E = rotace kamery klávesnicí.


### Barevná orientace gridu
- Modrý marker = aktuální pole hráče.
- Zelené menší diamanty = pole dosažitelná v rámci 6 pohybů.
- Červenohnědé malé diamanty = průchozí pole mimo aktuální dosah.
- Žluté diamanty = aktuální náhled cesty.
- Hover pole je zvýrazněno samostatně.
- Markery nezakrývají celé pole.


### V10 – výraznější orientace
- výrazná modrá = hráč
- výrazná zelená = dosažitelná pole
- červená = pole ostatních avatarů
- oranžová = blokovaná pole / pevné objekty (např. stromy)
- nedosažitelná volná pole už nejsou nijak zvýrazněna
- žlutá = aktuální cesta


### V11 – vylepšené fallback modely
Postavy mají nyní výraznější low-poly humanoidní siluetu: trup, samostatné paže a nohy, boty, ruce, krk, hlavu, vlasy/pokrývku hlavy a vybavení. Typy Hero, Guard, Merchant a Bandit mají odlišné barvy a doplňky.

## First-click facing
The first click that previews a destination also turns the player toward the first step of the previewed path. The second click on the same destination commits the movement.

### V12 – rigovaný procedurální avatar
Fallback postavy jsou nově v `src/renderer/ProceduralAvatar.js` (CharacterRenderer je jen tenká vrstva GLB ↔ fallback).
- Skutečná hierarchie kloubů: pánev → páteř → krk → hlava; rameno → loket → ruka; kyčel → koleno → kotník.
  Zbraň je v pravé ruce, štít na levém předloktí – pohybují se s končetinami.
- Archetypy: Hero (meč, kulatý štít, plášť), Guard (helma, kopí, pavéza, tabard), Merchant (klobouk, vous, róba, batoh, dýka),
  Bandit (kápě, maska, šavle, puklíř).
- Póza na stav + plynulé prolínání mezi stavy (idle dýchání a rozhlížení, walk/run s ohybem kolen a rotací pánve,
  útok podle zbraně – sek / šikmý sek / bod, obrana se štítem natočeným dopředu, klek na jedno koleno, leh na zádech, hit, death).
- Kadence kroků odpovídá rychlosti pohybu (žádné klouzání nohou); Shift nyní skutečně zrychlí pohyb (`runMultiplier`, výchozí 1.6).
- Plynulé otáčení podle `direction` – funguje i otočení při prvním kliknutí a počáteční směr NPC.
- Sekundární pohyb: plášť, mrkání; efekty útoku/obrany nejsou zasahovány raycastem (klik na avatara je přesnější).
- Sdílené geometrie a materiály mezi postavami.

Náhled všech avatarů a stavů: `npm run dev` a otevřít `/avatar-viewer.html`.

### V13 – travnatá mapa, větší markery, kůň
- Mapa je převážně tráva (`grass`, `grass2`, `grass3`) s klikatou hliněnou cestou, odbočkou k domům a písčitými místy u kaktusů/ohniště.
  Terén je jeden `InstancedMesh` s jemnou barevnou variací + instancované trsy trávy.
- Markery polí mají jednotnou velikost jako marker hráče (`MARK` v `Renderer.js`) a světlý okraj, aby byly čitelné i na trávě.
  Geometrie a materiály markerů se cachují (dřív vznikaly nové každý snímek).
- Stíny pokrývají celou mapu.
- Kůň (`ProceduralHorse.js`): sedlo, deka, uzdečka, hříva, ocas. Idle s dýcháním, švihání ocasem, stříhání ušima a občasnou pastvou;
  krok (4-taktní) a klus (`walk` / `run`).
- Vícepolíčkové postavy: `size` v datech postavy (kůň `size: 2`). `x/y` je přední pole (hlava), další pole jsou za ním podle `direction`.
  `Character.getCells()` / `occupies()` – kolize, pathfinding i červené markery počítají se všemi poli.

### V14 – ovládání více postav, vícepolíčkové bytosti, jízda na koni
- Markery polí mají 90 % velikosti pole (čtvercová výplň + okraj, `MARK` v `Renderer.js`).
- **Klik na jiného avatara / koně / obra = převzetí ovládání.** Klik na aktivní postavu volá dummy metodu.
  Klik na jezdce převezme ovládání koně. Rozdělané cesty ostatních postav doběhnou.
- **Footprint `{ w, l }`** (w = šířka napříč směrem, l = délka po směru): člověk 1×1, kůň 1×2, obr 2×1, větší tvor např. 3×2.
  `x/y` = přední (kotvící) pole, zbytek těla za ním / vedle něj podle `direction`.
- **Pohyb vícepolíčkových bytostí** (A* nad stavy `{x, y, dir}`, 1 krok = 1 bod pohybu):
  - šířka 1 (kůň): hlava jde na sousední pole a otočí se tím směrem, ocas zabere původní pole hlavy – kůň se plynule stáčí i otáčí na místě,
  - šířka > 1 (obr 2×1, 3×2 …): jen směry S/V/J/Z; krok novým kardinálním směrem = otočení + posun středu o 1 pole,
    diagonální krok = úkrok bez otočení,
  - kontrola volnosti všech polí těla i „řezání rohů“; zelené dosažitelné pole = kam může dojít přední pole,
    cíl cesty ukazuje celé tělo v cílové poloze.
- Vlastnost `move` = dosah pohybu (člověk 6, kůň 10, obr 5); HUD ukazuje aktivní postavu a dosah.
- **Nasednutí: `M`** – humanoid stojící vedle koně nasedne (plynulý „skok“ do sedla, póza `ride`), ovládá se kůň.
  Opětovné `M` = sesednutí na volné pole vedle koně (přednostně vlevo). Jezdec není na mřížce, kůň jej nese.
  Útok/obrana/klek/leh jsou v sedle zatím vypnuté.
- Obr (`type: 'giant'`) = zvětšený procedurální avatar (`scale: 1.8`) s kyjem, kadence kroků se škáluje s velikostí.
- `window.__rpg = { world, game, renderer }` pro ladění z konzole.

### V15 – posun mapy, spolehlivé přepínání postav, stromy
- **Pravé tlačítko + tažení = posun celé mapy** (kamera zůstává relativně k ovládané postavě). `C` = vycentrovat,
  při přepnutí postavy se kamera plynule vycentruje. Kontextové menu prohlížeče je na plátně vypnuté.
- **Přepínání postav:** klik vybere postavu i při kliknutí na pole, na kterém stojí (dřív se musel trefit tenký model).
  **Ctrl+klik** = jen výběr, nikdy nepohne postavou; dává přednost jiné postavě než aktuálně ovládané.
- **Stromy jako GLB assety** v `public/assets/models/objects/`: `tree_oak_1..3`, `tree_pine_1..3`, `tree_birch_1..3`,
  `tree_apple_1..2`, `tree_bush_1..2`, `tree_deadtree_1..2`.
  - Generátor: `src/renderer/TreeFactory.js`, náhled a export: `/tree-assets.html` (tlačítko stáhne všechna .glb).
  - `ObjectRenderer` načte GLB podle `type` + `variant`; když soubor chybí, použije stejný procedurální model.
    GLB lze nahradit vlastními modely – stačí zachovat jméno souboru (a volitelně uzel `crown` pro pohyb ve větru).
  - Koruny se jemně pohupují ve větru. Stromy blokují pohyb, keře (`bush`) ne.
  - `src/data/objects.js` rozmisťuje lesíky, sad u domů a jednotlivé stromy/keře deterministicky (mimo cesty, písek a postavy).

### V16 – napojení na server hof (fáze 1: plán ze serveru)
Režimy (`npm run dev`):
- `http://localhost:5173/game.html` – offline prototyp (`/` je od V22 rozcestník)
- `http://localhost:5173/game.html?server` – živý server hof přes Vite proxy `/hof → http://localhost:8080` (`vite.config.js`).
  Nejdřív se přihlas v hof na `http://localhost:8080/hof` ve **stejném prohlížeči** a vyber hru s arénou (session cookie je sdílená přes `localhost`).
  Jiná adresa serveru: `HOF_URL=http://host:port npm run dev`.
- `http://localhost:5173/game.html?mock` – přehrávání nahraných odpovědí (`public/fixtures/`), bez serveru.

Vrstva `src/server/`:
- `ServerApi.js` – `loadFullPlan`, `getPlanInfo`, `setDestination`, `sendCoords`, `selectPlanActor` (+ `MockServer`).
- `PlanAdapter.js` – GamePlan (Tiled JSON) → terén / objekty / `walkable`; rozdělení `controlled[]` na pole jednotlivých postav (velké bytosti).
- `ServerGame.js` – polling 200 ms (`ver`, `lastFullPlanVersion`), zrcadlení postav do `World`, plynulé kroky podle `tx/ty/tr`,
  stavy podle `moveType`, zvýraznění ze serveru, příkazy. Stejné rozhraní jako `Game`, renderer se nemění.
- `mappings.js` – `r ↔ směr`, gid → terén, názvy objektů → modely, `moveType` → animace, archetyp postavy (zatím podle jména / velikosti).

Ovládání v režimu serveru: 1. klik = server otočí a zaměří pole, 2. klik na stejné pole = pohyb (náhled cesty počítá
přímou trasu stejně jako server). Klik / Ctrl+klik na jinou postavu = `selectPlanActor` (jen GM).

### V17 – vložení do hof (arena3d.jsp)
- `src/app.js` – `createApp({container, mode, base, assetBase, hud, hooks})`, jedna běžící instance klienta v libovolném elementu.
  Velikost podle kontejneru (ResizeObserver), klávesy jen nad 3D a nikdy při psaní ve formuláři, `dispose()`,
  samo se ukončí, když stránka (SPA fragment) element odstraní.
- `src/embed.js` – `mount(element, opts)` / `unmount()` pro stránku hof, HUD a CSS uvnitř kontejneru.
- `npm run export:hof` (`tools/export-hof.mjs`) – zkopíruje klienta bez bundleru do
  `../hof/src/main/webapp/WEB-INF/js/plan3d/` (ES moduly, importy `three` přepsané na relativní cesty, three.js)
  a GLB modely do `WEB-INF/assets/objects/` (a `assets/characters/`), mapování `mvc:resources /assets/**`.
  Spouštěj po každé změně klienta.
- `hof/.../pages/game/arena3d.jsp` – kopie `arena.jsp`, kde je místo `plan.jsp` (Phaser) 3D plán. GM editor terénu
  (`planControl.jsp`) zůstává: když je vybraný štětec, klik do 3D maluje (`sendTerrainChange`).

### V19 – katalog statických objektů 1:1 s editorem terénu
- `src/data/objectCatalog.js` – jediný zdroj pravdy: id = název, který server ukládá do `objects[]` (`arenaPaint`).
  Všechny objekty starého editoru (bez zbraní) + nové stromy/keře; prefixy id zachovávají průchodnost serveru
  (`wall*` / `tree*`, `stone*`, `brick*`, `bush*`, `stump*`). `hidden` = vykreslí se, ale není v paletě (`tree02`).
- `src/renderer/ObjectFactory.js` (`buildObject(id)`), `PropFactory.js` (pařez, bloky, zdi, sloup, kámen, truhla,
  sud, bedny, váza, lucerna, svícen), `TreeFactory.js` (+ `poplar`/`tree01`, `spruce`/`tree02`, `shrub`/`bush01`).
- `ObjectRenderer` je řízený katalogem: GLB `<objectsBase>/<id>.glb`, fallback procedurální model; rotace podle
  katalogu (`random` / `quarter` / `fixed`), vítr jen u vegetace. Neznámé názvy (zbraně) = značka předmětu.
- `object-assets.html` (`src/tools/objectAssets.js`) – galerie, export `<id>.glb` + náhled `previews/<id>.png`.
- `export-hof` navíc kopíruje náhledy a zapisuje `WEB-INF/assets/objects/catalog.json`.
- hof: `planControl3d.jsp` – grafická paleta (terén, smazání, objekty po skupinách s náhledy), `arena3d.jsp` ji používá;
  `plan.jsp` (2D) zobrazuje pro neznámé id zástupný sprite (`spriteKey`); generátor plánu (`GamePlan`) losuje
  z katalogových stromů a keřů.

### V20 – doladění arena3d
- Perspektivní kamera (FOV 30°) místo ortografické: vzdálenější část plánu se zmenšuje (dřív opticky „rostla“ od kamery).
- Server: obyčejný klik na jinou postavu = klik na její pole (zaměření / útok přes 2 kliky), převzetí ovládání (GM) jen Ctrl+klik.
- Info rámeček ve 3D jen se základními údaji: postava, pole, pohyb (dosah), akce (+ dočasná hláška / chyba spojení).
- `planControl3d.jsp`: editace je po načtení skrytá (odkaz „Editace“ ji zobrazí).

### V21 – avatar složený z vrstev (jako 2D)
- Stejný princip jako 2D sprite v hof (`PersonWear.processImage`): **tělo** (`lookBase` / `lookVariant`) + vrstvy
  boty → nohy (kalhoty / zbroj) → tělo (oblečení / zbroj) → toulec → rukavice → vlasy → helma → koruna → amulet →
  zbraň (pravá) → levá ruka (štít / druhá zbraň) → vousy. Klíče vrstev jsou **stejné jako názvy 2D vrstev**.
- Jeden společný rig (kostra) pro všechny vrstvy = obdoba zarovnaných 2D sheetů; animace se nemění.
- `src/avatar/bodies.js` – těla: male/female (+ odstín pleti podle `base01…`), kostlivec, zombie, ghúl, mumie, goblin,
  uruk, zlobr, troll, brute-*, beastman, lizardman, daemon/fiend, stín …; zvířata zatím zástupně.
- `src/avatar/layers.js` – vrstvy: `feet01`, `pants01`, `bottom-scale|chainmail|plate`, `top01`, `body-padded|leather|scale|chainmail|plate|ballistic-*`,
  `quiver`, `gauntlets01`, `hairNN` (8 střihů), `helmet-light|medium|heavy|full|ballistic`, `crown01`, `amulet01`,
  `weapon-*` (meče, sekery, palcát, kopí, hůl, luky, kuše, střelné zbraně), `weapon-shield*`, `weapon-axe-off|dagger-off`, `beardNN`.
  Neznámý klíč se přeskočí (jako chybějící 2D soubor). Zbraň volí útočnou animaci (sek, bod, mířená střelba).
- `src/avatar/looks.js` – předvolby prototypu (hero, guard, …, ranger, knight) jako vzhled + vrstvy + barvy.
- `wardrobe.html` – šatník: tělo, varianta, zapínání vrstev, animace, výpis `layers` pro PlanActor.
- Server: `PlanActor.lookBase`, `lookVariant`, `layers`, `positionType`; změna výbavy za běhu avatara převleče.
  `?mock&looks` = záznam s ukázkovými vrstvami.

### V22 – statické demo (https://www.hrdinovefantasy.cz/demo/hof3d/)
- `index.html` = rozcestník, hra je `game.html` (`?mock`, `?mock&looks`, `?server` jen s Vite proxy / v hof).
- `npm run export:demo` (`tools/export-demo.mjs`) → `deploy/`: stránky s import mapou, `src/` beze změny, `lib/` (three.js +
  použité addony), `assets/`, `fixtures/`, `hub/`. Bez bundleru, všechny cesty relativní – obsah složky se nahraje do
  `/demo/hof3d/` (funguje v jakékoli složce). Alternativně `npm run build` (Vite, `base: './'`) → `dist/`.
- Modely a záznam se načítají relativně (`./assets/…`, `./fixtures/…`), celé GLB postav jen když je data vyžádají (`c.model`).

### V23 – obouruční držení zbraně (2H)
- Server: `PlanActor.twoHanded` = `Item.isTwoHanded()` zbraně v pravé ruce při volné levé ruce
  (zahrnuje i přepnutí držení hráčem – `changeWield`). Klient bez tohoto pole použije typické obouruční zbraně
  bez štítu (dlouhý meč, obouruční meč, bitevní sekera, kopí, hůl, palice, luky, kuše, pušky).
- Levá ruka drží zbraň přes IK (dvoukloubová ruka) na druhém úchopu zbraně (`GRIP2` v `avatar/layers.js`):
  meče a sekery pod pravou rukou, kopí a hůl vpředu na ratišti, pušky a kuše na předpažbí, pistole oběma rukama.
- Vlastní 2H pózy (klid, pohotovost, chůze/běh, klek) a útoky: sek oběma rukama shora, bod kopím se zadní rukou u boku,
  míření s pažbou u ramene; u kopí a pušek se trup natočí (šikmý postoj), aby levá ruka dosáhla.
  Hodnoty póz byly dopočteny na kostře (poloha ruky, směr zbraně, dosah levé ruky) – odchylka úchopu 0–4 cm.
- Šatník: volba držení auto / 1H / 2H, předvolba `warrior` (bitevní sekera). `?mock&looks`: Theralis drží dlouhý meč obouručně.

### V24 – oprava 2H, luk, animace v šatníku
- 2H držení je celé přes IK: póza určuje jen polohu pravé ruky a směr zbraně v prostoru trupu (`HOLDS`),
  obě ruce se dopočítají (lokty ven a dolů, u pušky u ramene záložní pól dozadu), zbraň se natočí do směru
  (čepel / hlava sekery dolů-vpřed, puška svisle), levá ruka na druhý úchop. Polohy rukou nalezeny optimalizací:
  ruce ani zbraň neprochází trupem, levá ruka sedí na úchopu.
- Luk se drží za střed rámu (rukojeť), tětiva je na straně střelce, při míření luk stojí svisle. Kuše: luček napříč pažbou.
- Šatník: lišta animací (klid, chůze, běh, útok, obrana, klek, leh, zásah, smrt), pauza, rychlost, otočení postavy, oběh kamery.
- Demo se exportuje do `deploy/` (obsah složky se nahraje do `/demo/hof3d/`).

### V25 – jízda na koni v hof (arena3d)
- Jízda je na serveru **poloha** postavy (`PositionType.HORSE_RIDE` / `HORSE_RIDE_RUN`, volí se v HTML aréně v nabídce polohy
  nebo GM příkazem `POSITION`), ne samostatný actor. Klient ji čte z `PlanActor.positionType` (posílá se od V21).
- Při `HORSE_RIDE*` se pod postavu vytvoří procedurální kůň (`ProceduralHorse`, měřítko 0.82 – postava dál zabírá 1 pole),
  jezdec do sedla naskočí, kůň jde s pohybem postavy (krok, při `HORSE_RIDE_RUN` / běhu cval) a otáčí se podle ní.
  Po změně polohy jezdec seskočí a kůň zmizí. Útok, obrana i zásah v sedle – nohy zůstávají kolem koně.
- HUD: „(na koni)“ / „(na koni, cval)“. Ukázka: `game.html?mock&looks&ride`.

### V26 – hof: poloha na koni z menu arény
- GM menu aktéra rozšířeno o „jízda na koni“ (`HORSE_RIDE`) a „nájezd“ (`HORSE_RIDE_RUN`); hráči v 1. kole v přípravě vidí
  u svých aktérů volbu polohy (Stát, Běh, Leh, Klek, jízda na koni, nájezd). Změny v hof: `ArenaHtml.java`, `ArenaController.java`.

### V27 – tma a světelné zdroje
- **Tma arény** = `GamePlan.darknessBasis` z `loadFullPlan` (GM příkaz DARKNESS, 0 = den … 10 = úplná tma): obloha a slunce
  plynule přejdou den → soumrak (3) → noc (7) → tma (10), pozadí a slabá mlha. Světelná mapa `darkness[]` (2D) se ve 3D nepoužívá.
- **Skutečná světla three.js** (`src/renderer/LightRenderer.js`): pevná sada PointLightů (3 se stíny + 2 bez stínů pro tmu a přebytek),
  aby se při rozsvícení nepřekládaly shadery; nejbližší zdroje k ovládané postavě dostanou světlo se stínem.
  Síla `power` ve stejných jednotkách jako darknessBasis (10 = rozsvítí úplnou tmu u zdroje), dosah `radius` v polích; záporná síla = tma.
- **Zdroje na postavě** (`src/renderer/CarriedLights.js`, `LightProps.js`) z `PlanActor.lights`
  `[{ type: TORCH|LANTERN|MAGIC_ITEM|MAGIC|DARK, hand: R|L|'', power, radius }]`: pochodeň (mihotavý plamen, v pravé ruce nahradí model zbraně,
  v levé ruce zvednutá před tělem), lucerna (visí z ruky, bez volné ruky u pasu), kouzelné světlo (koule nad ramenem), tma (temná koule).
  Bez určené ruky jde pochodeň/lucerna do volné levé ruky, jinak za opasek na pravém boku.
- **Zdroje na plánu** z `PlanArena.lights` `[{ type: AREA|DARK|TORCH|LANTERN, power, radius, x, y }]`: světlo v prostoru (zářící koule),
  tma (temná polokoule), rozsvícená pochodeň / lucerna na zemi.
- hof: `PlanLight.java` (nové), `PlanActor.lights`, `PlanArena.lights` (+ `ArenaFields.recountMasterPlan`).
- Test: `game.html?night` (tma 8 + pochodeň, lucerna, kouzlo, pochodeň v ruce), klávesy **N** = tma 0/4/7/10, **V** = světlo ovládané postavy;
  `game.html?mock&looks&night=10` = záznam ze serveru v noci se světly.

### V28 – lucerna a svícen z editoru svítí, rozsvícení pochodně / lucerny
- Statické objekty s `light` v `objectCatalog.js` (`lantern01` síla 10 / dosah 10, `candlestick01` 4 / 4) svítí hned po vložení editorem;
  stejné hodnoty počítá server do pravidel (`PlanLight.objectPower`, `GamePlan.getObjectLights`, `ArenaFields.countPersonLight`).
  Server je posílá i v `PlanArena.lights` s `object: true` – klient je kreslí podle katalogu, ne dvakrát.
- hof: akce **Rozsvítit / Zhasnout** (`OtherActionType.TOGGLE_LIGHT`, cena jako změna držení) u pochodně nebo lucerny v ruce
  (jinak ve výbavě); rozsvícení = hodnota světla předmětu 10 (jako kouzlo Magická pochodeň), ukládá se s předmětem.
- `planControl3d.jsp`: tlačítko Editace / Zavřít (oranžově orámovaný editor), zelené tlačítko Uložit.
- Použít předmět (pochodeň / lucerna) v aréně i na kartě postavy = rozsvítit / zhasnout samotný předmět, bez výběru cíle
  a bez spotřeby náboje (`ArenaActor` USE_ITEM, `ArenaHtml`, `Person.useItem`).

### V29 – nestvůry: vlk (procedurální čtyřnožec)
- `src/renderer/ProceduralCanine.js` – vlk a příbuzní na 1 poli: kostra trup / 4 nohy (zadní digitigrádní) / krk / hlava s čelistí / ocas.
  Stavy: klid (dýchání, rozhlížení, čichání, uši, ocas), chůze (4taktní krok), běh (cval), útok (přikrčení → výpad → kousnutí
  se zatřesením → návrat), obrana (přikrčení, cenění zubů, uši sklopené), zásah, klek = sed, leh, smrt (na boku).
- Varianty: `wolf`, `wolf-black`, `direwolf`, `dog`, `hellhound` (žhavé oči, jiskry), `firedog`, `spectral` / `soulhound`
  (průsvitní), `vampirewolf`, `undeadwolf` (žebra).
- Výběr modelu: hof posílá `PlanActor.beast` = klíč bestiáře (`beast-wolf` → `wolf`); tabulka v `src/avatar/creatures.js`.
  2D `lookBase` nestvůry je jen nejbližší sprite (medvěd i lev jsou `hound-large`), proto rozhoduje klíč; lookBase jen bez klíče.
- Ukázky: `game.html?beasts` (offline smečka), `game.html?mock&looks&beasts`, `creature-test.html?v=wolf,direwolf&states=idle,walk,run,attack`.
- Revize bestiáře (co chybí, navržené kostry): `docs/bestiar-modely.md` (generuje `tools/bestiar-modely.py`).

### V30 – bestiář: náhled hotových a chybějících modelů
- `bestiary.html` (dlaždice **Bestiář** na úvodní stránce, `src/tools/bestiaryViewer.js`): všech 264 nestvůr z bestiáře hof podle skupin,
  u každé 3D náhled a stav **hotovo** (vlastní model nebo postava, která sedí), **doplněk** (postava je, chybí křídla / hlava / ocas…)
  a **chybí** (červeně orámované, šrafované, s 2D spritem, který se zatím ukáže v aréně). Filtry, hledání, ukazatel postupu.
- Klik na kartu = živý náhled nahoře: otáčení myší, zoom kolečkem, tlačítka stavů (klid, chůze, běh, útok, obrana, zásah, klek, leh, smrt).
  `bestiary.html?beast=<klíč>` otevře rovnou danou nestvůru (např. `?beast=hellhound`).
- Data: `src/data/bestiary.js` generuje `tools/bestiar-modely.py` (spolu s `docs/bestiar-modely.md`) z `../data/beasts`, `res-src.json`
  a JSP bestiáře; po přidání modelu stačí doplnit `src/avatar/creatures.js`, stav se přepočítá sám.
- `src/avatar/bodies.js`: varianty postav `base-skeleton`, `base-orc`, `base-blue`, `base-demon` se kreslí jako kostlivec / ork /
  modrá kůže / démon (dřív obyčejný člověk); `base00` = `base01` (dřív nedefinovaná barva kůže).
- `creature-test.html`: nový pohled `view=hub` (obrázek na dlaždici).

### V31 – kostlivec a nemrtví, obrázky nestvůr v bestiáři
- `src/avatar/undead.js` (nové): kostlivec (`bone`) má lebku bez očí – prázdné očnice, nosní otvor, zuby a pohyblivou
  čelist (cvakání v klidu, kousnutí při útoku, otevřená při zásahu a smrti), obratle, hrudník s žebry, hrudní kost,
  klíční kosti a lopatky, pánev, stehenní kost s hlavicí, holeň + lýtková kost, loket + předloktí ze dvou kostí, kostnaté ruce a chodidla.
  Kosti jednoho kloubu se slévají do jedné sítě (málo draw calls, sdílená geometrie).
- Nemrtví z masa nemají oči, jen tmavé zapadlé důlky a otevřená ústa se zuby: zombie, ghúl (+ nosní otvor, žebra pod kůží),
  mumie (+ obvazy na hlavě, trupu a končetinách), dead-gentleman.
- Zbroj a oblečení na kostlivci mají užší rukávy a nohavice (`layers.js` `limbK`).
- Kostlivý obr (`skeleton-giant`, 2D sprite troll) se kreslí jako velký kostlivec (`creatures.js` `beastBody`).
- `bestiary.html`: obrázky nestvůr z hof `WEB-INF/img/beast` (bez skládaných humanoidů) – u chybějících jako obrázek karty
  i velký v náhledu, u hotových malý v rohu karty a v panelu vpravo jako předloha. Náhledy 260 px v `public/beast`
  a seznam `src/data/beastImages.js` dělá `python3 tools/bestiar-obrazky.py ../hof/src/main/webapp/WEB-INF/img/beast public/beast src/data/beastImages.js`
  (zpracuje jen nové nebo změněné obrázky).
- `creature-test.html?look=skeleton,mummy,zombie-1&view=face|body` – humanoidní těla v testu (`layers=` klíče oddělené `+`, v URL `%2B`).

### V32 – kočkovité šelmy a medvědi
- `src/renderer/QuadrupedRig.js` (nové): společná animace čtyřnožců (stavy, krok / cval, rozhlížení, čichání, natáčení);
  `ProceduralFeline.js` a `ProceduralBear.js` z ní dědí, `ProceduralCanine.js` zůstává beze změny.
- `ProceduralFeline`: `lion` (hříva, střapec na ocasu), `lioness`, `tiger` (pruhy), `leopard` (rozety), `sabretooth` (šavlovité tesáky,
  krátký ocas). Kresba srsti je canvas textura (`furTexture`). Útok = přikrčení s vrtěním zadkem → skok s předními tlapami → kousnutí,
  obrana = přikrčení, uši naplocho, prskání, zvednutá tlapa; sed, leh jako sfinga, smrt na boku.
- `ProceduralBear`: `bear`, `bear-large`, `bear-polar`, `cave-bear` (vysoké čelo), `necrotaur` (mech, otevřený bok s žebry, svítící oči).
  Útok = vztyčení na zadní → úder oběma tlapami → kousnutí, obrana = vztyčení s řevem, sed na zadku, leh na břiše.
- Klíče bestiáře: lion, tiger, leopard, sabretooth, bear, bear-large, cave-bear, necrotaur (`creatures.js`, hodnota `rig:varianta`);
  `src/renderer/creatureRigs.js` vytvoří správnou kostru (`createCreature`).
- Ukázky: `game.html?beasts` (+ lev, tygr, medvěd), `creature-test.html?v=lion,tiger,bear&states=idle,attack,defend`.
- Bestiář: 99 hotovo / 36 doplněk / 129 chybí; zbývají lví složeniny (sfinga, mantikora, chiméra) a obří krysa.

### V33 – zbylá zvířata (kopytníci, těžcí čtyřnožci, krysa, plazi, dvounožci, lví složeniny)
- `QuadrupedRig.js` zobecněn: seznam nohou (`init({ legs })` – dvounožci HL/HR, bazilišek 8 nohou), vlastní fázové posuny nohy
  (`L.walk` / `L.gal`), klíč póz nohy (`L.key`) a háček `applyLeg` (plazi s roztaženýma nohama ho přepisují).
- `creatureParts.js` (nové): zužující se trubice (rohy, kly, kel), `hornGeo`, křídla `makeWing` (netopýří blána / peří, složí se podél
  boku a roztáhnou, mávání), štíří ocas, plamínky (`flameTongue`).
- `ProceduralHoofed`: `drakun` (rohy dozadu, tesáky, drápy místo kopyt), `nightmare` (netopýří křídla, rudé oči, žhavá kopyta),
  `unicorn` (spirálový roh), `bull`, `cow` (strakatá, vemeno), `fire-bull` (plameny na hřbetě a rozích), `undead-bull` (lebka se
  zelenýma očima, žebra, hniloba), `boar` (kly, štětiny). Útok koně = vzepětí → úder kopyty → kousnutí / bodnutí rohem;
  skot a prase = hlava dolů → výpad → nabrání hlavou; obrana = tanec (kůň), hrabání kopytem (skot).
- `ProceduralPachyderm` (dědí z Hoofed): `elephant` (chobot z článků, kly, uši se roztahují a plácají), `hippopotamus` (tlama se
  otevře doširoka), `rhinoceros` (dva rohy). Sloupové nohy.
- `ProceduralRat`: `giant-rat` (holý ocas, řezáky, kmitající čumák); obrana = vztyčení na zadní, sed = panáček s čištěním tlapek.
- `ProceduralReptile`: `crocodile`, `giant-crocodille`, `giant-eft` (skvrny), `karialis` (rovné nohy, hřbetní pláty, ostny, ocas s
  palicí – útok švihem ocasu), `dragon-turtle` (ostnatý krunýř, zobák s tesáky), `basilisk` (8 nohou, kohoutí hlava s hřebínkem).
  Roztažené nohy se kývou kolem svislé osy, tělo a ocas se vlní; leh na břiše, smrt na zádech.
- `ProceduralBiped`: `sagat` (raptor s pruhy a srpovitým drápem), `uth` (dlouhý krk, zobák), `gauton` (obří ještěr, drobné přední
  packy), `terrorbird` (obří pták, péřová křídla), `ghat` (shrbený ještěr s velkými drápy – podle obrázku chodí po dvou).
  Prsty nohou zůstávají na zemi, ocas vyvažuje tělo.
- `ProceduralFeline` + složeniny: `chimera` (kozí hlava na hřbetě, had místo ocasu), `manticore` (netopýří křídla, štíří ocas, který
  při útoku bodne), `sphinx` (lidská tvář s nemes šátkem, péřová křídla).
- Velikosti jsou skutečné (slon ~2,6 m v kohoutku, gauton ~3,5 m v kyčli, hrůzopták a gigakrokodýl obří) – měřítko jde upravit ve
  variantě (`scale`). Jezdecký kůň (`horse`, `war-horse`) zůstává `ProceduralHorse`.
- `creature-test.html`: `z=` oddálení kamery pro velká zvířata, `view=head|headside|top`.
- Ukázky: `game.html?beasts` (+ býk, jednorožec, krokodýl, sagat), `bestiary.html`. Bestiář: 125 hotovo / 36 doplněk / 103 chybí;
  ze zvířat zbývají létající (orel, gryf, fénix, netopýři) a vodní tvorové.
