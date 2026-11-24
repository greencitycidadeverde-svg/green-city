# Arquitetura — GREEN CITY First Impact

## Decisão do MVP Web
- TypeScript: regras e contratos de gameplay.
- Babylon.js: cena 3D, câmera, renderização, colisões e meshes.
- React: HUD, menus e painéis; não executa física nem regras de missão.
- Vite: servidor de desenvolvimento e build estático.
- Supabase: fora do escopo da fatia local inicial; será introduzido para contas, salvamento remoto e registros de impacto.

## Fluxo
`React UI -> GameSnapshot -> GreenCityGame -> Babylon.js Scene/Engine`

A UI recebe snapshots do jogo. A simulação não importa componentes React. Serviços remotos futuros deverão entrar por interfaces/ports, nunca diretamente nos componentes visuais.

## Módulos planejados
- `game/world`: construção e streaming do mundo.
- `game/player`: movimento e câmera.
- `game/vehicles`: física e condução.
- `game/missions`: objetivos e estados.
- `game/economy`: XP e pontos locais; CIT real fica bloqueado até definição jurídica e antifraude.
- `services`: autenticação, persistência e Scanner no futuro.

## Restrições técnicas
- Começar com cenário pequeno e geometria procedural.
- Evitar dependências e assets pesados até medir desempenho.
- Manter single-player local até a experiência central estar estável.
- Não coletar localização, câmera ou dados pessoais no protótipo.
- Tratar a moeda exibida como simulação sem valor financeiro.

## Limitações atuais
A condução inicial é arcade e simplificada. O minimapa é esquemático. O cenário ainda não representa os cinco distritos do GDD. Tudo precisa passar pelo checklist de navegador antes de ser considerado testado/aprovado.
