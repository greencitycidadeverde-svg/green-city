# GREEN CITY — Cidade Sustentável (Web MVP)

**Plant in Real Life. Rule the Green City.**

GREEN CITY é um jogo educacional 3D de mundo aberto no navegador. O objetivo é transformar uma cidade degradada em uma cidade sustentável por meio de decisões, obras e mudanças nos sistemas urbanos — não apenas recolher lixo.

## Estrutura da cidade

A cidade foi planejada como um mapa geral dividido em cinco regiões. Cada região funciona como uma fase de recuperação, com problemas, objetivos e sistemas próprios:

1. **Centro Industrial** — resíduos, energia e mobilidade (primeira região jogável).
2. **Porto** — logística e qualidade da água.
3. **Periferia Verde** — serviços urbanos e transporte público.
4. **Reserva Florestal** — biodiversidade e restauração.
5. **Zona Costeira** — saneamento e resiliência climática.

O mapa geral já apresenta as cinco regiões e a lógica sequencial de desbloqueio. Nesta versão, somente o Centro Industrial tem cenário 3D jogável; as demais regiões são etapas planejadas e serão construídas progressivamente.

## Primeiro ciclo de recuperação

- Explorar o bairro e recolher cinco resíduos.
- Levar a carga até o EcoCentro para triagem e encaminhamento à reciclagem.
- Receber 100 CIT simulados pelo primeiro ciclo de recuperação.
- Investir 35 CIT em painéis solares e infraestrutura local de recarga.
- Investir 45 CIT para converter o veículo municipal a diesel em elétrico.
- Atingir as metas de reciclagem, energia renovável e mobilidade sustentável para liberar o Porto no mapa.

Os valores e indicadores são **mecânicas didáticas simplificadas**, não medições ambientais reais. O protótipo não calcula emissões de ciclo de vida nem certifica impacto ambiental.

## Tecnologia

- TypeScript
- React para HUD, menus e painéis
- Babylon.js para renderização 3D, câmera e colisões
- Vite para desenvolvimento e build web

O jogo roda no navegador moderno com suporte a WebGL 2. Não exige instalação do jogo pelo jogador.

## Desenvolvimento no Windows

Requisitos recomendados: Windows 10/11, Node.js 22.12 ou superior (LTS), npm 10+ e navegador moderno.

1. Instale o Node.js LTS: https://nodejs.org/
2. Abra a pasta do projeto no terminal.
3. Execute `npm install`.
4. Execute `npm run dev`.
5. Abra o endereço local indicado pelo Vite.

## Verificação

```bash
npm run typecheck
npm run build
npm run preview
```

## Controles

- WASD: mover o personagem ou dirigir
- Mouse: girar a câmera
- Shift: correr
- Espaço: pular
- E: recolher resíduos ou entregar a carga no EcoCentro
- F: entrar/sair do veículo
- M: abrir/fechar o mapa geral da cidade
- ESC: fechar o mapa ou pausar

## O que já existe no protótipo

- Bairro 3D procedural pequeno com ruas, edifícios, praça, rio e vegetação.
- Personagem em terceira pessoa, movimentação, corrida e salto.
- Veículo municipal inicialmente a diesel, com condução arcade; após investimento, é convertido visualmente em elétrico.
- Cinco objetos de resíduos interativos.
- EcoCentro físico no cenário e etapa de entrega.
- Plano Urbano com indicadores simulados.
- Instalação visual de painéis solares e ponto de recarga.
- Conversão do veículo municipal para elétrico, condicionada à energia solar.
- Mapa geral com cinco regiões e estado de progressão.
- CIT local fictício, sem valor financeiro, saque, compra ou transferência.

## Ainda não implementado

Os quatro bairros posteriores ainda não têm cenários 3D jogáveis. Também faltam NPCs, modelos finais, animações, tráfego simulado, separação individual de resíduos por material, processamento logístico detalhado, salvamento persistente, backend, Scanner, multiplayer e validação de impacto ambiental real.

## Organização do código

- `src/game`: mundo 3D e regras do jogo.
- `src/game/neighborhoods.ts`: dados das cinco regiões e seus focos.
- `src/ui`: HUD, mapa da cidade e Plano Urbano.
- `src/styles`: apresentação visual.
- `docs`: arquitetura, design, execução e checklist.

Supabase permanece fora do escopo do single-player local inicial. Será avaliado quando houver necessidade concreta de contas, sincronização ou salvamento remoto.

## Segurança e economia

CIT é somente uma pontuação fictícia local do jogo. Não é criptoativo, não possui valor monetário e não pode ser comprado, sacado ou transferido. O protótipo não coleta localização, câmera ou dados pessoais.
