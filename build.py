"""Build one offline HTML file using only Python's standard library."""
from pathlib import Path
import json
import re
import base64

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'source'
images = json.loads((SOURCE / 'assets-inline.json').read_text())
for animal in ['mouse', 'sparrow']:
    images[animal] = 'data:image/png;base64,' + base64.b64encode((SOURCE / 'assets' / (animal + '.png')).read_bytes()).decode()
modules = ['engine.js', 'projection.js', 'quiz.js', 'quiz-view.js', 'asset-frames.js',
           'motion-view.js', 'render.js', 'solo-state.js', 'audio.js',
           'food-web.js', 'web-art.js', 'web-view.js', 'web-export.js', 'solo.js']
parts = []
for name in modules:
    source = (SOURCE / name).read_text()
    source = re.sub(r'^import[^\n]+\n', '', source, flags=re.M)
    source = re.sub(r'\bexport\s+', '', source)
    if name == 'render.js':
        source = source.replace("'./assets/animals-pixel.png'", json.dumps(images['animals']))
        source = source.replace("'./assets/forest-props-pixel.png'", json.dumps(images['props']))
    if name == 'web-art.js':
        for animal in ['mouse', 'sparrow']:
            source = source.replace("'./assets/" + animal + ".png'", json.dumps(images[animal]))
    parts.append(f'// {name}\n{source}')
script = "(()=>{\n'use strict';\n" + '\n'.join(parts) + '\n})();'
style = (SOURCE / 'style.css').read_text().replace('__ANIMALS__', images['animals']).replace('__PROPS__', images['props'])
html = (SOURCE / 'shell.html').read_text()
html = html.replace('<!-- GAME_STYLE -->', '<style>\n' + style + '\n</style>')
html = html.replace('<!-- GAME_CODE -->', '<script>\n' + script + '\n</script>')
(ROOT / 'index.html').write_text(html)
print(f'Built index.html ({len(html.encode()):,} bytes), all code and images embedded.')
