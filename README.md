# GREEN CITY — Cidade Sustentável

**Plant in Real Life. Rule the Green City.**

GREEN CITY é um jogo educacional 3D de mundo aberto no navegador. O jogador transforma uma cidade degradada por meio de diagnóstico, planejamento, obras e mudanças nos sistemas urbanos — não apenas recolhendo lixo.

## Estrutura da cidade

A campanha possui dez regiões fictícias conectadas em um mapa geral:
1. **Centro Industrial** — resíduos, energia e mobilidade (Fase 01).
2. **Porto** — efluentes, saneamento local e logística (Fase 02).
3. **Periferia Verde** — saneamento e serviços urbanos.
4. **Reserva Florestal** — biodiversidade e restauração.
5. **Zona Costeira** — oceanos e resiliência climática.
6. **Cinturão Agrícola** — solo e produção sustentável.
7. **Centro Histórico** — mobilidade e patrimônio.
8. **Distrito Tecnológico** — economia circular.
9. **Vale das Nascentes** — água doce e clima.
10. **Ilha da Biodiversidade** — ecossistemas integrados.

As regiões são liberadas em sequência. As regiões concluídas ficam marcadas como recuperadas no mapa; a próxima é liberada e as futuras permanecem bloqueadas. As Fases 01 e 02 possuem cenários 3D nesta versão; as demais representam a rota planejada da campanha.

## Ciclo inicial de jogo

- Explorar o bairro em terceira pessoa.
- Abrir o mapa geral fictício com dez regiões e acompanhar a progressão da campanha.
- Recolher cinco resíduos com silhuetas distintas: papel, plástico, metal, vidro e orgânico.
- Transportar a carga até o EcoCentro.
- Consultar indicadores didáticos de reciclagem, energia renovável, mobilidade e qualidade do ar.
- Instalar energia solar e infraestrutura local de recarga.
- Converter o veículo municipal a diesel para elétrico, após implantar geração renovável.
- Atingir as metas do bairro para liberar logicamente o Porto.

CIT, custos e indicadores são valores simulados para o balanceamento do jogo; não representam moeda, medições ambientais ou créditos de carbono reais.

## Tecnologia

- TypeScript e React para HUD, menus e painéis.
- Babylon.js para mundo 3D, câmera, colisões e interação.
- Vite para desenvolvimento e compilação web.
- Cenário procedural para a fase inicial; Blender não é requisito.
- O jogo é entregue no navegador e não exige instalação do jogador.
- O progresso atual é mantido durante a sessão; salvamento permanente entre visitas será uma melhoria futura.

## Desenvolvimento local (opcional)

Requisitos: Node.js 22.x e npm.
1. Execute **npm install**.
2. Execute **npm run dev**.
3. Abra o endereço local exibido pelo Vite.

Verificações: **npm run typecheck** e **npm run build**.

## Controles

- WASD: mover ou dirigir.
- Mouse: girar a câmera.
- Shift: correr.
- Espaço: pular.
- E: recolher resíduos ou entregar a carga (o jogo mostra um botão contextual quando estiver no alcance).
- F: entrar ou sair do veículo (um botão contextual também aparece ao se aproximar).
- M: abrir ou fechar o mapa.
- ESC: fechar o mapa ou pausar.

## Evolução de campanha

A versão 0.4.1 mantém a campanha de dez regiões e o cenário 3D inicial do Porto. A primeira fase agora possui tela explícita de conclusão que abre o mapa antes de entrar no Porto. O cenário recebeu uma rodada inicial de suavização geométrica: personagem mais expressivo e animado, copas de árvores orgânicas, esquadrias e fachadas arredondadas, além de carro e caminhão com carrocerias mais curvas. A substituição por assets 3D profissionais próprios continua sendo a próxima etapa visual. O conceito detalhado está em `docs/PHASE_02_PORTO.md`.

## Limitações conhecidas

As oito regiões posteriores ao Porto ainda não têm cenário 3D jogável. NPCs, tráfego complexo, inventário e processamento completo por material, salvamento persistente, contas, multiplayer, Scanner e verificação de impacto ambiental real permanecem no plano futuro. A silhueta do agente e os detalhes arquitetônicos atuais são geometria procedural, não modelos artísticos finais.

## Organização

- src/game: mundo 3D e regras.
- src/game/neighborhoods.ts: dados das regiões.
- src/ui: HUD, mapa e Plano Urbano.
- src/styles: identidade visual e layout.
- docs: arquitetura, design, execução e estado.

## Infraestrutura

- Código-fonte: https://github.com/greencitycidadeverde-svg/green-city
- Direção visual editável: https://www.figma.com/design/0h4zS7dK3C6uJr3qVLo6On
- Publicação web: Vercel.
- Supabase será avaliado quando houver necessidade de contas ou sincronização remota.


## Projeto pedagógico e visual

A visão completa da campanha, progressão de conhecimento e direção de arte está em [docs/GREEN_CITY_10_PHASES.md](docs/GREEN_CITY_10_PHASES.md).
