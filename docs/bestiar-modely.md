# Bestiář a 3D modely nestvůr

Revize k 2026-10-08 (V29). Zdroj: `c:\opt\hof\data\beasts\*.hf` (264 nestvůr), jména z `res-src.json`, popisy z `WEB-INF/pages/bestiar/files/cz`. Náhled modelů: `bestiary.html`. 3D model se vybírá podle klíče bestiáře (`PlanActor.beast`), tabulka je v `three1/src/avatar/creatures.js`.

Sloupec „teď“ říká, co 3D klient ukáže dnes: humanoid s tělem podle 2D `lookBase`, „zástupný humanoid“ = tmavý humanoid místo zvířete (2D sprite nemá v 3D kostru), „nesedí“ = humanoid tam, kde má být něco jiného.

## Souhrn

| skupina | počet | stav / postup |
|---|---:|---|
| Psovité šelmy – ProceduralCanine | 11 | hotovo (V29) |
| Humanoidi – ProceduralAvatar | 78 | stačí současná kostra a těla z 2D vrstev |
| Humanoidi s doplňkem | 40 | současná kostra + nová část (hlava, křídla, ocas, materiál) |
| Gugové (démoni hněvu, rozkladu, obžerství, posedlosti) | 20 | nové tělo humanoida v bodies.js (lookBase gug) |
| Kočkovité šelmy – ProceduralFeline | 7 | hotovo: lev, tygr, levhart, šavlozubý (V32), chiméra, mantikora, sfinga (V33) |
| Medvědi a krysa – ProceduralBear, ProceduralRat | 5 | hotovo: medvědi a nekrotaur (V32), obří krysa (V33) |
| Kopytníci – ProceduralHoofed | 10 | hotovo (V33); jezdecký kůň zůstává ProceduralHorse |
| Těžcí čtyřnožci – ProceduralPachyderm | 3 | hotovo (V33) |
| Plazi – ProceduralReptile | 6 | hotovo (V33) |
| Dvounozí ještěři a ptáci – ProceduralBiped | 5 | hotovo (V33) |
| Draci a wyverni | 6 | plazí kostra + křídla |
| Ptáci a netopýři | 7 | nová kostra s křídly (letí nad polem) |
| Hadi, červi, stonožky | 17 | jedna článková kostra (vlnění), varianty hlavy a nožiček |
| Pavouci, hmyz, štíři, krabi – ProceduralArthropod | 20 | hotovo (V34), včetně létajícího hmyzu |
| Vodní tvorové | 5 | žralok, chobotnice (chapadla) |
| Beztvaří a elementálové | 12 | efekty / částice, bez kostry |
| Rostliny a houby | 8 | statický model s animovanými úponky |
| Nejasné | 4 | chybí popis vzhledu |

## Návrh pořadí

1. **Gugové** (20 nestvůr): jen nové tělo humanoida v `bodies.js` – nejvíc nestvůr za nejmenší práci.
2. **Zvířata** hotovo: kočkovité šelmy a medvědi (V32), kopytníci, těžcí čtyřnožci, krysa, plazi, dvounožci a lví složeniny (V33).
3. **Pavouci, hmyz, štíři a krabi** hotovo (V34). Další: **hadi, červi a stonožky** (17) – jedna článková kostra.
4. **Létající tvorové a vodní tvorové**: orel, gryf, fénix, netopýři, žralok, chobotnice.
5. **Humanoidi s doplňkem**: vlčí hlava pro vlkodlaky a vlkouše (hlava z vlka už je), křídla, rybí ocas, býčí hlava.
6. Draci, elementálové a rostliny.

## Psovité šelmy – ProceduralCanine (11)

Postup: hotovo (V29).

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| dog | Pes | Dog | dog-1 | -1 | vlk (V29) |  | Psy najdeme v lidských, barbarských i elfích vesnicích a městech. |
| fire-dog | Ohnivý pes | Fire Dog | undeaddog |  | vlk (V29) |  | Ohnivý pes je démon ohně podobný obřímu psu s červenočernou srstí, špičatýma ušima a obřími tesáky, obklopený plameny. |
| hellhound | Pekelný pes | Hellhound | hound-large | 5 | vlk (V29) |  | Pekelný pes je hrozivý strážce bran podsvětí, potomek mnohem mocnějšího nesmrtelného tříhlavého strážce. |
| hunting-hellbeast | Pekelný honič | Hunting Hellbeast | hound-large | 4 | vlk (V29) |  | Pekelný honič je strašlivá nestvůra z pekla, jejíž jméno vzbuzuje hrůzu. |
| soul-hound | Honič duší | Soul Hound | direwolf | 1 | vlk (V29) |  | Honiči duší jsou strašliví psi z Rozhraní, kteří se shromažďují tam, kudy putují duše mrtvých. |
| spectral-wolf | Přízračný vlk | Spectral Wolf | undeaddog | 1 | vlk (V29) |  | Přízračný vlk je děsivá magická bytost podobná obrovskému vlkovi, jehož tělem slabě prosvítá okolní světlo. |
| undead-animals | Nemrtvá zvířata | Undead Animals | undeaddog | 1 | vlk (V29) |  | Stejně jako lze oživit těla padlých lidí, mohou být temnou magií navrácena k pohybu i mrtvá zvířata. |
| vampire-elder-wolf-form | Upír prastarý (v podobě vlka) | Elder Vampire (wolf form) | direwolf | 1 | vlk (V29) |  | Prastarý upír ve formě vlka. |
| vampire-wolf-form | Upír (v podobě vlka) | Vampire (wolf form) | direwolf | 1 | vlk (V29) |  | Upír ve formě vlka. |
| wolf | Vlk obyčejný | Wolf | wolf-black | -1 | vlk (V29) |  | Vlci žijí od arktidy přes mírné lesy až po stepi. |
| wolf-ferocious | Vlk lítý | Dire Wolf | direwolf | 2 | vlk (V29) |  | Lítí vlci dorůstají velikosti poníka, ale jsou mnohem mohutnější. |

## Humanoidi – ProceduralAvatar (78)

