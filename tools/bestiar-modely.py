# Bestiary vs 3D models: writes docs/bestiar-modely.md and src/data/bestiary.js (data of bestiary.html).
# Run on the device from the three1 folder:
#   python3 tools/bestiar-modely.py c:/opt/hof/data/beasts c:/opt/hof/data/res-src.json ../hof/src/main/webapp/WEB-INF/pages/bestiar/files/cz
import json, sys, collections, os, re, html
beasts_dir, res_f, desc_dir = sys.argv[1:4]
out_f = sys.argv[4] if len(sys.argv) > 4 else 'docs/bestiar-modely.md'
out_js = sys.argv[5] if len(sys.argv) > 5 else 'src/data/bestiary.js'

def field(text, name):
    m = re.search(r'\b' + name + r'="([^"]*)"', text)
    return m.group(1) if m else ''

rows = []
for f in sorted(os.listdir(beasts_dir)):
    if not f.endswith('.hf'): continue
    t = open(os.path.join(beasts_dir, f), encoding='utf-8', errors='replace').read()
    m = re.search(r'keyName="SIZE",bonus="(-?\d+)"', t)
    rows.append({'key': f[:-3], 'name': field(t, 'name'), 'lookBase': field(t, 'lookBase'), 'lookVariant': field(t, 'lookVariant'),
                 'lookHair': field(t, 'lookHair'), 'lookBeard': field(t, 'lookBeard'), 'size': m.group(1) if m else ''})

desc = {}
for r in rows:
    p = os.path.join(desc_dir, r['key'] + '.jsp')
    if not os.path.exists(p): continue
    t = open(p, encoding='utf-8', errors='replace').read()
    t = re.sub(r'<%.*?%>', '', t, flags=re.S); t = re.sub(r'<[^>]+>', ' ', t); t = html.unescape(t)
    t = re.sub(r'\s+', ' ', t).strip()
    m = re.match(r'(.{0,260}?[.!?])\s', t + ' ')
    desc[r['key']] = m.group(1) if m else t[:240]

res = json.load(open(res_f, encoding='utf-8'))
flat = {}
def walk(o, k0=''):
    if isinstance(o, dict):
        if isinstance(o.get('cz'), str): flat[k0] = o
        else:
            for k, v in o.items(): walk(v, k)
walk(res)
def names(k):
    e = flat.get(k.upper().replace('-', '_'), {})
    return e.get('cz') or '', e.get('en') or ''

# rig groups: key -> (rig, note)
G = {}
def put(rig, keys, note=''):
    for k in keys.split():
        G[k] = (rig, note)

put('canine', 'wolf wolf-ferocious dog hellhound hunting-hellbeast fire-dog spectral-wolf soul-hound vampire-wolf-form vampire-elder-wolf-form undead-animals')
put('humanoid', 'cursed-knight dark-paladin death-guard lich skeleton skeletal-mage skeleton-king skeleton-warrior '
    'heavy-infantry-1 heavy-infantry-2 heavy-infantry-3 heavy-infantry-4 heavy-infantry-5 shooter-1 shooter-2 shooter-3 shooter-4 shooter-5 '
    'swordsman-1 swordsman-2 swordsman-3 swordsman-4 swordsman-5 warrior-1 warrior-2 warrior-3 warrior-4 warrior-5 '
    'orc orc-rider orc-shaman giant-orc vampire vampire-elder spectre rusalka swamp-hag dryad mummy zombie ghoul narghoul izrod '
    'ogre troll forest-giant hill-giant frost-giant skeleton-giant banshee wraith cursed-wraith shadow-of-dead lost-soul ghost-warrior '
    'quiet-guard illusion-figure demon-shadow-1 demon-shadow-2 demon-shadow-3 demon-shadow-4 demon-shadow-5 demon-devourer-1 demon-devourer-2 '
    'demon-destruction-1 demon-destruction-2 demon-destruction-3 demon-destruction-4 demon-destruction-5 demon-lord demon-devil-master '
    'zhogg jazgath raxun xandron mug-man burning-curse gorgon')
