import { useEffect, useRef, useState } from 'react';
import type { GreenCityGame } from '../game/Game';
import { CITY_NEIGHBORHOODS } from '../game/neighborhoods';
import type { GameSnapshot } from '../game/types';

const initial: GameSnapshot = {
  cit: 0,
  collected: 0,
  total: 5,
  delivered: false,
  solarInstalled: false,
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
  playerX: 0,
  playerZ: 25,
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

  useEffect(() => {
    let cancelled = false;
    let game: GreenCityGame | null = null;
    const canvas = canvasRef.current;
    if (!canvas) return;

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
  }, []);

  const missionProgress = state.missionStage === 'complete'
    ? 100
    : state.missionStage === 'improve'
      ? 50 + (state.solarInstalled ? 25 : 0) + (state.electricVehicle ? 25 : 0)
      : state.missionStage === 'deliver'
        ? 40
        : (state.collected / state.total) * 40;

  const mission = {
    collect: {
      eyebrow: 'FASE 01 · DIAGNÓSTICO E COLETA',
      title: 'Comece a recuperar o bairro',
      description: 'Recolha os resíduos espalhados. Depois, leve a carga ao EcoCentro para triagem e reciclagem.',
      progress: `${state.collected}/${state.total} resíduos`,
    },
    deliver: {
      eyebrow: 'FASE 01 · GESTÃO DE RESÍDUOS',
      title: 'Leve a carga ao EcoCentro',
      description: 'Os resíduos não desaparecem: transporte-os até o EcoCentro da praça para encaminhamento à triagem.',
      progress: 'Coleta concluída · entrega pendente',
    },
    improve: {
      eyebrow: 'FASE 01 · PLANEJAMENTO URBANO',
      title: 'Invista em soluções sustentáveis',
      description: 'Use o Plano Urbano para instalar energia solar e converter o veículo municipal. As melhorias alteram os indicadores.',
      progress: `${Math.round(missionProgress)}% do plano`,
    },
    complete: {
      eyebrow: 'FASE 01 · BAIRRO RECUPERADO',
      title: 'Centro Industrial transformado',
      description: 'As metas desta região foram atingidas. O Porto está liberado no mapa como próximo destino da expansão.',
      progress: 'Fase concluída',
    },
  }[state.missionStage];

  return <main className="game-shell">
    <canvas ref={canvasRef} className="game-canvas" tabIndex={0} aria-label="Mundo 3D jogável de GREEN CITY" />

    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">G</span>
        <div><strong>GREEN CITY</strong><small>CIDADE SUSTENTÁVEL · FASE 01/05</small></div>
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
      {state.missionStage === 'complete' && <div className="success-line">✓ METAS AMBIENTAIS ATINGIDAS · PORTO LIBERADO</div>}
    </section>

    {!gameReady && !gameError && <div className="loading-overlay"><div className="loading-box"><span className="loading-spinner" /> Preparando o mundo de GREEN CITY…</div></div>}
    {gameError && <div className="error-overlay"><div className="welcome-panel"><div className="eyebrow">ERRO AO CARREGAR O MUNDO 3D</div><h2>Não foi possível iniciar a cidade.</h2><p>{gameError}</p><small>Atualize a página. Se o problema continuar, envie esta mensagem para a equipe técnica.</small></div></div>}

    <div className="status-message">{state.message}</div>
    <div className="vehicle-status">{state.inVehicle ? `${state.electricVehicle ? 'ELÉTRICO' : 'DIESEL'} · ${state.vehicleSpeed} KM/H` : state.electricVehicle ? 'VEÍCULO MUNICIPAL ELÉTRICO' : 'VEÍCULO MUNICIPAL A DIESEL'}</div>

    <div className="minimap" aria-label="Minimapa do bairro">
      <div className="map-road map-road-v" />
      <div className="map-road map-road-h" />
      <div className="map-river" />
      <span className="map-player" style={{ left: `${Math.max(8, Math.min(92, 50 + state.playerX * 0.75))}%`, top: `${Math.max(8, Math.min(92, 50 + state.playerZ * 0.75))}%` }} />
    </div>

    <button className="plan-button" onClick={() => setShowPlan(true)}>PLANO URBANO</button>
    <button className="map-button" onClick={() => gameRef.current?.setMapOpen(!state.mapOpen)}>M · MAPA DA CIDADE</button>
    <div className="bottom-left"><span className="dot" /> SINGLE PLAYER · PROTÓTIPO WEB</div>

    <div className="controls">
      <span><b>WASD</b> mover/dirigir</span>
      <span><b>SHIFT</b> correr</span>
      <span><b>ESPAÇO</b> pular</span>
      <span><b>E</b> recolher/entregar</span>
      <span><b>F</b> entrar/sair</span>
      <span><b>M</b> mapa</span>
      <span><b>MOUSE</b> câmera</span>
      <span><b>ESC</b> pausa</span>
    </div>

    {showHelp && <div className="welcome-overlay">
      <div className="welcome-panel">
        <div className="eyebrow">PLANT IN REAL LIFE. RULE THE GREEN CITY.</div>
        <h2>Uma cidade. Muitos bairros. Uma transformação.</h2>
        <p>O Centro Industrial é a primeira fase. Recolha os resíduos, entregue-os no EcoCentro e invista em energia solar e mobilidade elétrica. Cada solução muda os indicadores da cidade.</p>
        <button onClick={() => setShowHelp(false)}>COMEÇAR A RECUPERAÇÃO <span>→</span></button>
        <small>WASD movimenta. E interage. M abre o mapa com os cinco bairros da cidade.</small>
      </div>
    </div>}

    {state.mapOpen && <div className="world-map-overlay">
      <section className="world-map-panel city-map-panel">
        <button className="world-map-close" onClick={() => gameRef.current?.setMapOpen(false)}>FECHAR · M</button>
        <div className="eyebrow">GREEN CITY · MAPA GERAL</div>
        <h2>Uma cidade dividida em cinco regiões</h2>
        <p>Recupere uma região por vez. Cada bairro traz novos problemas e sistemas urbanos para transformar.</p>
        <div className="city-map-grid">
          {CITY_NEIGHBORHOODS.map((neighborhood, index) => {
            const current = index === 0;
            const available = index === 1 && state.nextNeighborhoodUnlocked;
            const completed = current && state.missionStage === 'complete';
            const status = completed ? 'RECUPERADO' : current ? 'FASE ATIVA' : available ? 'LIBERADO' : 'BLOQUEADO';
            return <article className={`district-card ${current ? 'district-current' : ''} ${available ? 'district-available' : ''} ${index > 1 || (index === 1 && !available) ? 'district-locked' : ''}`} key={neighborhood.id}>
              <div className="district-card-top"><span>FASE 0{index + 1}</span><b>{status}</b></div>
              <h3>{neighborhood.name}</h3>
              <div className="district-theme">{neighborhood.theme}</div>
              <p>{neighborhood.challenge}</p>
              <small>{current ? completed ? 'Concluído nesta versão' : 'Você está aqui' : available ? 'Próxima região liberada · expansão 3D em desenvolvimento' : neighborhood.unlockLabel}</small>
            </article>;
          })}
        </div>
        <div className="city-map-footer">
          <span><i className="legend-dot active" /> Fase atual</span>
          <span><i className="legend-dot available" /> Liberado</span>
          <span><i className="legend-dot locked" /> Bloqueado</span>
        </div>
        <p className="map-disclaimer">O mapa apresenta a progressão planejada. Nesta versão, somente o Centro Industrial possui área 3D jogável; as próximas regiões serão construídas como novas fases.</p>
      </section>
    </div>}

    {showPlan && <div className="world-map-overlay">
      <section className="world-map-panel plan-panel">
        <button className="world-map-close" onClick={() => setShowPlan(false)}>FECHAR</button>
        <div className="eyebrow">CENTRO INDUSTRIAL · GESTÃO DA CIDADE</div>
        <h2>Plano de recuperação do bairro</h2>
        <p>As decisões consomem o orçamento local e alteram os indicadores. Nenhuma tecnologia é tratada como solução isolada.</p>
        <div className="metrics-grid">
          <Metric label="Reciclagem e destinação adequada" value={state.recyclingRate} />
          <Metric label="Participação de energia renovável" value={state.renewableShare} />
          <Metric label="Mobilidade sustentável" value={state.sustainableMobility} />
          <Metric label="Qualidade do ar" value={state.airQuality} />
        </div>
        <div className="upgrade-grid">
          <article className="upgrade-card">
            <div className="eyebrow">ENERGIA LIMPA</div>
            <h3>{state.solarInstalled ? 'Energia solar instalada' : 'Instalar energia solar'}</h3>
            <p>Instala painéis no EcoCentro e um ponto de recarga local. A energia renovável passa a apoiar a eletrificação.</p>
            <button disabled={state.solarInstalled || !state.delivered || state.cit < 35} onClick={() => gameRef.current?.installSolarEnergy()}>
              {state.solarInstalled ? 'INSTALADO' : 'INSTALAR · 35 CIT'}
            </button>
          </article>
          <article className="upgrade-card">
            <div className="eyebrow">MOBILIDADE SUSTENTÁVEL</div>
            <h3>{state.electricVehicle ? 'Veículo municipal elétrico' : 'Eletrificar veículo municipal'}</h3>
            <p>Substitui o veículo a diesel por um elétrico. Esta etapa exige energia solar e estrutura de recarga no bairro.</p>
            <button disabled={state.electricVehicle || !state.solarInstalled || state.cit < 45} onClick={() => gameRef.current?.electrifyMunicipalVehicle()}>
              {state.electricVehicle ? 'CONCLUÍDO' : 'CONVERTER · 45 CIT'}
            </button>
          </article>
        </div>
        {!state.delivered && <div className="plan-hint">Primeiro: recolha os cinco resíduos e entregue a carga no EcoCentro, na praça.</div>}
        {state.delivered && !state.solarInstalled && <div className="plan-hint">Orçamento disponível: {state.cit} CIT. A energia solar é a primeira etapa para apoiar a recarga elétrica.</div>}
        {state.solarInstalled && !state.electricVehicle && <div className="plan-hint">Energia solar instalada. Agora você pode eletrificar o veículo municipal.</div>}
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
