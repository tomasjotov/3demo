# Napojení 3D klienta na stávající server (analýza)

Zdroj: složka `binding/` (Java model `com.tst.hof.data.game`, JSP s Phaser klientem, iso grafika).
Stav: analýza kódu `binding/` + ověřeno v celém projektu `C:\data\tj\hof` (`Calc`, `ArenaController`, `ArenaFields.getPlanInfo`). Zatím bez vzorků reálných JSON odpovědí. Co zůstává neověřené, je označeno *(ověřit)*.

---

## 1. Shrnutí

- Server je **autoritativní**: drží pozice, tahy, pohyb, viditelnost i zvýraznění polí. Klient jen zobrazuje a posílá kliknutí.
- Komunikace je **HTTP polling**: `GET game/getPlanInfo` každých 200 ms (dynamický stav, pole `ver`). Při změně `lastFullPlanVersion` se znovu stáhne `GET game/loadFullPlan` (statická mapa).
- Mapa je **Tiled isometric JSON** (64×32 px): vrstva `L1` = terén (gid dlaždic), vrstva `Top` = klientské zvýraznění. K tomu paralelní pole `walkable[]`, `objects[]`, `softObjects[]` a `darkness[]` (index `y*width + x`).
- Souřadnice `x/y` a orientace mřížky **odpovídají našemu 3D klientovi** (x doprava dolů, y doleva dolů). Převod je 1:1, stačí `x → X`, `y → Z`.
- Velké rozdíly: server **nepočítá cestu**, jde rovnou za cílem po jednom poli každých 410 ms. Velké bytosti mají **footprint kolem středu** otočený v 8 směrech. Jízda na koni je **stav postavy** (`HORSE_RIDE`), ne samostatný kůň.
- Doporučení: 3D klient dostane vrstvu `server/` (adaptér), která převede `PlanArena` + `GamePlan` na náš `World`. Místní logika (`Game.js`) zůstane jako offline režim a náhled. Na serveru je potřeba několik malých rozšíření JSON (kap. 9).

---

## 2. Co je v `binding/`

| Soubor | Obsah | Význam pro napojení |
|---|---|---|
| `jsp/plan.jsp` | polling `getPlanInfo`, synchronizace actorů, zvýraznění, objekty mapy | **hlavní smyčka klienta** |
| `jsp/planPhaser.jsp` | Phaser scéna, načtení mapy, klikání, převody souřadnic | vstupy a souřadnice |
| `jsp/planChars.jsp` | třída `playerClass`: sprite, animace podle `moveType`, interpolace pohybu, `setDestination` | pohyb a animace actorů |
| `jsp/planControl.jsp` | GM editor (Vue): malování terénu, speciály, generování a ukládání plánů | editor (později) |
| `jsp/planTiles.jsp` | seznam malovatelných objektů, atlasy ohně/kouře/mlhy, testovací mapa | názvy objektů |
| `java/GamePlan.java` | model mapy, který se serializuje do `loadFullPlan` | **formát mapy** |
| `java/PlanArena.java` | DTO pro `getPlanInfo` | **formát stavu** |
| `java/PlanActor.java` | DTO actora + výpočet `moveType` | **formát postavy** |
| `java/Arena.java` | pohyb (`processActorMovement`, `actorSetDestination`), tah, fáze | pravidla pohybu |
| `java/ArenaActor*.java` | stav actora, `updateT()` (krokování), footprint `createMatrix(r)` | časování a velikost |
| `java/PersonWear.java` | vzhled, výbava, `getLargeX1..Y2` podle `lookBase` | velikost bytostí, vzhled |
| `java/Game.java` | správa plánů, `updatePlan()` | životní cyklus mapy |
| `img/iso/*` | tilesety 64×64, objekty, atlasy efektů | mapování gid na 3D |

Doplněno z projektu hof: `web/controller/ArenaController.java` (endpointy), `data/game/ArenaFields.java` (`getPlanInfo`, `getActorPlan`), `util/Calc.java`, `Coordinates`, `PositionType` (`STAND, RUN, KNEEL, LIE, HORSE_RIDE, HORSE_RIDE_RUN, SWIMMING, FLYING`).

---

## 3. Jak funguje starý klient

```
document.ready ──► getPlanInfo ──► (první odpověď) new Phaser.Game
                       │                └─ preload: loadFullPlan (Tiled JSON), atlasy postav
                       ▼
       setInterval 200 ms: getPlanInfo
          ├─ data.ver <= ver  → zahodit
          ├─ lastFullPlanVersion vzrostlo → loadFullPlan + znovu vytvořit objekty
          ├─ actors: nový → načíst atlas a vytvořit sprite; chybějící → smazat; jinak data = item
          └─ processDataPlan(): vyčistit Top, vykreslit spell/noWalk/blocked/extra/controlled,
                                alfa terénu podle vision + darkness
Phaser update(): actor.move(delta) → sprite jde směrem tr, dokud nedojde na targetX/targetY
```

