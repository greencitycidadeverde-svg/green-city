# Arquitetura — GREEN CITY

## Princípio

GREEN CITY tem um mundo 3D explorável e uma camada de simulação urbana. As ações do jogador alteram indicadores simplificados e desbloqueiam regiões. A interface não substitui a simulação: React apresenta estados e comandos; as regras ficam no domínio do jogo.

## Tecnologias

- TypeScript: contratos e regras do jogo.
- Babylon.js: cena 3D, câmera, colisões e meshes.
- React: HUD, mapa geral, painel de gestão e menus.
- Vite: dev server e build estático.
- Supabase: adiado; não necessário para single-player local.

## Fluxo atual

`React UI -> GameSnapshot -> GreenCityGame -> Babylon.js Scene/Engine`

A interface recebe snapshots e chama métodos públicos para as ações de gestão. A simulação não importa componentes React.

## Progressão por regiões

A lista de regiões é centralizada em `src/game/neighborhoods.ts`. Cada região tem nome, foco, desafio e regra textual de desbloqueio. O mapa geral apresenta o percurso da cidade:

1. Centro Industrial
2. Porto
3. Periferia Verde
4. Reserva Florestal
5. Zona Costeira

O código atual implementa somente a primeira região como cenário jogável. O Porto aparece como próxima região liberada quando o Centro Industrial atinge as metas. As demais regiões permanecem bloqueadas e são conteúdo futuro, não áreas 3D escondidas já prontas.

## Ciclo jogável do Centro Industrial

1. Coletar cinco objetos de resíduos.
2. Entregar a carga no EcoCentro.
3. Receber 100 CIT simulados e elevar o indicador de reciclagem.
4. Instalar energia solar por 35 CIT.
5. Converter o veículo municipal para elétrico por 45 CIT, exigindo energia solar e ponto de recarga.
6. Liberar a região seguinte quando reciclagem >= 60%, participação renovável >= 30% e mobilidade sustentável >= 30%.

Os quatro indicadores apresentados (reciclagem, energia renovável, mobilidade sustentável e qualidade do ar) são variáveis de gameplay. Seus valores são didáticos e não equivalem a medições, inventários de emissões ou certificações.

## Próxima modularização recomendada

- `world/`: construção, setores, streaming e limites do mapa.
- `player/`: movimentação, animação, câmera.
- `vehicles/`: tipos de motorização, condução e recarga.
- `waste/`: categorias, inventário, transporte, triagem e destino final.
- `energy/`: geração, demanda, armazenamento e rede.
- `missions/`: objetivos e progressão de regiões.
- `simulation/`: indicadores e impactos.
- `economy/`: orçamento e custos das melhorias.

A primeira iteração mantém a implementação concentrada para reduzir risco; esses módulos devem ser extraídos conforme os sistemas crescerem.

## Restrições

- Começar com uma região pequena e mensurável.
- Evitar carregar a cidade inteira em detalhe no primeiro build.
- Introduzir streaming de setores e níveis de detalhe antes de expandir muito o mapa 3D.
- Manter CIT local e sem valor financeiro.
- Não anunciar impacto ambiental real sem dados e método verificáveis.
