# GREEN CITY — First Impact (Web MVP)

Primeira fatia jogável do GREEN CITY: distrito urbano 3D, personagem em terceira pessoa, câmera orbital, movimentação, corrida, pulo, colisões, primeiro veículo elétrico dirigível, coleta de resíduos, missão ambiental e CIT simulado.

## Requisitos
- Windows 10/11 64-bit
- Node.js 22.12 ou superior (LTS recomendado)
- npm 10+
- Navegador moderno com WebGL 2 (Chrome ou Edge)

## Instalação no Windows
1. Instale Node.js LTS pelo site oficial: https://nodejs.org/
2. Extraia o ZIP em uma pasta simples, por exemplo `C:\Projetos\GREEN_CITY`.
3. Abra essa pasta no Explorador de Arquivos.
4. Clique na barra de endereço, digite `cmd` e pressione Enter.
5. Execute `npm install` e aguarde terminar.
6. Execute `npm run dev`.
7. Abra o endereço local informado no terminal (normalmente `http://localhost:5173`).

## Verificação
```bash
npm run typecheck
npm run build
npm run preview
```

## Controles atuais
- WASD: mover personagem ou dirigir
- Mouse arrastando: girar câmera
- Shift: correr a pé
- Espaço: pular
- E: recolher resíduo (a pé)
- F: entrar/sair do primeiro veículo
- M: abrir/fechar o mapa ampliado
- ESC: fechar o mapa ou pausar/retomar

## Escopo presente no código
- Cena 3D procedural de distrito urbano pequeno.
- Personagem em terceira pessoa com movimentação e pulo.
- Câmera orbital.
- Colisões básicas do cenário.
- Primeiro veículo elétrico com aceleração, frenagem, ré e direção simplificadas.
- Entrada e saída do veículo pela tecla F.
- Cinco objetos de resíduo interativos.
- Missão Operação Rio Limpo e HUD.
- Minimapa esquemático local e mapa ampliado pela tecla M ou pelo botão MAPA.
- 80 CIT simulados ao concluir a missão; sem carteira, blockchain ou valor financeiro.
- Mudança visual do rio e vegetação ao concluir a missão.

## Ainda não implementado
Veículos com física realista, animações e modelos finais, NPCs com IA, lojas, mapa geográfico completo, salvamento persistente, backend, GREEN CITY Scanner, validação ambiental real, token transferível, multiplayer e os cinco distritos completos.

## Arquitetura
- `src/game`: mundo, simulação e regras de gameplay; sem dependência da UI React.
- `src/ui`: interface React que observa snapshots do jogo.
- `src/styles`: apresentação.
- `docs`: arquitetura, plano e checklist.
- Supabase será conectado quando existir necessidade concreta de conta, persistência remota ou validação.

## Segurança e economia
O CIT desta versão é somente uma pontuação local fictícia. Não é criptoativo, não pode ser comprado, sacado ou transferido. Nenhuma foto ou localização é coletada.
