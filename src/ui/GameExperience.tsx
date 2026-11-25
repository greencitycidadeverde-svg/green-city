import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { GreenCityGame } from '../game/Game';
import { CITY_NEIGHBORHOODS } from '../game/neighborhoods';
import type { GameProgressData, GameSnapshot } from '../game/types';
import { supabase } from '../lib/supabase';

const DEVELOPER_PHASE_STORAGE_KEY = 'green-city-developer-phase-checklist-v1';

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
  cooperativeSorted: 0,
  cooperativeTotal: 5,
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
  mapObjectives: [],
  nextObjectiveLabel: 'Aguardando objetivos',
  inVehicle: false,
  vehicleSpeed: 0,
  nearbyAction: null,
  nearbyLabel: '',
  playerX: 8.5,
  playerZ: 23.5,
  vehicleX: 5.1,
  vehicleZ: 23.5,
  message: 'Investigue o bairro e recolha os resíduos espalhados.',
  progressData: {
    phase: 1, cit: 0, collectedWaste: [], deliveredWaste: false, solarBuildings: [],
    electricVehicle: false, missionStage: 'collect', outfallsInspected: [], treatmentInstalled: false,
    septicInstalled: [], companyWasteCollected: [], cooperativeSorted: [],
    portMissionStage: 'inspect', portWaterQuality: 24,
  },
};

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric-row">
    <div className="metric-copy"><span>{label}</span><strong>{value}%</strong></div>
    <div className="metric-track"><span style={{ width: `${value}%` }} /></div>
  </div>;
}

interface GameExperienceProps {
  userId: string;
  campaignId: string;
  initialPhase: 1 | 2;
  savedProgress: Partial<GameProgressData>;
  isAdmin: boolean;
  onExitToCampaign: () => void;
}