Kliknutí levým tlačítkem (`pointerup`):

1. pokud je zapnuté malování v editoru → `arenaPaint` / `arenaPlanSpecial` a konec,
2. vždy `sendCoords(x, y)`,
3. pokud je hráč `active` → `setDestination(id, x, y)`.

Prostřední tlačítko posouvá kameru. Kamera po 3 s znovu sleduje aktivní postavu (`autofollow`).

---

## 4. API (z JSP)

Autentizace je **session** (`getCurrentUser/getCurrentGame` z HTTP session), takže 3D klient musí běžet na stejném originu jako `/hof`: buď jako stránka uvnitř aplikace, nebo přes Vite proxy (`/hof` → `localhost:8080`).
Oprávnění: `setDestination` = GM nebo vlastník actora; `selectPlanActor` a `sendCoords` = **jen GM** (`selectPlanActor` nastaví „override actora“, kterého GM ovládá).

| Endpoint | Parametry | Odpověď | Použití |
|---|---|---|---|
| `GET game/getPlanInfo` | `view` (sessionStorage, výchozí 1) | `{status, data: "<JSON PlanArena jako string>"}` | stav, polling 200 ms |
| `GET game/loadFullPlan` | – | JSON `GamePlan` (přímo objekt) | mapa |
| `GET game/setDestination` | `id, x, y` | `{status, data: důvod chyby}` | pohyb / zaměření (**dvojklik je na serveru**, viz 6.2) |
| `GET game/sendCoords` | `x, y` | – | každé kliknutí (zaměření, kouzla) |
| `GET game/selectPlanActor` | `id` | `{status}` | výběr ovládané postavy |
| `GET game/arenaPaint` | `x, y, val` | – | GM: terén 1/2/3 nebo název objektu |
| `GET game/arenaPlanSpecial` | `x, y, val` | – | GM: světlo, tma, mlha, dým |
| `GET game/storeGamePlan`, `getGamePlans`, `selectGamePlan?id`, `addGamePlan`, `recreateGamePlan` | rozměry, poměry terénu | – | GM správa plánů |
| `GET game/getActorImages/{id}/{imageName}/{anim}` | – | PNG atlas | 2D sprity (ve 3D nepotřebujeme) |

---

## 5. Datové formáty

### 5.1 `loadFullPlan` → `GamePlan` (Tiled isometric)

| Pole | Typ | Poznámka |
|---|---|---|
| `width`, `height` | int | výchozí 30×30 / 64×64 |
| `tilewidth` 64, `tileheight` 32, `orientation` "isometric", `renderorder` "right-down" | | Tiled hlavička |
| `layers[0]` `L1` | `data: int[w*h]` | **terén**: gid dlaždice (tab. 7.1) |
| `layers[1]` `Top` | `data: int[w*h]` | prázdné, klient do něj kreslí zvýraznění |
| `tilesets[]` | outside (firstgid 1, 160 dlaždic), building (firstgid 161, 80 dlaždic) | |
| `walkable[]` | int 0/1 | 0 = voda, strom, keř, pařez, … |
| `objects[]` | string \| null | `tree01`, `tree02`, `bush01`, `stump01`, `stone01`, `brick01`, `wall-n/e/s/w`, `stone-col`, `chest01`, `lantern01`, `candlestick01`, `barrel01`, `boxes01`, `vase01`, `rock01` … |
| `softObjects[]` | `SoftMap {items: [string]}` \| null | předměty na zemi (zbraně, štíty, truhly, …) |
| `darkness[]` | int 0..100 | osvětlení pole (100 = světlo) |
| `darknessBasis`, `magicDisturbance`, `id` | | |

`mapData[]` (logický typ 1 grass / 2 dirt / 3 water / 4 stone) má jen indexovaný getter, takže se do JSON nejspíš **neposílá** *(ověřit)*. Typ terénu proto odvodíme z gid.

### 5.2 `getPlanInfo` → `PlanArena`

| Pole | Význam |
|---|---|
| `ver` | čítač, který se **zvýší při každém dotazu** (`ver++` v `getPlanInfo`). Filtr `ver <= poslední` jen zahazuje odpovědi, které přišly mimo pořadí, změnu stavu nesignalizuje |
| `lastFullPlanVersion` | když vzroste, klient znovu načte `loadFullPlan` |
| `plan` | "X" / jiné (logika výběru hráče je v obou větvích stejná) |
| `userId` | aktuální uživatel |
| `vision` (0..10), `visionType` (2 = aura, max 60 %; 3 = vše vidět; jinak vision×10 + darkness) | viditelnost |
| `actors[]` | `PlanActor` (5.3) |
| `controlled[]` | **pole všech actorů** (`getWorldMatrix()` = celý footprint velkých bytostí) + zaměřené pole aktivního actora |
| `blocked[]` | **okraj dosahu pohybu** aktivního actora (prstenec polí ve vzdálenosti `moveRange`) + u GM v přípravě zaměřené pole + `masterPlan.blocked` |
| `extra[]` | pozice aktuálního protivníka, oblast kouzla nebo speciálu (koule, kužel, prstenec, zeď) a kontrolní zóny nepřátel |
| `spell[]` | plošné efekty (`masterPlan.spell`), `text` ∈ `FIRE, POISON, SMOKE, FOG, BLUNT, SPELL` |

