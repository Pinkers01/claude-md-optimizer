#!/usr/bin/env python3
"""Parser CLAUDE.md z detekcja duplikatow i sprzecznosci."""
import re, json, hashlib
from collections import defaultdict

SRC = '/Users/pinky/CLAUDE.md'
OUT = '/tmp/claude_md_optimizer/sections.json'

src = open(SRC, 'r', encoding='utf-8').read()
total = len(src)
lines = src.split('\n')

# Parse into sections
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

# Merge H3 into parent H1/H2
merged = []
for s in sections:
    s['content'] = '\n'.join(s['lines'])
    s['chars'] = len(s['content'])
    if s['level'] >= 3 and merged:
        merged[-1]['content'] += '\n' + s['content']
        merged[-1]['chars'] = len(merged[-1]['content'])
    else:
        merged.append(s)

# Classification heuristic
KEEP_KW = ['kim jestem', 'autoryzacja sesji', 'formy zwracania', 'happy app',
           'kontakt pinky', 'design system', 'code style', 'tech stack',
           'folder standard', '__preamble__', 'easter egg w kodzie',
           'zasady pracy', 'master directive', 'misja', 'rule precedence']
MOVE_KW = ['moje projekty', 'reguly produktow saas', 'reguły produktów',
           'ai tools stack', 'new project bootstrap', 'codzienne rutyny',
           'tygodniowy raport', 'discord strategy', 'seo priority',
           'security roadmap', 'profit scoring', 'apple reminders',
           'kafelki', 'cards', 'ruflo', 'lokalni agenci', 'coworking',
           'ghost mode', 'session management', 'master mode',
           'telegram heartbeat', 'autonomous learning', 'hosting architecture',
           'standardy każdej', 'standardy kazdej', 'instalacja',
           'pixelforgood', 'stopmetzoeken', 'mural spirit', 'octagon',
           'og electric', '3-task cycle', 'auto-clear', 'mode switching',
           'rejestracja nowych', 'panel admin', 'mobile responsive',
           'jezyki', 'języki', 'seo', 'auto-load', 'discord',
           'mobile-safe', 'master cross-tenant', 'per-project admin',
           'master admin', 'wymagania techniczne', 'anti-patterns',
           'model routing']

def classify(s):
    t = s['title'].lower()
    for k in KEEP_KW:
        if k in t and len(k) > 8:
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
                             'og electric', 'invoiceflow']):
        prefix = 'project_'
    elif 'reference' in t or 'kontakt' in t or 'strato' in t:
        prefix = 'reference_'
    else:
        prefix = 'feedback_'
    return prefix + slugify(s['title']) + '.md'

# === DUPLICATE DETECTION ===
# Tokenize each section into normalized sentences
def tokenize_sentences(text):
    text = re.sub(r'```[\s\S]*?```', '', text)  # strip code blocks
    text = re.sub(r'`[^`]*`', '', text)  # inline code
    text = re.sub(r'^\s*#{1,6}.*$', '', text, flags=re.M)  # headers
    text = re.sub(r'\s+', ' ', text)
    sents = re.split(r'(?<=[.!?])\s+', text)
    out = []
    for s in sents:
        s = s.strip(' -*').strip()
        if len(s) >= 40:
            out.append(s)
    return out