Postup: stačí současná kostra a těla z 2D vrstev.

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| banshee | Banší | Banshee | shadow |  | humanoid (shadow) |  | Banší je děsivý nehmotný nemrtvý, který vzniká z duše ženy, jejíž smrt provázel hluboký žal, zrada nebo nenaplněná láska. |
| burning-curse | Planoucí prokletí | Burning Curse | zombie-2 |  | humanoid (zombie-2) |  | Planoucí prokletí je vzácný a mimořádně nebezpečný nemrtvý, který vzniká z kletby pronesené v okamžiku smrti. |
| cursed-knight | Prokletý rytíř | Cursed Knight | male |  | humanoid (male) |  | Prokletý rytíř kráčí světem v plátové zbroji z temného kovu, která neodhalí jedinou skulinu. |
| cursed-wraith | Prokletý přízrak | Cursed Wraith | shadow |  | humanoid (shadow) |  | Prokletý přízrak vzniká z kletby tak strašlivé, že překračuje hranice smrti. |
| dark-paladin | Temný paladin | Dark Paladin | male |  | humanoid (male) |  | Temný paladin je padlý paladin, jehož duši sevřela kletba vlastního boha. |
| death-guard | Strážce smrti | Death Guardian | male |  | humanoid (male) |  | Tvor vytvořený nekromantským kouzlem z čiré temnoty, není ale nemrtvý. |
| demon-destruction-1 | Démon zkázy I | Demon of Destruction I | daemon-lesser | 2 | humanoid (daemon-lesser) |  | Gug je divoký a tupý démon, typický démon hněvu. |
| demon-destruction-2 | Démon zkázy II | Demon of Destruction II | daemon-lesser | 4 | humanoid (daemon-lesser) |  |  |
| demon-destruction-3 | Démon zkázy III | Demon of Destruction III | dameon-sword-nowings | 6 | humanoid (dameon-sword-nowings) |  |  |
| demon-destruction-4 | Démon zkázy IV | Demon of Destruction IV | brute-dark-brown | 8 | humanoid (brute-dark-brown) |  |  |
| demon-destruction-5 | Démon zkázy V | Demon of Destruction V | brute-dark-brown | 10 | humanoid (brute-dark-brown) |  |  |
| demon-devil-master | Ďábelský pán | Devil Lord | daemon-pitlord | 10 | humanoid (daemon-pitlord) |  | Říká se, že v nejtemnějších koutech Rozhraní žijí tři pekelní páni, bytosti nezměrné síly a moci polobohů. |
| demon-devourer-1 | Démon požírač I | Demon Devourer I | male |  | humanoid (male) |  | Otroci Otrok je první nebezpečnější forma požírače. |
| demon-devourer-2 | Démon požírač II | Demon Devourer II | male | 1 | humanoid (male) |  | Sluhové Ze zakukleného otroka vzniká sluha. |
| demon-lord | Pán démonů | Demon Lord | daemon-pitlord | 10 | humanoid (daemon-pitlord) |  | Pohleďte na nejmocnějšího z démonů – pohleďte a zemřete. |
| demon-shadow-1 | Démon stínu I | Demon of Shadow I | shadow |  | humanoid (shadow) |  |  |
| demon-shadow-2 | Démon stínu II | Demon of Shadow II | shadow | 1 | humanoid (shadow) |  |  |
| demon-shadow-3 | Démon stínu III | Demon of Shadow III | shadow | 2 | humanoid (shadow) |  |  |
| demon-shadow-4 | Démon stínu IV | Demon of Shadow IV | shadow | 3 | humanoid (shadow) |  |  |
| demon-shadow-5 | Démon stínu V | Demon of Shadow V | shadow | 4 | humanoid (shadow) |  |  |
| dryad | Dryáda | Dryad | female |  | humanoid (female) |  | Dryády jsou na první pohled k nerozeznání od lidských nebo elfích žen. |
| forest-giant | Obr lesní | Forest Giant | troll | 2 | humanoid (troll) |  | Lesní obr je kolohnát asi tři metry vysoký, divokého vzhledu, s dlouhými vlasy a často i vousy. |
| frost-giant | Obr ledový | Frost Giant | giant-air | 4 | humanoid (giant-air) |  | Ledový obr se tyčí do výšky tří metrů. |
| ghost-warrior | Přízračný válečník | Ghost Warrior | male |  | humanoid (male) |  | Přízračný válečník je neklidný duch bojovníka, který padl v bitvě a nikdy nenašel pokoj. |
| ghoul | Ghúl | Ghoul | ghoul |  | humanoid (ghoul) |  | V noci vylézají z krypt, jeskyní a děr v zemi tlející kostry potažené seschlou šedou kůží. |
| giant-orc | Ork | Orc | uruk-soldier | 2 | humanoid (uruk-soldier) |  | Orkové žijí tam, kde se jiní neudrží: ve vysokých horách, na zmrzlých pláních, v džunglích i na pouštích daleko od civilizace. |
| gorgon | Gorgona | Gorgon | gorgon | 2 | humanoid (gorgon) |  | V dávných časech stvořili rozhněvaní bohové příšerné bytosti Temnot, napůl ženy a napůl hady, a vypustili je do světa, aby ztrestaly nepo… |
| heavy-infantry-1 | Těžkooděnec I | Heavy Infantry I | male |  | humanoid (male) |  | Příklad těžkooděnce. |
| heavy-infantry-2 | Těžkooděnec II | Heavy Infantry II | male |  | humanoid (male) |  | Příklad těžkooděnce. |
| heavy-infantry-3 | Těžkooděnec III | Heavy Infantry III | male |  | humanoid (male) |  | Příklad těžkooděnce. |
| heavy-infantry-4 | Těžkooděnec IV | Heavy Infantry IV | male |  | humanoid (male) |  | Příklad těžkooděnce. |
| heavy-infantry-5 | Těžkooděnec V | Heavy Infantry V | male |  | humanoid (male) |  | Příklad těžkooděnce. |
| hill-giant | Obr horský | Hill Giant | troll | 10 | humanoid (troll) |  | Horský obr je obrovský kolohnát vysoký až deset metrů, s kůží barvy skály. |
| illusion-figure | Iluzní postava | Illusion Figure | shadow |  | humanoid (shadow) |  | Tvor vytvořený iluzním kouzlem. |
| izrod | Izrod | Izrod | ghoul | 1 | humanoid (ghoul) |  | Izrodi jsou potomci lidí, kteří žili v zakletých bažinách tak dlouho, že dnes připomínají spíš nestvůry než lidské bytosti. |
| jazgath | Jazgath | Jazgath | brute-green | 1 | humanoid (brute-green) |  | Jazgath je odpudivý tvor s tmavou, zelenohnědou kůží pokrytou drobnými výrůstky. |
| lich | Lich | Lich | male |  | humanoid (male) |  | Skutečnou raritou mezi nemrtvými jsou lichové: kdysi mocní čarodějové, nejčastěji nekromanti, kteří se dobrovolně vzdali smrtelnosti a vl… |
| lost-soul | Zbloudilá duše | Lost Soul | male |  | humanoid (male) |  | Zbloudilá duše je jedním z nejubožejších a zároveň nejznepokojivějších nemrtvých. |
| mug-man | Blátivec | Mud Man | brute-dark-brown | 2 | humanoid (brute-dark-brown) |  | Blátivec bývá zaměňován za elementála, protože je stvořen z bláta a hlíny. |
| mummy | Mumie | Mummy | mummy |  | humanoid (mummy) |  | Mumie jsou nemluvní strážci, kteří slouží i po smrti a chrání svatá místa před vetřelci. |
| narghoul | Narghúl | Narghoul | ghoul-2 |  | humanoid (ghoul-2) |  | Narghúl je podivné stvoření, zčásti živé a zčásti nemrtvé. |
| ogre | Obr lidožravý | Ogre | ogre | 3 | humanoid (ogre) |  | Lidožravý obr je ohyzdný kolohnát vysoký až tři metry. |
| orc | Skřet | Orc | male | -1 | humanoid (male) |  | Skřetů je mnoho a jsou velmi rozmanití. |
| orc-rider | Skřetí legie | Orc Rider | male | -1 | humanoid (male) |  | Legionář smrti může pocházet z kteréhokoli plemene skřetů. |
| orc-shaman | Skřet stříbrný | Silver Orc | male | -1 | humanoid (male) |  | Stříbrní skřeti mají šedou kůži, která se ve světle pochodní stříbřitě leskne – odtud jejich jméno. |
| quiet-guard | Tichý strážce | Quiet Guardian | shadow |  | humanoid (shadow) |  | Tichý strážce je tvořen silou smrti a magií. |
| raxun | Raxun | Raxun | male |  | humanoid (male) |  | Raxun se vzdáleně podobá člověku. |
| rusalka | Rusalka | Rusalka | female |  | humanoid (female) |  | Rusalka je neklidná nemrtvá bytost, která vzniká téměř výhradně ze smrti ženy spojené se zradou, nešťastnou láskou nebo násilím. |
| shadow-of-dead | Stín zemřelého | Shadow of the Dead | shadow |  | humanoid (shadow) |  | Stín je nemrtvý, kterého tvoří zbytek umírající duše. |
| shooter-1 | Střelec I | Shooter I | male |  | humanoid (male) |  | Příklad střelce. |
| shooter-2 | Střelec II | Shooter II | male |  | humanoid (male) |  | Příklad střelce. |
| shooter-3 | Střelec III | Shooter III | male |  | humanoid (male) |  | Příklad střelce. |
| shooter-4 | Střelec IV | Shooter IV | male |  | humanoid (male) |  | Příklad střelce. |
| shooter-5 | Střelec V | Shooter V | male |  | humanoid (male) |  | Příklad střelce. |
| skeletal-mage | Kostlivý kouzelník | Skeletal Mage | male |  | humanoid (male) |  | Kostlivý kouzelník vzniká, jak napovídá jméno, z kostí padlého kouzelníka. |
| skeleton | Kostlivec | Skeleton | male |  | humanoid (male) |  | Pokud se ze tmy vynoří kráčející kostra a vám se sevře žaludek, potkali jste kostlivce. |
| skeleton-giant | Kostlivý obr | Skeleton Giant | troll | 6 | humanoid (troll) |  | Pokud se nekromant nespokojí s obyčejným nemrtvým kostlivcem, může místo něj oživit toto monstrum. |
| skeleton-king | Kostlivý král | Skeleton King | male |  | humanoid (male) |  | Kostlivý král se podobá běžnému kostlivci, ale hlavu mu zdobí zlatá koruna a oči mu planou temně modrým světlem. |
| skeleton-warrior | Kostlivý válečník | Skeleton Warrior | male |  | humanoid (male) |  | Tělo zkušeného válečníka si může pamatovat naučené pohyby a chování v boji. |
| spectre | Spektra | Spectre | female |  | humanoid (female) |  | Spektra je mocný přízrak, který vzniká z velmi významné či mocné osoby, typicky princezny nebo kouzelnice. |
| swamp-hag | Bahenní víla | Swamp Hag | female |  | humanoid (female) |  | Setkání s bahenními vílami nepatří k nejhezčím zážitkům. |
| swordsman-1 | Šermíř I | Swordsman I | male |  | humanoid (male) |  | Příklad šermíře. |
| swordsman-2 | Šermíř II | Swordsman II | male |  | humanoid (male) |  | Příklad šermíře. |
| swordsman-3 | Šermíř III | Swordsman III | male |  | humanoid (male) |  | Příklad šermíře. |
| swordsman-4 | Šermíř IV | Swordsman IV | male |  | humanoid (male) |  | Příklad šermíře. |
| swordsman-5 | Šermíř V | Swordsman V | male |  | humanoid (male) |  | Příklad šermíře. |
| troll | Troll | Troll | troll | 6 | humanoid (troll) |  | Trollové jsou obři vysocí kolem pěti metrů. |
| vampire | Upír | Vampire | male |  | humanoid (male) |  | Upír patří mezi vládnoucí nemrtvé: je to duše, která si dokáže udržet či znovu vytvořit vlastní tělesnou schránku. |
| vampire-elder | Upír prastarý | Elder Vampire | male |  | humanoid (male) |  | Prastaří upíři náleží mezi nejmocnější bytosti existující v Pravém světě. |
| warrior-1 | Válečník I | Warrior I | male |  | humanoid (male) |  | Příklad válečníka, který nemá zásadní zaměření. |
| warrior-2 | Válečník II | Warrior II | male |  | humanoid (male) |  | Příklad válečníka, který nemá zásadní zaměření. |
| warrior-3 | Válečník III | Warrior III | male |  | humanoid (male) |  | Příklad válečníka, který nemá zásadní zaměření. |
| warrior-4 | Válečník IV | Warrior IV | male |  | humanoid (male) |  | Příklad elitního válečníka, který nemá zásadní zaměření. |
| warrior-5 | Válečník V | Warrior V | male |  | humanoid (male) |  | Příklad elitního válečníka, který nemá zásadní zaměření. |
| wraith | Přízrak | Wraith | shadow |  | humanoid (shadow) |  | Setkání s přízrakem patří k nejděsivějším zážitkům, jaké mohou živí poznat. |
| xandron | Xandron | Xandron | male |  | humanoid (male) |  | Xandroni pocházejí z tak vzdálené démonické sféry, že je někteří učenci považují za pouhou pověru. |
| zhogg | Zhogg | Zhogg | male | 2 | humanoid (male) |  | Zhogg je ještěr, který se vzdáleně podobá člověku. |
| zombie | Zombie | Zombie | zombie-1 |  | humanoid (zombie-1) |  | Mrtví kráčejí krajinou za mručení a naříkání a co jim padne do drápů, to roztrhají a sežerou. |

