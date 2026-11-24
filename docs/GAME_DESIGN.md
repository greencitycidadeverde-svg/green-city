# GREEN CITY — Direção de jogo e progressão

## Premissa

O jogador chega a uma cidade degradada e passa a atuar como agente de transformação urbana. Ele precisa entender os problemas, definir prioridades, instalar soluções, organizar serviços e acompanhar as consequências. A cidade muda visual e funcionalmente conforme as decisões.

## Estrutura macro

A cidade é um mapa contínuo planejado, dividido em cinco regiões que funcionam como fases. O mapa geral mostra o conjunto desde o início, mas o conteúdo jogável é liberado por progressão. Cada região tem seu próprio cenário, orçamento, indicadores, desafios e missões.

| Fase | Região | Tema central |
|---|---|---|
| 01 | Centro Industrial | Resíduos, energia e mobilidade |
| 02 | Porto | Logística e qualidade da água |
| 03 | Periferia Verde | Serviços urbanos e transporte público |
| 04 | Reserva Florestal | Biodiversidade e restauração |
| 05 | Zona Costeira | Saneamento e resiliência climática |

A primeira versão contém cenário 3D somente para a Fase 01. A visão geral das cinco regiões não deve ser confundida com cinco mapas já construídos.

## Ciclo principal

**Explorar → Diagnosticar → Planejar → Executar → Avaliar → Desbloquear**

- Explorar: percorrer o bairro e localizar problemas.
- Diagnosticar: entender resíduos, energia, mobilidade, água e áreas degradadas.
- Planejar: escolher melhorias considerando custo, infraestrutura e ordem de implantação.
- Executar: coletar, transportar, construir, modernizar e organizar serviços.
- Avaliar: acompanhar indicadores e observar mudanças no ambiente.
- Desbloquear: cumprir metas para avançar à próxima região.

## Cinco pilares do jogo

1. Mobilidade sustentável: comparar tecnologias de veículos, ônibus, transporte ativo, infraestrutura de recarga e impactos do sistema energético.
2. Energia limpa: geração solar, rede, demanda e recarga.
3. Gestão de resíduos: coleta, transporte, triagem, reciclagem, compostagem e destinação de rejeitos.
4. Recuperação ambiental: rios, áreas verdes, habitats e áreas degradadas.
5. Planejamento urbano: decidir onde instalar estruturas e como conectá-las aos serviços.

## Primeira fase — Centro Industrial

Objetivo: provar o ciclo de gestão e mostrar que as soluções dependem umas das outras.

- Coletar cinco resíduos e transportar a carga até o EcoCentro.
- A entrega eleva o indicador de reciclagem e gera orçamento didático.
- Instalar painéis solares e um ponto de recarga.
- Somente então converter o veículo municipal a diesel em elétrico.
- Cumprir as metas de reciclagem, energia renovável e mobilidade para liberar a região do Porto.

Custos e indicadores são valores de balanceamento provisórios, não estudos técnicos de custos ou benefícios ambientais.

## Fase 02 — Porto (documento de concepção)

O Porto será a segunda região jogável após a recuperação do Centro Industrial. Seu tema não será apenas recolher lixo da água: o jogador deverá localizar as fontes de poluição, interromper a entrada de contaminantes, organizar a logística de resíduos e recuperar gradualmente a margem do rio.

O fluxo planejado é: **investigar a água → identificar fontes → conter a poluição na origem → retirar resíduos flutuantes → estruturar triagem e pré-tratamento → restaurar a margem → acompanhar a recuperação**. A qualidade da água não melhora instantaneamente; intervenções na origem precisam ocorrer antes da restauração ecológica, e a biodiversidade responde com atraso.

O escopo, mapa por zonas, missões, indicadores, dependências e critérios de conclusão estão em [`docs/PHASE_02_PORTO.md`](./PHASE_02_PORTO.md). É um plano de produção, não uma área 3D já implementada.

## Direção de experiência

O aprendizado deve acontecer pela exploração, pelas escolhas e pelas consequências, sem transformar o jogo em questionário. Cada tecnologia deve ter requisitos, custos e trade-offs. Evitar a simplificação de que uma tecnologia é sempre limpa independentemente da cadeia de produção, matriz energética e infraestrutura.

## Escopo que ainda precisa ser construído

As quatro regiões posteriores, trânsito e transporte público simulados, NPCs, categorias reais de materiais, instalações funcionais, efeitos ambientais graduais e salvamento persistente ainda não fazem parte do protótipo jogável atual.