def normalize(s):
    s = s.lower()
    s = re.sub(r'[^\w\s]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def shingles(text, n=5):
    words = normalize(text).split()
    return set(' '.join(words[i:i+n]) for i in range(len(words) - n + 1))

# Find duplicates by:
# 1) Lines (>20 chars normalized) appearing in >1 section
# 2) Key phrases / rules repeated across sections
duplicates = defaultdict(list)

def norm_line(s):
    s = s.strip(' -*•·>').strip()
    s = re.sub(r'\s+', ' ', s)
    return s.lower()

# Collect normalized lines per section
line_index = defaultdict(list)  # normalized_line -> [(section_id, original_line)]
for i, s in enumerate(merged):
    seen_in_this = set()
    for raw in s['content'].split('\n'):
        n = norm_line(raw)
        if len(n) < 25:
            continue
        if re.match(r'^#{1,6}\s', n):
            continue
        if n in seen_in_this:
            continue
        seen_in_this.add(n)
        line_index[n].append((i, raw.strip()))

# Phrase fingerprints: detect rule keywords repeated
key_phrases_re = [
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
    (r'\bbypass|--dangerously', 'bypass permissions'),
    (r'NL.*PL.*EN|PL.*NL.*EN|3\s+języki', '3 języki'),
    (r'open\s+design|playwright\s+mcp|opencla[uw]', 'AI tools stack'),
    (r'gp-maschinen', 'gp-maschinen reference'),
    (r'octagon', 'Octagon Sport'),
    (r'pixelforgood', 'PixelForGood'),
    (r'invoiceflow', 'InvoiceFlow'),
    (r'stopmetzoeken', 'StopMetZoeken'),
]
phrase_index = defaultdict(set)  # phrase_label -> {section_ids}
for i, s in enumerate(merged):
    cl = s['content'].lower()
    for pat, label in key_phrases_re:
        if re.search(pat, cl, re.I):
            phrase_index[label].add(i)

for n, occurrences in line_index.items():
    if len(occurrences) >= 2:
        ids = list({o[0] for o in occurrences})
        if len(ids) < 2:
            continue
        sample = occurrences[0][1][:80]
        for sid in ids:
            others = [x for x in ids if x != sid]
            duplicates[sid].append({
                'kind': 'line',
                'with': others,
                'sample': sample,
            })

for label, sids in phrase_index.items():
    if len(sids) >= 3:
        for sid in sids:
            others = sorted(x for x in sids if x != sid)
            duplicates[sid].append({
                'kind': 'phrase',
                'label': label,
                'with': others,
                'sample': label,
            })

# === CONFLICT DETECTION ===
# Rule-based pairs that signal contradictions
CONFLICT_RULES = [
    {
        'id': 'stripe_vs_mollie',
        'label': 'Stripe vs Mollie (NL)',
        'patterns_a': [r'\bnigdy\s+stripe\b', r'mollie\s+nie\s+stripe', r'\bMollie\s+\(primary'],
        'patterns_b': [r'invoiceflow.*stripe', r'stripe\s+€\d+', r'using\s+stripe'],
    },
    {
        'id': 'em_dash',
        'label': 'NIGDY em-dash vs zawiera em-dash',
        'patterns_a': [r'nigdy\s+myślnika?\s+em', r'zero\s+em-?dash', r'NIGDY.*\(—\)'],
        'patterns_b': [],
        'check_em_dash_present': True,
    },
    {
        'id': 'always_ask',
        'label': 'Nigdy nie pytaj vs lista akcji wymagajacych pytania',
        'patterns_a': [r'nigdy\s+nie\s+pytaj', r'staly\s+yes', r'stałe\s+yes', r'bez\s+pytania'],
        'patterns_b': [r'wymagają\s+zapytania', r'pytam.*tylko\s+gdy', r'pytaj.*pinky'],
    },
    {
        'id': 'lite_version',
        'label': 'Nigdy lite vs MVP/preview',
        'patterns_a': [r'nigdy.*lite', r'zero\s+skrótów', r'na\s+maksa'],
        'patterns_b': [r'\bMVP\b', r'lite\s+version', r'preview\s+version'],
    },
    {
        'id': 'autonomy_vs_options',
        'label': 'Decyzje same vs 3-4 opcje przed decyzja',
        'patterns_a': [r'decyduj.*samodzieln', r'autonomi.*działać', r'decyzje\s+same'],
        'patterns_b': [r'3-4\s+opcj', r'czeka.*wybór', r'czekaj\s+na\s+mój\s+wybór'],
    },
    {
        'id': 'no_paid_apis',
        'label': 'Zero placonych API vs InvoiceFlow Stripe / OpenRouter',
        'patterns_a': [r'zero\s+dodatkowych\s+płatnych', r'nie\s+proponuj.*api'],
        'patterns_b': [r'openrouter.*key', r'glm-5\.1.*openrouter', r'higgsfield'],
    },
    {
        'id': 'desktop_folder',
        'label': 'Apps Cloude folder vs sandbox/desktop',
        'patterns_a': [r'desktop/apps\s+cloude', r'pulpit\s+ma\s+zostać\s+czysty'],
        'patterns_b': [r'desktop/claude-sandbox', r'desktop/ai_studio'],
    },
]

def check_conflicts(content_lower, raw_content):
    found = []
    for rule in CONFLICT_RULES:
        a_match = any(re.search(p, content_lower, re.I) for p in rule['patterns_a'])
        b_match = any(re.search(p, content_lower, re.I) for p in rule['patterns_b']) if rule['patterns_b'] else False
        if rule.get('check_em_dash_present'):
            if a_match and ('—' in raw_content):
                found.append({'rule_id': rule['id'], 'label': rule['label'], 'kind': 'self'})
                continue
        if a_match and b_match:
            found.append({'rule_id': rule['id'], 'label': rule['label'], 'kind': 'self'})
        elif a_match:
            found.append({'rule_id': rule['id'], 'label': rule['label'], 'kind': 'side_a'})
        elif b_match:
            found.append({'rule_id': rule['id'], 'label': rule['label'], 'kind': 'side_b'})
    return found

# Cross-section conflicts: side_a in section X + side_b in section Y
cross_conflicts = defaultdict(list)
section_sides = []
for i, s in enumerate(merged):
    cl = s['content'].lower()
    sides = []
    for rule in CONFLICT_RULES:
        a = any(re.search(p, cl, re.I) for p in rule['patterns_a'])
        b = any(re.search(p, cl, re.I) for p in rule['patterns_b']) if rule['patterns_b'] else False
        if rule.get('check_em_dash_present') and a and '—' in s['content']:
            cross_conflicts[i].append({'rule_id': rule['id'], 'label': rule['label'],
                                        'with': i, 'note': 'em-dash w tej samej sekcji'})
        if a and b:
            cross_conflicts[i].append({'rule_id': rule['id'], 'label': rule['label'],
                                        'with': i, 'note': 'wewnątrz sekcji'})
        sides.append({'a': a, 'b': b})
    section_sides.append(sides)

for i, sa in enumerate(section_sides):
    for j, sb in enumerate(section_sides):
        if i == j:
            continue
        for ri, rule in enumerate(CONFLICT_RULES):
            if rule.get('check_em_dash_present'):
                continue
            if sa[ri]['a'] and sb[ri]['b']:
                cross_conflicts[i].append({'rule_id': rule['id'], 'label': rule['label'],
                                            'with': j, 'note': f'kolizja z sekcja #{j+1}'})

# Build output
out_sections = []
for i, s in enumerate(merged):
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
    })

stats = {
    'total_chars': total,
    'section_count': len(out_sections),
    'keep_count': sum(1 for s in out_sections if s['suggested_action'] == 'keep'),
    'move_count': sum(1 for s in out_sections if s['suggested_action'] == 'move'),
    'delete_count': 0,
    'keep_chars': sum(s['chars'] for s in out_sections if s['suggested_action'] == 'keep'),
    'move_chars': sum(s['chars'] for s in out_sections if s['suggested_action'] == 'move'),
    'duplicate_pairs': sum(len(d) for d in duplicates.values()) // 2,
    'conflict_count': sum(len(c) for c in cross_conflicts.values()),
}

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump({'stats': stats, 'sections': out_sections}, f, ensure_ascii=False)

print(json.dumps(stats, ensure_ascii=False, indent=2))