## Humanoidi s doplňkem (40)

Postup: současná kostra + nová část (hlava, křídla, ocas, materiál).

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| air-elemental-greater | Vzdušný elementál vyšší | Greater Air Elemental | brute-blue | 6 | humanoid (brute-blue) – nesedí | tělo z energie / ohně / vody (průsvitné, částice) | Silnější forma vzdušného elementála, kterou je těžší ovládat. |
| automaton | Automaton | Automaton | brute-dark-brown | 3 | humanoid (brute-dark-brown) – nesedí | tělo z kamene / kovu (bez oblečení, hranaté) | Automaton dokážou vyrobit jen mistři alchymie a mechaniky. |
| centaur | Kentaur | Centaur | horse-1 |  | kůň | koňské tělo s lidským trupem (kostra koně + horní půlka avatara) |  |
| cobold | Vlkouš | Cobold | uruk-crusher | 1 | humanoid (uruk-crusher) – nesedí | vlčí hlava (hlava z vlka V29) na humanoidovi | Vlkouši jsou tvorové podobní člověku, ale mají v sobě hodně z vlků. |
| demon-devourer-3 | Démon požírač III | Demon Devourer III | daemon-master | 3 | humanoid (daemon-master) – nesedí | velká křídla a rohy (draunug pán) | Páni Podaří-li se sluhovi stát pánem, naroste do výšky asi tří metrů, na hlavě mu vyraší velké rohy a vyrostou mu křídla. |
| demon-devourer-4 | Démon požírač IV | Demon Devourer IV | daemon-infernal | 5 | humanoid (daemon-infernal) – nesedí | velká křídla a rohy (draunug pán) | Mocní páni Draunug, který se stane mocným pánem, opět vyroste, až měří kolem pěti metrů, a získá silnější magické schopnosti. |
| demon-devourer-5 | Démon požírač V | Demon Devourer V | daemon-greater | 7 | humanoid (daemon-greater) – nesedí | velká křídla a rohy (draunug pán) | Děsiví páni Děsivý pán je skutečná rarita; naštěstí jich není mnoho ani v nejtemnějších oblastech Rozhraní. |
| demon-pride-1 | Démon pýchy I | Demon of Pride I | female |  | humanoid (female) – nesedí | sukuba: křídla, růžky, ocas |  |
| demon-pride-2 | Démon pýchy II | Demon of Pride II | female |  | humanoid (female) – nesedí | sukuba: křídla, růžky, ocas |  |
| demon-pride-3 | Démon pýchy III | Demon of Pride III | male |  | humanoid (male) – nesedí | sukuba: křídla, růžky, ocas |  |
| demon-pride-4 | Démon pýchy IV | Demon of Pride IV | male |  | humanoid (male) – nesedí | sukuba: křídla, růžky, ocas |  |
| demon-pride-5 | Démon pýchy V | Demon of Pride V | female |  | humanoid (female) – nesedí | sukuba: křídla, růžky, ocas |  |
| earth-elemental | Zemní elementál | Earth Elemental | brute-dark-brown | 3 | humanoid (brute-dark-brown) – nesedí | tělo z kamene / kovu (bez oblečení, hranaté) | Tento elementál se zjevuje v podobě obra poskládaného z velkých balvanů. |
| earth-elemental-giant | Zemní elementál obří | Giant Earth Elemental | fiend-brown | 12 | humanoid (fiend-brown) – nesedí | tělo z kamene / kovu (bez oblečení, hranaté) | Jedna z největších forem zemního elementála kolosální velikosti. |
| earth-elemental-greater | Zemní elementál vyšší | Greater Earth Elemental | brute-dark-brown | 7 | humanoid (brute-dark-brown) – nesedí | tělo z kamene / kovu (bez oblečení, hranaté) | Větší a nezvladatelnějí forma zemního elementála. |
| evil-tree | Oživlý strom | Evil Tree | fiend-brown | 12 | humanoid (fiend-brown) – nesedí | postava ze dřeva, kůry a listí | Většina stromů celý život pokojně stojí a roste, nanejvýš upustí větev nebo nastaví vetřelci kořen. |
| fairy | Lesní víla | Fairy | female |  | humanoid (female) – nesedí | křídla | Lesní víly jsou křehká stvoření, která žijí výhradně v hvozdech. |
| fallen-angel | Padlý anděl | Fallen Angel | male |  | humanoid (male) – nesedí | křídla | Padlý anděl je jedním z nejhorších nepřátel, jaké si lze představit. |
| faun | Faun | Faun | male |  | humanoid (male) – nesedí | kozí nohy, růžky | Faun, též satyr nebo rokyta, je napůl kozel a napůl člověk: od pasu nahoru má lidské tělo, dole kozí nohy, na hlavě malé růžky a špičaté … |
| fire-elemental-giant | Ohnivý elementál obří | Giant Fire Elemental | male | 8 | humanoid (male) – nesedí | tělo z energie / ohně / vody (průsvitné, částice) | Tento elementál spálí vše na popel. |
| fire-elemental-greater | Ohnivý elementál vyšší | Greater Fire Elemental | brute-red | 4 | humanoid (brute-red) – nesedí | tělo z energie / ohně / vody (průsvitné, částice) | Žár tohoto elementál je tak strašný, že mu lze jen těžko odolat. |
| forest-phantom | Lesní přízrak | Forest Phantom | plaguefiend |  | humanoid (plaguefiend) – nesedí | postava ze dřeva, kůry a listí | Lesní přízrak má člověku podobnou postavu z listí, kůry a kořenů. |
| gargoyle | Gargoyla | Gargoyle | wyvern-gray | 1 | zástupný humanoid (wyvern-gray) | kamenná šelma s netopýřími křídly a ocasem | Nehybná gargoyla vypadá jako prapodivná socha z šedého nebo černého kamene, která připomíná spojení šelmy, netopýra a skřeta: má tělo šel… |
| golem | Golem | Golem | brute-dark-brown | 3 | humanoid (brute-dark-brown) – nesedí | tělo z kamene / kovu (bez oblečení, hranaté) | Golem je nejjednodušší stroj, jaký dokážou alchymisté vyrobit. |
| gorilla | Gorila | Gorilla | black-walker | 3 | humanoid (black-walker) – nesedí | opičí proporce (dlouhé ruce, chůze po kotnících) | Na rozdíl od malých opic mohou být gorily nebezpečné. |
| headless | Bezhlavec | Headless | ghoul |  | humanoid (ghoul) – nesedí | bez hlavy | Tento nebezpečný nemrtvý vzniká z popravených, velmi zlých lidí nebo z někoho, komu se stala velká křivda. |
| maggot-man | Červicec | Maggot Man | ghoul | 1 | humanoid (ghoul) – nesedí | postava z roje hmyzu / červů (částice) | Červivec je tvor podobný člověku, ale složený z hemžících se červů, které drží pohromadě magie. |
| mermaid | Mořská panna | Mermaid | female |  | humanoid (female) – nesedí | rybí ocas místo nohou | Mořské panny neboli nereidy jsou ženské protějšky tritonů. |
| minotaur | Minotaur | Minotaur | uruk-crusher | 2 | humanoid (uruk-crusher) – nesedí | býčí hlava, rohy, kopyta | Minotauři jsou tvorové s býčí hlavou, lidským tělem a kopyty. |
| nature-wrath | Zloba přírody | Nature Wrath | fiend-green | 20 | humanoid (fiend-green) – nesedí | postava ze dřeva, kůry a listí | Pokud někdo opravdu rozzlobí samotnou přírodu, ta povstane v podobě hněvu a smete vše, co se jí postaví do cesty. |
| serpent-guardian | Hadí strážce | Serpent Guardian | hound-large | 1 | zástupný humanoid (hound-large) | hadí tělo s lidským trupem | Hadí strážce je had s lidským trupem a dvěma pažemi, ve kterých může třímat zbraně. |
| swarm-devil | Děsivý roj | Swarm Devil | brute-green | 3 | humanoid (brute-green) – nesedí | postava z roje hmyzu / červů (částice) | Děsivý roj vzniká kouzlem, které spojí hmyz, například vosy, do podoby postavy. |
| tree-folk | Stromový lid | Tree Folk | fiend-brown | 12 | humanoid (fiend-brown) – nesedí | postava ze dřeva, kůry a listí | Stromový muž, který se nehýbe, je k nerozeznání od stromu. |
| triton | Triton | Triton | male | 1 | humanoid (male) – nesedí | rybí ocas místo nohou | Tritoni se vzdáleně podobají lidem, ale tělo mají pokryté šupinami a místo nohou rybí ocas. |
| ubeg | Ubeg | Ubeg | black-walker | 4 | humanoid (black-walker) – nesedí | hmyzí hlava s kusadly | Ubegové jsou velcí hnědí tvorové s kusadly a hmyzíma očima. |
| urxuquer | Urxuquer | Urxuquer | giantspider-black | 1 | zástupný humanoid (giantspider-black) | pavoukočlověk (lidský trup na pavoučím těle) | Urxuqueři jsou strašliví pavoukolidé, které stvořil jeden z temných bohů, aby mu sloužili a ovládli svět. |
| vestrad | Vestrad | Vestrad | male |  | humanoid (male) – nesedí | tělo z energie / ohně / vody (průsvitné, částice) | Vestrad, známý také jako Bleskohřmot, je démonická bytost z jiskřící energie, která se probouzí z temných hlubin a vládne moci blesků. |
| water-elemental-greater | Vodní elementál vyšší | Greater Water Elemental | brute-blue | 6 | humanoid (brute-blue) – nesedí | tělo z energie / ohně / vody (průsvitné, částice) |  |
| werewolf | Vlkodlak | Werewolf | black-walker | 2 | humanoid (black-walker) – nesedí | vlčí hlava (hlava z vlka V29) na humanoidovi | Lykantropie je božský dar Lianey: dlouhověkost, schopnost měnit se ve zvíře a odolávat zranění i nemocem. |
| werewolf-elder | Vlkodlak prastarý | Elder Werewolf | black-walker | 2 | humanoid (black-walker) – nesedí | vlčí hlava (hlava z vlka V29) na humanoidovi | Prastaří vlkodlaci jsou velmi vzácní, mocní a nesmírně nebezpeční. |