Všechna pole jsou `Coordinates {x, y, text?}`, kde −1 znamená ignorovat.

### 5.3 `PlanActor`

| Pole | Význam | Použití ve 3D |
|---|---|---|
| `id` | keyName actora | `Character.id` |
| `userId`, `own`, `active` | vlastník, vlastní, je na tahu / ovládaný | výběr ovládané postavy |
| `x, y, r` | pozice a směr 0..7 | logická pozice, `direction` |
| `tx, ty, tr` | **další krok** (sousední pole) a jeho směr, −1 = stojí | interpolace kroku |
| `targetX, targetY` | cíl pohybu, −1 = žádný | náhled cíle |
| `moveType` | `walk, run, kneel, lie, attack-1, attack-polearm, attack-dual, attack-two-hand-1, attack-pistol/rifle/bow/crossbow/mg/throw, block-shield, block-unarmed, evade, cast, pray, use-item` | stav animace (7.4) |
| `mp`, `mr` | taktické body, **rozsah pohybu** | dosah (zelená pole) |
| `actions`, `speedActions` | akce, bonusové akce | HUD |
| `name`, `color`, `colorBack` | jmenovka | štítek nad postavou |
| `imageName`, `imageSize`, `imageOffsetX/Y`, `type` (A/B/C z `lookBase`) | 2D sprite | výběr 3D archetypu (7.5) |
| `visibility` | 0..100 | průhlednost |

---

## 6. Pravidla na serveru, se kterými musí 3D klient počítat

### 6.1 Souřadnice a směry

- Phaser: `world.x = (x − y)·32`, `world.y = (x + y)·16`. Osa x jde doprava dolů, y doleva dolů, (0,0) je nahoře.
  Náš 3D klient (kamera na `angle = π/4`) má **stejnou orientaci**. Převod je `X = x + .5`, `Z = y + .5`.
- `r` je směr v **obrazovkových** iso pojmech. **Ověřeno** v `Calc.countAngle(x, y) = round((atan2(−x, y)° + 45) / 45)`, kde x, y = odkud − kam:

| r | sprite | krok v mřížce (dx, dy) | náš `direction` |
|---|---|---|---|
| 0 | u (nahoru) | (−1, −1) | NW |
| 1 | ur | (0, −1) | N |
| 2 | r (doprava) | (+1, −1) | NE |
| 3 | dr | (+1, 0) | E |
| 4 | d (dolů) | (+1, +1) | SE |
| 5 | dl | (0, +1) | S |
| 6 | l (doleva) | (−1, +1) | SW |
| 7 | ul | (−1, 0) | W |

  Jinak řečeno: `r = (index našeho směru N,NE,E,…,NW + 1) mod 8` (ověřeno).

### 6.2 Pohyb

- `actorSetDestination`: **první** klik nastaví `pointedX/Y` (zaměření, náhled). **Druhý** klik na stejné pole teprve nastaví `mapTarget` a spustí pohyb.
  Je to stejné chování jako u nás (1. klik = náhled, 2. klik = jdi). Rozhoduje o tom server, klient pošle `setDestination` při každém kliku.
- Při stejném kliku se otočí `r` k cíli, i když pohyb neproběhne (odpovídá našemu „first-click facing“).
- Kontroly: dosah `countMapRange10(dx, dy)/10 <= moveRange`, kde **diagonální krok = 15, rovný = 10** (ověřeno), tedy diagonála stojí 1,5 pole, cíl musí být `walkable`, nesmí ležet v kinetické zóně a nesmí kolidovat s footprintem jiného actora (kromě ležícího).
- Krokování (`updateT` + `serverSync`): další pole je `x ± 1, y ± 1` přímo k cíli, **bez hledání cesty**. Krok trvá **410 ms**, diagonála 820 ms, běh ÷1,5.
  Každý krok platí taktické body (WALK/RUN/SWIM/FLY/CRAWL × `moveMulti`). Na neprůchozím poli se pohyb zastaví (`mapTarget = −1`). Maximum je 30 kroků za tah (`mapMoveCount`).
- Při pohybu se vyhodnocují plošné efekty (oheň, kyselina, …) a reakce nepřátel. Pohyb tak může kdykoli skončit dřív.

**Důsledek:** náš A* náhled se se serverem neshoduje, jakmile je v cestě překážka. Možnosti jsou v kap. 9.

### 6.3 Velké bytosti

