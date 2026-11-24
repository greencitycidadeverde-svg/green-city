# Checklist de testes — GREEN CITY First Impact

## Fundação
- [ ] `npm install` termina sem erros
- [ ] `npm run typecheck` termina sem erros
- [ ] `npm run build` termina sem erros
- [ ] `npm run dev` abre a aplicação no navegador
- [ ] WebGL 2 disponível e cena renderizada

## Personagem e câmera
- [ ] WASD move o personagem em relação à orientação da câmera
- [ ] Shift aumenta a velocidade
- [ ] Espaço executa salto e o personagem retorna ao chão
- [ ] Mouse gira a câmera
- [ ] Edifícios e barreiras bloqueiam a passagem
- [ ] Perda de foco da janela não deixa teclas presas

## Veículo
- [ ] Aproximar-se do carro e pressionar F entra no veículo
- [ ] Pressionar F longe do carro não entra
- [ ] W acelera, S freia/reverte, A/D esterçam
- [ ] O veículo colide com objetos sólidos
- [ ] F sai do veículo e reposiciona o personagem ao lado
- [ ] HUD exibe velocidade e estado de condução

## Missão
- [ ] E distante de resíduos não concede pontos
- [ ] E próximo recolhe apenas um resíduo
- [ ] A missão conclui somente ao chegar a 5/5
- [ ] A recompensa de 80 CIT simulados é concedida uma única vez
- [ ] Rio e vegetação mudam após a conclusão

## Interface e desempenho
- [ ] Minimapa acompanha o personagem
- [ ] Tecla M abre e fecha o mapa ampliado
- [ ] Botão de mapa abre e fecha o mapa ampliado
- [ ] ESC fecha o mapa ampliado antes de pausar
- [ ] O jogo fica congelado enquanto o mapa ampliado está aberto
- [ ] ESC pausa e retoma
- [ ] Redimensionar janela mantém a cena visível
- [ ] Teste em PC modesto com registro de FPS e memória
- [ ] Teste em Chrome e Edge

> Não marcar como aprovado até executar o teste no navegador e registrar o resultado.