## Gugové (démoni hněvu, rozkladu, obžerství, posedlosti) (20)

Postup: nové tělo humanoida v bodies.js (lookBase gug).

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| demon-anger-1 | Démon hněvu I | Demon of Wrath I | gug | 2 | zástupný humanoid (gug) |  |  |
| demon-anger-2 | Démon hněvu II | Demon of Wrath II | gug | 3 | zástupný humanoid (gug) |  |  |
| demon-anger-3 | Démon hněvu III | Demon of Wrath III | gug | 4 | zástupný humanoid (gug) |  |  |
| demon-anger-4 | Démon hněvu IV | Demon of Wrath IV | gug | 5 | zástupný humanoid (gug) |  |  |
| demon-anger-5 | Démon hněvu V | Demon of Wrath V | gug | 7 | zástupný humanoid (gug) |  |  |
| demon-decay-1 | Démon rozkladu I | Demon of Decay I | gug | 2 | zástupný humanoid (gug) |  |  |
| demon-decay-2 | Démon rozkladu II | Demon of Decay II | gug | 2 | zástupný humanoid (gug) |  |  |
| demon-decay-3 | Démon rozkladu III | Demon of Decay III | gug | 2 | zástupný humanoid (gug) |  |  |
| demon-decay-4 | Démon rozkladu IV | Demon of Decay IV | gug | 2 | zástupný humanoid (gug) |  |  |
| demon-decay-5 | Démon rozkladu V | Demon of Decay V | gug | 2 | zástupný humanoid (gug) |  |  |
| demon-gluttony-1 | Démon obžerství I | Demon of Gluttony I | gug | 2 | zástupný humanoid (gug) |  |  |
| demon-gluttony-2 | Démon obžerství II | Demon of Gluttony II | gug | 2 | zástupný humanoid (gug) |  |  |
| demon-gluttony-3 | Démon obžerství III | Demon of Gluttony III | gug | 2 | zástupný humanoid (gug) |  |  |
| demon-gluttony-4 | Démon obžerství IV | Demon of Gluttony IV | gug | 2 | zástupný humanoid (gug) |  |  |
| demon-gluttony-5 | Démon obžerství V | Demon of Gluttony V | gug | 2 | zástupný humanoid (gug) |  |  |
| demon-possession-1 | Démon posedlosti I | Demon of Possession I | gug | 2 | zástupný humanoid (gug) |  |  |
| demon-possession-2 | Démon posedlosti II | Demon of Possession II | gug | 2 | zástupný humanoid (gug) |  |  |
| demon-possession-3 | Démon posedlosti III | Demon of Possession III | gug | 2 | zástupný humanoid (gug) |  |  |
| demon-possession-4 | Démon posedlosti IV | Demon of Possession IV | gug | 2 | zástupný humanoid (gug) |  |  |
| demon-possession-5 | Démon posedlosti V | Demon of Possession V | gug | 2 | zástupný humanoid (gug) |  |  |