- Footprint = obdélník `[-largeX1..largeX2] × [-largeY1..largeY2]` **kolem středu** (`mapX/mapY`), otočený podle `r` přes `Calc.countTranformation(i, j, r)`, tedy **i v diagonálách**.
  Základní orientace je `r = 1` (sever, bez rotace): `-largeY1` je **přední** strana, `+largeY2` zadní. Diagonální rotace zaokrouhlují souřadnice, takže tvar „zubatí“.
  **Chyba v `countTranformation`:** případ `r = 7` (270°) vrací `(j, i)`, což je zrcadlení. Správně má být `(j, −i)` (viz `r = 3`: `(−j, i)`). Postava natočená na západ má proto nesymetrický footprint zrcadlený.
- Velikost určuje `lookBase` (`PersonWear.getLargeX1..Y2`). Příklady: `ogre`, `troll`, `uruk-*`, `giant-*` = X 1+1 (šířka 3); `dragon-red`, `gigacrab` = 2+2 (šířka 5); `fiend-*` až 5×5; Y až 3 dopředu.
- Do `PlanActor` se footprint neposílá. Všechna pole všech actorů ale chodí souhrnně v `controlled[]`, takže pro zvýraznění stačí. Pro správné natočení modelu ale potřebujeme footprint u konkrétního actora.

Náš klient má kotvu na předním poli a `footprint {w, l}`. Adaptér musí přejít na model **střed + rozsahy** (nebo dostat seznam polí přímo ze serveru).

### 6.4 Jízda na koni

- Server zná `PositionType.HORSE_RIDE` a `HORSE_RIDE_RUN` (ceny pohybu, útok v běhu). Kůň **není samostatný actor**, je to stav postavy.
- `PlanActor.moveType` tento stav neposílá (`HORSE_RIDE` skončí jako `walk`) a footprint jezdce zůstává podle `lookBase`, tedy 1×1.

Ve 3D klientu jezdce vykreslíme jako jednu jednotku kůň + jezdec, pokud server pošle `positionType`. O tom, jestli má jezdec na koni zabírat 2 pole, musí rozhodnout server.

---

## 7. Mapování na 3D klienta

### 7.1 Terén (`L1` gid, tileset `iso-64x64-outside`, firstgid 1)

| gid | Obsah | 3D |
|---|---|---|
| 1–2, 5–7, 11–24 | tráva (varianty) | `grass*` |
| 3–4 | hlína (`convertToFinal`) | `dirt` |
| 8–10, 19–20, 25–30 | výplně a obrysy (zvýraznění) | ignorovat v `L1` |
| 31–44 | kopce a svahy | výškové dlaždice (zatím tráva + výška) |
| 51–60, 67–71 | skály a kameny | `rock` (objekt na poli) |
| 61–66, 72–80 | útesy / vodopády, vyvýšené bloky | vyvýšený blok (výška) |
| 81–103 | voda (pobřeží) | `water` (nový materiál), neprůchozí |
| 111–119 | vysoká tráva | tráva + hustší trsy |
| 120–130 | keře, mladé smrky, klády | `bush`, `pine`, kláda |
| 131–160 | velké stromy (sprity přes více dlaždic) | `oak` / `pine` / `deadtree` |
| 161–240 (tileset `building`) | kámen, podlahy, stěny s okny a dveřmi, střechy, schody, stoly, studny | modulární stavební díly (pozdější fáze) |

### 7.2 Objekty (`objects[]`, `softObjects[]`)

| Server | 3D |
|---|---|
| `tree01`, `tree02` | `oak` / `birch` (GLB `tree_*`) |
| `bush01` | `bush` |
| `stump01` | pařez (nový model) |
| `stone01`, `rock01`, `brick01`, `stone-col`, `wall-n/e/s/w` | kámen, sloup, zeď (podle směru) |
| `chest01`, `barrel01`, `boxes01`, `vase01`, `lantern01`, `candlestick01` | rekvizity (nové modely) |
| `softObjects`: `sword01`, `dagger01`, `axe01`, `mace01`, `flail01`, `warhammer01`, `spear01`, `halberd01`, `bow01`, `crossbow01`, `shield01` | předměty ležící na zemi (malé modely, několik na jednom poli) |
| `spell.text` FIRE / SMOKE / POISON / FOG / BLUNT | částicové efekty na poli |

Pozor: v `GamePlan.updateSoftObjects` jsou ikony `bow01` a `crossbow01` přehozené.

### 7.3 Zvýraznění (Top vrstva → naše markery 90 %)

| Server | Starý index | 3D marker |
|---|---|---|
| hover | 27 žlutý obrys | hover rámeček |
| `controlled[]` | 25 červený obrys | pole obsazená postavami (červená, vlastní modrá) + zaměřené pole |
| `walkable == 0` | 29 černý | neprůchozí (tlumený) |
| `blocked[]` | 30 bílý | okraj dosahu pohybu (zelený okraj) |
| `extra[]` | 26 modrý | protivník, oblast kouzla, kontrolní zóny nepřátel (modrá / fialová) |
| `spell[]` | 28 zelený | zóna kouzla (fialová) + efekt |

