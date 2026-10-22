"""Build the offline practice from the same class UI, models and assets. Stdlib only."""
from pathlib import Path
import base64
import re
ROOT=Path(__file__).resolve().parent
modules=['engine.js','sync.js','projection.js','quiz.js','quiz-view.js','asset-frames.js','motion-view.js','render.js','audio.js','app.js']
parts=[]
for name in modules:
    code=(ROOT/name).read_text()
    code=re.sub(r'^import[^\n]*\n','',code,flags=re.M)
    code=re.sub(r'\bexport\s+','',code)
    if name=='render.js':
        for asset in ['animals-pixel.png','forest-props-pixel.png']:
            uri='data:image/png;base64,'+base64.b64encode((ROOT/'assets'/asset).read_bytes()).decode()
            code=code.replace("'./assets/"+asset+"'",repr(uri))
    if name=='app.js':
        code=code.replace("const teacherMode=params.get('mode')==='teacher';","const teacherMode=false;")
    parts.append('// '+name+'\n'+code)
style=(ROOT/'style.css').read_text()
for asset in ['animals-pixel.png','forest-props-pixel.png']:
    uri='data:image/png;base64,'+base64.b64encode((ROOT/'assets'/asset).read_bytes()).decode()
    style=style.replace('./assets/'+asset,uri)
# The offline practice cannot open production Firebase or fetch configuration.
network="class Network{async init(){throw new Error('demo.html은 혼자 연습하는 파일이에요. 우리 반 공동접속은 배포한 index.html 주소를 이용해 주세요.');}dispose(){}}"
script="(()=>{\n'use strict';\n"+network+'\n'+'\n'.join(parts)+'\npractice(false);\n})();'
html=(ROOT/'index.html').read_text().replace('<link rel="stylesheet" href="./style.css">','<style>\n'+style+'\n</style>')
html=html.replace('<script type="module" src="./app.js"></script>','<script>\n'+script+'\n</script>')
html=html.replace('<title>먹이사슬 술래잡기 · 생물과 환경</title>','<title>먹이사슬 술래잡기 · 혼자 연습 3.4</title>')
(ROOT/'demo.html').write_text(html)
print(f'Built demo.html: {len(html.encode()):,} bytes; same picture quiz, audio, engine and motion, no network SDK.')