## Kočkovité šelmy – ProceduralFeline (7)

Postup: hotovo: lev, tygr, levhart, šavlozubý (V32), chiméra, mantikora, sfinga (V33).

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| chimera | Chiméra | Chimera | hound-large | 5 | lví složenina (V33) | lví tělo, více hlav | Chiméra je velký a hrozivý tvor s mohutným, svalnatým tělem lva pokrytým hustou srstí. |
| leopard | Levhart | Leopard | wolf-timber |  | kočkovitá šelma (V32) |  | Levhart (panter, pardál) Levharti se dokážou přizpůsobit téměř jakémukoli prostředí od nížin až vysoko do hor. |
| lion | Lev | Lion | hound-large | 3 | kočkovitá šelma (V32) |  | Pustinný lev má žlutohnědou srst, která jej v jeho prostředí dobře maskuje. |
| manticore | Mantikora | Manticore | hound-large | 2 | lví složenina (V33) | lví tělo, křídla, štíří ocas | Mantikora je výsledkem nečistých alchymistických pokusů. |
| sabretooth | Tygr šavlozubý | Sabretooth Tiger | hound-large | 5 | kočkovitá šelma (V32) |  | Šavlozubý tygr je příbuzný lva a tygra, ale je mnohem mohutnější a strašnější. |
| sphinx | Sfinga | Sphinx | hound-large | 3 | lví složenina (V33) | lví tělo, lidská hlava, křídla | Sfinga je tvor se lvím tělem a lidskou hlavou. |
| tiger | Tygr | Tiger | hound-large | 4 | kočkovitá šelma (V32) |  | Tygr je velká hnědožlutá šelma s charakteristickými černými pruhy. |

## Medvědi a krysa – ProceduralBear, ProceduralRat (5)

Postup: hotovo: medvědi a nekrotaur (V32), obří krysa (V33).

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| bear | Medvěd | Bear | hound-large | 5 | medvěd (V32) |  | Medvěd hnědý váží až čtvrt tuny a měří nanejvýš dva metry. |
| bear-large | Medvěd velký | Large Bear | hound-large | 7 | medvěd (V32) |  | Větší druhy medvědů, jako je grizzly, lední nebo severský medvěd. |
| cave-bear | Medvěd jeskynní | Cave Bear | giant-dark-beast | 8 | medvěd (V32) |  | Jeskynní medvěd patří k nejstrašlivějším šelmám světa. |
| giant-rat | Krysa obří | Giant Rat | giantrat |  | krysa (V33) | krysa (ProceduralRat) | Obří krysa není přirozené zvíře, vzniká působením magie nebo alchymie. |
| necrotaur | Nekrotaur | Necrotaur | hound-large | 4 | medvěd (V32) |  | Nekrotaur vzniká oživením velkého zvířete, například medvěda. |

## Kopytníci – ProceduralHoofed (10)

Postup: hotovo (V33); jezdecký kůň zůstává ProceduralHorse.

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| boar | Prase divoké | Boar | donkey-1 | 1 | hoofed (V33) | prase: krátké nohy, kly | Divoké prase je plaché zvíře žijící převážně v lesích. |
| bull | Býk | Bull | horse-1 | 6 | kůň | skot: kostra koně, těžší tělo, rohy | Skot dělíme na domácí a divoký (buvoli, bizoni). |
| cow | Kráva | Cow | buck | 4 | hoofed (V33) | skot: kostra koně, těžší tělo, rohy | Skot dělíme na domácí (krávy a býci) a divoký (buvoli, bizoni). |
| drakun | Drakůň | Drakun | horse-1 | 4 | kůň | kůň + úprava (černá srst a žhavé oči / roh / mohutnější šelma) | Drakůň je šelma, která na první pohled připomíná koně, je však mnohem větší a robustnější, s mohutnými svaly. |
| fire-bull | Ohnivý býk | Fire Bull | hound-large | 5 | hoofed (V33) | skot: kostra koně, těžší tělo, rohy | Ohnivého býka splete s obyčejným zvířetem jen slepec. |
| horse | Kůň | Horse | horse-1 | 5 | kůň | je – ProceduralHorse (zatím vždy se sedlem) | Kůň patří odnepaměti k domácím zvířatům. |
| nightmare | Noční můra | Nightmare | horse-1 | 4 | kůň | kůň + úprava (černá srst a žhavé oči / roh / mohutnější šelma) | Zdálky si noční můru snadno spletete se vznešeným koněm: má antracitově černou srst, hrdou hlavu a hustou hřívu. |
| undead-bull | Nemrtvý býk | Undead Bull | hound-large | 5 | hoofed (V33) | skot: kostra koně, těžší tělo, rohy | Nemrtvý býk je děsivá stvůra, mohutnější než kterýkoli živý býk: tělo měří přes čtyři metry na délku a přes dva na výšku. |
| unicorn | Jednorožec | Unicorn | horse-1 |  | kůň | kůň + úprava (černá srst a žhavé oči / roh / mohutnější šelma) | Jednorožec dokáže na první pohled uchvátit každého, kdo jej spatří. |
| war-horse | Kůň válečný | War Horse | horse-1 | 6 | kůň | je – ProceduralHorse (zatím vždy se sedlem) | Válečný kůň je obzvlášť silný kůň vycvičený pro boj. |

## Těžcí čtyřnožci – ProceduralPachyderm (3)

Postup: hotovo (V33).

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| elephant | Slon | Elephant | lizard-large-dark | 10 | heavy (V33) | těžký čtyřnožec (sloupové nohy) | Slon je kolosální zvíře vysoké až čtyři metry a těžké mnoho tun, s šedou nebo hnědou kůží. |
| hippopotamus | Hroch | Hippopotamus | lizard-large-dark | 8 | heavy (V33) | těžký čtyřnožec (sloupové nohy) | Hroch má zavalité tělo, velkou hlavu se široce rozevíratelnou tlamou a mezi prsty krátké plovací blány. |
| rhinoceros | Nosorožec | Rhinoceros | lizard-large-dark | 8 | heavy (V33) | těžký čtyřnožec (sloupové nohy) | Nosorožec je mohutné zvíře starobylého vzhledu s tlustou kůží a hlavou zakončenou charakteristickým rohem, u některých druhů velkým a mal… |

