# Modelos 3D do GREEN CITY

Os modelos são gerados automaticamente durante o build de produção pelo script `scripts/generate-models.mjs`.

Arquivos produzidos:
- `personagem.glb.gz`
- `arvore.glb.gz`
- `edificio.glb.gz`
- `carro_eletrico.glb.gz`
- `caminhao_coleta.glb.gz`

O jogo carrega os GLBs diretamente de `/models`. O carregador reconhece quando o navegador/CDN entrega os bytes ainda compactados e descompacta antes de importar pelo Babylon.js. O build valida o cabeçalho GLB e gera todos os cinco arquivos sempre que uma nova versão é publicada.