export default function GameExperience({ userId, campaignId, initialPhase, savedProgress, isAdmin, onExitToCampaign }: GameExperienceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GreenCityGame | null>(null);
  const [state, setState] = useState(initial);
  const developerMode = isAdmin && new URLSearchParams(window.location.search).get('modo') === 'desenvolvimento';
  const [startingPhase, setStartingPhase] = useState<1 | 2>(initialPhase);
  const [completedPhaseMarks, setCompletedPhaseMarks] = useState<number[]>(() => {
    try {
      const stored = window.localStorage.getItem(DEVELOPER_PHASE_STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed)
        ? [...new Set(parsed.filter((value): value is number => Number.isInteger(value) && value >= 1 && value <= 10))].sort((a, b) => a - b)
        : [];
    } catch {
      return [];
    }
  });
  const [showHelp, setShowHelp] = useState(false);
  const [joystick, setJoystick] = useState({ x: 0, y: 0 });
  const joystickPointerRef = useRef<number | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [mapTab, setMapTab] = useState<'objectives' | 'city'>('objectives');
  const [gameReady, setGameReady] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [playRequested, setPlayRequested] = useState(true);
  const [phaseCompleteSeen, setPhaseCompleteSeen] = useState(false);
  const [portCompleteSeen, setPortCompleteSeen] = useState(false);
  const [phaseCompleteOpen, setPhaseCompleteOpen] = useState(false);
  const phaseCompleteTriggeredRef = useRef(false);

  const setDeveloperPhaseMark = (phase: number, completed: boolean) => {
    setCompletedPhaseMarks((current) => {
      const next = (completed
        ? [...new Set([...current, phase])]
        : current.filter((item) => item !== phase)
      ).sort((a, b) => a - b);
      try {
        window.localStorage.setItem(DEVELOPER_PHASE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // O checklist continua funcionando em memória se o navegador bloquear o armazenamento local.
      }
      return next;
    });
  };

  const startGameAtPhase = (phase: 1 | 2) => {
    setStartingPhase(phase);
    setGameReady(false);
    setGameError(null);
    setShowHelp(false);
    setPlayRequested(true);
  };

  const reopenDeveloperPanel = () => {
    setPlayRequested(false);
    setGameReady(false);
    setGameError(null);
    setPhaseCompleteOpen(false);
    setShowHelp(true);
  };
  const portCompleteTriggeredRef = useRef(false);

  const isHydratingRef = useRef(true);
  const lastPersistedSnapshotRef = useRef('');
  const pendingSaveRef = useRef<Promise<void>>(Promise.resolve());
  const persistSnapshot = (snapshot: GameSnapshot) => {
    const client = supabase;
    if (isHydratingRef.current || !client || !userId || !campaignId) return;
    const complete = snapshot.phase === 1
      ? snapshot.missionStage === 'complete'
      : snapshot.portMissionStage === 'complete';
    const percent = snapshot.phase === 1
      ? complete ? 100 : snapshot.missionStage === 'collect'
        ? Math.round(snapshot.collected / snapshot.total * 30)
        : snapshot.missionStage === 'deliver' ? 35
          : Math.min(99, 35 + Math.round(snapshot.solarBuildingsInstalled / snapshot.solarBuildingsTotal * 50) + (snapshot.electricVehicle ? 15 : 0))
      : complete ? 100 : snapshot.portMissionStage === 'inspect'
        ? Math.round(snapshot.outfallsInspected / snapshot.outfallsTotal * 25)
        : snapshot.portMissionStage === 'treatment' ? 35
          : snapshot.portMissionStage === 'septic'
            ? 40 + Math.round(snapshot.septicInstalled / snapshot.septicTotal * 25)
            : snapshot.portMissionStage === 'collect'
              ? 70 + Math.round(snapshot.companyWasteCollected / snapshot.companyWasteTotal * 20)
              : snapshot.portMissionStage === 'deliver' ? 90
                : Math.min(99, 92 + Math.round(snapshot.cooperativeSorted / snapshot.cooperativeTotal * 8));
    const signature = JSON.stringify([snapshot.phase, snapshot.progressData, percent]);
    if (lastPersistedSnapshotRef.current === signature) return;
    lastPersistedSnapshotRef.current = signature;

    pendingSaveRef.current = pendingSaveRef.current.then(async () => {
      const { error } = await client.from('phase_progress').upsert({
        campaign_id: campaignId,
        user_id: userId,
        phase_number: snapshot.phase,
        status: complete ? 'completed' : 'in_progress',
        environment_state: complete ? 'restored' : percent > 0 ? 'restoring' : 'degraded',
        progress_percent: percent,
        score: snapshot.cit,
        objective_state: snapshot.progressData,
        started_at: new Date().toISOString(),
        completed_at: complete ? new Date().toISOString() : null,
      }, { onConflict: 'campaign_id,phase_number' });
      if (error) throw error;

      const nextPhase = Math.min(10, snapshot.phase + (complete ? 1 : 0));
      const { error: campaignError } = await client.from('campaigns').update({
        current_phase: nextPhase,
        highest_unlocked_phase: Math.max(snapshot.phase, nextPhase),
        knowledge_points: snapshot.cit,
      }).eq('id', campaignId);
      if (campaignError) throw campaignError;

      if (complete && snapshot.phase < 10) {
        const { error: unlockError } = await client.from('phase_progress').update({
          status: 'available',
          environment_state: 'degraded',
        }).eq('campaign_id', campaignId).eq('phase_number', snapshot.phase + 1);
        if (unlockError) throw unlockError;
      }

      if (complete) {
        const report = snapshot.phase === 1
          ? {
              title: 'Relatório de Aprendizado — Centro Industrial',
              content: {
                problem: 'Resíduos sem destinação adequada e consumo de energia e combustíveis.',
                solution: 'Coleta seletiva, entrega ao EcoCentro, energia solar e eletrificação do veículo municipal.',
                result: 'Objetivos essenciais concluídos no cenário do jogo.',
                reflection: 'Como podemos reduzir resíduos e emissões antes de tentar compensá-los?',
              },
            }
          : {
              title: 'Relatório de Aprendizado — Porto',
              content: {
                problem: 'Descargas de efluentes, saneamento sanitário isolado e resíduos empresariais sem triagem.',
                solution: 'Inspeção, ETE industrial, sistemas sanitários locais e encaminhamento à cooperativa.',
                result: 'Objetivos essenciais concluídos no cenário do jogo.',
                reflection: 'Por que efluente industrial e esgoto sanitário não recebem necessariamente o mesmo tratamento?',
              },
            };
        const { data: existing, error: queryError } = await client.from('learning_journal')
          .select('id').eq('campaign_id', campaignId).eq('phase_number', snapshot.phase)
          .eq('entry_type', 'learning_report').limit(1);
        if (queryError) throw queryError;
        if (!existing?.length) {
          const { error: insertError } = await client.from('learning_journal').insert({
            campaign_id: campaignId, user_id: userId, phase_number: snapshot.phase,
            entry_type: 'learning_report', title: report.title, content: report.content,
          });
          if (insertError) throw insertError;
        }
      }
    }).catch((error: unknown) => {
      console.error('Falha ao salvar o progresso GREEN CITY:', error);
      lastPersistedSnapshotRef.current = '';
    });
  };

  useEffect(() => {
    isHydratingRef.current = true;
    let cancelled = false;
    let game: GreenCityGame | null = null;
    const canvas = canvasRef.current;
    if (!canvas || !playRequested) return;

    void import('../game/Game')
      .then(({ GreenCityGame: Game }) => {
        if (cancelled) return;
        game = new Game(canvas, (snapshot) => {
          persistSnapshot(snapshot);
          setState(snapshot);
          if (snapshot.phase === 1 && snapshot.missionStage === 'complete') {
            setDeveloperPhaseMark(1, true);
            if (!phaseCompleteTriggeredRef.current) {
              phaseCompleteTriggeredRef.current = true;
              setPhaseCompleteOpen(true);
            }
          }
          if (snapshot.phase === 2 && snapshot.portMissionStage === 'complete') {
            setDeveloperPhaseMark(2, true);
            if (!portCompleteTriggeredRef.current) {
              portCompleteTriggeredRef.current = true;
              setPhaseCompleteOpen(true);
            }
          }
        });
        gameRef.current = game;
        if (startingPhase === 2) game.enterPortPhase(true);
        game.restoreProgress(savedProgress);
        isHydratingRef.current = false;
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
  }, [playRequested, startingPhase, savedProgress]);

  const handleReturnToCampaign = async () => {
    const snapshot = gameRef.current?.getSnapshot();
    if (snapshot) persistSnapshot(snapshot);
    await pendingSaveRef.current;
    onExitToCampaign();
  };

  const moveJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.36);
    let x = (event.clientX - (rect.left + rect.width / 2)) / radius;
    let y = (event.clientY - (rect.top + rect.height / 2)) / radius;
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) { x /= magnitude; y /= magnitude; }
    setJoystick({ x, y });
    gameRef.current?.setMobileMovement(x, y);
  };
  const startJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    joystickPointerRef.current = event.pointerId;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* o toque continua rastreado enquanto estiver na área */ }
    moveJoystick(event);
  };
  const stopJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerRef.current !== event.pointerId) return;
    joystickPointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* captura já liberada pelo navegador */ }
    }
    setJoystick({ x: 0, y: 0 });
    gameRef.current?.setMobileMovement(0, 0);
  };

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
            : state.portMissionStage === 'collect'
              ? 70 + Math.round((state.companyWasteCollected / state.companyWasteTotal) * 20)
              : state.portMissionStage === 'deliver'
                ? 90
                : state.portMissionStage === 'sorting'
                  ? Math.min(99, 92 + Math.round((state.cooperativeSorted / state.cooperativeTotal) * 8))
                  : 100;

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
    collect: { eyebrow: 'FASE 02 · COLETA NAS EMPRESAS', title: 'Recolha os materiais nas empresas', description: 'Aproxime-se até 9,5 metros do caminhão amarelo e toque em ENTRAR ou pressione F. W acelera, S dá ré e A/D viram. Pare ao lado da carga de cada empresa e toque em COLETAR ou pressione E.', progress: `${state.companyWasteCollected}/${state.companyWasteTotal} empresas atendidas` },
    deliver: { eyebrow: 'FASE 02 · TRANSPORTE E DESTINAÇÃO', title: 'Leve a carga até a cooperativa', description: 'Com as três cargas no caminhão, siga até a COOPERATIVA. Entre na área de descarga, pare completamente e toque em DESCARREGAR ou pressione E. Use F para descer do caminhão quando estiver parado.', progress: '3/3 empresas atendidas · entrega pendente' },
    sorting: { eyebrow: 'FASE 02 · TRIAGEM E RECICLAGEM', title: 'Separe os cinco grupos de materiais', description: `Com o caminhão parado, pressione F para descer. Depois toque em cada baia da cooperativa ou pressione E para separar papel/papelão, plástico, vidro, metal e orgânico. ${state.cooperativeSorted}/${state.cooperativeTotal} grupos separados.`, progress: `${state.cooperativeSorted}/${state.cooperativeTotal} grupos separados` },
    complete: { eyebrow: 'FASE 02 · PORTO RECUPERADO', title: 'Materiais recebidos e separados', description: 'A ETE está operando, as instalações sanitárias foram regularizadas e os materiais das três empresas foram entregues e separados na cooperativa. A próxima região foi liberada.', progress: 'Fase concluída' },
  }[state.portMissionStage];

  const mission = state.phase === 1 ? phaseOneMission : portMission;
  const interactionLabel = state.nearbyLabel.replace(/^([EF]) · /, 'TOQUE · ');
  const mobileActionLabel = state.nearbyAction === 'enter-vehicle' ? 'ENTRAR'
    : state.nearbyAction === 'exit-vehicle' ? 'SAIR'
      : state.nearbyAction === 'collect-company-waste' ? 'COLETAR'
        : state.nearbyAction === 'deliver-cooperative' ? 'DESCARREGAR'
          : state.nearbyAction === 'sort-cooperative-materials' ? 'SEPARAR' : 'AÇÃO';

  return <main className="game-shell">
    <canvas ref={canvasRef} className="game-canvas" tabIndex={0} aria-label="Mundo 3D jogável de GREEN CITY" />

    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">G</span>
        <div><strong>GREEN CITY</strong><small>CIDADE SUSTENTÁVEL · FASE 0{state.phase}/10</small></div>
      </div>
      <button type="button" className="campaign-return-button" onClick={() => void handleReturnToCampaign()}>MAPA DA CIDADE</button>
      {developerMode && gameReady && <button type="button" className="dev-menu-toggle" onClick={reopenDeveloperPanel}>PAINEL DE TESTE</button>}
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
    >{interactionLabel}<span>TOCAR / CLICAR</span></button>}
    {gameReady && !state.paused && !state.mapOpen && !showHelp && <div className="mobile-controls">
      <div className="mobile-joystick" role="group" aria-label="Direcional: arraste para mover o personagem ou dirigir"
        onPointerDown={startJoystick} onPointerMove={moveJoystick}
        onPointerUp={stopJoystick} onPointerCancel={stopJoystick} onLostPointerCapture={stopJoystick}>
        <span className="mobile-stick-base" />
        <span className="mobile-stick-knob" style={{ transform: `translate(calc(-50% + ${joystick.x * 32}px), calc(-50% + ${joystick.y * 32}px))` }} />
        <small>MOVER</small>
      </div>
      <div className="mobile-zoom-stack" aria-label="Controles de zoom">
        <button type="button" className="mobile-zoom-button" aria-label="Aproximar a câmera" onClick={() => gameRef.current?.zoomCameraBy(-2)}>+</button>
        <button type="button" className="mobile-zoom-button" aria-label="Afastar a câmera" onClick={() => gameRef.current?.zoomCameraBy(2)}>−</button>
      </div>
      <div className="mobile-action-stack">
        {state.nearbyAction && <button type="button" className="mobile-action-button" aria-label={interactionLabel} onClick={() => gameRef.current?.performNearbyAction()}>{mobileActionLabel}</button>}
        <button type="button" aria-label="Pular" className="mobile-action-button mobile-action-button--jump"
          onPointerDown={() => gameRef.current?.setMobileJump(true)}
          onPointerUp={() => gameRef.current?.setMobileJump(false)}
          onPointerCancel={() => gameRef.current?.setMobileJump(false)}
          onPointerLeave={() => gameRef.current?.setMobileJump(false)}>PULAR</button>
      </div>
    </div>}

    <div className="vehicle-status">{state.phase === 2
      ? state.inVehicle
        ? state.portMissionStage === 'deliver' ? `CAMINHÃO · DESTINO: COOPERATIVA · ${state.vehicleSpeed} KM/H` : `CAMINHÃO DE COLETA · ${state.vehicleSpeed} KM/H`
        : state.portMissionStage === 'deliver' ? 'CARGA A BORDO · RETORNE AO CAMINHÃO' : 'CAMINHÃO DE COLETA · APROXIME-SE PARA ENTRAR'
      : state.inVehicle ? `${state.electricVehicle ? 'ELÉTRICO' : 'DIESEL'} · ${state.vehicleSpeed} KM/H` : state.electricVehicle ? 'VEÍCULO MUNICIPAL ELÉTRICO' : 'VEÍCULO MUNICIPAL A DIESEL'}</div>

    <div className={"minimap " + (state.phase === 2 ? "minimap-port" : "minimap-city")} aria-label="Minimapa com os objetivos da etapa atual">
      <div className="map-road map-road-v" />
      <div className="map-road map-road-h" />
      <div className="map-river" />
      {state.phase === 1 && <>
        <span className="map-ecocenter" title="EcoCentro · entrega e triagem" />
        <span className="map-base" title="Base de eletrificação" />
      </>}
      {state.mapObjectives.map((objective, index) => <span
        key={objective.id}
        className={"map-objective-marker map-objective-marker--" + objective.status}
        style={{
          left: Math.max(4, Math.min(96, 50 + objective.x * 0.75)) + "%",
          top: Math.max(4, Math.min(96, 50 + objective.z * 0.75)) + "%",
        }}
        title={objective.label + (objective.status === 'done' ? " · concluído" : objective.status === 'next' ? " · próximo objetivo" : " · objetivo da etapa")}
      >{objective.status === 'done' ? '✓' : index + 1}</span>)}
      <span className={state.electricVehicle ? "map-vehicle map-vehicle-electric" : "map-vehicle"}
        style={{ left: Math.max(8, Math.min(92, 50 + state.vehicleX * 0.75)) + "%", top: Math.max(8, Math.min(92, 50 + state.vehicleZ * 0.75)) + "%" }}
        title={state.phase === 2 ? "Caminhão de coleta · posição atual" : "Veículo municipal · posição atual"} />
      <span className="map-player" style={{ left: Math.max(8, Math.min(92, 50 + state.playerX * 0.75)) + "%", top: Math.max(8, Math.min(92, 50 + state.playerZ * 0.75)) + "%" }} />
      <div className="map-route-caption">
        <small>SIGA O MAPA</small>
        <strong>{state.nextObjectiveLabel}</strong>
      </div>
    </div>

    <button className="plan-button" onClick={() => setShowPlan(true)}>PLANO URBANO</button>
    <button className="map-button" onClick={() => { setMapTab('objectives'); gameRef.current?.setMapOpen(!state.mapOpen); }}>M · MAPA DE OBJETIVOS</button>
    <div className="bottom-left"><span className="dot" /> CAMPANHA INDIVIDUAL · PROGRESSO SALVO</div>

    <div className="controls">
      <span><b>WASD</b> mover · mouse arrastado gira câmera</span>
      <span><b>SHIFT</b> correr</span>
      <span><b>ESPAÇO</b> pular</span>
      <span><b>E</b> interagir/instalar</span>
      <span><b>F</b> entrar/sair</span>
      <span><b>M</b> mapa</span>
      <span><b>MOUSE</b> câmera</span>
      <span><b>ESC</b> pausa</span>
    </div>

    {showHelp && <div className="welcome-overlay">
      <div className={"welcome-panel welcome-hero" + (developerMode ? " welcome-panel--dev" : "")}>
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
        <button className="start-game-button" onClick={() => startGameAtPhase(1)}>JOGAR FASE 01 <span>▶</span></button>
        {developerMode && <section className="dev-console" aria-label="Painel de testes do desenvolvedor">
          <div className="dev-console-heading">
            <div>
              <div className="eyebrow">ACESSO LOCAL · MODO DE DESENVOLVIMENTO</div>
              <h3>Painel de testes da campanha</h3>
              <p>Abra diretamente as regiões que já possuem cenário jogável e marque as fases que você já validou.</p>
            </div>
            <span className="dev-mode-tag">TESTE</span>
          </div>
          <div className="dev-console-grid">
            {CITY_NEIGHBORHOODS.map((neighborhood, index) => {
              const phase = index + 1;
              const implemented = phase <= 2;
              const completed = completedPhaseMarks.includes(phase);
              return <article className="dev-phase-card" key={neighborhood.id}>
                <div className="dev-phase-meta">
                  <span>FASE {String(phase).padStart(2, '0')}</span>
                  <b className={completed ? 'is-completed' : implemented ? 'is-available' : 'is-pending'}>
                    {completed ? 'VALIDADA' : implemented ? 'DISPONÍVEL' : 'PLANEJADA'}
                  </b>
                </div>
                <h4>{neighborhood.name}</h4>
                {implemented ? <div className="dev-phase-actions">
                  <button type="button" onClick={() => startGameAtPhase(phase as 1 | 2)}>ABRIR FASE {String(phase).padStart(2, '0')}</button>
                  <label><input type="checkbox" checked={completed} onChange={(event) => setDeveloperPhaseMark(phase, event.currentTarget.checked)} /> Marcar como validada</label>
                </div> : <p>O conteúdo desta região ainda está em planejamento e não pode ser aberto no jogo.</p>}
              </article>;
            })}
          </div>
          <p className="dev-console-note">O checklist fica salvo somente neste navegador. Este atalho não é um login nem uma autenticação segura; use-o para testes do protótipo e não como controle de acesso de produção.</p>
        </section>}
        <div className="welcome-foot"><span className="desktop-only">WASD · MOVIMENTAR</span><span className="desktop-only">E · INTERAGIR</span><span className="desktop-only">M · MAPA DA CIDADE</span><span className="mobile-only">JOYSTICK · MOVER</span><span className="mobile-only">TOQUE · AÇÃO</span><span className="mobile-only">ARRASTE · CÂMERA · PINÇA · ZOOM</span><span>SEM INSTALAÇÃO · JOGA NO NAVEGADOR</span></div>
      </div>
    </div>}

    {state.mapOpen && <div className="world-map-overlay">
      {mapTab === 'objectives' ? <section className="world-map-panel objective-map-panel">
        <div className="world-map-tools">
          <button className="world-map-switch" onClick={() => setMapTab('city')}>VER MAPA GERAL DA CIDADE</button>
          <button className="world-map-close" onClick={() => gameRef.current?.setMapOpen(false)}>FECHAR · M</button>
        </div>
        <div className="eyebrow">GREEN CITY · FASE 0{state.phase} · ROTA DA ETAPA</div>
        <h2>{mission.title}</h2>
        <p>Os pontos da etapa estão marcados no mapa. O amarelo indica o próximo destino; os demais pontos mostram o que já foi feito e o que ainda falta. Você continua responsável por investigar e decidir a solução ambiental.</p>
        <div className="objective-map-layout">
          <div className={"objective-map-board " + (state.phase === 2 ? "objective-map-board--port" : "objective-map-board--city")}>
            <div className="objective-map-river" />
            <div className="objective-map-road objective-map-road-one" />
            <div className="objective-map-road objective-map-road-two" />
            {state.mapObjectives.map((objective, index) => <span
              key={objective.id}
              className={"objective-map-pin objective-map-pin--" + objective.status}
              style={{
                left: Math.max(3, Math.min(97, 50 + objective.x * 0.98)) + "%",
                top: Math.max(3, Math.min(97, 50 + objective.z * 0.98)) + "%",
              }}
              title={objective.label}
            >{objective.status === 'done' ? '✓' : index + 1}</span>)}
            <span className="objective-map-player"
              style={{ left: Math.max(3, Math.min(97, 50 + state.playerX * 0.98)) + "%", top: Math.max(3, Math.min(97, 50 + state.playerZ * 0.98)) + "%" }}
              title="Você está aqui">VOCÊ</span>
            <span className="objective-map-vehicle"
              style={{ left: Math.max(3, Math.min(97, 50 + state.vehicleX * 0.98)) + "%", top: Math.max(3, Math.min(97, 50 + state.vehicleZ * 0.98)) + "%" }}
              title={state.phase === 2 ? "Caminhão" : "Veículo municipal"}>V</span>
          </div>
          <div className="objective-map-list">
            <div className="objective-map-next"><small>PRÓXIMO DESTINO</small><strong>{state.nextObjectiveLabel}</strong></div>
            {state.mapObjectives.length === 0
              ? <div className="objective-map-empty">Etapa concluída. Abra o mapa geral para acompanhar a próxima região liberada.</div>
              : state.mapObjectives.map((objective, index) => <div key={objective.id} className={"objective-map-row objective-map-row--" + objective.status}>
                  <span>{objective.status === 'done' ? '✓' : index + 1}</span>
                  <div><b>{objective.label}</b><small>{objective.status === 'done' ? 'CONCLUÍDO' : objective.status === 'next' ? 'PRÓXIMO PONTO' : 'PONTO DESTA ETAPA'}</small></div>
                </div>)}
            <div className="objective-map-legend">
              <span><i className="objective-legend-dot objective-legend-dot--next" /> Próximo</span>
              <span><i className="objective-legend-dot objective-legend-dot--done" /> Concluído</span>
              <span><i className="objective-legend-dot objective-legend-dot--upcoming" /> A seguir</span>
            </div>
          </div>
        </div>
      </section> : <section className="world-map-panel city-map-panel">
        <div className="world-map-tools">
          <button className="world-map-switch" onClick={() => setMapTab('objectives')}>VOLTAR AOS OBJETIVOS DA ETAPA</button>
          <button className="world-map-close" onClick={() => gameRef.current?.setMapOpen(false)}>FECHAR · M</button>
        </div>
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
                className={"district-card " + (completed ? "district-complete " : "") + (current ? "district-current " : "") + (available ? "district-available " : "") + (!completed && !current && !available ? "district-locked" : "")}
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
          <span><i className="legend-dot active" /> Fase atual</span><span><i className="legend-dot available" /> Liberado</span><span><i className="legend-dot locked" /> Bloqueado</span>
        </div>
        <p className="map-disclaimer">O mapa é uma representação fictícia da cidade. Nesta versão, o Centro Industrial e o Porto possuem cenários 3D; as outras oito regiões permanecem bloqueadas enquanto são desenvolvidas.</p>
      </section>}
    </div>}

    {state.phase === 1 && state.missionStage === 'complete' && phaseCompleteOpen && !phaseCompleteSeen && <div className="phase-complete-overlay">
      <section className="phase-complete-panel learning-report">
        <div className="completion-medal">✓</div>
        <div className="eyebrow">CADERNO DE APRENDIZADO · FASE 01 DE 10</div>
        <h2>O Centro Industrial começou a mudar!</h2>
        <p>Você não apenas cumpriu tarefas: ajudou a dar um destino melhor aos resíduos, modernizou os prédios e tornou o transporte municipal mais sustentável.</p>
        <div className="completion-stats"><span>5 resíduos recolhidos</span><span>8 prédios com energia solar</span><span>1 veículo elétrico</span></div>
        <div className="learning-report-grid">
          <article className="learning-report-card">
            <small>O PROBLEMA</small>
            <h3>Resíduos sem destino correto</h3>
            <p>Lixo abandonado pode sujar o solo e chegar aos bueiros, córregos e rios. Quando materiais diferentes são misturados, fica mais difícil reaproveitar cada um.</p>
          </article>
          <article className="learning-report-card">
            <small>O QUE FIZEMOS</small>
            <h3>Coleta e separação</h3>
            <p>Recolhemos os materiais e levamos ao EcoCentro, onde papel, plástico, vidro, metal e orgânicos podem seguir caminhos adequados, como reciclagem ou tratamento específico.</p>
          </article>
          <article className="learning-report-card">
            <small>ENERGIA MAIS LIMPA</small>
            <h3>Sol nos telhados e carro elétrico</h3>
            <p>Os painéis solares geram eletricidade sem queimar combustível no local. O veículo elétrico não solta gases pelo escapamento enquanto circula, ajudando a reduzir a poluição do ar nas ruas.</p>
          </article>
          <article className="learning-report-card learning-report-card--result">
            <small>O QUE APRENDEMOS</small>
            <h3>Prevenir é melhor do que remediar</h3>
            <p>Separar resíduos, reaproveitar materiais e escolher energia e transporte mais limpos evita parte da poluição antes que ela chegue à natureza.</p>
          </article>
        </div>
        <div className="learning-question"><b>DESAFIO PARA PENSAR</b><span>Por que uma garrafa plástica não deve ser jogada junto com restos de comida e folhas?</span></div>
        <div className="learning-next"><small>PRÓXIMA ETAPA · FASE 02</small><b>Porto: água, saneamento e responsabilidade das empresas.</b><span>Agora vamos aprender que efluentes e resíduos precisam de tratamentos diferentes.</span></div>
        <button className="start-game-button" onClick={() => { setPhaseCompleteSeen(true); setPhaseCompleteOpen(false); setMapTab('city'); gameRef.current?.setMapOpen(true); }}>AVANÇAR · VER MAPA DA CIDADE <span>→</span></button>
      </section>
    </div>}

    {state.phase === 2 && state.portMissionStage === 'complete' && phaseCompleteOpen && !portCompleteSeen && <div className="phase-complete-overlay">
      <section className="phase-complete-panel learning-report">
        <div className="completion-medal">✓</div>
        <div className="eyebrow">CADERNO DE APRENDIZADO · FASE 02 DE 10</div>
        <h2>O Porto está no caminho da recuperação!</h2>
        <p>Você investigou os pontos de despejo, ajudou a organizar o saneamento e garantiu que os resíduos das empresas fossem recolhidos e separados.</p>
        <div className="completion-stats"><span>3 pontos de despejo investigados</span><span>1 ETE implantada</span><span>2 sistemas sépticos</span><span>3 empresas atendidas</span></div>
        <div className="learning-report-grid">
          <article className="learning-report-card">
            <small>O PROBLEMA DA ÁGUA</small>
            <h3>Efluentes sem tratamento</h3>
            <p>Água usada em processos de uma empresa pode carregar sujeira, matéria orgânica e produtos químicos. Despejar esse efluente sem tratamento adequado pode prejudicar os seres vivos e a qualidade da água.</p>
          </article>
          <article className="learning-report-card">
            <small>ETE · EFLUENTE INDUSTRIAL</small>
            <h3>Tratar antes de devolver ao ambiente</h3>
            <p>A Estação de Tratamento de Efluentes recebe a água usada pela atividade industrial e aplica etapas adequadas aos contaminantes encontrados. Só depois do tratamento e das verificações necessárias o efluente pode seguir para a destinação permitida. Água tratada não significa água potável.</p>
          </article>
          <article className="learning-report-card">
            <small>FOSSA SÉPTICA · ESGOTO SANITÁRIO</small>
            <h3>Outra solução para outro tipo de água</h3>
            <p>As fossas atendem banheiros e instalações sanitárias isoladas. Dentro do tanque, parte dos sólidos se deposita e microrganismos ajudam a decompor a matéria orgânica. O líquido ainda precisa de destinação ou tratamento complementar adequado, e a fossa exige manutenção. Ela não substitui a ETE industrial.</p>
          </article>
          <article className="learning-report-card">
            <small>RESÍDUOS SÓLIDOS DAS EMPRESAS</small>
            <h3>Separar para reaproveitar</h3>
            <p>O caminhão recolheu os materiais e levou tudo à cooperativa. Lá, papel e papelão, plástico, vidro, metal e orgânicos foram separados para que cada grupo possa seguir para reciclagem, compostagem ou outra destinação correta.</p>
          </article>
          <article className="learning-report-card learning-report-card--result">
            <small>O QUE MUDOU</small>
            <h3>Menos poluição, mais cuidado com o rio</h3>
            <p>No mundo simulado, a implantação do tratamento melhora o indicador de qualidade da água e muda a aparência do rio. Na vida real, é preciso analisar e monitorar o efluente: não basta a água parecer limpa para saber se está segura.</p>
          </article>
        </div>
        <div className="learning-question"><b>DESAFIO PARA PENSAR</b><span>Por que o esgoto de um banheiro e a água usada em uma fábrica não devem receber automaticamente o mesmo tratamento?</span></div>
        <div className="learning-next"><small>PRÓXIMA ETAPA · FASE 03</small><b>Periferia Verde: coleta comunitária, compostagem, saneamento e drenagem.</b><span>Vamos passar das soluções básicas para entender como os bairros inteiros podem trabalhar juntos.</span></div>
        <button className="start-game-button" onClick={() => { setPortCompleteSeen(true); setPhaseCompleteOpen(false); setMapTab('city'); gameRef.current?.setMapOpen(true); }}>AVANÇAR · VER PRÓXIMA REGIÃO <span>→</span></button>
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