## Plazi – ProceduralReptile (6)

Postup: hotovo (V33).

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| basilisk | Bazilišek | Basilisk | lizard-large-dark | 4 | reptile (V33) | osminohý ještěr | Bazilišek je osminohý ještěr s vypouklýma, hypnotizujícíma očima. |
| crocodile | Krokodýl | Crocodile | hound-large | 3 | reptile (V33) | nízký plaz na roztažených nohách | Krokodýl žije v teplých krajích v bažinách a stojatých vodách. |
| dragon-turtle | Drakoželva | Dragon Turtle | crawler | 10 | reptile (V33) | želva s ostnatým krunýřem | Drakoželva je obří želva, mnohem úspěšnější než její běžné příbuzné, protože je masožravá a navíc velmi zkušený lovec. |
| giant-crocodille | Gigakrokodýl | Giant Crocodile | lizard-large-dark | 11 | reptile (V33) | nízký plaz na roztažených nohách | Gigakrokodýl je obrovský příbuzný obyčejného krokodýla. |
| giant-eft | Gigamlok | Giant Eft | hound-large | 4 | reptile (V33) | nízký plaz na roztažených nohách | Gigamlok se dříve vyskytoval ve většině teplých řek a močálů, ale lidé ho při osidlování vytlačili, a tak dnes žije jen v odlehlých oblas… |
| karialis | Karialis | Karialis | lizard-large-dark | 10 | reptile (V33) | obrněný, hřbetní pláty, ostnatý ocas s palicí | Karialis je mohutný šedohnědý tvor s hlavou velkou asi jako člověk, masivním trupem a ostnatým ocasem zakončeným jako palcát. |

## Dvounozí ještěři a ptáci – ProceduralBiped (5)

Postup: hotovo (V33).

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| gauton | Gauton | Gauton | dragon-red | 9 | biped (V33) | dvounohý ještěr | Gauton je obrovský ještěr vysoký šest až osm metrů, se zelenohnědou kůží, dvěma silnýma nohama, zakrnělými předními packami a velkou hlav… |
| ghat | Ghat | Ghat | hound-large | 3 | biped (V33) | shrbený obojživelný ještěr s velkými drápy (podle obrázku chodí po dvou) | Ghat je zelenošedý ještěr s tlamou plnou ostnatých zubů, mohutným tělem a tlapami s ostrými drápy a plovacími blánami. |
| sagat | Sagat | Sagat | hound-large | 1 | biped (V33) | dvounohý ještěr | Sagat je velmi rychlý ještěr, který obývá teplejší kraje od plání po hluboké lesy. |
| terrorbird | Hrůzopták | Terrorbird | dragon-red | 20 | biped (V33) | obří pták s křídly | Hrůzopták patří k vůbec největším zvířatům, jaká kdy žila. |
| uth | Uth | Uth | turkey-1 | 1 | biped (V33) | dvounohý ještěr | Uthové jsou draví tvorové, kteří žijí v malých stádech nebo samotářsky na savanách a v řídkých listnatých lesích. |

## Draci a wyverni (6)

Postup: plazí kostra + křídla.

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| dragon | Drak | Dragon | dragon-red | 13 | zástupný humanoid (dragon-red) |  | Draci jsou prastarý druh moudrých ještěrů obrovských rozměrů: dospělý drak měří kolem pěti metrů na výšku a dvanáct na délku a váží někol… |
| dragon-elder | Drak prastarý | Elder Dragon | dragon-red | 15 | zástupný humanoid (dragon-red) |  | O schopnostech prastarých draků se vyprávějí legendy a jejich skutečná síla je možná ještě předčí. |
| dragon-young | Drak mladý | Young Dragon | dragon-red | 10 | zástupný humanoid (dragon-red) |  | Mladí draci ještě nemají zkušenosti a moudrost svých starších příbuzných, přesto se je rozhodně nevyplácí podceňovat. |
| dragonlich | Drakolich | Dragonlich | dragon-undead | 10 | zástupný humanoid (dragon-undead) |  | Legendy praví, že drak, který se upíše temným silám, se může na Pravý svět vracet v podobě licha. |
| skeleton-dragon | Kostlivý drak | Skeleton Dragon | dragon-undead | 10 | zástupný humanoid (dragon-undead) |  | Nekromanti velkého talentu a síly dokážou oživit i kostru samotného draka a donutit ji, aby jim sloužila. |
| wyvern | Wyvern | Wyvern | wyvern-gray | 4 | zástupný humanoid (wyvern-gray) |  | Wyvern je létající ještěr s úzkou tlamou plnou ostrých zubů, párem netopýřích křídel a dlouhým ocasem. |

## Ptáci a netopýři (7)

Postup: nová kostra s křídly (letí nad polem).

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| eagle | Orel královský | Royal Eagle | wyvern-gray | 4 | zástupný humanoid (wyvern-gray) |  | Orel královský patří k nejúžasnějším tvorům. |
| giant-bat | Netopýr obří | Giant Bat | turkey-1 | 1 | zástupný humanoid (turkey-1) |  | Obří netopýr je téměř metr dlouhý masožravec, příbuzný obyčejného netopýra. |
| gryffon | Gryf | Griffin | wyvern-gray | 5 | zástupný humanoid (wyvern-gray) |  | Gryf je velký tvor podobný ptáku, s mohutnými křídly, zobákem a tělem krytým hnědou srstí. |
| harpy | Harpyje | Harpy | wyvern-gray |  | zástupný humanoid (wyvern-gray) |  | Harpyje jsou zlovolná stvoření s ženskou hlavou a ptačím tělem, s drápatýma nohama a křídly. |
| phoenix | Fénix | Phoenix | dragon-red | 8 | zástupný humanoid (dragon-red) |  | Fénix je ohnivý démon v podobě obrovského ptáka se zlatým peřím, obklopeného plameny. |
| vampire-bat-form | Upír (v podobě netopýra) | Vampire (bat form) | dragonfly |  | zástupný humanoid (dragonfly) |  | Upír ve formě netopýra. |
| vampire-elder-bat-form | Upír prastarý (v podobě netopýra) | Elder Vampire (bat form) | dragonfly |  | zástupný humanoid (dragonfly) |  | Prastarý upír ve formě netopýra. |

## Hadi, červi, stonožky (17)

