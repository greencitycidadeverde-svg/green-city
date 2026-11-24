# Estado do projeto — 24/11/2026

## Direção aprovada para a implementação
GREEN CITY é um jogo educacional 3D de transformação urbana sustentável. A cidade será um mapa geral dividido em bairros/regiões, cada um funcionando como uma fase. O jogador recupera uma região e libera a seguinte.

## Código desta versão
- Mapa geral com cinco regiões: Centro Industrial, Porto, Periferia Verde, Reserva Florestal e Zona Costeira.
- Apenas o Centro Industrial possui cenário 3D jogável neste estágio.
- Coleta de cinco resíduos e entrega da carga no EcoCentro.
- Plano Urbano com quatro indicadores simulados.
- Instalação de energia solar e ponto de recarga.
- Conversão do veículo municipal a diesel para elétrico, condicionada à implantação de energia solar.
- Liberação do Porto quando as metas da primeira região são atingidas.
- HUD, minimapa, mapa geral e painel de gestão.

## Limitações conhecidas
- O mapa geral apresenta as regiões planejadas, mas quatro delas ainda não têm cenário 3D, missões ou simulação implementados.
- O cenário da primeira fase é procedural e pequeno; personagem cápsula e veículos simples.
- A cadeia de resíduos ainda não possui separação real por material, capacidade de carga, transporte por categorias ou processamento empresarial individualizado.
- Indicadores e custos são balanceamento didático simplificado, não dados científicos ou medição de impacto real.
- Não há NPCs, tráfego complexo, salvamento persistente, backend, Scanner ou multiplayer.
- Nenhum teste manual de gameplay em navegador deve ser presumido apenas pelo sucesso do build.

## Serviços externos
- GitHub: repositório `greencitycidadeverde-svg/green-city`.
- Vercel: projeto web independente `green-city`, conectado ao branch `main`; deploy automático por push.
- Supabase: não criado; permanece adiado para quando houver necessidade de contas ou persistência remota.
- Nenhum serviço ou arquivo do Monta Fácil foi alterado.

## Validação necessária
- Executar `npm run typecheck` e `npm run build` no ambiente de deploy.
- Confirmar a resposta HTTP e inspecionar a versão no navegador.
- Testar manualmente: coleta, deslocamento ao EcoCentro, entrega, compras, indicadores, conversão do veículo, desbloqueio do Porto e controles.
- Não declarar gameplay aprovado antes desses testes manuais.
