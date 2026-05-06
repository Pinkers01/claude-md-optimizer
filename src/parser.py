#!/usr/bin/env python3
"""Parser CLAUDE.md v4: smart preamble merge, deeper rules, skills inventory."""
import re, json, os, glob
from collections import defaultdict

SRC = '/Users/pinky/CLAUDE.md'
SKILLS_DIR = '/Users/pinky/.claude/skills'
OUT = '/tmp/claude_md_optimizer/sections.json'

src = open(SRC, 'r', encoding='utf-8').read()
total_chars = len(src)
total_bytes = len(src.encode('utf-8'))
total_lines = src.count('\n') + 1
lines = src.split('\n')

# Pass 1: split into raw sections
sections = []
current = {'title': '__PREAMBLE__', 'level': 0, 'lines': []}
for line in lines:
    m = re.match(r'^(#{1,3})\s+(.+)$', line)
    if m:
        if current['lines'] or current['title'] != '__PREAMBLE__':
            sections.append(current)
        current = {'title': m.group(2).strip(), 'level': len(m.group(1)), 'lines': [line]}
    else:
        current['lines'].append(line)
sections.append(current)

# Pass 2: merge "comment-style" H1 headers (those at the very top with no body)
# These look like:
#   # CLAUDE.md - Pinky Creative Studio
#   # Mateusz Kuzniar (Pinky) - Troelstradreef 72...
# Each is a standalone H1 with empty body. Merge them all into one virtual header section.
merged_top = []
i = 0
header_block = []
while i < len(sections):
    s = sections[i]
    body_lines = [l for l in s['lines'] if not re.match(r'^#{1,3}\s', l) and l.strip()]
    is_comment_header = (
        s['level'] == 1 and
        len(body_lines) <= 1 and
        i < 8
    )
    if is_comment_header:
        header_block.append(s)
        i += 1
    else:
        break

if len(header_block) >= 2:
    merged_lines = []
    titles = []
    for h in header_block:
        merged_lines.extend(h['lines'])
        titles.append(h['title'])
    virtual = {
        'title': 'Header & autorzy',
        'level': 1,
        'lines': merged_lines,
        'merged_from': titles,
    }
    merged_top.append(virtual)
    sections = sections[len(header_block):]
elif len(header_block) == 1:
    merged_top.extend(header_block)
    sections = sections[1:]

sections = merged_top + sections

# Pass 3: merge H3 into nearest H1/H2 parent
final = []
for s in sections:
    s['content'] = '\n'.join(s['lines'])
    s['chars'] = len(s['content'])
    if s['level'] >= 3 and final:
        final[-1]['content'] += '\n' + s['content']
        final[-1]['chars'] = len(final[-1]['content'])
    else:
        final.append(s)

# Classification
KEEP_KW = ['kim jestem', 'autoryzacja sesji', 'formy zwracania', 'happy app',
           'kontakt pinky', 'design system', 'code style', 'tech stack',
           'folder standard', 'easter egg w kodzie',
           'zasady pracy', 'master directive', 'misja', 'rule precedence',
           'header & autorzy']
MOVE_KW = ['moje projekty', 'reguly produktow saas', 'reguły produktów',
           'ai tools stack', 'new project bootstrap', 'codzienne rutyny',
           'tygodniowy raport', 'discord strategy', 'seo priority',
           'security roadmap', 'profit scoring', 'apple reminders',
           'kafelki', 'cards', 'ruflo', 'lokalni agenci', 'coworking',
           'ghost mode', 'session management', 'master mode',
           'telegram heartbeat', 'autonomous learning', 'hosting architecture',
           'standardy kazdej', 'standardy każdej', 'instalacja',
           'pixelforgood', 'stopmetzoeken', 'mural spirit', 'octagon',
           'og electric', '3-task cycle', 'auto-clear', 'mode switching',
           'rejestracja nowych', 'panel admin', 'mobile responsive',
           'jezyki', 'języki', 'auto-load', 'discord',
           'mobile-safe', 'master cross-tenant', 'per-project admin',
           'master admin', 'wymagania techniczne', 'anti-patterns',
           'model routing']