Server posílá **okraj** dosahu (`blocked[]`). Vnitřek, tedy zelená dosažitelná pole, dopočítá klient z `walkable`, actorů a `mr` se stejnou metrikou 10/15 (6.2).

### 7.4 `moveType` → stav avatara

| Server | 3D stav | Poznámka |
|---|---|---|
| `walk` / `run` (s `tx ≥ 0`) | `walk` / `run` | |
| stojí (`tx == −1`, žádná akce) | `idle` | |
| `kneel`, `lie` | `kneel`, `lie` | |
| `attack-1`, `attack-two-hand-1`, `attack-dual`, `attack-polearm` | `attack` (sek, obouruč, dvě zbraně, bodnutí) | rozšířit pózy |
| `attack-bow`, `attack-crossbow`, `attack-pistol`, `attack-rifle`, `attack-mg`, `attack-throw` | nové pózy střelby a hodu | doplnit |
| `block-shield`, `block-unarmed`, `evade` | `defend`, nový `block-unarmed`, `evade` (úkrok) | |
| `cast`, `pray`, `use-item` | nové pózy | doplnit |

Akce na serveru **trvají, dokud se nezmění stav**: animace útoku se v klientu přehrává ve smyčce. Náš avatar má útok jako jednorázovou akci (0,55 s), takže pro serverový režim přidáme cyklický útok.

### 7.5 Vzhled

`imageName` / `lookBase` / `type` (A/B/C) vybírá 2D sprite set. Pro 3D navrhuji tabulku `lookBase → archetyp` (humanoid, obr, troll, pavouk, drak, …) plus výbavu (pravá a levá ruka, helma, zbroj, plášť), kterou drží `PersonWear`. Do `PlanActor` ale dnes nejde.

---

## 8. Navržená architektura klienta

```
src/server/
  ServerApi.js        fetch wrapper: getPlanInfo, loadFullPlan, setDestination, sendCoords, selectPlanActor
  PlanSync.js         polling 200 ms, kontrola ver / lastFullPlanVersion, zahazování starých odpovědí,
                      backoff při chybě, pauza v neaktivní záložce
  PlanAdapter.js      GamePlan → mapData (terén, výšky, walkable, darkness) + objectData
                      PlanArena → actors (create/update/remove), overlays, vision
  ActorSync.js        x,y,tx,ty,tr → plynulý krok 410 ms (diagonála 820, běh ÷1,5);
                      korekce při odchylce > 1 pole (jako updateSpritePosition)
  mappings.js         gid → terén, objekt → model, moveType → stav, r ↔ direction, lookBase → archetyp
  MockServer.js       offline: přehrává nahrané JSON odpovědi (vývoj bez serveru)
```

- `World` / `Character` / renderery zůstanou. Adaptér plní `world.characters` a `map` a do herní logiky nezasahuje.
- `Game.js` dostane režim **server**: kliknutí → `sendCoords` + `setDestination`, Ctrl+klik → `selectPlanActor`, žádný lokální pohyb, jen náhled. **Offline** režim zůstane beze změny.
- Ovládaná postava = actor s `active` (případně `own`). Náš Ctrl+klik pošle `selectPlanActor` a výběr se potvrdí až z dalšího `getPlanInfo`.

---

## 9. Rozhodnutí a potřebné změny na serveru

**Minimální rozšíření JSON (zpětně kompatibilní, Phaser klient je bude ignorovat):**

1. `PlanActor.positionType` (STAND / RUN / KNEEL / LIE / HORSE_RIDE / HORSE_RIDE_RUN / SWIMMING / FLYING): jízda, plavání, létání.
2. `PlanActor.large: {x1, x2, y1, y2}` nebo rovnou `cells: [{x,y}]` (`getWorldMatrix()`): velké bytosti.
3. `PlanActor.stepMs` (čas do dokončení kroku = `tt − now`): přesná synchronizace interpolace.
4. `PlanActor.lookBase` a souhrn výbavy (`rightHand`, `leftHand`, `helmet`, `armor`, `cloak`, `shield`): 3D vzhled.
5. `PlanActor.pointedX/Y`: náhled zaměřeného pole po prvním kliku (dnes jde jen `targetX/Y`).

**Pohyb (je potřeba vybrat):**

- **A) Beze změny serveru:** klient zobrazí náhled přímé trasy (stejný greedy algoritmus jako server, i se zastavením na překážce). Jednoduché a přesné, ale bez obcházení překážek.
- **B) Waypointy z klienta:** klient najde A* cestu a posílá `setDestination` po úsecích, dvakrát na každý mezicíl. Server se nemění, ale je to víc requestů a hrozí souběh s reakcemi.
- **C) Doporučeno:** nový endpoint `setPath(id, [x,y…])` nebo A* na serveru v `updateT()`. Náhled i pohyb pak budou stejné a obcházení překážek zvládne server.

Dále se sjednotí cena diagonály (`countMapRange10`, nejspíš 1,5) s naším náhledem (dnes 1) a dosah se bude zobrazovat z `mr`.

---

## 10. Otevřené otázky / co potřebuji

