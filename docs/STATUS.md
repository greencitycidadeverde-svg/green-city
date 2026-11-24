# Estado do projeto — 24/11/2026

## Direção
GREEN CITY é um jogo educacional 3D de transformação urbana sustentável. A cidade será um mapa geral dividido em cinco bairros/regiões, cada um funcionando como uma fase. O jogador recupera uma região e libera a seguinte.

## Código atual
- Mapa geral com cinco regiões: Centro Industrial, Porto, Periferia Verde, Reserva Florestal e Zona Costeira.
- Apenas o Centro Industrial possui cenário 3D jogável.
- Coleta e entrega da carga no EcoCentro.
- Plano Urbano com indicadores simulados de reciclagem, energia renovável, mobilidade sustentável e qualidade do ar.
- Instalação de energia solar e ponto local de recarga.
- Conversão do veículo municipal a diesel para elétrico, condicionada à energia solar.
- Liberação lógica do Porto quando as metas da primeira região são atingidas.

## Verificação já executada
- O commit da nova progressão foi compilado com sucesso na Vercel: `tsc -b` e `vite build` passaram.
- Deploy de produção foi concluído com estado READY; página retornou HTTP 200.
- A compilação reportou bundle JavaScript principal de aproximadamente 5,6 MB (1,26 MB gzip), acima da recomendação de 500 kB. Code splitting e otimização Babylon.js permanecem pendentes.
- O build anterior apontou uma vulnerabilidade alta durante `npm install`; Vite foi atualizado para 7.3.7 nesta revisão para corrigir advisories conhecidos. A nova instalação precisa confirmar o resultado do audit.
- Node foi restringido a 22.x no package.json para alinhar com a versão configurada na Vercel.

## Limitações conhecidas
- As outras quatro regiões aparecem no mapa, mas ainda não têm cenário 3D, missões ou simulação.
- O cenário da primeira fase é procedural e pequeno; personagem cápsula e veículo simples.
- A cadeia de resíduos ainda não separa materiais individualmente nem simula logística/processamento empresarial completo.
- Indicadores e custos são balanceamento didático, não medições ambientais verificadas.
- Não há NPCs, tráfego complexo, salvamento persistente, backend, Scanner ou multiplayer.
- Nenhum teste manual de gameplay foi concluído; build e HTTP 200 não comprovam o funcionamento das interações no navegador.

## Serviços externos
- GitHub: repositório `greencitycidadeverde-svg/green-city`.
- Vercel: projeto `green-city`, conectado ao branch `main`.
- Supabase: não criado; adiado até existir necessidade de contas ou persistência remota.
- Nenhum serviço ou arquivo do Monta Fácil foi alterado.

## Próximos testes
- Confirmar build e audit após a atualização de Vite.
- Testar no navegador: coleta, entrega, custos, indicadores, instalações, conversão do veículo e liberação do Porto.
- Inspecionar console do navegador e medir FPS/memória em PC modesto.