def classify(s):
    t = s['title'].lower()
    if t == '__preamble__':
        return 'keep'
    for k in KEEP_KW:
        if k in t and len(k) > 6:
            return 'keep'
    for k in MOVE_KW:
        if k in t:
            return 'move'
    if s['chars'] > 1200:
        return 'move'
    return 'keep'

def slugify(t):
    t = re.sub(r'[^\w\s-]', '', t.lower())
    t = re.sub(r'[\s_-]+', '_', t).strip('_')
    return t[:50] or 'section'

def filename_for(s):
    t = s['title'].lower()
    if any(p in t for p in ['pixelforgood', 'stopmetzoeken', 'mural', 'octagon',
                             'og electric', 'invoiceflow', 'ruflo', 'ghost',
                             'projekty', 'session']):
        prefix = 'project_' if any(p in t for p in ['pixelforgood','stopmetzoeken','mural','octagon','og electric','invoiceflow','projekty']) else 'feedback_'
    elif 'reference' in t or 'kontakt' in t or 'strato' in t:
        prefix = 'reference_'
    else:
        prefix = 'feedback_'
    return prefix + slugify(s['title']) + '.md'

# DUPLICATE DETECTION (line + phrase level)
duplicates = defaultdict(list)
def norm_line(s):
    s = s.strip(' -*•·>').strip()
    s = re.sub(r'\s+', ' ', s)
    return s.lower()

line_index = defaultdict(list)
for i, s in enumerate(final):
    seen = set()
    for raw in s['content'].split('\n'):
        n = norm_line(raw)
        if len(n) < 25 or re.match(r'^#{1,6}\s', n):
            continue
        if n in seen:
            continue
        seen.add(n)
        line_index[n].append((i, raw.strip()))

KEY_PHRASES = [
    (r'\bem-?dash\b|myślnik(?:a)?\s+em', 'reguła em-dash'),
    (r'\bbcrypt\b.*\b12\b', 'bcrypt rounds 12'),
    (r'\bmollie\b.*\bnie\s+stripe\b|\bnigdy\s+stripe\b', 'Mollie nie Stripe'),
    (r'\bpinkerson007', 'kod autoryzacji'),
    (r'apps\s+cloude', 'folder Apps Cloude'),
    (r'master\s+admin', 'master admin'),
    (r'fleet\s+beacon', 'fleet beacon'),
    (r'easter\s+egg', 'easter eggs'),
    (r'pinky-mobile-safe|mobile-safe', 'mobile-safe boilerplate'),
    (r'whatsapp\s+fab', 'WhatsApp FAB'),
    (r'pinky\s+creative\s+studio', 'brand stopki'),
    (r'\bAVG\b|\bGDPR\b', 'AVG/GDPR'),
    (r'apple\s+reminders', 'Apple Reminders'),
    (r'master\s+vault', 'Master Vault'),
    (r'telegram\s+heartbeat|@pinky_openclaw_bot', 'Telegram bot'),
    (r'NL.*PL.*EN|PL.*NL.*EN|3\s+języki', '3 języki'),
    (r'open\s+design|playwright\s+mcp|opencla[uw]', 'AI tools stack'),
    (r'gp-maschinen', 'gp-maschinen reference'),
    (r'octagon', 'Octagon Sport'),
    (r'pixelforgood', 'PixelForGood'),
    (r'invoiceflow', 'InvoiceFlow'),
    (r'stopmetzoeken', 'StopMetZoeken'),
]
phrase_index = defaultdict(set)
for i, s in enumerate(final):
    cl = s['content'].lower()
    for pat, label in KEY_PHRASES:
        if re.search(pat, cl, re.I):
            phrase_index[label].add(i)