put('humanoid+', 'werewolf werewolf-elder cobold', 'vlčí hlava (hlava z vlka V29) na humanoidovi')
put('humanoid+', 'minotaur', 'býčí hlava, rohy, kopyta')
put('humanoid+', 'faun', 'kozí nohy, růžky')
put('humanoid+', 'gorilla', 'opičí proporce (dlouhé ruce, chůze po kotnících)')
put('humanoid+', 'fairy fallen-angel', 'křídla')
put('humanoid+', 'demon-pride-1 demon-pride-2 demon-pride-3 demon-pride-4 demon-pride-5', 'sukuba: křídla, růžky, ocas')
put('humanoid+', 'demon-devourer-3 demon-devourer-4 demon-devourer-5', 'velká křídla a rohy (draunug pán)')
put('humanoid+', 'mermaid triton', 'rybí ocas místo nohou')
put('humanoid+', 'headless', 'bez hlavy')
put('elemental', 'swarm-devil maggot-man', 'postava z roje hmyzu / červů')
put('elemental', 'golem automaton earth-elemental earth-elemental-greater earth-elemental-giant', 'tělo z kamene / kovu (hranaté)')
put('elemental', 'vestrad fire-elemental-greater fire-elemental-giant water-elemental-greater air-elemental-greater', 'tělo z energie / ohně / vody (průsvitné)')
put('plant', 'forest-phantom tree-folk evil-tree nature-wrath', 'postava ze dřeva, kůry a listí')
put('humanoid+', 'ubeg', 'hmyzí hlava s kusadly')
put('gug', 'demon-anger-1 demon-anger-2 demon-anger-3 demon-anger-4 demon-anger-5 demon-decay-1 demon-decay-2 demon-decay-3 demon-decay-4 demon-decay-5 '
    'demon-gluttony-1 demon-gluttony-2 demon-gluttony-3 demon-gluttony-4 demon-gluttony-5 demon-possession-1 demon-possession-2 demon-possession-3 demon-possession-4 demon-possession-5')