1. **Vzorky JSON**: odpovědi `getPlanInfo` (několik po sobě během pohybu a útoku) a `loadFullPlan` z reálné hry, z prohlížeče přes DevTools → Network → Save as HAR. Poslouží jako fixtures pro `MockServer`.
2. ~~`Calc.java`~~ ověřeno (6.1–6.3, včetně chyby `r = 7`).
3. ~~Controller a plnění `PlanArena`~~ ověřeno (5.2). Zbývá parametr `view`, který `ArenaFields.getPlanInfo` přijímá, ale ve zobrazené části ho nepoužívá *(ověřit)*.
4. Server běží na `http://localhost:8080/hof`. Kvůli session poběží 3D klient přes Vite proxy (`/hof` → 8080) nebo jako stránka v aplikaci.
5. Jízda na koni: má jezdec na koni zabírat 2 pole (náš kůň 1×2), nebo zůstane 1×1?
6. Mají se ve 3D řešit výškové dlaždice (31–44, 72–80) a budovy (161–240) hned, nebo až v další fázi?

---

## 11. Navržený postup

1. **Fáze 1, čtení (bez změn serveru):** `ServerApi` + `PlanSync` + `PlanAdapter` pro terén, objekty a actory. Pohyb podle `x/y/tx/ty`, overlays, vision. Ověření proti nahraným JSON přes `MockServer`.
2. **Fáze 2, ovládání:** klik → `sendCoords` + `setDestination`, Ctrl+klik → `selectPlanActor`, náhled varianty A, mapování `moveType` na nové pózy.
3. **Fáze 3, rozšíření serveru:** `positionType`, `cells`, `stepMs`, výbava. Jízda, velké bytosti, 3D vzhled.
4. **Fáze 4:** `setPath` (A* na serveru), voda, výšky, budovy, GM editor ve 3D.

### Drobné chyby nalezené ve starém klientu (pro informaci)

- `plan.jsp`: alfa objektů používá index `map.height * yy + xx` místo `width * yy + xx` (u nečtvercových map špatně).
- `effectData` se alokuje `[height][width]`, ale indexuje `[x][y]`.
- `planControl.jsp → addGamePlan` posílá `stumps: _this.stmps` (překlep, pařezy se nepřenesou).
- `GamePlan.convertToFinal`: dvakrát `DATA_WATER`, kámen (51–60) se nikdy nevygeneruje.
- `GamePlan.updateSoftObjects`: ikony luk a kuše jsou přehozené.

---

## 12. Ověřeno na živých datech (localhost:8080/hof, 2. 10. 2026)

Záznam: `binding/fixtures/loadFullPlan.json`, `getPlanInfo-empty.json`, `getPlanInfo-session1.json` (16 klíčových snímků: příprava → boj, krok, otočení, útok/obrana, chůze 3 diagonál, pohyb obra, běh).
Postavy: Theralis (hráč), Kostlivec (NPC), Obr lidožravý (NPC, `imageSize` 300).

- **Mapa:** 30×30, `L1` obsahuje jen gid 1 (tráva) a 3–4 (hlína). Objekty 4× `bush01`, 1× `tree01`, oba **neprůchozí** (`walkable = 0`, keř tedy taky). `mapData` server neposílá, `Top` je samé 0, `darkness` všude 100.
- **Fáze:** `plan` = `"X"` v přípravě, `"S"` v boji. `vision` a `visionType` se mění podle toho, kdo je zrovna na tahu (10/0, 10/2, 11/1).
- **Dvojklik ověřen:**
  1. První klik jen otočí postavu (`r = tr`, `tx = −1`) a zaměřené pole se objeví v `controlled[]`.
  2. Druhý klik nastaví `tx/ty/tr` (první krok) a `targetX/Y`.
  3. Po dojití je chvíli `tx,ty = x,y` a `tr = −1`, pak `tx = −1`.
- **Rychlost:** změny jsem viděl zhruba po 0,6–1 s na krok, server počítá 410 / 820 ms plus synchronizaci. Klient má krok interpolovat přibližně 0,5 s rovně a 0,8 s diagonálně a srovnat se podle `x/y`.
- **Cena pohybu (chůze):** rovný krok 4 `mp`, diagonální 6 `mp` (poměr 10 : 15).
  - **Běh:** přepnutí sníží `mp` (17 → 12) a zvýší `mr` (4 → 6). Krok během stojí 2 / 3 `mp`.
  - `mr` (dosah) posílá server, klient ho nepočítá.
- **Okraj dosahu:** `blocked[]` = prstenec ve vzdálenosti `mr` kolem aktivní postavy (ověřeno pro mr 4, 2, 5, 1). Po dojití se zmenší.
- **Velká bytost:** Obr lidožravý zabírá **3 pole napříč** (x 18–20, `r = 1` sever, hloubka 1), tedy `largeX1 = largeX2 = 1`, `largeY = 0`. Jeho pole chodí v `controlled[]` a posouvají se s ním.
- **Útok:**
  - Útočník má `moveType: "attack-1"` a `active`. Cíl dostane `color: "#ffff00"` a jeho pole je v `extra[]`.
  - Při obraně přejde `active` na obránce s `moveType: "block-unarmed"`, po vyhodnocení se vrátí zpět.
  - `moveType` útoku zůstává nastavený i po akci, dokud postava nezačne jinou činnost.
