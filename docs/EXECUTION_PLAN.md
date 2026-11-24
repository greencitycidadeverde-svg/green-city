# Plano de execução — GREEN CITY

## Ciclo 0 — Repositório e build
1. Manter o código versionado no repositório GitHub `greencitycidadeverde-svg/green-city`.
2. Instalar Node.js 22.12+ e dependências com `npm install`.
3. Executar `npm run typecheck` e `npm run build`.
4. Validar a abertura WebGL no Chrome e Edge.

## Ciclo 1 — First Impact jogável
1. Validar câmera e movimento em terceira pessoa.
2. Validar colisões, salto e perda de foco.
3. Validar entrada, condução e saída do veículo arcade.
4. Validar coleta, missão, CIT simulado e transformação ambiental.
5. Corrigir bugs antes de adicionar conteúdo.

## Ciclo 2 — Qualidade de jogo
1. Melhorar avatar, animações e feedback de interação.
2. Melhorar veículo e colisões.
3. Adicionar NPCs simples e pontos de interesse.
4. Adicionar salvamento local versionado.
5. Criar mapa/minimapa com coordenadas reais do distrito.

## Ciclo 3 — Publicação Web
1. Build de produção validado.
2. Conectar o repositório à Vercel.
3. Publicar Preview e, após testes, Production.
4. Testar navegadores e máquinas de desempenho baixo.

## Ciclo 4 — Serviços remotos
1. Definir dados e modelo de ameaças.
2. Criar projeto Supabase separado somente quando necessário e com custo explicitamente verificado.
3. Implementar autenticação e salvamento remoto.
4. Implementar campanhas de impacto real e auditoria somente após desenho de privacidade, consentimento e antifraude.

## Critério de avanço
Não marcar uma etapa como concluída apenas porque o código foi escrito. Exigir execução, teste reproduzível e registro do resultado.