put('feline', 'lion tiger leopard sabretooth')
put('feline', 'sphinx', 'lví tělo, lidská hlava, křídla')
put('feline', 'manticore', 'lví tělo, křídla, štíří ocas')
put('feline', 'chimera', 'lví tělo, více hlav')
put('bear', 'bear bear-large cave-bear necrotaur')
put('bear', 'giant-rat', 'krysa (ProceduralRat)')
put('hoofed', 'horse war-horse', 'je – ProceduralHorse (zatím vždy se sedlem)')
put('hoofed', 'nightmare unicorn drakun', 'kůň + úprava (černá srst a žhavé oči / roh / mohutnější šelma)')
put('hoofed', 'bull cow fire-bull undead-bull', 'skot: kostra koně, těžší tělo, rohy')
put('hoofed', 'boar', 'prase: krátké nohy, kly')
put('hoofed', 'centaur', 'kentaur: koňské tělo s lidským trupem a kopím (ProceduralCentaur)')
put('heavy', 'elephant rhinoceros hippopotamus', 'těžký čtyřnožec (sloupové nohy)')
put('reptile', 'crocodile giant-crocodille giant-eft', 'nízký plaz na roztažených nohách')
put('reptile', 'karialis', 'obrněný, hřbetní pláty, ostnatý ocas s palicí')
put('reptile', 'dragon-turtle', 'želva s ostnatým krunýřem')
put('reptile', 'basilisk', 'osminohý ještěr')
put('biped', 'gauton sagat uth', 'dvounohý ještěr')
put('biped', 'terrorbird', 'obří pták s křídly')
put('biped', 'ghat', 'shrbený obojživelný ještěr s velkými drápy (podle obrázku chodí po dvou)')
put('dragon', 'dragon dragon-young dragon-elder dragonlich skeleton-dragon wyvern')
put('dragon', 'gargoyle', 'kamenná šelma s netopýřími křídly a ocasem')
put('flyer', 'eagle gryffon harpy giant-bat vampire-bat-form vampire-elder-bat-form phoenix')
put('arthropod', 'sirii aku', 'létající hmyz (vážka, vosa)')
put('serpent', 'python sea-serpent crystal-snake goblin-snake winged-serpent', 'had (článkové tělo)')
put('serpent', 'hydra', 'had s více hlavami')
put('serpent', 'sandworm forest-wurm corpse-wurm swamp-worm maggot-lair-1 maggot-lair-2 aakf cave-slug leech-shuddery', 'červ / plž (článkové tělo bez hlavy)')
put('serpent', 'nugotha sterenda', 'stonožka (článkové tělo s nožičkami)')
put('serpent', 'serpent-guardian', 'hadí tělo s lidským trupem')
put('arthropod', 'beetle-1 beetle-2 beetle-3 ant', 'hmyz (6 nohou)')
put('arthropod', 'gargantula giant-strider rahlog rahlog-queen sorog urax xur zeghar', 'pavouk (8 nohou, gargantula 6)')
put('arthropod', 'giant-scorpion diamond-scorpion dune-reaper', 'štír (klepeta, ocas)')
put('arthropod', 'mantis', 'kudlanka')
put('arthropod', 'giant-crab giant-spider-crab', 'krab')
put('arthropod', 'urxuquer', 'pavoukočlověk (lidský trup na pavoučím těle)')
put('aquatic', 'shark kraken octopuss-1 octopuss-2 octopuss-3', 'vodní tvor (žralok / chobotnice s chapadly)')
put('amorphous', 'cave-slime living-jelly', 'sliz / rosol')
put('amorphous', 'air-elemental air-elemental-giant', 'vzdušný vír (tornádo)')
put('amorphous', 'water-elemental water-elemental-giant', 'vodní sloup / vlna')
put('amorphous', 'fire-elemental', 'hořící sloup')
put('amorphous', 'cloud-form vampire-cloud-form vampire-elder-cloud-form chasfon', 'oblak / jev (částice)')
put('amorphous', 'vermin', 'roj krys (několik malých zvířat na poli)')
put('plant', 'drischea hungry-wine gwanga mirocus skorfan suotix waaz rack', 'rostlina / houba / kámen')
put('aquatic', 'klobg', 'shrbený zelený tvor s dlouhým jazykem')
put('aquatic', 'manyhead', 'krysí tvor s pěti hlavami')
put('aquatic', 'illusion-beast illusion-beast-2', 'průsvitný hadí drak (iluze)')