- **Kontrolní zóny:** když je na tahu Theralis, `extra[]` obsahuje zóny nepřátel (u obra velká oblast kolem něj).
- **Kvalita dat:** `controlled[]` obsahuje duplicity a `−1,−1`, takže je potřeba filtrovat. `type` je u všech `"X"` (žádné A/B/C). `imageName` je hash spritu a pro 3D vzhled nepoužitelný, proto je nutné doplnit `lookBase` (kap. 9).

---

## 13. Implementace fáze 1 (V16)

Hotovo v `three1/src/server/`, spuštění `?server` (živý hof přes Vite proxy) nebo `?mock` (záznam).

- **Mapa:** `loadFullPlan` → terén podle gid (tab. 7.1, tráva / hlína / voda / kámen / podlaha), objekty podle tab. 7.2
  (stromy a keře z GLB assetů, pařez, sloup, zeď, truhla, sud, …), `walkable[]` blokuje i pole bez objektu (voda).
  Po zvýšení `lastFullPlanVersion` se terén a objekty přestaví.
- **Postavy:** vznikají a mizí podle `actors[]`. Pole těla (i velkých bytostí) se berou z `controlled[]`
  (rozdělení podle pořadí actorů a vzdálenosti; zaměřené pole aktivního actora se odliší podle počtu polí těla
  naučeného z předchozích snímků). Krok se plynule animuje k `tx/ty` (≈ 2,1 pole/s, běh 3,2), při odchylce > 3 pole skok.
- **Animace:** `moveType` → `walk/run` při pohybu, `attack-*` → opakovaný útok, `block-*`/`evade` → obrana, `kneel/pray`, `lie`.
  `cast` a `use-item` zatím bez pózy.
- **Vzhled:** zatím heuristika (jméno „kostlivec“ → kostlivec, „obr/troll/zlobr“ nebo šířka ≥ 2 pole → obr se škálou podle šířky,
  ostatní → jeden ze 4 humanoidů podle `id`). Pro správný vzhled je potřeba `lookBase` (kap. 9).
- **Zvýraznění:** okraj dosahu = `blocked[]` (zelený rámeček), vnitřek dosahu se dopočítá metrikou 10/15, `extra[]` fialově,
  `spell[]` růžově, zaměřené pole bílým rámečkem, postavy modře (aktivní) / červeně.
- **Příkazy:** klik = `sendCoords` + `setDestination` (server sám rozliší 1. a 2. klik), klik / Ctrl+klik na jinou postavu =
  `selectPlanActor` (GM). Náhled cesty = přímá trasa jako na serveru, zastaví se na překážce.
- **Neřešeno (fáze 2+):** útok na cíl (`arenaSetTarget`, manévry), přepínání chůze / běh, viditelnost (`visibility`, `vision`, `darkness`),
  efekty kouzel (`spell.text`), jmenovky nad postavami.

---

## 14. Vložení do hof – stránka arena3d (V17)

- **Stránka:** `WEB-INF/pages/game/arena3d.jsp` = `arena.jsp`, kde je místo `<jsp:include page="plan.jsp">` 3D plán
  (`div#plan3d`, výška 65vh) a nad ním / pod ním beze změny HTML aréna, GM editor (`planTiles.jsp`, `planControl.jsp`).
  Odkaz „Sledování“ (Phaser `changeFollow`) je odstraněný, 3D kamera sleduje aktivní postavu sama.
  Načítání `#context=game&article=arena3d` zařídí hof.
- **Klient:** `WEB-INF/js/plan3d/` (servírováno jako `<ctx>/js/plan3d/` přes `mvc:resources /js/**`).
  Bez buildu: ES moduly, `import()` z klasického skriptu ve fragmentu (jQuery 3.7 inline skripty spouští).
  Vstup `src/embed.js` → `mount(element, { base: ctx, objectsBase: ctx + '/assets/objects/', charactersBase: ctx + '/assets/characters/', getView, onTileClick })`.
  GLB modely leží v `WEB-INF/assets/objects/` (`mvc:resources /assets/**`).
- **Chování na stránce:** jedno pollování `getPlanInfo` (Phaser plan.jsp se na arena3d nenačítá), klávesy (Q/E/C) jen
  když je myš nad 3D nebo má fokus a nikdy při psaní do formuláře, kolečko zoomuje jen nad 3D, po přechodu na jinou
  stránku se klient zastaví (element zmizí z DOM).
- **Aktualizace:** v projektu three1 `npm run export:hof`, pak v Eclipse obnovit projekt hof (F5), aby WTP publikoval
  nové soubory; v prohlížeči Ctrl+F5 (vnitřní moduly nemají verzi v URL).