for n, occs in line_index.items():
    ids = list({o[0] for o in occs})
    if len(ids) >= 2:
        sample = occs[0][1][:100]
        for sid in ids:
            others = sorted([x for x in ids if x != sid])
            duplicates[sid].append({'kind': 'line', 'with': others, 'sample': sample})

for label, sids in phrase_index.items():
    if len(sids) >= 3:
        for sid in sids:
            others = sorted([x for x in sids if x != sid])
            duplicates[sid].append({'kind': 'phrase', 'label': label, 'with': others, 'sample': label})

# CONFLICT DETECTION (deeper rules)
CONFLICT_RULES = [
    {'id':'stripe_vs_mollie','label':'Stripe vs Mollie (NL)',
     'a':[r'\bnigdy\s+stripe\b', r'mollie\s+nie\s+stripe', r'\bMollie\s+\(primary'],
     'b':[r'invoiceflow.*stripe', r'stripe\s+€\d+', r'using\s+stripe']},
    {'id':'em_dash','label':'NIGDY em-dash vs zawiera em-dash',
     'a':[r'nigdy\s+myślnika?\s+em', r'zero\s+em-?dash', r'NIGDY.*\(—\)'],
     'b':[],'check_em_dash_present':True},
    {'id':'always_ask','label':'Nigdy nie pytaj vs lista akcji wymagajacych pytania',
     'a':[r'nigdy\s+nie\s+pytaj', r'staly\s+yes', r'stałe\s+yes', r'bez\s+pytania'],
     'b':[r'wymagają\s+zapytania', r'pytam.*tylko\s+gdy', r'pytaj.*pinky']},
    {'id':'lite_version','label':'Nigdy lite vs MVP/preview',
     'a':[r'nigdy.*lite', r'zero\s+skrótów', r'na\s+maksa'],
     'b':[r'\bMVP\b', r'lite\s+version', r'preview\s+version']},
    {'id':'autonomy_vs_options','label':'Decyzje same vs 3-4 opcje przed decyzja',
     'a':[r'decyduj.*samodzieln', r'autonomi.*działać', r'decyzje\s+same'],
     'b':[r'3-4\s+opcj', r'czeka.*wybór', r'czekaj\s+na\s+mój\s+wybór']},
    {'id':'no_paid_apis','label':'Zero placonych API vs InvoiceFlow Stripe / OpenRouter',
     'a':[r'zero\s+dodatkowych\s+płatnych', r'nie\s+proponuj.*api'],
     'b':[r'openrouter.*key', r'glm-5\.1.*openrouter', r'higgsfield']},
    {'id':'desktop_folder','label':'Apps Cloude folder vs sandbox/desktop',
     'a':[r'desktop/apps\s+cloude', r'pulpit\s+ma\s+zostać\s+czysty'],
     'b':[r'desktop/claude-sandbox', r'desktop/ai_studio']},
    {'id':'comments_default','label':'Default no comments vs Komentarze EN',
     'a':[r'no\s+comments', r'default.*no\s+comments', r'don\'t\s+write\s+comments'],
     'b':[r'komentarze.*po\s+angielsku', r'comments\s+in\s+english']},
    {'id':'language','label':'Polski zawsze vs raporty po angielsku',
     'a':[r'polski\s+zawsze', r'zawsze\s+po\s+polsku'],
     'b':[r'raport.*english', r'report.*english']},
]

cross_conflicts = defaultdict(list)
section_sides = []
for i, s in enumerate(final):
    cl = s['content'].lower()
    sides = []
    for rule in CONFLICT_RULES:
        a = any(re.search(p, cl, re.I) for p in rule['a'])
        b = any(re.search(p, cl, re.I) for p in rule['b']) if rule['b'] else False
        if rule.get('check_em_dash_present') and a and '—' in s['content']:
            cross_conflicts[i].append({'rule_id':rule['id'],'label':rule['label'],
                                        'with':i,'note':'em-dash w tej samej sekcji'})
        if a and b:
            cross_conflicts[i].append({'rule_id':rule['id'],'label':rule['label'],
                                        'with':i,'note':'wewnątrz sekcji'})
        sides.append({'a':a,'b':b})
    section_sides.append(sides)

