# Estado do projeto — 24/11/2026

## Código presente
- Cena urbana procedural de pequeno distrito.
- Personagem cápsula em terceira pessoa com movimentação, corrida, salto e câmera orbital.
- Colisões básicas.
- Veículo elétrico procedural com condução arcade, entrada e saída.
- Cinco resíduos interativos e missão Operação Rio Limpo.
- Recompensa de 80 CIT simulados e transformação visual do rio/vegetação.
- HUD, minimapa e mapa ampliado.

## Verificação executada anteriormente
- Cinco arquivos TypeScript/TSX passaram por transpilação sintática, sem diagnósticos de sintaxe.
- `npm install` não terminou devido a timeout de rede no ambiente de execução.
- `tsc -b` não pôde completar porque as dependências React, Vite e Babylon.js não estavam instaladas.
- Nenhum teste em navegador real foi executado. Nenhum sistema está aprovado em runtime.

## Serviços externos
- GitHub: repositório `greencitycidadeverde-svg/green-city` criado; visibilidade pública; README inicial enviado.
- Vercel: projeto independente `green-city-web` existente na equipe `green-6c16`; sem deployment válido no último levantamento.
- Supabase: organização selecionada no plano Free; criação de backend adiada pois não é necessária à primeira versão local.
- Nenhum serviço ou arquivo do Monta Fácil foi alterado.

## Próxima validação obrigatória
Instalar dependências e executar `npm run typecheck`, `npm run build`, depois testar o bundle em navegador com WebGL 2. Não anunciar a versão como testada até completar esses passos.
