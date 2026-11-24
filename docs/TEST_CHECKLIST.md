# Checklist de testes — GREEN CITY por bairros

## Build e abertura
- [ ] `npm install` termina sem erros
- [ ] `npm run typecheck` termina sem erros
- [ ] `npm run build` termina sem erros
- [ ] A aplicação abre no Chrome e Edge com WebGL 2
- [ ] O mapa geral mostra as cinco regiões na ordem planejada

## Ciclo da primeira fase — Centro Industrial
- [ ] E próximo de cada resíduo recolhe apenas um objeto
- [ ] Ao recolher 5/5, a missão muda para entrega
- [ ] E longe do EcoCentro não entrega os resíduos
- [ ] E próximo do EcoCentro registra a entrega uma única vez
- [ ] A entrega concede 100 CIT simulados uma única vez
- [ ] O Plano Urbano apresenta os quatro indicadores
- [ ] Instalar energia solar custa 35 CIT e atualiza o indicador de energia renovável
- [ ] A instalação solar cria painéis e um ponto de recarga visíveis
- [ ] Converter o veículo antes da instalação solar é bloqueado
- [ ] Converter o veículo custa 45 CIT e altera o veículo para elétrico
- [ ] O Porto é liberado somente após cumprir as três metas do bairro

## Personagem, câmera e veículo
- [ ] WASD movimenta personagem e veículo
- [ ] Shift corre; Espaço pula
- [ ] Mouse gira a câmera
- [ ] F entra e sai do veículo quando próximo
- [ ] W acelera, S freia/reverte, A/D esterçam
- [ ] ESC pausa/retoma e M abre/fecha o mapa

## Qualidade visual — versão 0.3.2
- [ ] O agente apresenta colete, faixas refletivas, crachá, luvas, capacete e mochila sem peças desalinhadas.
- [ ] Árvores mostram tronco, galhos e copas em camadas sem atravessar prédios ou bloquear caminhos.
- [ ] Letreiros das fachadas estão legíveis e orientados para a rua.
- [ ] EcoCentro mostra PAPEL (azul), PLÁSTICO (vermelho), VIDRO (verde), METAL (amarelo) e ORGÂNICO (marrom).
- [ ] Cada recipiente tem pictograma distinto, nome e exemplos; verificar especialmente PLÁSTICO versus VIDRO.
- [ ] Placa educativa está voltada para o caminho de chegada e pode ser lida sem se aproximar demais.
- [ ] Verificar se texturas e fontes aparecem corretamente em diferentes resoluções.

## Interface e desempenho
- [ ] Plano Urbano abre e fecha corretamente
- [ ] Mapa geral abre e fecha corretamente
- [ ] Indicadores e estado do veículo atualizam após cada ação
- [ ] Layout é utilizável em telas estreitas
- [ ] Teste em PC modesto com registro de FPS e memória
- [ ] Verificar console do navegador e erros de runtime

> O build foi verificado no ambiente de deploy; os itens de gameplay acima só podem ser marcados após teste manual no navegador.
