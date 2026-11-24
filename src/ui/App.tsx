import { useEffect, useRef, useState } from 'react';
import type { GreenCityGame } from '../game/Game';
import { CITY_NEIGHBORHOODS } from '../game/neighborhoods';
import type { GameSnapshot } from '../game/types';

const initial: GameSnapshot = {
  phase: 1,
  completedNeighborhoods: 0,
  thirdNeighborhoodUnlocked: false,
  portMissionStage: 'inspect',
  outfallsInspected: 0,
  outfallsTotal: 3,
  treatmentInstalled: false,
  septicInstalled: 0,
  septicTotal: 2,
  companyWasteCollected: 0,
  companyWasteTotal: 3,
  waterQuality: 24,
  cit: 0,
  collected: 0,
  total: 5,
  delivered: false,
  solarBuildingsInstalled: 0,
  solarBuildingsTotal: 8,
  electricVehicle: false,
  recyclingRate: 18,
  renewableShare: 5,
  sustainableMobility: 8,
  airQuality: 38,
  missionStage: 'collect',
  nextNeighborhoodUnlocked: false,
  paused: false,
  mapOpen: false,
  inVehicle: false,
  vehicleSpeed: 0,
  nearbyAction: null,
  nearbyLabel: '',
  playerX: 8.5,
  playerZ: 23.5,
  vehicleX: 5.1,
  vehicleZ: 23.5,
  message: 'Investigue o bairro e recolha os resíduos espalhados.',
};

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric-row">
    <div className="metric-copy"><span>{label}</span><strong>{value}%</strong></div>
    <div className="metric-track"><span style={{ width: `${value}%` }} /></div>
  </div>;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GreenCityGame | null>(null);
  const [state, setState] = useState(initial);
  const [showHelp, setShowHelp] = useState(true);
  const [showPlan, setShowPlan] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [playRequested, setPlayRequested] = useState(false);
  const [phaseCompleteSeen, setPhaseCompleteSeen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let game: GreenCityGame | null = null;
    const canvas = canvasRef.current;
    if (!canvas || !playRequested) return;

    void import('../game/Game')
      .then(({ GreenCityGame: Game }) => {
        if (cancelled) return;
        game = new Game(canvas, setState);
        gameRef.current = game;
        setGameReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const detail = error instanceof Error ? error.message : 'Falha desconhecida';
        setGameError(detail);
      });

    return () => {
      cancelled = true;
      game?.dispose();
      gameRef.current = null;
    };
  }, [playRequested]);

  const missionProgress = state.phase === 1
    ? state.missionStage === 'complete'
      ? 100
      : state.missionStage === 'collect'
        ? Math.round((state.collected / state.total) * 30)
        : state.missionStage === 'deliver'
          ? 35
          : Math.min(99, 35 + Math.round((state.solarBuildingsInstalled / state.solarBuildingsTotal) * 50) + (state.electricVehicle ? 15 : 0))
    : state.portMissionStage === 'complete'
      ? 100
      : state.portMissionStage === 'inspect'
        ? Math.round((state.outfallsInspected / state.outfallsTotal) * 25)
        : state.portMissionStage === 'treatment'
          ? 35
          : state.portMissionStage === 'septic'
            ? 40 + Math.round((state.septicInstalled / state.septicTotal) * 25)
            : 70 + Math.round((state.companyWasteCollected / state.companyWasteTotal) * 30);

  const phaseOneMission = {
    collect: { eyebrow: 'FASE 01 · DIAGNÓSTICO E COLETA', title: 'Comece a recuperar o bairro', description: 'Recolha os resíduos espalhados. Depois, leve a carga ao EcoCentro para encaminhamento correto.', progress: `${state.collected}/${state.total} resíduos` },
    deliver: { eyebrow: 'FASE 01 · GESTÃO DE RESÍDUOS', title: 'Leve a carga ao EcoCentro', description: 'Vá até a praça, identifique as cinco categorias pelas cores e símbolos e entregue os resíduos no ponto de triagem.', progress: 'Coleta concluída · entrega pendente' },
    solar: { eyebrow: 'FASE 01 · MISSÃO DE ENERGIA SOLAR', title: 'Solarize os prédios', description: `Aproxime-se da fachada de cada prédio ainda sem painéis e pressione E para instalar. ${state.solarBuildingsInstalled}/${state.solarBuildingsTotal} edifícios modernizados.`, progress: `${state.solarBuildingsInstalled}/${state.solarBuildingsTotal} prédios` },
    vehicle: { eyebrow: 'FASE 01 · MISSÃO DE MOBILIDADE', title: 'Dirija até a base de eletrificação', description: 'Entre no carro com F, siga pela via de serviço até a base marcada no minimapa, pare completamente na vaga, desça com F e pressione E ao lado do veículo.', progress: 'Base ativa · conversão pendente' },
    complete: { eyebrow: 'FASE 01 · BAIRRO RECUPERADO', title: 'Centro Industrial transformado', description: 'Os oito prédios receberam energia solar e o veículo municipal foi convertido na base. O Porto está liberado no mapa.', progress: 'Fase concluída' },
  }[state.missionStage];

  const portMission = {
    inspect: { eyebrow: 'FASE 02 · DIAGNÓSTICO DA ÁGUA', title: 'Investigue os despejos no rio', description: 'Encontre os três pontos de descarga próximos ao rio e pressione E para registrar uma amostra de cada um.', progress: `${state.outfallsInspected}/${state.outfallsTotal} pontos inspecionados` },
    treatment: { eyebrow: 'FASE 02 · TRATAMENTO DE EFLUENTES', title: 'Construa a estação de tratamento', description: 'Vá até a área sinalizada entre o pátio e o rio e pressione E para instalar a ETE. A estação tratará os efluentes industriais antes da descarga.', progress: 'Diagnóstico concluído · ETE pendente' },
    septic: { eyebrow: 'FASE 02 · SANEAMENTO LOCAL', title: 'Instale as fossas sépticas', description: `Instale sistemas sépticos nas duas instalações sanitárias isoladas do porto. ${state.septicInstalled}/${state.septicTotal} concluídas.`, progress: `${state.septicInstalled}/${state.septicTotal} fossas instaladas` },
    collect: { eyebrow: 'FASE 02 · COLETA NAS EMPRESAS', title: 'Use o caminhão de coleta', description: 'Entre no caminhão amarelo com F. Dirija até as áreas de resíduos das três empresas, pare perto de cada carga e pressione E para recolher.', progress: `${state.companyWasteCollected}/${state.companyWasteTotal} empresas atendidas` },
    complete: { eyebrow: 'FASE 02 · PORTO RECUPERADO', title: 'A água e a logística estão melhores', description: 'A ETE está operando, as duas instalações sanitárias receberam fossas sépticas e os resíduos das três empresas foram coletados. A próxima região foi liberada.', progress: 'Fase concluída' },
  }[state.portMissionStage];

  const mission = state.phase === 1 ? phaseOneMission : portMission;


  return <main className="game-shell">
    <canvas ref={canvasRef} className="game-canvas" tabIndex={0} aria-label="Mundo 3D jogável de GREEN CITY" />

    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">G</span>
        <div><strong>GREEN CITY</strong><small>CIDADE SUSTENTÁVEL · FASE 0{state.phase}/10</small></div>
      </div>
      <div className="wallet"><span>CIT SIMULADOS</span><strong>◆ {state.cit.toString().padStart(3, '0')}</strong></div>
    </header>

    <section className="mission-card">
      <div className="eyebrow">{mission.eyebrow}</div>
      <h1>{mission.title}</h1>
      <p>{mission.description}</p>
      <div className="progress-row">
        <div className="progress-track"><span style={{ width: `${missionProgress}%` }} /></div>
        <b>{mission.progress}</b>
      </div>
      {state.phase === 1 && state.missionStage === 'complete' && <div className="success-line">✓ METAS AMBIENTAIS ATINGIDAS · PORTO LIBERADO</div>}
      {state.phase === 2 && state.portMissionStage === 'complete' && <div className="success-line">✓ PORTO RECUPERADO · REGIÃO 03 LIBERADA</div>}
    </section>

    {!gameReady && !gameError && <div className="loading-overlay"><div className="loading-box"><span className="loading-spinner" /> Preparando o mundo de GREEN CITY…</div></div>}
    {gameError && <div className="error-overlay"><div className="welcome-panel"><div className="eyebrow">ERRO AO CARREGAR O MUNDO 3D</div><h2>Não foi possível iniciar a cidade.</h2><p>{gameError}</p><small>Atualize a página. Se o problema continuar, envie esta mensagem para a equipe técnica.</small></div></div>}

    <div className="status-message">{state.message}</div>
    {gameReady && state.nearbyAction && <button
      className="interaction-prompt"
      onClick={() => gameRef.current?.performNearbyAction()}
      aria-label={state.nearbyLabel}
    >{state.nearbyLabel}<span>TOCAR / CLICAR</span></button>}
    <div className="vehicle-status">{state.phase === 2
      ? state.inVehicle ? `CAMINHÃO DE COLETA · ${state.vehicleSpeed} KM/H` : 'CAMINHÃO DE COLETA · F PARA ENTRAR'
      : state.inVehicle ? `${state.electricVehicle ? 'ELÉTRICO' : 'DIESEL'} · ${state.vehicleSpeed} KM/H` : state.electricVehicle ? 'VEÍCULO MUNICIPAL ELÉTRICO' : 'VEÍCULO MUNICIPAL A DIESEL'}</div>

    <div className="minimap" aria-label="Minimapa do bairro">
      <div className="map-road map-road-v" />
      <div className="map-road map-road-h" />
      <div className="map-river" />
      <span className="map-ecocenter" title="EcoCentro · entrega e triagem" />
      <span className={state.electricVehicle ? "map-vehicle map-vehicle-electric" : "map-vehicle"}
        style={{ left: `${Math.max(8, Math.min(92, 50 + state.vehicleX * 0.75))}%`, top: `${Math.max(8, Math.min(92, 50 + state.vehicleZ * 0.75))}%` }}
        title="Veículo municipal · posição atual" />
      <span className="map-base" title="Base de eletrificação · destino da missão" />
      <span className="map-player" style={{ left: `${Math.max(8, Math.min(92, 50 + state.playerX * 0.75))}%`, top: `${Math.max(8, Math.min(92, 50 + state.playerZ * 0.75))}%` }} />
    </div>

    <button className="plan-button" onClick={() => setShowPlan(true)}>PLANO URBANO</button>
    <button className="map-button" onClick={() => gameRef.current?.setMapOpen(!state.mapOpen)}>M · MAPA DA CIDADE</button>
    <div className="bottom-left"><span className="dot" /> SINGLE PLAYER · PROTÓTIPO WEB</div>

    <div className="controls">
      <span><b>WASD</b> mover/dirigir</span>
      <span><b>SHIFT</b> correr</span>
      <span><b>ESPAÇO</b> pular</span>
      <span><b>E</b> interagir/instalar</span>
      <span><b>F</b> entrar/sair</span>
      <span><b>M</b> mapa</span>
      <span><b>MOUSE</b> câmera</span>
      <span><b>ESC</b> pausa</span>
    </div>

    {showHelp && <div className="welcome-overlay">
      <div className="welcome-panel welcome-hero">
        <div className="welcome-topline">
          <div className="welcome-logo"><span>G</span><div><b>GREEN CITY</b><small>JOGO DE TRANSFORMAÇÃO AMBIENTAL</small></div></div>
          <span className="phase-pill">FASE 01 DE 10 · CENTRO INDUSTRIAL</span>
        </div>
        <div className="welcome-scene" aria-label="Ilustração de uma cidade verde com árvores, edifícios e energia limpa">
          <span className="scene-sun" />
          <span className="scene-cloud scene-cloud-a" />
          <span className="scene-cloud scene-cloud-b" />
          <span className="scene-hill scene-hill-back" />
          <span className="scene-hill scene-hill-front" />
          <div className="scene-city">
            <span className="scene-building building-a"><i /><i /><i /></span>
            <span className="scene-building building-b"><i /><i /><i /><i /></span>
            <span className="scene-building building-c"><i /><i /></span>
            <span className="scene-tree tree-a" /><span className="scene-tree tree-b" /><span className="scene-tree tree-c" />
            <span className="scene-solar-roof" />
            <span className="scene-road" />
          </div>
          <span className="scene-caption">RECUPERE. CONECTE. TRANSFORME.</span>
        </div>
        <div className="welcome-copy">
          <div className="eyebrow">SUA MISSÃO COMEÇA AQUI</div>
          <h2>Uma cidade inteira precisa de você.</h2>
          <p>Explore o bairro, entenda os problemas e transforme a cidade com decisões que fazem diferença no mundo real.</p>
        </div>
        <div className="welcome-objectives">
          <div className="objective-tile objective-explore"><span>01</span><b>EXPLORAR</b><small>Encontre os desafios ambientais</small></div>
          <div className="objective-tile objective-recycle"><span>02</span><b>RECUPERAR</b><small>Organize resíduos e infraestrutura</small></div>
          <div className="objective-tile objective-energy"><span>03</span><b>MODERNIZAR</b><small>Use energia limpa e mobilidade elétrica</small></div>
        </div>
        <button className="start-game-button" onClick={() => { setShowHelp(false); setPlayRequested(true); }}>JOGAR FASE 01 <span>▶</span></button>
        <div className="welcome-foot"><span>WASD · MOVIMENTAR</span><span>E · INTERAGIR</span><span>M · MAPA DA CIDADE</span><span>SEM INSTALAÇÃO · JOGA NO NAVEGADOR</span></div>
      </div>
    </div>}

    {state.mapOpen && <div className="world-map-overlay">
      <section className="world-map-panel city-map-panel">
        <button className="world-map-close" onClick={() => gameRef.current?.setMapOpen(false)}>FECHAR · M</button>
        <div className="eyebrow">GREEN CITY · MAPA GERAL</div>
        <h2>Uma cidade, dez regiões para recuperar</h2>
        <p>O mapa fictício mostra a campanha inteira. As regiões concluídas ficam verdes, a próxima região liberada pode ser acessada e as demais permanecem bloqueadas.</p>
        <div className="city-map-board">
          <div className="city-map-river" />
          <div className="city-map-road city-map-road-one" />
          <div className="city-map-road city-map-road-two" />
          <div className="city-map-grid">
            {CITY_NEIGHBORHOODS.map((neighborhood, index) => {
              const completed = index < state.completedNeighborhoods;
              const current = !completed && index === state.phase - 1;
              const available = !completed && !current && index === state.completedNeighborhoods;
              const canEnterPort = available && index === 1 && state.phase === 1;
              const status = completed ? 'RECUPERADO' : current ? 'FASE ATIVA' : available ? 'LIBERADO' : 'BLOQUEADO';
              return <button type="button"
                className={`district-card ${completed ? 'district-complete' : ''} ${current ? 'district-current' : ''} ${available ? 'district-available' : ''} ${!completed && !current && !available ? 'district-locked' : ''}`}
                key={neighborhood.id} disabled={!canEnterPort}
                onClick={() => { if (canEnterPort) gameRef.current?.enterPortPhase(); }}>
                <div className="district-card-top"><span>FASE {String(index + 1).padStart(2, '0')}</span><b>{status}</b></div>
                <div className="district-map-icon">{completed ? '✓' : available ? '🔓' : neighborhood.icon}</div>
                <h3>{neighborhood.name}</h3>
                <div className="district-theme">{neighborhood.theme}</div>
                <p>{neighborhood.challenge}</p>
                <small>{completed ? 'Região concluída e marcada no mapa' : current ? 'Você está nesta região' : canEnterPort ? 'Clique para entrar na Fase 02' : available ? 'Próxima região liberada · expansão seguinte' : neighborhood.unlockLabel}</small>
              </button>;
            })}
          </div>
        </div>
        <div className="city-map-footer">
          <span><i className="legend-dot active" /> Fase atual</span>
          <span><i className="legend-dot available" /> Liberado</span>
          <span><i className="legend-dot locked" /> Bloqueado</span>
        </div>
        <p className="map-disclaimer">O mapa é uma representação fictícia da cidade. Nesta versão, o Centro Industrial e o Porto possuem cenários 3D; as outras oito regiões permanecem bloqueadas enquanto são desenvolvidas.</p>
      </section>
    </div>}

    {state.phase === 1 && state.missionStage === 'complete' && !phaseCompleteSeen && <div className="phase-complete-overlay">
      <section className="phase-complete-panel">
        <div className="completion-medal">✓</div>
        <div className="eyebrow">MISSÃO CONCLUÍDA · FASE 01 DE 10</div>
        <h2>Centro Industrial recuperado!</h2>
        <p>Você organizou os resíduos, modernizou os oito prédios com energia solar e converteu o veículo municipal. O Porto está liberado no mapa.</p>
        <div className="completion-stats"><span>8 prédios solares</span><span>1 veículo elétrico</span><span>Região 02 liberada</span></div>
        <button className="start-game-button" onClick={() => { setPhaseCompleteSeen(true); gameRef.current?.enterPortPhase(); }}>AVANÇAR PARA A FASE 02 <span>→</span></button>
        <button className="completion-map-button" onClick={() => { setPhaseCompleteSeen(true); gameRef.current?.setMapOpen(true); }}>VER MAPA DAS 10 REGIÕES</button>
      </section>
    </div>}

    {showPlan && <div className="world-map-overlay">
      <section className="world-map-panel plan-panel">
        <button className="world-map-close" onClick={() => setShowPlan(false)}>FECHAR</button>
        <div className="eyebrow">CENTRO INDUSTRIAL · GESTÃO DA CIDADE</div>
        <h2>{state.phase === 1 ? 'Missões de recuperação do bairro' : 'Missões de recuperação do Porto'}</h2>
        <p>Este painel acompanha os indicadores e objetivos da região atual. As obras e coletas acontecem no cenário, por aproximação e interação do personagem.</p>
        {state.phase === 1 ? <>
          <div className="metrics-grid">
            <Metric label="Reciclagem e destinação adequada" value={state.recyclingRate} />
            <Metric label="Participação de energia renovável" value={state.renewableShare} />
            <Metric label="Mobilidade sustentável" value={state.sustainableMobility} />
            <Metric label="Qualidade do ar" value={state.airQuality} />
          </div>
          <div className="upgrade-grid">
            <article className="upgrade-card"><div className="eyebrow">ENERGIA SOLAR NOS EDIFÍCIOS</div><h3>{state.solarBuildingsInstalled}/{state.solarBuildingsTotal} prédios solarizados</h3><p>Aproxime-se de cada fachada sem painéis e pressione E. Cada instalação custa 10 CIT, coloca painéis no telhado e atualiza os indicadores de energia renovável.</p></article>
            <article className="upgrade-card"><div className="eyebrow">CONVERSÃO DO VEÍCULO</div><h3>{state.electricVehicle ? 'Veículo 100% elétrico' : state.solarBuildingsInstalled >= 3 ? 'Base de eletrificação ativa' : 'Aguardando três prédios solares'}</h3><p>{state.electricVehicle ? 'O carro foi convertido dentro do jogo, estacionado na vaga e com o personagem fora do veículo.' : 'Depois de solarizar três prédios, dirija até a base, estacione, desça e pressione E ao lado do carro. A conversão custa 20 CIT.'}</p></article>
          </div>
        </> : <>
          <div className="metrics-grid">
            <Metric label="Qualidade da água (simulada)" value={state.waterQuality} />
            <Metric label="Pontos de despejo inspecionados" value={Math.round(state.outfallsInspected / state.outfallsTotal * 100)} />
            <Metric label="Tratamento de efluentes" value={state.treatmentInstalled ? 100 : 0} />
            <Metric label="Coleta nas empresas" value={Math.round(state.companyWasteCollected / state.companyWasteTotal * 100)} />
          </div>
          <div className="upgrade-grid">
            <article className="upgrade-card"><div className="eyebrow">ESTAÇÃO DE TRATAMENTO · ETE</div><h3>{state.treatmentInstalled ? 'ETE implantada' : 'Aguardando diagnóstico'}</h3><p>Os efluentes industriais são conduzidos à estação, onde passam por etapas de tratamento antes da saída para o rio. A água do cenário muda após a implantação.</p></article>
            <article className="upgrade-card"><div className="eyebrow">SANEAMENTO LOCAL</div><h3>{state.septicInstalled}/{state.septicTotal} fossas sépticas instaladas</h3><p>As fossas atendem instalações sanitárias isoladas. Elas não substituem o tratamento específico dos efluentes industriais realizado pela ETE.</p></article>
            <article className="upgrade-card"><div className="eyebrow">LOGÍSTICA DE RESÍDUOS</div><h3>{state.companyWasteCollected}/{state.companyWasteTotal} empresas atendidas</h3><p>Use o caminhão amarelo, pare junto aos pontos sinalizados e pressione E para carregar os resíduos de cada empresa.</p></article>
          </div>
        </>}
        {state.phase === 1 && !state.delivered && <div className="plan-hint">Primeiro: recolha os cinco resíduos e entregue a carga no EcoCentro.</div>}
        {state.delivered && state.solarBuildingsInstalled < 3 && <div className="plan-hint">Missão atual: instale energia solar em três prédios. A base do veículo será ativada automaticamente depois da terceira instalação.</div>}
        {state.delivered && state.solarBuildingsInstalled >= 3 && !state.electricVehicle && <div className="plan-hint">A base está ativa. Siga o marcador amarelo no minimapa, estacione completamente, desça e converta o veículo ao lado da vaga.</div>}
        {state.electricVehicle && state.solarBuildingsInstalled < state.solarBuildingsTotal && <div className="plan-hint">O veículo já é elétrico. Continue solarizando os prédios restantes para concluir a fase.</div>}
                {state.nextNeighborhoodUnlocked && <div className="success-line">✓ METAS DO BAIRRO ATINGIDAS · PRÓXIMA REGIÃO LIBERADA</div>}
        <small className="economy-note">CIT é uma pontuação fictícia do protótipo, sem valor monetário ou possibilidade de saque.</small>
      </section>
    </div>}

    {state.paused && <div className="pause-overlay">
      <div className="welcome-panel">
        <div className="eyebrow">PAUSA</div><h2>A cidade espera.</h2>
        <button onClick={() => gameRef.current?.setPaused(false)}>CONTINUAR <span>→</span></button>
      </div>
    </div>}
    <button className="help-button" onClick={() => setShowHelp(!showHelp)} aria-label="Ajuda">?</button>
  </main>;
}
