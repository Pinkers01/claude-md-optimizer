import json, html as h
data = json.load(open('/tmp/claude_md_optimizer/sections.json'))
# Inline JSON safely
json_str = json.dumps(data, ensure_ascii=False).replace('</', '<\\/')
template = open('/tmp/claude_md_optimizer/template.html', 'r', encoding='utf-8').read()
out = template.replace('__DATA_PLACEHOLDER__', json_str)
open('/Users/pinky/Desktop/claude_md_optimizer.html', 'w', encoding='utf-8').write(out)
print('OK', len(out), 'bytes')