RIGS = collections.OrderedDict([
    ('canine', ('Psovité šelmy – ProceduralCanine', 'hotovo (V29)')),
    ('humanoid', ('Humanoidi – ProceduralAvatar', 'stačí současná kostra a těla z 2D vrstev')),
    ('humanoid+', ('Humanoidi s doplňkem', 'hotovo (V35): těla nestvůr v avatar/beastBodies.js (hlavy, křídla, ocasy, kozí nohy)')),
    ('gug', ('Gugové (démoni hněvu, rozkladu, obžerství, posedlosti)', 'hotovo (V35): těla v avatar/beastBodies.js')),
    ('feline', ('Kočkovité šelmy – ProceduralFeline', 'hotovo: lev, tygr, levhart, šavlozubý (V32), chiméra, mantikora, sfinga (V33)')),
    ('bear', ('Medvědi a krysa – ProceduralBear, ProceduralRat', 'hotovo: medvědi a nekrotaur (V32), obří krysa (V33)')),
    ('hoofed', ('Kopytníci – ProceduralHoofed', 'hotovo (V33), kentaur (V35); jezdecký kůň zůstává ProceduralHorse')),
    ('heavy', ('Těžcí čtyřnožci – ProceduralPachyderm', 'hotovo (V33)')),
    ('reptile', ('Plazi – ProceduralReptile', 'hotovo (V33)')),
    ('biped', ('Dvounozí ještěři a ptáci – ProceduralBiped', 'hotovo (V33)')),
    ('dragon', ('Draci, wyvern a gargoyla – ProceduralDragon', 'hotovo (V35)')),
    ('flyer', ('Ptáci a netopýři – ProceduralFlyer', 'hotovo (V35), létají nad polem')),
    ('serpent', ('Hadi, červi, stonožky – ProceduralSerpent', 'hotovo (V35), včetně hydry a hadího strážce')),
    ('arthropod', ('Pavouci, hmyz, štíři, krabi – ProceduralArthropod', 'hotovo (V34), včetně létajícího hmyzu; urxuquer (V35)')),
    ('aquatic', ('Vodní a zvláštní tvorové – ProceduralAquatic', 'hotovo (V35)')),
    ('elemental', ('Elementálové, golemové a roje v lidské podobě – ProceduralElemental', 'hotovo (V35)')),
    ('amorphous', ('Beztvaří: víry, vodní a ohnivé sloupy, sliz, oblaka, havěť – ProceduralAmorphous', 'hotovo (V35)')),
    ('plant', ('Rostliny a stromové bytosti – ProceduralPlant', 'hotovo (V35)')),
    ('unknown', ('Nezařazené', 'chybí v tabulce skupin')),
])

def current(k, lb, rig):
    if rig == 'canine': return 'vlk (V29)'
    if k in ('centaur', 'urxuquer'): return rig + ' + lidský trup (V35)'
    if rig in ('dragon', 'flyer', 'serpent', 'aquatic', 'elemental', 'amorphous', 'plant'): return rig + ' (V35)'
    if rig in ('gug', 'humanoid+'): return 'tělo nestvůry (V35)'
    if k in ('lion', 'tiger', 'leopard', 'sabretooth'): return 'kočkovitá šelma (V32)'
    if k in ('bear', 'bear-large', 'cave-bear', 'necrotaur'): return 'medvěd (V32)'
    if k in ('chimera', 'manticore', 'sphinx'): return 'lví složenina (V33)'
    if k == 'giant-rat': return 'krysa (V33)'
    if rig == 'arthropod': return 'arthropod (V34)'
    if rig in ('hoofed', 'heavy', 'reptile', 'biped') and not lb.startswith('horse'): return rig + ' (V33)'
    if lb.startswith('horse'): return 'kůň'
    humanoid_bases = ['male', 'female', 'skeleton', 'mummy', 'zombie', 'ghoul', 'dead-gentleman', 'goblin', 'ogre', 'troll', 'brute', 'uruk',
                      'giant', 'juggernaut', 'beastman', 'lizardman', 'daemon', 'dameon', 'fiend', 'plaguefiend', 'shadow', 'black-walker', 'gorgon']
    animal = ['buck', 'doe', 'cat-', 'dog-', 'hound', 'wolf', 'direwolf', 'undeaddog', 'donkey', 'chicken', 'turkey', 'giantrat', 'giantbee',
              'giantspider', 'gigacrab', 'gigascorpion', 'dragon', 'wyvern', 'slime', 'crawl', 'carniverous', 'lizard-large', 'gug', 'ghlug', 'giant-dark-beast']
    if any(lb.startswith(p) for p in animal): return 'zástupný humanoid (' + lb + ')'
    if any(lb.startswith(p) for p in humanoid_bases):
        return 'humanoid (' + lb + ')' if rig in ('humanoid',) else 'humanoid (' + lb + ') – nesedí'
    return 'zástupný humanoid (' + lb + ')'