for i, sa in enumerate(section_sides):
    for j, sb in enumerate(section_sides):
        if i == j: continue
        for ri, rule in enumerate(CONFLICT_RULES):
            if rule.get('check_em_dash_present'): continue
            if sa[ri]['a'] and sb[ri]['b']:
                cross_conflicts[i].append({'rule_id':rule['id'],'label':rule['label'],
                                            'with':j,'note':f'kolizja z sekcja #{j+1}'})

# RULES DETECTION (special: "NIGDY X" / "ZAWSZE Y" / "OBOWIĄZKOWO" patterns)
rules_per_section = defaultdict(list)
RULE_RX = re.compile(
    r'(?:^|\n)\s*[-*]?\s*(?:[A-ZĄĆĘŁŃÓŚŹŻ]{2,}[\s,:.!]+){1,3}.{10,160}',
    re.UNICODE
)
strong_words = ['NIGDY', 'ZAWSZE', 'OBOWIĄZKOWO', 'TWARDA REGUŁA', 'BEZWZGLĘDNE',
                 'KAŻDA', 'KAŻDY', 'WYMAGA', 'MUSI', 'TYLKO']
for i, s in enumerate(final):
    for line in s['content'].split('\n'):
        clean = line.strip(' -*•').strip()
        if any(w in clean for w in strong_words) and 20 < len(clean) < 200:
            rules_per_section[i].append(clean[:180])

# Skills inventory
skills = []
if os.path.isdir(SKILLS_DIR):
    for d in sorted(os.listdir(SKILLS_DIR)):
        skill_md = os.path.join(SKILLS_DIR, d, 'SKILL.md')
        if not os.path.isfile(skill_md):
            continue
        try:
            with open(skill_md, 'r', encoding='utf-8') as f:
                content = f.read(2000)
            desc_match = re.search(r'^description:\s*(.+?)$', content, re.M)
            desc = desc_match.group(1).strip() if desc_match else ''
            desc = desc.split('. ')[0]
            if len(desc) > 200:
                desc = desc[:200] + '...'
            skills.append({'name': d, 'description': desc})
        except Exception:
            pass

# Build output
out_sections = []
for i, s in enumerate(final):
    action = classify(s)
    out_sections.append({
        'id': i,
        'title': s['title'] if s['title'] != '__PREAMBLE__' else '(preambula)',
        'level': s['level'],
        'chars': s['chars'],
        'content': s['content'],
        'suggested_action': action,
        'suggested_filename': filename_for(s) if action == 'move' else '',
        'duplicates': duplicates.get(i, []),
        'conflicts': cross_conflicts.get(i, []),
        'rules': rules_per_section.get(i, [])[:8],
        'merged_from': s.get('merged_from'),
    })

stats = {
    'total_chars': total_chars,
    'total_bytes': total_bytes,
    'total_lines': total_lines,
    'section_count': len(out_sections),
    'keep_count': sum(1 for s in out_sections if s['suggested_action']=='keep'),
    'move_count': sum(1 for s in out_sections if s['suggested_action']=='move'),
    'delete_count': 0,
    'keep_chars': sum(s['chars'] for s in out_sections if s['suggested_action']=='keep'),
    'move_chars': sum(s['chars'] for s in out_sections if s['suggested_action']=='move'),
    'duplicate_pairs': sum(len(d) for d in duplicates.values()) // 2,
    'conflict_count': sum(len(c) for c in cross_conflicts.values()),
    'rules_count': sum(len(r) for r in rules_per_section.values()),
    'skills_available': len(skills),
}

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump({'stats': stats, 'sections': out_sections, 'skills': skills}, f, ensure_ascii=False)

print(json.dumps(stats, ensure_ascii=False, indent=2))