---

## 15. Statické objekty 1:1 a grafický editor (V19)

- **Katalog** `three1/src/data/objectCatalog.js` → při exportu `WEB-INF/assets/objects/catalog.json`. Id = název v `objects[]`
  (`arenaPaint val`). Všechny objekty starého editoru kromě zbraní (`tree01`, `tree02`, `bush01`, `stump01`, `stone01`, `brick01`,
  `wall-n/e/s/w`, `stone-col`, `rock01`, `chest01`, `barrel01`, `boxes01`, `vase01`, `lantern01`, `candlestick01`) + nové
  `tree_oak_1..3`, `tree_pine_1..3`, `tree_birch_1..3`, `tree_apple_1..2`, `tree_dead_1..2`, `bush_1..2`.
  Prefixy zachovávají průchodnost serveru (`wall*` −1, `tree*/stone*/brick*/bush*/stump*` 0). `tree02` je skrytý v paletě (nahrazuje ho borovice).
- **3D:** každé id má model `<id>.glb` (+ procedurální fallback), náhled `previews/<id>.png`, rotace podle katalogu.
  Neznámé názvy (zbraně v `softObjects`) = značka předmětu.
- **Editor:** `planControl3d.jsp` (arena3d.jsp) – paleta: Vypnout / Tráva / Hlína / Voda / Smazat objekt + objekty po skupinách s náhledy.
  `sendTerrainChange` a hodnoty `arenaPaint` jsou stejné jako v `planControl.jsp`; opraven překlep `stumps`.
- **2D:** `plan.jsp` `spriteKey(name)` – pro id bez 2D textury zástupný sprite (`tree_pine*` → tree02, `tree*` → tree01, `bush*` → bush01, …).
- **Generátor:** plán se neukládá, generuje se za běhu. `GamePlan` (stromy/keře) losuje z `GEN_TREES` / `GEN_BUSHES` (katalogová id).

---

## 16. Avatar z vrstev (V21)

- **2D (beze změny):** `getActorImages` → `PersonWear.getImageSet` → `processImage` skládá PNG z vrstev
  `/opt/hof/chars/<lookBase>/<vrstva>/<animace>.png` v pořadí: boty, kalhoty | zbroj nohou, oblečení | zbroj těla
  (u `body-ballistic-tshirt` / skryté vesty obojí), toulec, rukavice, vlasy, helma, koruna, náhrdelník, zbraň v pravé ruce,
  levá ruka (štít / `axe-off` / `dagger-off`), vousy.
- **Server (V21):** `PersonWear.getLookLayers()` projde **stejný kód** `processImage` v režimu „jen klíče“ (bez čtení souborů)
  a vrátí seznam názvů vrstev; `PlanActor` posílá `lookBase`, `lookVariant`, `layers` a `positionType`.
  Hash 2D obrázku (`imageName`) se nemění.
- **3D:** `ProceduralAvatar(look)` = společný rig + tělo podle `lookBase` (`avatar/bodies.js`) + vrstvy podle klíčů (`avatar/layers.js`).
  Při změně `layers` (vytažení / odložení zbraně, nasazení helmy …) se avatar převleče bez nového vytvoření.
  Klient bez nových polí (starší server) použije dřívější heuristiku podle jména.
- **Otevřené:** skutečný seznam souborů `hairNN` / `beardNN` / `baseNN` je jen v `/opt/hof/chars` – mapování střih/barva je
  zatím odhad (`HAIR_STYLES`, `HAIR_COLORS`), upraví se podle 2D obrázků. Zvířata a netvoři bez humanoidní postavy
  (vlci, pavouci, draci, koně jako NPC …) zatím jen zástupně.

- **2H (V23):** `PlanActor.twoHanded` (boolean) = zbraň v pravé ruce je obouruční (`Item.isTwoHanded()`, včetně přepnutí
  držení) a levá ruka je volná. Změna za běhu avatara přestrojí (levá ruka pustí / chytí zbraň).

- **Jízda na koni (V25):** `PlanActor.positionType` = `HORSE_RIDE` / `HORSE_RIDE_RUN` → 3D vykreslí postavu v sedle procedurálního
  koně (krok / cval podle polohy a pohybu), při jiné poloze jezdec seskočí. Serverová pravidla beze změny (rychlost podle
  `getMountSpeed`, footprint 1×1). Vzhled koně zatím pevný (do budoucna podle předmětu / zvířete jezdce).
- **Poloha v aréně (hof, V26):** GM menu u aktéra (`ArenaHtml`): povalit | Stát | Běh | Leh | Klek | **jízda na koni | nájezd** |
  zápas − | chytit | zápas + | reset. Hráč vidí u vlastních aktérů v 1. kole v přípravné fázi jen volbu polohy
  (Stát … nájezd); `ArenaController.arenaSendActorValue` mu povolí jen příkaz `POSITION` pro vlastního aktéra v tomto okamžiku.