Postup: jedna článková kostra (vlnění), varianty hlavy a nožiček.

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| aakf | Aakf | Aakf | crawler | 3 | zástupný humanoid (crawler) | červ / plž (článkové tělo bez hlavy) | Červ aakf je černý nebo šedý tvor dlouhý kolem čtyř metrů. |
| cave-slug | Slimák jeskynní | Cave Slug | hound-large | 3 | zástupný humanoid (hound-large) | červ / plž (článkové tělo bez hlavy) | Slimák jeskynní je šedý až černý obří plž bez ulity. |
| corpse-wurm | Mrtvočerv | Corpse Wurm | crawler | 8 | zástupný humanoid (crawler) | červ / plž (článkové tělo bez hlavy) | Mrtvočerv je šílený výtvor, který vzniká spojením mnoha mrtvých těl. |
| crystal-snake | Křišťálový had | Crystal Snake | carniverous-plant |  | zástupný humanoid (carniverous-plant) | had (článkové tělo) | Tento podivný had není z masa, ale z krystalů spojených magií, a proto je neobyčejně těžké ho zabít. |
| forest-wurm | Lesní červ | Forest Wurm | lizard-large-dark | 8 | zástupný humanoid (lizard-large-dark) | červ / plž (článkové tělo bez hlavy) | Lesní červ je obrovské hnědozelené zvíře; přestože se mu říká červ, se skutečnými červy má jen málo společného. |
| goblin-snake | Skřetohad | Goblin Snake | slime | 2 | zástupný humanoid (slime) | had (článkové tělo) | Skřetohad je děsivé spojení skřeta a hada. |
| hydra | Hydra | Hydra | dragon-undead | 4 | zástupný humanoid (dragon-undead) | had s více hlavami | Hydra je stvoření s tělem obrovského hada a několika dračími hlavami. |
| leech-shuddery | Pijavice hrozivá | Dread Leech | carniverous-plant |  | zástupný humanoid (carniverous-plant) | červ / plž (článkové tělo bez hlavy) | Pijavice hrozivá je velmi nepříjemný a nebezpečný tvor, který žije v bažinách a kalných vodách. |
| maggot-lair-1 | Jeskynní červ | Cave Maggot | crawler |  | zástupný humanoid (crawler) | červ / plž (článkové tělo bez hlavy) | Jeskynní červi jsou asi metr dlouzí, nepříjemní a velmi žraví tvorové. |
| maggot-lair-2 | Jeskynní červ - matka | Cave Maggot Mother | giantspider-poison | 8 | zástupný humanoid (giantspider-poison) | červ / plž (článkové tělo bez hlavy) | Jeskynní červi jsou asi metr dlouzí, nepříjemní a velmi žraví tvorové. |
| nugotha | Nugotha | Nugotha | giantspider-striped | 3 | zástupný humanoid (giantspider-striped) | stonožka (článkové tělo s nožičkami) | Nugotha je obří zelenohnědá stonožka s dravými kusadly plnými zelenkavého jedu. |
| python | Python | Python | giant-dark-beast | 10 | zástupný humanoid (giant-dark-beast) | had (článkové tělo) | Python je největší had na světě. |
| sandworm | Písečný červ | Sandworm | giant-dark-beast | 20 | zástupný humanoid (giant-dark-beast) | červ / plž (článkové tělo bez hlavy) | Tento gigantický tvor žije na pouštích, kde nemá sobě rovného. |
| sea-serpent | Mořský had | Sea Serpent | dragon-red | 20 | zástupný humanoid (dragon-red) | had (článkové tělo) | Mořský had patří k největším tvorům vůbec. |
| sterenda | Sterenda | Sterenda | crawler | 4 | zástupný humanoid (crawler) | stonožka (článkové tělo s nožičkami) | Sterenda se podobá obrovské stonožce s kusadly a tykadly na hlavě. |
| swamp-worm | Bahenní červ | Swamp Worm | crawler | 2 | zástupný humanoid (crawler) | červ / plž (článkové tělo bez hlavy) | Tento tlustý zelený červ si libuje v kalné bahnité vodě. |
| winged-serpent | Okřídlený had | Winged Serpent | dragonfly | 1 | zástupný humanoid (dragonfly) | had (článkové tělo) | Okřídlený had je zelenomodrý plaz se dvěma blanitými křídly těsně za hlavou. |

## Pavouci, hmyz, štíři, krabi – ProceduralArthropod (20)

Postup: hotovo (V34), včetně létajícího hmyzu.

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| aku | Aku | Aku | giantbee | -2 | arthropod (V34) | létající hmyz (vážka, vosa) | Aku jsou přerostlí příbuzní včel a vos. |
| ant | Mravenec | Ant | giantratdark | -1 | arthropod (V34) | hmyz (6 nohou) | Obří mravenci žijí a chovají se podobně jako jejich drobní příbuzní, jen jsou mnohem větší – běžně měří kolem metru, někdy i víc. |
| beetle-1 | Brouk I | Beetle I | giantspider-black |  | arthropod (V34) | hmyz (6 nohou) | Velký brouk dlouhý asi dva metry. |
| beetle-2 | Brouk II | Beetle II | giantspider-bluespotted | 2 | arthropod (V34) | hmyz (6 nohou) | Ještě větší brouk dlouhý asi čtyři metry. |
| beetle-3 | Brouk III | Beetle III | giantspider-poison | 4 | arthropod (V34) | hmyz (6 nohou) | Obří brouk dlouhý asi šest metrů. |
| diamond-scorpion | Diamantový štír | Diamond Scorpion | giantspider-bluespotted | 4 | arthropod (V34) | štír (klepeta, ocas) | Diamantový štír je nebezpečný tvor, který vznikl spojením štíra s démonickými bytostmi. |
| dune-reaper | Pouštní zabiják | Dune Reaper | giantspider-bluespotted | 1 | arthropod (V34) | štír (klepeta, ocas) | Tento nebezpečný hmyz žije v poušti, kde se zahrabává do písku a trpělivě čeká na kořist. |
| gargantula | Gargantula | Gargantula | giantspider-poison | 8 | arthropod (V34) | pavouk (8 nohou, gargantula 6) | Gargantula je obrovský černý pavouk pokrytý ostrými štětinami, se dvěma shluky očí a šesti nohama. |
| giant-crab | Obří krab | Giant Crab | gigacrab | 7 | arthropod (V34) | krab | V hlubinách žije mnoho podivných a obřích stvoření a jedním z nich je obří krab, na kterého čas od času narazí námořníci daleko od obydle… |
| giant-scorpion | Štír obří | Giant Scorpion | giantspider-striped | 3 | arthropod (V34) | štír (klepeta, ocas) | Štíři zjevně fascinovali dávné alchymisty a pokoutné kouzelníky, kteří je mutovali tak dlouho, až vypěstovali exempláře od velikosti pras… |
| giant-spider-crab | Giga Krabopavouk | Giant Spider Crab | gigacrab | 12 | arthropod (V34) | krab | Tento výtvor, v němž šílený tvůrce spojil obřího kraba s pavoukem, můžeme najít v hlubokých bažinách. |
| giant-strider | Obří sekáč | Giant Strider | giantspider-poison | 8 | arthropod (V34) | pavouk (8 nohou, gargantula 6) | Obří sekáči jsou strašliví pavoukovci, kterých naštěstí žije jen několik. |
| mantis | Kudlanka tropická | Tropical Mantis | giantspider-bluespotted | 2 | arthropod (V34) | kudlanka | Kudlanka tropická má tmavě zelené tělo a dvě klepeta, kterými lapá své oběti. |
| rahlog | Rahlog | Rahlog | giantspider-black |  | arthropod (V34) | pavouk (8 nohou, gargantula 6) | Rahlogové jsou velcí světlí pavouci. |
| rahlog-queen | Rahlog - královna | Rahlog Queen | giantspider-striped | 3 | arthropod (V34) | pavouk (8 nohou, gargantula 6) | Rahlogové jsou velcí světlí pavouci. |
| sirii | Sirii | Sirii | dragonfly | -2 | arthropod (V34) | létající hmyz (vážka, vosa) | Sirii jsou velké modročerné vážky se čtyřmi nohama, dvěma složenýma očima a žihadlem. |
| sorog | Sorog | Sorog | giantspider-bluespotted | 3 | arthropod (V34) | pavouk (8 nohou, gargantula 6) | Sorog je obrovský pavouk, který tká husté sítě na okrajích bažin, v soutěskách a v hustých lesích a loví do nich kořist. |
| urax | Urax | Urax | giantspider-poison | 5 | arthropod (V34) | pavouk (8 nohou, gargantula 6) | Urax je obrovský tmavý pavouk s tělem pokrytým štětinami. |
| xur | Xur | Xur | giantspider-black | -2 | arthropod (V34) | pavouk (8 nohou, gargantula 6) | Xurové jsou pavouci, kteří žijí v lesích, tkají si pavučiny a loví menší zvěř. |
| zeghar | Ze’ghar | Zeghar | giantspider-black | -1 | arthropod (V34) | pavouk (8 nohou, gargantula 6) | Ze'gharové jsou tmavošedí pavouci velcí asi jako trpaslík, s nápadným tečkováním na hřbetě. |

