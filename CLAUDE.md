# Casa dos pais: modelo em código

Planta térrea exportada do HomeByMe (projeto 23564974), convertida em dados JSON mais um visualizador Three.js.

## Comandos
- `npm install` e depois `npm run dev`: visualizador 3D/2D em http://localhost:5173
- `npm run plan`: gera `out/plan.svg` (planta baixa)
- `npm run model`: regenera `data/house.json` a partir de `data/raw-extract.json` (requer `pip install shapely`)

## Fonte da verdade
**`data/house.json` é o modelo.** Edite-o para mudar a casa. `raw-extract.json` é o export original e só é usado pelo `npm run model`. Rodar esse comando sobrescreve `house.json`.

### Convenções
- Unidades: **mm**. Origem no canto sudoeste da planta. `x` aponta para leste (direita) e `y` para norte (cima na planta); `z` é a altura.
- `rot` em graus, anti-horário, em torno de `z`.
- Pé-direito: 2500 mm. Paredes com 100 mm de espessura (50 mm de cada lado do eixo).

### Esquema
- `walls[]`: `{id, a:[x,y], b:[x,y], t, h}`. Segmento no **eixo** da parede.
- `separators[]`: divisões de cômodo sem parede física (linhas virtuais).
- `rooms[]`: `{id, label, name?, areaFloor (m², valor do HomeByMe), polygon:[[x,y]...] (eixo das paredes), boundary[], floor/walls/ceiling (dbId de material), furnitureIds}`
- `openings[]`: portas e janelas. `pos` é o centro do vão sobre o eixo da parede. `pos[2]` é o peitoril. Largura e altura vêm de `params.width/height` e `bbox`. `src/geometry.js#attachOpenings` associa cada vão à parede.
- `furniture[]`: `{id, dbId, pos:[x,y,z], rot, bbox:[minx,miny,minz,maxx,maxy,maxz] (local, antes da rotação), params?, userProduct?}`

### Limitações conhecidas
- O export do HomeByMe **não tem nomes de produtos**, só `dbId`. Os rótulos em `src/catalog.js` foram inferidos pelos parâmetros ou dimensões.
- A geometria 3D real dos móveis (arquivos .bm3/.bma) não foi exportada. Cada móvel é desenhado como a caixa do seu bounding box.
- Os cômodos ainda estão com os nomes genéricos do HomeByMe ("room 1"...). Para renomear, preencha `rooms[].name`.
- Referências de materiais e acabamentos (`OLD_PUBLICATION_MATERIAL_*`) foram removidas dos `params`.

## Estrutura
- `src/geometry.js`: geometria pura (vãos, recorte de paredes, footprint). Sem Three.js, então roda em Node.
- `src/main.js`: cena Three.js (paredes com vãos recortados, pisos, móveis, UI).
- `src/catalog.js`: mapeamento de `dbId` para rótulo e cor.
- `scripts/plan-svg.mjs`: exporta a planta em SVG.
- `scripts/build_model.py`: transforma o export bruto em `house.json`.