by = collections.defaultdict(list)
js = []
for r in rows:
    k, lb, sz = r['key'], r['lookBase'], r['size']
    rig, note = G.get(k, ('unknown', 'nezařazeno'))
    cz, en = names(k)
    if not cz and r['name'] and not re.search(r'meč|sekera|luk|kopí|oštěp|hůl|zbroj', r['name'], re.I): cz = r['name']
    by[rig].append((k, cz, en, lb, sz, note, current(k, lb, rig)))
    js.append({'key': k, 'cz': cz, 'en': en, 'group': rig, 'note': note, 'lookBase': lb, 'lookVariant': r['lookVariant'],
               'hair': r['lookHair'], 'beard': r['lookBeard'], 'size': int(sz) if sz.lstrip('-').isdigit() else None, 'desc': desc.get(k, '')})

out = []
out.append('# Bestiář a 3D modely nestvůr\n')
out.append('Revize k 2026-10-08 (V35). Zdroj: `c:\\opt\\hof\\data\\beasts\\*.hf` (%d nestvůr), jména z `res-src.json`, '
           'popisy z `WEB-INF/pages/bestiar/files/cz`. Náhled modelů: `bestiary.html`. 3D model se vybírá podle klíče bestiáře (`PlanActor.beast`), '
           'tabulka je v `three1/src/avatar/creatures.js`.\n' % len(rows))
out.append('Sloupec „teď“ říká, co 3D klient ukáže dnes: humanoid s tělem podle 2D `lookBase`, „zástupný humanoid“ = tmavý '
           'humanoid místo zvířete (2D sprite nemá v 3D kostru), „nesedí“ = humanoid tam, kde má být něco jiného.\n')
out.append('## Souhrn\n')
out.append('| skupina | počet | stav / postup |')
out.append('|---|---:|---|')
for rig, (title, how) in RIGS.items():
    if by.get(rig): out.append('| %s | %d | %s |' % (title, len(by[rig]), how))
out.append('')
out.append('## Stav\n')
out.append('Od V35 má 3D model každá nestvůra bestiáře: vlastní kostru (tabulka `BEASTS` v `creatures.js`), tělo nestvůry pro postavu '
           '(`avatar/beastBodies.js`, tabulka `BEAST_BODIES`) nebo humanoida z 2D vrstev. Zbývá jen dolaďování vzhledu podle obrázků.\n')
for rig, (title, how) in RIGS.items():
    items = by.get(rig)
    if not items: continue
    out.append('## %s (%d)\n' % (title, len(items)))
    out.append('Postup: %s.\n' % how)
    out.append('| klíč | jméno | EN | 2D lookBase | vel. | teď | poznámka | popis |')
    out.append('|---|---|---|---|---:|---|---|---|')
    for k, cz, en, lb, sz, note, cur in sorted(items):
        d = desc.get(k, '').replace('|', '/')
        if len(d) > 140: d = d[:137] + '…'
        out.append('| %s | %s | %s | %s | %s | %s | %s | %s |' % (k, cz, en, lb, sz, cur, note, d))
    out.append('')
open(out_f, 'w', encoding='utf-8').write('\n'.join(out))
groups = [{'id': g, 'title': t, 'how': h} for g, (t, h) in RIGS.items()]
open(out_js, 'w', encoding='utf-8').write(
    '// Generated by tools/bestiar-modely.py from the hof bestiary (beasts/*.hf, res-src.json, bestiar/files/cz) – do not edit.\n'
    '// group = proposed 3D rig (see docs/bestiar-modely.md); which beasts already have a model decides bestiaryViewer.js.\n'
    'export const BESTIARY_GROUPS = ' + json.dumps(groups, ensure_ascii=False, indent=1) + ';\n\n'
    'export const BESTIARY = [\n' + ',\n'.join('    ' + json.dumps(e, ensure_ascii=False) for e in js) + '\n];\n')
print({r: len(v) for r, v in by.items()})