## Vodní tvorové (5)

Postup: žralok, chobotnice (chapadla).

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| kraken | Kraken | Kraken | daemon-pitlord | 30 | humanoid (daemon-pitlord) – nesedí | vodní tvor (žralok / chobotnice s chapadly) | Nejstrašnějším stvořením hlubin je bezpochyby kraken. |
| octopuss-1 | Chobotnice obří | Giant Octopus | giantspider-poison | 5 | zástupný humanoid (giantspider-poison) | vodní tvor (žralok / chobotnice s chapadly) | Chobotnice má obrovskou hlavu se dvěma očima bez víček, ze které vyrůstá osm chapadel s přísavkami. |
| octopuss-2 | Chobotnice ďábelská | Devil Octopus | giantspider-poison | 10 | zástupný humanoid (giantspider-poison) | vodní tvor (žralok / chobotnice s chapadly) | Chobotnice ďábelská je známá pod mnoha jmény a setkání s ní patří k nočním můrám námořníků, protože si za kořist dokáže vyhlédnout i celo… |
| octopuss-3 | Horor z hlubin | Horror from the Deep | dragon-undead | 20 | zástupný humanoid (dragon-undead) | vodní tvor (žralok / chobotnice s chapadly) | Horor z hlubin je chobotnice tak obrovská a nebezpečná, že ji námořníci často mylně považují za samotného vládce hlubin. |
| shark | Žralok | Shark | lizard-large-dark | 7 | zástupný humanoid (lizard-large-dark) | vodní tvor (žralok / chobotnice s chapadly) | Žraloci patří k nejnebezpečnějším tvorům, které lze na moři potkat. |

## Beztvaří a elementálové (12)

Postup: efekty / částice, bez kostry.

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| air-elemental | Vzdušný elementál | Air Elemental | slime | 2 | zástupný humanoid (slime) | vzdušný vír (tornádo) | Vzdušný elementál je vzduchový trychtýř vysoký asi dva metry, ve kterém poletuje prach, listí a kamení. |
| air-elemental-giant | Vzdušný elementál obří | Giant Air Elemental | fiend-blue | 10 | humanoid (fiend-blue) – nesedí | vzdušný vír (tornádo) | Pokud se krajinou žene tornádo, vězte, že je to obří vzdušný elementál. |
| cave-slime | Sliz, jeskynní | Cave Slime | slime |  | zástupný humanoid (slime) | sliz / rosol | Jeskynní sliz vypadá jako kaluž hnědozeleného slizu. |
| chasfon | Chasfon | Chasfon | turkey-1 | -4 | zástupný humanoid (turkey-1) | oblak / jev (částice) | Chasfon je podivný tvor, či spíše jev, který vzniká jako vedlejší produkt mocných kouzel nebo magických jevů, případně v místech, kde se … |
| cloud-form | Přeměna na oblak | Cloud Form | slime |  | zástupný humanoid (slime) | oblak / jev (částice) | Podobu oblaku tvor získá působením kouzla nebo lektvaru. |
| fire-elemental | Ohnivý elementál | Fire Elemental | slime-lava | 1 | zástupný humanoid (slime-lava) | hořící sloup | Čistá forma elementu ohně, která se projevuje jako hořící, pohybující se sloup. |
| living-jelly | Oživlý rosol | Living Jelly | carniverous-plant | 3 | zástupný humanoid (carniverous-plant) | sliz / rosol | Oživlý rosol má tvar krychle, která se za mlaskavých zvuků sune podzemními chodbami. |
| vampire-cloud-form | Upír (v podobě oblaku) | Vampire (cloud form) | slime |  | zástupný humanoid (slime) | oblak / jev (částice) | Upír ve formě oblaku mlhy. |
| vampire-elder-cloud-form | Upír prastarý (v podobě oblaku) | Elder Vampire (cloud form) | shadow |  | humanoid (shadow) – nesedí | oblak / jev (částice) | Prastarý upír ve formě oblaku mlhy. |
| vermin | Havěť | Vermin | giantrat | -8 | zástupný humanoid (giantrat) | roj krys (několik malých zvířat na poli) | Havěť zahrnuje krysy, potkany nebo jiné., poměrně neškodné tvory, kteří jednotlivě nemají šanci ohrozit postavy. |
| water-elemental | Vodní elementál | Water Elemental | slime | 3 | zástupný humanoid (slime) | vodní sloup / vlna |  |
| water-elemental-giant | Vodní elementál obří | Giant Water Elemental | fiend-blue | 10 | humanoid (fiend-blue) – nesedí | vodní sloup / vlna | Pokud do našeho světa pronikne tento elementál, bude běsnit jako bouře. |

## Rostliny a houby (8)

Postup: statický model s animovanými úponky.

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| drischea | Drischea | Drischea | carniverous-plant | 7 | zástupný humanoid (carniverous-plant) | rostlina / houba / kámen | Drischea je na pohled nádherný strom obsypaný bílými květy a šťavnatým ovocem, který roste v teplých džunglích. |
| gwanga | Gwanga | Gwanga | carniverous-plant | 1 | zástupný humanoid (carniverous-plant) | rostlina / houba / kámen | Gwanga je nepěkná masožravá rostlina, která se dokáže poměrně rychle pohybovat. |
| hungry-wine | Hladové víno | Hungry Vine | carniverous-plant |  | zástupný humanoid (carniverous-plant) | rostlina / houba / kámen | Hladové víno je nebezpečná masožravá popínavá rostlina, kterou najdeme od pralesů až po obyčejné lesy. |
| mirocus | Mirocus | Mirocus | carniverous-plant |  | zástupný humanoid (carniverous-plant) | rostlina / houba / kámen | Mirocuse kdysi stvořil dávný čaroděj, aby ochránil své artefakty před nenechavými rukama. |
| rack | Skřipec | Rack | carniverous-plant | -3 | zástupný humanoid (carniverous-plant) | rostlina / houba / kámen | Skřipec je podivný tvor, který vypadá jako obyčejný kámen a číhá na každého, kdo se přiblíží. |
| skorfan | Skorfan | Skorfan | carniverous-plant | 2 | zástupný humanoid (carniverous-plant) | rostlina / houba / kámen | Skorfana lze snadno přehlédnout, protože vypadá jako padlá kláda porostlá mechem. |
| suotix | Suotix | Suotix | carniverous-plant | 2 | zástupný humanoid (carniverous-plant) | rostlina / houba / kámen | Suotix je tvor na pomezí rostliny a živočicha. |
| waaz | Waaz | Waaz | carniverous-plant | 1 | zástupný humanoid (carniverous-plant) | rostlina / houba / kámen | Waaz je podivná houba, která roste v jeskyních, temných lesích a bažinách. |

## Nejasné (4)

Postup: chybí popis vzhledu.

| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |
|---|---|---|---|---:|---|---|---|
| illusion-beast | Iluzní tvor | Illusion Beast | direwolf |  | zástupný humanoid (direwolf) | potřebuji popis vzhledu | Tvor vytvořený iluzním kouzlem. |
| illusion-beast-2 | Iluzní tvor II | Illusion Beast II | direwolf |  | zástupný humanoid (direwolf) | potřebuji popis vzhledu |  |
| klobg | Klobg | Klobg | zombie-2 | 1 | humanoid (zombie-2) – nesedí | potřebuji popis vzhledu | Klobg žije v bažinách a močálech. |
| manyhead | Mnohohlavec | Manyhead | skeleton-shambler | 2 | humanoid (skeleton-shambler) – nesedí | potřebuji popis vzhledu | Tato nestvůra vznikla jako vedlejší účinek šílených pokusů s magií, případně v magických zónách a podobných místech. |
