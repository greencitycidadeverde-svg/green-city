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
  peripheryMissionStage: 'survey',
  communityIssuesInspected: 0,
  communityIssuesTotal: 3,
  communityWasteCollected: 0,
  communityWasteTotal: 5,
  communityOrganicDeposited: 0,
  communityOrganicTotal: 2,
  communityRecyclableDeposited: 0,
  communityRecyclableTotal: 3,
  learningNotice: null,
  communityOrganicsSorted: false,
  communityRecyclablesSorted: false,
  communityCompostTurned: false,
  communitySewerConnections: 0,
  communitySewerTotal: 2,
  communityRainGardenBuilt: false,
  communityWaterQuality: 28,
  forestMissionStage: 'survey', forestHabitatsInspected: 0, forestHabitatsTotal: 3,
  forestProduceHarvested: 0, forestProduceTotal: 3, forestTruckLoaded: false,
  forestProcessed: false, forestMarketStocked: false,
  forestPackagingSorted: 0, forestPackagingTotal: 6, forestCooperativeDelivered: false,
  forestSeedlingsPlanted: 0, forestSeedlingsTotal: 3, forestSpringProtected: false, forestWildlifeRecorded: false,
  forestFirePreventionInspected: false,
  coastalMissionStage: 'survey', coastalSitesInspected: 0, coastalSitesTotal: 3,
  coastalWasteCollected: 0, coastalWasteTotal: 4, coastalWasteSorted: 0,
  coastalMangrovesPlanted: 0, coastalMangrovesTotal: 3,
  coastalWildlifeRecorded: 0, coastalWildlifeTotal: 2, coastalWaterMonitoringComplete: false,
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
    peripheryMissionStage: 'survey', communityIssuesInspected: [], communityWasteCollected: [],
    communityOrganicDeposited: [], communityRecyclableDeposited: [],
    communityOrganicsSorted: false, communityRecyclablesSorted: false, communityCompostTurned: false,
    communitySewerConnected: [], communityRainGardenBuilt: false,
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
  initialPhase: 1 | 2 | 3 | 4 | 5;
  savedProgress: Partial<GameProgressData>;
  isMaster: boolean;
  replayMode: boolean;
  onConfigurePhase: (phase: number) => void;
  onReplayPhase: (phase: 1 | 2 | 3 | 4 | 5) => void;
  onOpenPhase: (phase: 1 | 2 | 3 | 4 | 5) => void;
  onExitToCampaign: () => void;
}

export default function GameExperience({ userId, campaignId, initialPhase, savedProgress, isMaster, replayMode, onConfigurePhase, onReplayPhase, onOpenPhase, onExitToCampaign }: GameExperienceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GreenCityGame | null>(null);
  const [state, setState] = useState(initial);
  const developerMode = isMaster;
  const [startingPhase, setStartingPhase] = useState<1 | 2 | 3 | 4 | 5>(initialPhase);
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
  const [peripheryCompleteSeen, setPeripheryCompleteSeen] = useState(false);
  const [forestCompleteSeen, setForestCompleteSeen] = useState(false);
  const [coastalCompleteSeen, setCoastalCompleteSeen] = useState(false);
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

  const startGameAtPhase = (phase: 1 | 2 | 3 | 4 | 5) => {
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
  const peripheryCompleteTriggeredRef = useRef(false);
  const forestCompleteTriggeredRef = useRef(false);
  const coastalCompleteTriggeredRef = useRef(false);

  const isHydratingRef = useRef(true);
  const lastPersistedSnapshotRef = useRef('');
  const pendingSaveRef = useRef<Promise<void>>(Promise.resolve());
  const persistSnapshot = (snapshot: GameSnapshot) => {
    const client = supabase;
    if (replayMode || isHydratingRef.current || !client || !userId || !campaignId) return;
    const complete = snapshot.phase === 1
      ? snapshot.missionStage === 'complete'
      : snapshot.phase === 2
        ? snapshot.portMissionStage === 'complete'
        : snapshot.phase === 3
          ? snapshot.peripheryMissionStage === 'complete'
          : snapshot.phase === 4
            ? snapshot.forestMissionStage === 'complete'
            : snapshot.coastalMissionStage === 'complete';
    const percent = snapshot.phase === 1
      ? complete ? 100 : snapshot.missionStage === 'collect'
        ? Math.round(snapshot.collected / snapshot.total * 30)
        : snapshot.missionStage === 'deliver' ? 35
          : Math.min(99, 35 + Math.round(snapshot.solarBuildingsInstalled / snapshot.solarBuildingsTotal * 50) + (snapshot.electricVehicle ? 15 : 0))
      : snapshot.phase === 2
        ? complete ? 100 : snapshot.portMissionStage === 'inspect'
          ? Math.round(snapshot.outfallsInspected / snapshot.outfallsTotal * 25)
          : snapshot.portMissionStage === 'treatment' ? 35
            : snapshot.portMissionStage === 'septic'
              ? 40 + Math.round(snapshot.septicInstalled / snapshot.septicTotal * 25)
              : snapshot.portMissionStage === 'collect'
                ? 70 + Math.round(snapshot.companyWasteCollected / snapshot.companyWasteTotal * 20)
                : snapshot.portMissionStage === 'deliver' ? 90
                  : Math.min(99, 92 + Math.round(snapshot.cooperativeSorted / snapshot.cooperativeTotal * 8))
        : snapshot.phase === 3
          ? complete ? 100 : snapshot.peripheryMissionStage === 'survey'
            ? Math.round(snapshot.communityIssuesInspected / snapshot.communityIssuesTotal * 18)
            : snapshot.peripheryMissionStage === 'collect'
              ? 18 + Math.round(snapshot.communityWasteCollected / snapshot.communityWasteTotal * 22)
              : snapshot.peripheryMissionStage === 'sorting'
                ? 42 + Math.round(snapshot.communityOrganicDeposited / snapshot.communityOrganicTotal * 8) + Math.round(snapshot.communityRecyclableDeposited / snapshot.communityRecyclableTotal * 8)
                : snapshot.peripheryMissionStage === 'compost' ? 62
                  : snapshot.peripheryMissionStage === 'sanitation'
                    ? 65 + Math.round(snapshot.communitySewerConnections / snapshot.communitySewerTotal * 25)
                    : 95
          : snapshot.phase === 4
            ? complete ? 100 : snapshot.forestMissionStage === 'survey'
              ? Math.round(snapshot.forestHabitatsInspected / snapshot.forestHabitatsTotal * 15)
              : snapshot.forestMissionStage === 'harvest'
                ? 15 + Math.round(snapshot.forestProduceHarvested / snapshot.forestProduceTotal * 20)
                : snapshot.forestMissionStage === 'transport' ? 40
                  : snapshot.forestMissionStage === 'process' ? 48
                    : snapshot.forestMissionStage === 'market' ? 56
                      : snapshot.forestMissionStage === 'sorting'
                        ? 60 + Math.round(snapshot.forestPackagingSorted / snapshot.forestPackagingTotal * 15)
                        : snapshot.forestMissionStage === 'cooperative' ? 78
                          : Math.min(99, 80 + snapshot.forestSeedlingsPlanted * 4 + (snapshot.forestSpringProtected ? 7 : 0) + (snapshot.forestWildlifeRecorded ? 5 : 0) + (snapshot.forestFirePreventionInspected ? 3 : 0))
            : complete ? 100 : snapshot.coastalMissionStage === 'survey'
              ? Math.round(snapshot.coastalSitesInspected / snapshot.coastalSitesTotal * 15)
              : snapshot.coastalMissionStage === 'cleanup'
                ? 15 + Math.round(snapshot.coastalWasteCollected / snapshot.coastalWasteTotal * 20)
                : snapshot.coastalMissionStage === 'sorting'
                  ? 35 + Math.round(snapshot.coastalWasteSorted / snapshot.coastalWasteTotal * 20)
                  : snapshot.coastalMissionStage === 'restore'
                    ? 55 + Math.round(snapshot.coastalMangrovesPlanted / snapshot.coastalMangrovesTotal * 25)
                    : Math.min(99, 80 + Math.round(snapshot.coastalWildlifeRecorded / snapshot.coastalWildlifeTotal * 15) + (snapshot.coastalWaterMonitoringComplete ? 5 : 0));
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
          : snapshot.phase === 2
          ? {
              title: 'Relatório de Aprendizado — Porto',
              content: {
                problem: 'Descargas de efluentes, saneamento sanitário isolado e resíduos empresariais sem triagem.',
                solution: 'Inspeção, ETE industrial, sistemas sanitários locais e encaminhamento à cooperativa.',
                result: 'Objetivos essenciais concluídos no cenário do jogo.',
                reflection: 'Por que efluente industrial e esgoto sanitário não recebem necessariamente o mesmo tratamento?',
              },
            }
          : snapshot.phase === 3
            ? {
                title: 'Relatório de Aprendizado — Periferia Verde',
                content: {
                  problem: 'Descarte irregular de resíduos, necessidade de saneamento sanitário e escoamento superficial de chuva no bairro.',
                  solution: 'Identificação de resíduos orgânicos (cascas de frutas e restos vegetais) e recicláveis secos (embalagens de plástico, metal e vidro); encaminhamento individual à composteira e à coleta seletiva; manejo da composteira; ligações sanitárias e jardim de chuva em local apropriado.',
                  result: 'Foram registrados ' + snapshot.communityWasteCollected + ' de ' + snapshot.communityWasteTotal + ' objetos. Os orgânicos seguiram à composteira; os recicláveis foram separados para triagem e encaminhamento, sem confundir a cooperativa com a indústria recicladora. O composto só retorna ao solo após decomposição e maturação; ligações sanitárias dependem de tratamento e jardins de chuva exigem avaliação técnica do local.',
                  reflection: 'Por que cascas e restos de alimentos vão para a composteira, enquanto embalagens de plástico, metal e vidro seguem para a coleta seletiva? Por que o composto precisa amadurecer antes de ir aos canteiros?',
                },
              }
            : snapshot.phase === 4
              ? {
                  title: 'Relatório de Aprendizado — Reserva Florestal',
                  content: {
                    problem: 'Fragmentação de habitats, necessidade de restauração e impactos ambientais ao longo da cadeia de produção e consumo de alimentos.',
                    solution: 'Diagnóstico da biodiversidade, apoio à agricultura familiar, transporte da produção, processamento e embalagem, comercialização, separação pós-consumo, entrega de recicláveis à cooperativa, compostagem dos orgânicos, proteção da nascente e plantio de mudas nativas.',
                    result: 'O cenário demonstrou como produção, logística, indústria, comércio, consumo e conservação se conectam. A cooperativa prepara os recicláveis para encaminhamento; a transformação industrial será aprofundada na Fase 08.',
                    reflection: 'Por que os resíduos recicláveis e orgânicos precisam de rotas diferentes, e como a produção de alimentos pode conviver com a conservação da floresta?',
                  },
                }
              : {
                  title: 'Relatório de Aprendizado — Zona Costeira',
                  content: {
                    problem: 'Resíduos e sedimentos podem percorrer a bacia hidrográfica até o estuário e o mar; manguezais e a fauna costeira dependem de habitats preservados e de monitoramento.',
                    solution: 'Investigação de trechos a montante, no estuário e no manguezal; coleta de quatro resíduos comuns seguros na praia; separação por material e cor; registro dos pontos de plantio orientados do manguezal; observação da fauna e monitoramento educativo da água.',
                    result: 'No cenário foram investigados ' + snapshot.coastalSitesInspected + ' de ' + snapshot.coastalSitesTotal + ' trechos, recolhidos ' + snapshot.coastalWasteCollected + ' objetos, separados ' + snapshot.coastalWasteSorted + ' materiais, registrados ' + snapshot.coastalMangrovesPlanted + ' pontos de plantio e ' + snapshot.coastalWildlifeRecorded + ' observações de fauna. O ponto de água é apenas um registro educativo: não representa análise laboratorial nem atesta segurança.',
                    reflection: 'Por que retirar resíduos da praia não substitui o controle das fontes de poluição ao longo da bacia? Como as marés e a hidrologia influenciam o manguezal?',
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
          if (snapshot.phase === 3 && snapshot.peripheryMissionStage === 'complete') {
            setDeveloperPhaseMark(3, true);
            if (!peripheryCompleteTriggeredRef.current) {
              peripheryCompleteTriggeredRef.current = true;
              setPhaseCompleteOpen(true);
            }
          }
          if (snapshot.phase === 4 && snapshot.forestMissionStage === 'complete') {
            setDeveloperPhaseMark(4, true);
            if (!forestCompleteTriggeredRef.current) {
              forestCompleteTriggeredRef.current = true;
              setPhaseCompleteOpen(true);
            }
          }
          if (snapshot.phase === 5 && snapshot.coastalMissionStage === 'complete') {
            setDeveloperPhaseMark(5, true);
            if (!coastalCompleteTriggeredRef.current) {
              coastalCompleteTriggeredRef.current = true;
              setPhaseCompleteOpen(true);
            }
          }
        });
        gameRef.current = game;
        if (startingPhase === 2) game.enterPortPhase(true);
        if (startingPhase === 3) game.enterPeripheryPhase(true);
        if (startingPhase === 4) game.enterForestPhase(true);
        if (startingPhase === 5) game.enterCoastalPhase(true);
        // Ao trocar de fase pelo painel de testes Master, não restaurar dados da fase anterior.
        game.restoreProgress(startingPhase === initialPhase ? savedProgress : {});
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
  }, [playRequested, startingPhase, savedProgress, replayMode]);

  const handleReturnToCampaign = async () => {
    const snapshot = gameRef.current?.getSnapshot();
    if (snapshot) persistSnapshot(snapshot);
    await pendingSaveRef.current;
    onExitToCampaign();
  };

  const handleOpenPhase = async (phase: 1 | 2 | 3 | 4 | 5) => {
    const snapshot = gameRef.current?.getSnapshot();
    if (snapshot) persistSnapshot(snapshot);
    await pendingSaveRef.current;
    onOpenPhase(phase);
  };

  const handleReplayPhase = async (phase: 1 | 2 | 3 | 4 | 5) => {
    const snapshot = gameRef.current?.getSnapshot();
    if (snapshot) persistSnapshot(snapshot);
    await pendingSaveRef.current;
    onReplayPhase(phase);
  };

  const openMasterPhaseConfig = async (phase: number) => {
    if (!isMaster || phase <= 5 || phase > 10) return;
    await handleReturnToCampaign();
    onConfigurePhase(phase);
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
    ? state.missionStage === 'complete' ? 100
      : state.missionStage === 'collect' ? Math.round((state.collected / state.total) * 30)
        : state.missionStage === 'deliver' ? 35
          : Math.min(99, 35 + Math.round((state.solarBuildingsInstalled / state.solarBuildingsTotal) * 50) + (state.electricVehicle ? 15 : 0))
    : state.phase === 2
      ? state.portMissionStage === 'complete' ? 100
        : state.portMissionStage === 'inspect' ? Math.round((state.outfallsInspected / state.outfallsTotal) * 25)
          : state.portMissionStage === 'treatment' ? 35
            : state.portMissionStage === 'septic' ? 40 + Math.round((state.septicInstalled / state.septicTotal) * 25)
              : state.portMissionStage === 'collect' ? 70 + Math.round((state.companyWasteCollected / state.companyWasteTotal) * 20)
                : state.portMissionStage === 'deliver' ? 90
                  : Math.min(99, 92 + Math.round((state.cooperativeSorted / state.cooperativeTotal) * 8))
      : state.phase === 3
        ? state.peripheryMissionStage === 'complete' ? 100
          : state.peripheryMissionStage === 'survey' ? Math.round(state.communityIssuesInspected / state.communityIssuesTotal * 18)
            : state.peripheryMissionStage === 'collect' ? 18 + Math.round(state.communityWasteCollected / state.communityWasteTotal * 22)
              : state.peripheryMissionStage === 'sorting' ? 42 + Math.round(state.communityOrganicDeposited / state.communityOrganicTotal * 8) + Math.round(state.communityRecyclableDeposited / state.communityRecyclableTotal * 8)
                : state.peripheryMissionStage === 'compost' ? 62
                  : state.peripheryMissionStage === 'sanitation' ? 65 + Math.round(state.communitySewerConnections / state.communitySewerTotal * 25)
                    : 95
        : state.forestMissionStage === 'complete' ? 100
          : state.forestMissionStage === 'survey' ? Math.round(state.forestHabitatsInspected / state.forestHabitatsTotal * 15)
            : state.forestMissionStage === 'harvest' ? 15 + Math.round(state.forestProduceHarvested / state.forestProduceTotal * 20)
              : state.forestMissionStage === 'transport' ? 40
                : state.forestMissionStage === 'process' ? 48
                  : state.forestMissionStage === 'market' ? 56
                    : state.forestMissionStage === 'sorting' ? 60 + Math.round(state.forestPackagingSorted / state.forestPackagingTotal * 15)
                      : state.forestMissionStage === 'cooperative' ? 78
                        : state.phase === 4
                          ? Math.min(99, 77 + state.forestSeedlingsPlanted * 4 + (state.forestSpringProtected ? 7 : 0) + (state.forestWildlifeRecorded ? 5 : 0) + (state.forestFirePreventionInspected ? 3 : 0))
                          : state.coastalMissionStage === 'complete' ? 100
                            : state.coastalMissionStage === 'survey' ? Math.round(state.coastalSitesInspected / state.coastalSitesTotal * 15)
                              : state.coastalMissionStage === 'cleanup' ? 15 + Math.round(state.coastalWasteCollected / state.coastalWasteTotal * 20)
                                : state.coastalMissionStage === 'sorting' ? 35 + Math.round(state.coastalWasteSorted / state.coastalWasteTotal * 20)
                                  : state.coastalMissionStage === 'restore' ? 55 + Math.round(state.coastalMangrovesPlanted / state.coastalMangrovesTotal * 25)
                                    : Math.min(99, 80 + Math.round(state.coastalWildlifeRecorded / state.coastalWildlifeTotal * 15) + (state.coastalWaterMonitoringComplete ? 5 : 0));

  const phaseOneMission = {
    collect: { eyebrow: 'FASE 01 · DIAGNÓSTICO E COLETA', title: 'Comece a recuperar o bairro', description: 'Recolha os resíduos espalhados. Depois, leve a carga ao EcoCentro para encaminhamento correto.', progress: `${state.collected}/${state.total} resíduos` },
    deliver: { eyebrow: 'FASE 01 · GESTÃO DE RESÍDUOS', title: 'Leve a carga ao EcoCentro', description: 'Vá até a praça, identifique as cinco categorias pelas cores e símbolos e entregue os resíduos no ponto de triagem.', progress: 'Coleta concluída · entrega pendente' },
    solar: { eyebrow: 'FASE 01 · MISSÃO DE ENERGIA SOLAR', title: 'Solarize os prédios', description: `Aproxime-se da fachada de cada prédio ainda sem painéis e pressione E para instalar. ${state.solarBuildingsInstalled}/${state.solarBuildingsTotal} edifícios modernizados.`, progress: `${state.solarBuildingsInstalled}/${state.solarBuildingsTotal} prédios` },
    vehicle: { eyebrow: 'FASE 01 · MISSÃO DE MOBILIDADE', title: 'Dirija até a base de eletrificação', description: 'Entre no carro com F, siga pela via de serviço até a base marcada no minimapa, pare completamente na vaga, desça com F e pressione E ao lado do veículo.', progress: 'Base ativa · conversão pendente' },
    complete: { eyebrow: 'FASE 01 · BAIRRO RECUPERADO', title: 'Centro Industrial transformado', description: 'Os oito prédios receberam energia solar e o veículo municipal foi convertido na base. O Porto está liberado no mapa.', progress: 'Fase concluída' },
  }[state.missionStage];

  const portMission = {
    inspect: { eyebrow: 'FASE 02 · DIAGNÓSTICO DA ÁGUA', title: 'Investigue os despejos no rio', description: 'Encontre os três pontos de descarga próximos ao rio e pressione E para registrar uma amostra de cada um.', progress: state.outfallsInspected + '/' + state.outfallsTotal + ' pontos inspecionados' },
    treatment: { eyebrow: 'FASE 02 · TRATAMENTO DE EFLUENTES', title: 'Construa a estação de tratamento', description: 'Vá até a área sinalizada entre o pátio e o rio e pressione E para instalar a ETE. A estação tratará os efluentes industriais antes da descarga.', progress: 'Diagnóstico concluído · ETE pendente' },
    septic: { eyebrow: 'FASE 02 · SANEAMENTO LOCAL', title: 'Instale as fossas sépticas', description: 'Instale sistemas sépticos nas duas instalações sanitárias isoladas do porto. ' + state.septicInstalled + '/' + state.septicTotal + ' concluídas.', progress: state.septicInstalled + '/' + state.septicTotal + ' fossas instaladas' },
    collect: { eyebrow: 'FASE 02 · COLETA NAS EMPRESAS', title: 'Recolha os materiais nas empresas', description: 'Aproxime-se até 9,5 metros do caminhão amarelo e toque em ENTRAR ou pressione F. W acelera, S dá ré e A/D viram. Pare ao lado da carga de cada empresa e toque em COLETAR ou pressione E.', progress: state.companyWasteCollected + '/' + state.companyWasteTotal + ' empresas atendidas' },
    deliver: { eyebrow: 'FASE 02 · TRANSPORTE E DESTINAÇÃO', title: 'Leve a carga até a cooperativa', description: 'Com as três cargas no caminhão, siga até a COOPERATIVA. Entre na área de descarga, pare completamente e toque em DESCARREGAR ou pressione E. Use F para descer do caminhão quando estiver parado.', progress: '3/3 empresas atendidas · entrega pendente' },
    sorting: { eyebrow: 'FASE 02 · TRIAGEM E RECICLAGEM', title: 'Separe os cinco grupos de materiais', description: 'Com o caminhão parado, pressione F para descer. Depois toque em cada baia da cooperativa ou pressione E para separar papel/papelão, plástico, vidro, metal e orgânico. ' + state.cooperativeSorted + '/' + state.cooperativeTotal + ' grupos separados.', progress: state.cooperativeSorted + '/' + state.cooperativeTotal + ' grupos separados' },
    complete: { eyebrow: 'FASE 02 · PORTO RECUPERADO', title: 'Materiais recebidos e separados', description: 'A ETE está operando, as instalações sanitárias foram regularizadas e os materiais das três empresas foram entregues e separados na cooperativa. A próxima região foi liberada.', progress: 'Fase concluída' },
  }[state.portMissionStage];

  const peripheryMission = {
    survey: { eyebrow: 'FASE 03 · INVESTIGAÇÃO COMUNITÁRIA', title: 'Conheça os desafios do bairro', description: 'Explore os pontos sinalizados: observe resíduos nas ruas, um bueiro com água parada e moradias que precisam de atenção ao esgoto sanitário. Investigue antes de escolher as soluções.', progress: state.communityIssuesInspected + '/' + state.communityIssuesTotal + ' pontos investigados' },
    collect: { eyebrow: 'FASE 03 · IDENTIFIQUE CADA RESÍDUO', title: 'Reconheça o que você está recolhendo', description: 'Recolha ' + state.communityWasteTotal + ' objetos com formatos diferentes. Cascas e restos de frutas são orgânicos; garrafas e latas são recicláveis. Ao pegar cada peça, veja a explicação para descobrir por que ela pertence àquele grupo.', progress: state.communityWasteCollected + '/' + state.communityWasteTotal + ' objetos identificados e recolhidos' },
    sorting: { eyebrow: 'FASE 03 · DOIS DESTINOS DIFERENTES', title: 'Coloque cada objeto no local certo', description: 'Leve as duas sobras de alimentos à COMPOSTEIRA aberta. Coloque ' + (state.communityRecyclableTotal === 2 ? 'a garrafa PET e a lata de alumínio' : 'a garrafa PET, a lata de alumínio e a garrafa de vidro') + ' no recipiente azul da COLETA SELETIVA. O jogo explica cada objeto na hora do descarte.', progress: state.communityOrganicDeposited + '/' + state.communityOrganicTotal + ' orgânicos na composteira · ' + state.communityRecyclableDeposited + '/' + state.communityRecyclableTotal + ' recicláveis separados' },
    compost: { eyebrow: 'FASE 03 · COMPOSTAGEM PASSO A PASSO', title: 'Areje a composteira e veja o ciclo virar plantio', description: 'Restos de frutas e cascas não viram adubo na mesma hora. Na composteira, misture matéria orgânica com folhas secas e materiais vegetais; microrganismos precisam de ar, umidade e tempo. Só o composto maturado pode voltar ao solo dos canteiros.', progress: '2/2 resíduos orgânicos encaminhados · volte à composteira para arejar a mistura e acompanhar a transformação' },
    sanitation: { eyebrow: 'FASE 03 · SANEAMENTO BÁSICO', title: 'Conecte as moradias à rede sanitária', description: 'Verifique as ligações de esgoto das duas moradias. Esgoto sanitário deve seguir para rede e tratamento adequados. A água da chuva é conduzida por outro sistema: a drenagem pluvial. ' + state.communitySewerConnections + '/' + state.communitySewerTotal + ' ligações verificadas.', progress: state.communitySewerConnections + '/' + state.communitySewerTotal + ' moradias conectadas' },
    'rain-garden': { eyebrow: 'FASE 03 · DRENAGEM URBANA', title: 'Implante um jardim de chuva', description: 'No ponto indicado, crie uma área vegetada rebaixada para receber parte do escoamento da chuva. Em locais adequados, solo e plantas ajudam a reter, filtrar e infiltrar água; não é solução para esgoto sanitário nem funciona em todo tipo de terreno.', progress: 'Diagnóstico e saneamento concluídos · jardim pendente' },
    complete: { eyebrow: 'FASE 03 · PERIFERIA VERDE', title: 'A comunidade começou a se transformar', description: 'Você investigou os desafios, organizou a coleta, acompanhou a composteira, melhorou as ligações sanitárias e implantou um jardim de chuva no cenário simulado.', progress: 'Fase concluída' },
  }[state.peripheryMissionStage];


  const forestMission = {
    survey: { eyebrow: 'FASE 04 · BIODIVERSIDADE', title: 'Conheça a reserva e seus habitats', description: 'Explore os três pontos sinalizados. Observe fragmentos de vegetação, conectividade entre habitats e sinais da vida silvestre antes de iniciar a restauração.', progress: state.forestHabitatsInspected + '/' + state.forestHabitatsTotal + ' habitats investigados' },
    harvest: { eyebrow: 'FASE 04 · AGRICULTURA FAMILIAR', title: 'Conheça quem produz os alimentos', description: 'Na propriedade familiar, recolha as três caixas de produtos. O cuidado com o solo, a água, a diversidade e o trabalho das famílias ajuda a tornar a produção mais sustentável.', progress: state.forestProduceHarvested + '/' + state.forestProduceTotal + ' caixas colhidas' },
    transport: { eyebrow: 'FASE 04 · TRANSPORTE DA PRODUÇÃO', title: 'Acompanhe o caminhão até a indústria', description: state.forestTruckLoaded ? 'O caminhão está levando a produção para a agroindústria. Acompanhe a rota até a doca de recebimento.' : 'Leve as caixas colhidas ao pátio de carga e pressione E. O caminhoneiro fará o transporte até a agroindústria.', progress: state.forestTruckLoaded ? 'Carga a caminho da agroindústria' : 'Colheita concluída · caminhão pendente' },
    process: { eyebrow: 'FASE 04 · AGROINDÚSTRIA', title: 'Entenda o processamento e a embalagem', description: 'Na indústria, os alimentos são recebidos, processados e embalados. Observe que a operação também gera resíduos e precisa de controle ambiental.', progress: 'Produção recebida · processamento pendente' },
    market: { eyebrow: 'FASE 04 · COMÉRCIO LOCAL', title: 'Leve os produtos até o mercado', description: 'O caminhão transporta os alimentos embalados até o mercado. Receba a carga e organize os produtos para venda ao consumidor.', progress: 'Produtos processados · recebimento no mercado pendente' },
    sorting: { eyebrow: 'FASE 04 · SEPARAÇÃO NA ORIGEM', title: 'Separe em três fluxos, sem misturar', description: '1) Recicláveis secos: papel/papelão (AZUL), plástico (VERMELHO), vidro (VERDE) e metal (AMARELO), limpos e secos, seguem à cooperativa. 2) Orgânicos (MARROM): restos de comida ficam em balde exclusivo, com tampa, para compostagem em casa ou coleta dedicada quando oferecida. 3) Rejeitos (CINZA): seguem à coleta própria. Nunca coloque comida no saco de papelão, nas embalagens ou na carga de recicláveis.', progress: state.forestPackagingSorted + '/' + state.forestPackagingTotal + ' categorias separadas' },
    cooperative: { eyebrow: 'FASE 04 · COOPERATIVA RAÍZES DA FLORESTA', title: 'Veja como funciona a triagem cooperativa', description: 'Esta cooperativa recebe papel/papelão, plástico, vidro e metal secos. Orgânicos NÃO entram nessa carga: quando a cooperativa também oferece compostagem, fornece um balde separado e faz retirada em rota e frequência próprias, combinadas conforme volume gerado e capacidade do serviço. Sem esse serviço, use uma composteira doméstica ou siga a orientação municipal. Rejeitos seguem outra rota.', progress: state.forestCooperativeDelivered ? 'Quatro grupos recicláveis recebidos' : 'Separação concluída · entrega dos recicláveis secos pendente' },
    restore: { eyebrow: 'FASE 04 · RESTAURAÇÃO ECOLÓGICA', title: 'Proteja a floresta e acompanhe a vida', description: 'Plante três mudas nativas, proteja a nascente e registre a fauna. Restauração exige espécies adequadas, continuidade e monitoramento — não acontece apenas no dia do plantio.', progress: state.forestSeedlingsPlanted + '/' + state.forestSeedlingsTotal + ' mudas · ' + (state.forestSpringProtected ? 'nascente protegida' : 'nascente pendente') + ' · ' + (state.forestWildlifeRecorded ? 'fauna registrada' : 'monitoramento pendente') + ' · ' + (state.forestFirePreventionInspected ? 'prevenção verificada' : 'prevenção pendente') },
    complete: { eyebrow: 'FASE 04 · RESERVA FLORESTAL', title: 'A floresta e a comunidade estão conectadas', description: 'Você investigou habitats, acompanhou a agricultura familiar, transporte, indústria, mercado, destinação de resíduos e ações de restauração da reserva.', progress: 'Fase concluída' },
  }[state.forestMissionStage];


  const coastalMission = {
    survey: { eyebrow: 'FASE 05 · BACIA E ESTUÁRIO', title: 'Siga o caminho da água até o mar', description: 'Investigue os três marcos: trecho a montante, estuário influenciado pelas marés e margem do manguezal. O que acontece longe da praia também pode chegar à costa.', progress: state.coastalSitesInspected + '/' + state.coastalSitesTotal + ' trechos investigados' },
    cleanup: { eyebrow: 'FASE 05 · RESÍDUOS NA PRAIA', title: 'Recolha apenas materiais comuns e seguros', description: 'Encontre quatro objetos identificados: caixa de papelão limpa, garrafa PET, garrafa de vidro inteira e lata de alumínio vazia. Não toque em cacos, óleo, animais ou materiais desconhecidos.', progress: state.coastalWasteCollected + '/' + state.coastalWasteTotal + ' objetos recolhidos' },
    sorting: { eyebrow: 'FASE 05 · COLETA SELETIVA COSTEIRA', title: 'Separe cada material pela categoria correta', description: 'Papel/papelão limpo (AZUL), plástico (VERMELHO), vidro de embalagem inteiro (VERDE) e metal (AMARELO). As cores seguem o padrão nacional, mas confira também o nome e o exemplo de cada recipiente.', progress: state.coastalWasteSorted + '/' + state.coastalWasteTotal + ' materiais separados' },
    restore: { eyebrow: 'FASE 05 · RESTAURAÇÃO DE MANGUEZAL', title: 'Plante apenas nos pontos planejados', description: 'Registre três pontos de plantio previamente demarcados. Na vida real, espécies, faixa de maré, hidrologia e solo precisam ser avaliados com especialistas e comunidades; plantar mudas sem restaurar essas condições não recupera o ecossistema.', progress: state.coastalMangrovesPlanted + '/' + state.coastalMangrovesTotal + ' pontos de plantio realizados' },
    monitor: { eyebrow: 'FASE 05 · MONITORAMENTO COSTEIRO', title: 'Observe a fauna e registre a água', description: 'Use os postos de observação sem tocar, capturar ou alimentar animais. Registre o ponto de monitoramento da água: amostras reais e análises precisam ser realizadas por equipes capacitadas. Água aparentemente limpa não comprova segurança.', progress: state.coastalWildlifeRecorded + '/' + state.coastalWildlifeTotal + ' observações · ' + (state.coastalWaterMonitoringComplete ? 'ponto de água registrado' : 'ponto de água pendente') },
    complete: { eyebrow: 'FASE 05 · ZONA COSTEIRA', title: 'A costa está mais bem compreendida e protegida', description: 'Você conectou a bacia, o estuário, o manguezal, a praia, a separação de resíduos e o monitoramento da biodiversidade.', progress: 'Fase concluída' },
  }[state.coastalMissionStage];

  const mission = state.phase === 1 ? phaseOneMission : state.phase === 2 ? portMission : state.phase === 3 ? peripheryMission : state.phase === 4 ? forestMission : coastalMission;
  const interactionLabel = state.nearbyLabel.replace(/^([EF]) · /, 'TOQUE · ');
  const mobileActionLabel = state.nearbyAction === 'enter-vehicle' ? 'ENTRAR'
    : state.nearbyAction === 'exit-vehicle' ? 'SAIR'
      : state.nearbyAction === 'collect-company-waste' ? 'COLETAR'
        : state.nearbyAction === 'deliver-cooperative' ? 'DESCARREGAR'
          : state.nearbyAction === 'sort-cooperative-materials' ? 'SEPARAR'
        : state.nearbyAction === 'collect-community-waste' ? 'RECOLHER'
          : state.nearbyAction === 'sort-community-organics' ? 'ORGÂNICOS'
            : state.nearbyAction === 'sort-community-recyclables' ? 'RECICLAR'
              : state.nearbyAction === 'turn-community-compost' ? 'REVOLVER'
                : state.nearbyAction === 'connect-community-sewer' ? 'CONECTAR'
                  : state.nearbyAction === 'build-rain-garden' ? 'CONSTRUIR'
                    : state.nearbyAction === 'inspect-forest-habitat' ? 'INVESTIGAR'
                      : state.nearbyAction === 'harvest-farm-produce' ? 'COLHER'
                        : state.nearbyAction === 'load-farm-truck' ? 'CARREGAR'
                          : state.nearbyAction === 'process-food-products' ? 'PROCESSAR'
                            : state.nearbyAction === 'stock-local-market' ? 'RECEBER'
                              : state.nearbyAction === 'sort-consumer-packaging' ? 'SEPARAR'
                                : state.nearbyAction === 'deliver-forest-cooperative' ? 'ENTREGAR'
                                  : state.nearbyAction === 'plant-native-seedling' ? 'PLANTAR'
                                    : state.nearbyAction === 'protect-forest-spring' ? 'PROTEGER'
                                      : state.nearbyAction === 'record-forest-wildlife' ? 'REGISTRAR'
                                        : state.nearbyAction === 'inspect-forest-fire-prevention' ? 'CONFERIR'
                                        : state.nearbyAction === 'inspect-coastal-site' ? 'INVESTIGAR'
                                          : state.nearbyAction === 'collect-coastal-waste' ? 'RECOLHER'
                                            : state.nearbyAction === 'sort-coastal-waste' ? 'SEPARAR'
                                              : state.nearbyAction === 'plant-coastal-mangrove' ? 'PLANTAR'
                                                : state.nearbyAction === 'record-coastal-wildlife' ? 'OBSERVAR'
                                                  : state.nearbyAction === 'sample-coastal-water' ? 'REGISTRAR' : 'AÇÃO';

  return <main className="game-shell">
    <canvas ref={canvasRef} className="game-canvas" tabIndex={0} aria-label="Mundo 3D jogável de GREEN CITY" />

    <header className="topbar">
      <div className="brand">
        <img className="brand-mark brand-mark-image" src="/brand/green-city-logo.webp" alt="Logotipo oficial GREEN CITY — Cidade Verde" />
        <div><strong>GREEN CITY</strong><small>CIDADE SUSTENTÁVEL · FASE 0{state.phase}/10</small></div>
      </div>
      <button type="button" className="campaign-return-button" onClick={() => void handleReturnToCampaign()}>VOLTAR AO MAPA DA CIDADE</button>
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
      {state.phase === 3 && state.peripheryMissionStage === 'complete' && <div className="success-line">✓ PERIFERIA VERDE RECUPERADA · REGIÃO 04 LIBERADA</div>}
    </section>

    {!gameReady && !gameError && <div className="loading-overlay"><div className="loading-box"><span className="loading-spinner" /> Preparando o mundo de GREEN CITY…</div></div>}
    {gameError && <div className="error-overlay"><div className="welcome-panel"><div className="eyebrow">ERRO AO CARREGAR O MUNDO 3D</div><h2>Não foi possível iniciar a cidade.</h2><p>{gameError}</p><small>Atualize a página. Se o problema continuar, envie esta mensagem para a equipe técnica.</small></div></div>}


    {state.learningNotice && <aside className="learning-notice-layer" aria-live="polite">
      <section className="learning-notice-card" role="dialog" aria-label="Explicação educativa do resíduo">
        <div className="learning-notice-heading">
          <div><div className="eyebrow">{state.learningNotice.eyebrow}</div><h2>{state.learningNotice.title}</h2></div>
          <button type="button" aria-label="Fechar explicação" onClick={() => gameRef.current?.dismissLearningNotice()}>×</button>
        </div>
        <p>{state.learningNotice.description}</p>
        <div className="learning-notice-step"><b>ONDE COLOCAR</b><span>{state.learningNotice.destination}</span></div>
        <div className="learning-notice-step"><b>O QUE ACONTECE DEPOIS</b><span>{state.learningNotice.afterwards}</span></div>
        <button type="button" className="learning-notice-continue" onClick={() => gameRef.current?.dismissLearningNotice()}>ENTENDI · CONTINUAR</button>
      </section>
    </aside>}

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

    <div className="vehicle-status">{state.phase === 5 ? 'ZONA COSTEIRA · EXPLORAÇÃO A PÉ' : state.phase === 4 ? (state.forestTruckLoaded && !state.forestMarketStocked ? 'LOGÍSTICA RURAL · CAMINHÃO DE PRODUÇÃO' : 'RESERVA FLORESTAL · EXPLORAÇÃO A PÉ') : state.phase === 3 ? 'PERIFERIA VERDE · EXPLORAÇÃO A PÉ' : state.phase === 2
      ? state.inVehicle
        ? state.portMissionStage === 'deliver' ? `CAMINHÃO · DESTINO: COOPERATIVA · ${state.vehicleSpeed} KM/H` : `CAMINHÃO DE COLETA · ${state.vehicleSpeed} KM/H`
        : state.portMissionStage === 'deliver' ? 'CARGA A BORDO · RETORNE AO CAMINHÃO' : 'CAMINHÃO DE COLETA · APROXIME-SE PARA ENTRAR'
      : state.inVehicle ? `${state.electricVehicle ? 'ELÉTRICO' : 'DIESEL'} · ${state.vehicleSpeed} KM/H` : state.electricVehicle ? 'VEÍCULO MUNICIPAL ELÉTRICO' : 'VEÍCULO MUNICIPAL A DIESEL'}</div>

    <div className={"minimap " + (state.phase === 2 ? "minimap-port" : state.phase === 3 ? "minimap-periphery" : state.phase === 4 ? "minimap-forest" : state.phase === 5 ? "minimap-coastal" : "minimap-city")} aria-label="Minimapa com os objetivos da etapa atual">
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
      {state.phase < 4 && <span className={state.electricVehicle ? "map-vehicle map-vehicle-electric" : "map-vehicle"}
        style={{ left: Math.max(8, Math.min(92, 50 + state.vehicleX * 0.75)) + "%", top: Math.max(8, Math.min(92, 50 + state.vehicleZ * 0.75)) + "%" }}
        title={state.phase === 2 ? "Caminhão de coleta · posição atual" : "Veículo municipal · posição atual"} />}
      <span className="map-player" style={{ left: Math.max(8, Math.min(92, 50 + state.playerX * 0.75)) + "%", top: Math.max(8, Math.min(92, 50 + state.playerZ * 0.75)) + "%" }} />
      <div className="map-route-caption">
        <small>SIGA O MAPA</small>
        <strong>{state.nextObjectiveLabel}</strong>
      </div>
    </div>

    <button className="plan-button" onClick={() => setShowPlan(true)}>PLANO URBANO</button>
    <button className="map-button" onClick={() => { setMapTab('objectives'); gameRef.current?.setMapOpen(!state.mapOpen); }}>M · MAPA DE OBJETIVOS</button>
    <div className="bottom-left"><span className="dot" /> {replayMode ? "REPLAY DA FASE · PROGRESSO ORIGINAL PRESERVADO" : "CAMPANHA INDIVIDUAL · PROGRESSO SALVO"}</div>

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
        <button type="button" className="world-map-close welcome-back" onClick={() => setShowHelp(false)}>VOLTAR AO JOGO</button>
        <div className="welcome-topline">
          <div className="welcome-logo"><img src="/brand/green-city-logo.webp" alt="Logotipo oficial GREEN CITY — Cidade Verde" /><div><b>GREEN CITY</b><small>JOGO DE TRANSFORMAÇÃO AMBIENTAL</small></div></div>
          <span className="phase-pill">FASE {String(startingPhase).padStart(2, "0")} DE 10 · {CITY_NEIGHBORHOODS[startingPhase - 1].name.toUpperCase()}</span>
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
        <button className="start-game-button" onClick={() => startGameAtPhase(startingPhase)}>JOGAR FASE {String(startingPhase).padStart(2, "0")} <span>▶</span></button>
        {developerMode && <section className="dev-console" aria-label="Painel de testes do desenvolvedor">
          <div className="dev-console-heading">
            <div>
              <div className="eyebrow">ACESSO LOCAL · MODO DE DESENVOLVIMENTO</div>
              <h3>Painel de testes da campanha</h3>
              <p>Teste as cinco regiões que já possuem cenário 3D e abra o configurador pedagógico das cinco fases seguintes.</p>
            </div>
            <span className="dev-mode-tag">TESTE</span>
          </div>
          <div className="dev-console-grid">
            {CITY_NEIGHBORHOODS.map((neighborhood, index) => {
              const phase = index + 1;
              const implemented = phase <= 5;
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
                  <button type="button" onClick={() => startGameAtPhase(phase as 1 | 2 | 3 | 4 | 5)}>ABRIR FASE {String(phase).padStart(2, '0')}</button>
                  <label><input type="checkbox" checked={completed} onChange={(event) => setDeveloperPhaseMark(phase, event.currentTarget.checked)} /> Marcar como validada</label>
                </div> : <div className="dev-phase-actions">
                  <button type="button" onClick={() => void openMasterPhaseConfig(phase)}>CONFIGURAR MÓDULO</button>
                  <p>Conteúdo editável no Estúdio Master; cenário 3D ainda em construção.</p>
                </div>}
              </article>;
            })}
          </div>
          <p className="dev-console-note">Este painel aparece somente para a conta Master autenticada. O progresso do checklist de testes fica neste navegador; as configurações pedagógicas das dez fases são salvas no banco. Aprovar o conteúdo não significa que o cenário 3D esteja implementado.</p>
        </section>}
        <div className="welcome-foot"><span className="desktop-only">WASD · MOVIMENTAR</span><span className="desktop-only">E · INTERAGIR</span><span className="desktop-only">M · MAPA DA CIDADE</span><span className="mobile-only">JOYSTICK · MOVER</span><span className="mobile-only">TOQUE · AÇÃO</span><span className="mobile-only">ARRASTE · CÂMERA · PINÇA · ZOOM</span><span>SEM INSTALAÇÃO · JOGA NO NAVEGADOR</span></div>
      </div>
    </div>}

    {state.mapOpen && <div className="world-map-overlay">
      {mapTab === 'objectives' ? <section className="world-map-panel objective-map-panel">
        <div className="world-map-tools">
          <button className="world-map-switch" onClick={() => setMapTab('city')}>VER MAPA GERAL DA CIDADE</button>
          <button className="world-map-close" onClick={() => gameRef.current?.setMapOpen(false)}>VOLTAR AO JOGO</button>
        </div>
        <div className="eyebrow">GREEN CITY · FASE 0{state.phase} · ROTA DA ETAPA</div>
        <h2>{mission.title}</h2>
        <p>Os pontos da etapa estão marcados no mapa. O amarelo indica o próximo destino; os demais pontos mostram o que já foi feito e o que ainda falta. Você continua responsável por investigar e decidir a solução ambiental.</p>
        <div className="objective-map-layout">
          <div className={"objective-map-board " + (state.phase === 2 ? "objective-map-board--port" : state.phase === 3 ? "objective-map-board--periphery" : state.phase === 4 ? "objective-map-board--forest" : state.phase === 5 ? "objective-map-board--coastal" : "objective-map-board--city")}>
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
            {state.phase !== 4 && <span className="objective-map-vehicle"
              style={{ left: Math.max(3, Math.min(97, 50 + state.vehicleX * 0.98)) + "%", top: Math.max(3, Math.min(97, 50 + state.vehicleZ * 0.98)) + "%" }}
              title={state.phase === 2 ? "Caminhão" : "Veículo municipal"}>V</span>}
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
          <button className="world-map-close" onClick={() => gameRef.current?.setMapOpen(false)}>VOLTAR AO JOGO</button>
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
              const canReplayCompleted = completed && index < 5;
              const canEnterPort = (available && index === 1 && state.phase === 1) || (isMaster && index === 1 && state.phase !== 2);
              const canEnterPeriphery = (available && index === 2 && state.phase === 2 && state.portMissionStage === 'complete') || (isMaster && index === 2 && state.phase !== 3);
              const canEnterForest = (available && index === 3 && state.phase === 3 && state.peripheryMissionStage === 'complete') || (isMaster && index === 3 && state.phase !== 4);
              const canEnterCoastal = (available && index === 4 && state.phase === 4 && state.forestMissionStage === 'complete') || (isMaster && index === 4 && state.phase !== 5);
              const canMasterTest = isMaster && index === 0 && state.phase !== 1;
              const canConfigure = isMaster && index >= 5;
              const masterAccessible = canEnterPort || canEnterPeriphery || canEnterForest || canEnterCoastal || canMasterTest || canConfigure;
              const status = canConfigure ? 'CONFIGURAR MÓDULO' : completed ? 'RECUPERADO · REVER' : current ? 'FASE ATIVA' : isMaster && masterAccessible ? 'TESTE MASTER' : available ? 'LIBERADO' : 'BLOQUEADO';
              const canOpen = canReplayCompleted || canEnterPort || canEnterPeriphery || canEnterForest || canEnterCoastal || canMasterTest;
              return <button type="button"
                className={"district-card " + (completed ? "district-complete " : "") + (current ? "district-current " : "") + ((available || masterAccessible || canReplayCompleted) ? "district-available " : "") + (!completed && !current && !available && !masterAccessible ? "district-locked" : "")}
                key={neighborhood.id} disabled={!canOpen && !canConfigure}
                onClick={() => {
                  if (canConfigure) void openMasterPhaseConfig(index + 1);
                  else if (canOpen) void handleOpenPhase((index + 1) as 1 | 2 | 3 | 4 | 5);
                }}>
                <div className="district-card-top"><span>FASE {String(index + 1).padStart(2, '0')}</span><b>{status}</b></div>
                <div className="district-map-icon">{completed ? '✓' : neighborhood.icon}</div>
                <h3>{neighborhood.name}</h3>
                <div className="district-theme">{neighborhood.theme}</div>
                <p>{neighborhood.challenge}</p>
                <small>{canConfigure ? 'Abrir configuração pedagógica no Estúdio Master · cenário 3D em construção' : completed ? 'Clique para visualizar o progresso salvo ou iniciar uma nova partida' : current ? 'Você está nesta região' : canEnterPort ? 'Clique para entrar na Fase 02' : canEnterPeriphery ? 'Clique para entrar na Fase 03' : canEnterForest ? 'Clique para entrar na Fase 04' : canEnterCoastal ? 'Clique para entrar na Fase 05' : available ? 'Próxima região liberada' : neighborhood.unlockLabel}</small>
              </button>;
            })}
          </div>
        </div>
        <div className="city-map-footer">
          <span><i className="legend-dot active" /> Fase atual</span><span><i className="legend-dot available" /> Liberado</span><span><i className="legend-dot locked" /> Bloqueado</span>
        </div>
        <p className="map-disclaimer">O mapa é uma representação fictícia da cidade. Nesta versão, Centro Industrial, Porto, Periferia Verde, Reserva Florestal e Zona Costeira possuem cenários 3D jogáveis. As fases 06 a 10 permanecem em desenvolvimento.</p>
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
        <button className="learning-back-button" onClick={() => { setPhaseCompleteSeen(true); setPhaseCompleteOpen(false); }}>VOLTAR À FASE</button>
        <button className="learning-back-button" onClick={() => void handleReplayPhase(1)}>JOGAR NOVAMENTE · PRESERVAR PROGRESSO</button>
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
        <button className="learning-back-button" onClick={() => { setPortCompleteSeen(true); setPhaseCompleteOpen(false); }}>VOLTAR À FASE</button>
        <button className="learning-back-button" onClick={() => void handleReplayPhase(2)}>JOGAR NOVAMENTE · PRESERVAR PROGRESSO</button>
        <button className="start-game-button" onClick={() => { setPortCompleteSeen(true); setPhaseCompleteOpen(false); setMapTab('city'); gameRef.current?.setMapOpen(true); }}>AVANÇAR · VER PRÓXIMA REGIÃO <span>→</span></button>
      </section>
    </div>}


    {state.phase === 3 && state.peripheryMissionStage === 'complete' && phaseCompleteOpen && !peripheryCompleteSeen && <div className="phase-complete-overlay">
      <section className="phase-complete-panel learning-report">
        <div className="completion-medal">✓</div>
        <div className="eyebrow">CADERNO DE APRENDIZADO · FASE 03 DE 10</div>
        <h2>A Periferia Verde está se transformando!</h2>
        <p>Você observou os desafios da comunidade, reconheceu os tipos de resíduos e acompanhou o caminho dos orgânicos até o composto usado nos canteiros.</p>
        <div className="completion-stats"><span>3 pontos investigados</span><span>{state.communityWasteTotal} objetos identificados</span><span>{state.communityOrganicTotal} orgânicos encaminhados</span><span>{state.communityRecyclableTotal} recicláveis separados</span><span>2 ligações sanitárias</span><span>1 jardim de chuva</span></div>
        <div className="learning-report-grid">
          <article className="learning-report-card"><small>RESÍDUO ORGÂNICO</small><h3>Casca de banana e restos de frutas</h3><p>Esses materiais são restos de alimentos. Separados de embalagens, podem entrar na composteira junto com folhas secas e outros materiais vegetais. Eles não devem ir para o recipiente de recicláveis.</p></article>
          <article className="learning-report-card"><small>RECICLÁVEIS SECOS</small><h3>Garrafa PET, lata e vidro</h3><p>São objetos feitos de plástico, metal e vidro. Vazios, limpos e secos, seguem a coleta seletiva e a triagem. A cooperativa prepara os materiais que recebe; a transformação em novos produtos depende da etapa industrial.</p></article>
          <article className="learning-report-card"><small>COMPOSTAGEM</small><h3>Da composteira para os canteiros</h3><p>Microrganismos e outros decompositores transformam os restos orgânicos ao longo do tempo. A mistura exige materiais secos, umidade e aeração. Só depois da maturação o composto adequado pode retornar ao solo e ajudar no cultivo de hortaliças e flores.</p></article>
          <article className="learning-report-card"><small>SANEAMENTO BÁSICO</small><h3>Esgoto sanitário tem sua própria rede</h3><p>O esgoto dos banheiros deve ser coletado e encaminhado a sistema de tratamento adequado. A rede de esgoto não é a mesma infraestrutura que conduz a água da chuva, e uma ligação de rede não substitui o tratamento.</p></article>
          <article className="learning-report-card"><small>DRENAGEM URBANA</small><h3>Jardim de chuva ajuda a manejar o escoamento</h3><p>Uma área vegetada e preparada pode reter parte da água da chuva e favorecer a infiltração onde as condições do solo, do lençol freático e da contaminação permitem. Ela não resolve enchentes sozinha nem recebe esgoto.</p></article>
          <article className="learning-report-card learning-report-card--result"><small>O QUE APRENDEMOS</small><h3>Infraestrutura funciona em conjunto</h3><p>Coleta, compostagem, saneamento e drenagem resolvem problemas diferentes. A comunidade pode participar, mas redes, operação, manutenção, monitoramento e serviços públicos também são necessários.</p></article>
        </div>
        <div className="learning-question"><b>DESAFIO PARA PENSAR</b><span>Por que a água da chuva que escorre pelas ruas não deve ser misturada com o esgoto dos banheiros?</span></div>
        <div className="learning-next"><small>PRÓXIMA ETAPA · FASE 04</small><b>Reserva Florestal: biodiversidade, habitats e corredores ecológicos.</b><span>Agora vamos compreender como plantas, animais e ambientes naturais dependem uns dos outros.</span></div>
        <button className="learning-back-button" onClick={() => { setPeripheryCompleteSeen(true); setPhaseCompleteOpen(false); }}>VOLTAR À FASE</button>
        <button className="learning-back-button" onClick={() => void handleReplayPhase(3)}>JOGAR NOVAMENTE · PRESERVAR PROGRESSO</button>
        <button className="start-game-button" onClick={() => { setPeripheryCompleteSeen(true); setPhaseCompleteOpen(false); setMapTab('city'); gameRef.current?.setMapOpen(true); }}>AVANÇAR · VER MAPA DA CIDADE <span>→</span></button>
      </section>
    </div>}


    {state.phase === 4 && state.forestMissionStage === 'complete' && phaseCompleteOpen && !forestCompleteSeen && <div className="phase-complete-overlay">
      <section className="phase-complete-panel learning-report">
        <div className="completion-medal">✓</div>
        <div className="eyebrow">CADERNO DE APRENDIZADO · FASE 04 DE 10</div>
        <h2>A Reserva Florestal está mais protegida!</h2>
        <p>Você investigou habitats, acompanhou a cadeia da agricultura familiar, verificou a prevenção de incêndios e participou da recuperação ecológica da reserva.</p>
        <div className="completion-stats"><span>3 habitats investigados</span><span>3 caixas colhidas</span><span>1 transporte até a indústria</span><span>1 entrega à cooperativa</span><span>3 mudas plantadas</span></div>
        <div className="learning-report-grid">
          <article className="learning-report-card"><small>BIODIVERSIDADE</small><h3>Habitat é mais que árvores</h3><p>Animais, plantas, água, solo e relações entre espécies formam o ecossistema. Fragmentos conectados podem facilitar o deslocamento e a troca entre populações.</p></article>
          <article className="learning-report-card"><small>AGRICULTURA FAMILIAR</small><h3>Produção local e responsabilidade</h3><p>Famílias produtoras cultivam e colhem alimentos. O cuidado com o solo, a água, a diversidade e a redução de perdas ajuda a tornar a produção mais sustentável.</p></article>
          <article className="learning-report-card"><small>CADEIA PRODUTIVA</small><h3>Do campo ao mercado</h3><p>O caminhoneiro transporta a produção até a agroindústria. A indústria processa e embala; o mercado comercializa; e os consumidores precisam separar os resíduos após o uso.</p></article>
          <article className="learning-report-card"><small>SEPARAÇÃO NA ORIGEM</small><h3>Três fluxos: secos, orgânicos e rejeitos</h3><p>Papel/papelão (azul), plástico (vermelho), vidro (verde) e metal (amarelo) devem ficar limpos e secos e seguem à Cooperativa Raízes da Floresta para triagem. Restos de comida (marrom) ficam em balde próprio, separados dos recicláveis, para composteira doméstica ou coleta exclusiva de orgânicos quando houver. Se a cooperativa oferecer esse serviço, a retirada do balde acontece em frequência e rota próprias, ajustadas ao volume e à capacidade operacional. Rejeitos gerais (cinza) seguem outra destinação. A cooperativa não é a fábrica recicladora.</p></article>
          <article className="learning-report-card"><small>PREVENÇÃO DE INCÊNDIOS</small><h3>Prevenir é proteger</h3><p>Mapear riscos, evitar queimadas, manter alerta e comunicar sinais de fumaça são medidas importantes. O combate deve ser feito por equipes treinadas e com segurança.</p></article>
          <article className="learning-report-card learning-report-card--result"><small>RESTAURAÇÃO E MONITORAMENTO</small><h3>Plantar é o começo do trabalho</h3><p>Proteger nascentes, recuperar vegetação ciliar e acompanhar mudas e fauna exige continuidade. O resultado ambiental precisa ser monitorado ao longo do tempo.</p></article>
        </div>
        <div className="learning-question"><b>DESAFIO PARA PENSAR</b><span>Por que embalagens recicláveis e restos de alimentos precisam ser separados, e como a cadeia de produção pode proteger a floresta?</span></div>
        <div className="learning-next"><small>PRÓXIMA ETAPA · FASE 05</small><b>Zona Costeira: rios, manguezais e oceanos.</b><span>Vamos conectar o cuidado com a floresta à proteção das águas e dos ambientes costeiros.</span></div>
        <button className="learning-back-button" onClick={() => { setForestCompleteSeen(true); setPhaseCompleteOpen(false); }}>VOLTAR À FASE</button>
        <button className="learning-back-button" onClick={() => void handleReplayPhase(4)}>JOGAR NOVAMENTE · PRESERVAR PROGRESSO</button>
        <button className="start-game-button" onClick={() => { setForestCompleteSeen(true); setPhaseCompleteOpen(false); setMapTab('city'); gameRef.current?.setMapOpen(true); }}>AVANÇAR · VER MAPA DA CIDADE <span>→</span></button>
      </section>
    </div>}


    {state.phase === 5 && state.coastalMissionStage === 'complete' && phaseCompleteOpen && !coastalCompleteSeen && <div className="phase-complete-overlay">
      <section className="phase-complete-panel learning-report">
        <div className="completion-medal">✓</div>
        <div className="eyebrow">CADERNO DE APRENDIZADO · FASE 05 DE 10</div>
        <h2>A Zona Costeira está mais bem protegida!</h2>
        <p>Você acompanhou a água desde a bacia até o mar, separou resíduos da praia, participou do plantio orientado de manguezal e registrou observações ambientais.</p>
        <div className="completion-stats"><span>3 trechos investigados</span><span>4 materiais recolhidos e separados</span><span>3 pontos de plantio registrados</span><span>2 observações de fauna</span><span>1 ponto de monitoramento da água</span></div>
        <div className="learning-report-grid">
          <article className="learning-report-card"><small>BACIA HIDROGRÁFICA</small><h3>O rio conecta o território ao oceano</h3><p>A água escoa por uma área de contribuição. Sedimentos e poluentes podem vir de áreas distantes, por isso proteger a praia também exige prevenção e controle das fontes a montante.</p></article>
          <article className="learning-report-card"><small>ESTUÁRIO</small><h3>Um ambiente de transição</h3><p>O estuário recebe água doce e sofre influência das marés. Salinidade, sedimentos e condições do habitat variam no espaço e no tempo.</p></article>
          <article className="learning-report-card"><small>MANGUEZAL</small><h3>Habitat e proteção costeira</h3><p>Manguezais oferecem abrigo, áreas de alimentação e reprodução para muitas espécies. Suas raízes e vegetação ajudam a estabilizar margens; a restauração precisa respeitar espécies nativas, marés e hidrologia local.</p></article>
          <article className="learning-report-card"><small>RESÍDUOS NA PRAIA</small><h3>Separar cada material</h3><p>Papel/papelão (azul), plástico (vermelho), vidro de embalagem inteiro (verde) e metal (amarelo) foram separados em recipientes identificados. A triagem organiza materiais para transporte e beneficiamento; não significa reciclagem instantânea.</p></article>
          <article className="learning-report-card learning-report-card--result"><small>MONITORAMENTO</small><h3>Aparência não comprova qualidade</h3><p>O ponto registrado no jogo é educativo. A segurança da água depende de amostragem, análises laboratoriais e monitoramento feito por profissionais; um único ponto não representa toda a bacia.</p></article>
        </div>
        <div className="learning-question"><b>DESAFIO PARA PENSAR</b><span>Por que recolher resíduos da praia não substitui o controle da poluição ao longo do rio e da bacia hidrográfica?</span></div>
        <div className="learning-next"><small>PRÓXIMA ETAPA · FASE 06</small><b>Cinturão Agrícola: solo, água e produção sustentável.</b><span>Agora vamos observar como as escolhas de produção e manejo do solo também influenciam rios e biodiversidade.</span></div>
        <button className="learning-back-button" onClick={() => { setCoastalCompleteSeen(true); setPhaseCompleteOpen(false); }}>VOLTAR À FASE</button>
        <button className="learning-back-button" onClick={() => void handleReplayPhase(5)}>JOGAR NOVAMENTE · PRESERVAR PROGRESSO</button>
        <button className="start-game-button" onClick={() => { setCoastalCompleteSeen(true); setPhaseCompleteOpen(false); setMapTab('city'); gameRef.current?.setMapOpen(true); }}>VER MAPA DA CIDADE <span>→</span></button>
      </section>
    </div>}

    {showPlan && <div className="world-map-overlay">
      <section className="world-map-panel plan-panel">
        <button className="world-map-close" onClick={() => setShowPlan(false)}>VOLTAR AO JOGO</button>
        <div className="eyebrow">{state.phase === 1 ? 'CENTRO INDUSTRIAL' : state.phase === 2 ? 'PORTO' : state.phase === 3 ? 'PERIFERIA VERDE' : state.phase === 4 ? 'RESERVA FLORESTAL' : 'ZONA COSTEIRA'} · GESTÃO DA REGIÃO</div>
        <h2>{state.phase === 1 ? 'Missões de recuperação do bairro' : state.phase === 2 ? 'Missões de recuperação do Porto' : state.phase === 3 ? 'Missões de recuperação da comunidade' : state.phase === 4 ? 'Missões da reserva e da cadeia de alimentos' : 'Missões da Zona Costeira'}</h2>
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
        </> : state.phase === 2 ? <>
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
        </> : state.phase === 3 ? <>
          <div className="metrics-grid">
            <Metric label="Pontos do bairro investigados" value={Math.round(state.communityIssuesInspected / state.communityIssuesTotal * 100)} />
            <Metric label="Coleta comunitária" value={Math.round(state.communityWasteCollected / state.communityWasteTotal * 100)} />
            <Metric label="Orgânicos na composteira" value={Math.round(state.communityOrganicDeposited / state.communityOrganicTotal * 100)} />
            <Metric label="Recicláveis na coleta seletiva" value={Math.round(state.communityRecyclableDeposited / state.communityRecyclableTotal * 100)} />
            <Metric label="Ligações sanitárias" value={Math.round(state.communitySewerConnections / state.communitySewerTotal * 100)} />
            <Metric label="Jardim de chuva" value={state.communityRainGardenBuilt ? 100 : 0} />
          </div>
          <div className="upgrade-grid">
            <article className="upgrade-card"><div className="eyebrow">COMPOSTEIRA E CANTEIROS</div><h3>{state.communityCompostTurned ? 'Composto maturado aplicado aos canteiros' : '2 resíduos orgânicos aguardando manejo'}</h3><p>Cascas de banana e restos de frutas entram na composteira junto com folhas secas e materiais vegetais. Microrganismos decompõem a mistura com umidade e oxigênio. Quando maturado, o composto ajuda a melhorar o solo para hortaliças, flores e plantas.</p></article>
            <article className="upgrade-card"><div className="eyebrow">RECICLÁVEIS SECOS</div><h3>{state.communityRecyclableDeposited}/{state.communityRecyclableTotal} objetos separados</h3><p>A garrafa PET, a lata de alumínio e a garrafa de vidro seguem para coleta seletiva e triagem. A separação não significa reciclagem imediata: o material ainda precisa de encaminhamento e transformação industrial.</p></article>
            <article className="upgrade-card"><div className="eyebrow">SANEAMENTO</div><h3>{state.communitySewerConnections}/{state.communitySewerTotal} moradias conectadas</h3><p>As ligações simuladas conduzem esgoto sanitário para a rede própria. O tratamento e a operação do sistema continuam necessários; isso não é a rede pluvial.</p></article>
            <article className="upgrade-card"><div className="eyebrow">DRENAGEM PLUVIAL</div><h3>{state.communityRainGardenBuilt ? 'Jardim de chuva implantado' : 'Área de escoamento a tratar'}</h3><p>Jardins de chuva podem ajudar a reter e infiltrar parte da chuva em locais tecnicamente adequados. Eles não recebem esgoto e não substituem o sistema de drenagem completo.</p></article>
          </div>
        </> : state.phase === 4 ? <>
          <div className="metrics-grid">
            <Metric label="Habitats investigados" value={Math.round(state.forestHabitatsInspected / state.forestHabitatsTotal * 100)} />
            <Metric label="Colheita familiar" value={Math.round(state.forestProduceHarvested / state.forestProduceTotal * 100)} />
            <Metric label="Processamento e mercado" value={(Number(state.forestProcessed) + Number(state.forestMarketStocked)) * 50} />
            <Metric label="Separação pós-consumo" value={Math.round(state.forestPackagingSorted / state.forestPackagingTotal * 100)} />
            <Metric label="Restauração e prevenção" value={Math.round((state.forestSeedlingsPlanted / state.forestSeedlingsTotal * 55) + (state.forestSpringProtected ? 18 : 0) + (state.forestWildlifeRecorded ? 14 : 0) + (state.forestFirePreventionInspected ? 13 : 0))} />
          </div>
          <div className="upgrade-grid">
            <article className="upgrade-card"><div className="eyebrow">AGRICULTURA FAMILIAR</div><h3>{state.forestProduceHarvested}/{state.forestProduceTotal} caixas colhidas</h3><p>Famílias produtoras cultivam e colhem alimentos. O cuidado com o solo, a água e a vegetação nativa ajuda a manter a produção e os serviços do ecossistema.</p></article>
            <article className="upgrade-card"><div className="eyebrow">AGROINDÚSTRIA E MERCADO</div><h3>{state.forestProcessed ? 'Alimentos processados e embalados' : 'Aguardando processamento'}</h3><p>A indústria recebe a produção, processa, embala e encaminha ao comércio. Os processos industriais também precisam prevenir e destinar corretamente os resíduos gerados.</p></article>
            <article className="upgrade-card"><div className="eyebrow">COOPERATIVA RAÍZES DA FLORESTA</div><h3>{state.forestCooperativeDelivered ? 'Quatro grupos secos recebidos para triagem' : 'Triagem e entrega pendentes'}</h3><p>A cooperativa recebe apenas os recicláveis secos desta rota: papel/papelão, plástico, vidro e metal. Orgânicos ficam em balde fechado e separado para composteira doméstica ou coleta exclusiva, quando oferecida pelo prestador. A retirada pode ser semanal, quinzenal ou mensal conforme volume, logística e acordo local — não é uma frequência nacional fixa. Rejeitos seguem para outro serviço.</p></article>
          </div>
        </> : <>
          <div className="metrics-grid">
            <Metric label="Trechos da bacia investigados" value={Math.round(state.coastalSitesInspected / state.coastalSitesTotal * 100)} />
            <Metric label="Resíduos seguros recolhidos" value={Math.round(state.coastalWasteCollected / state.coastalWasteTotal * 100)} />
            <Metric label="Triagem por material" value={Math.round(state.coastalWasteSorted / state.coastalWasteTotal * 100)} />
            <Metric label="Pontos de restauração do manguezal" value={Math.round(state.coastalMangrovesPlanted / state.coastalMangrovesTotal * 100)} />
            <Metric label="Observação da fauna" value={Math.round(state.coastalWildlifeRecorded / state.coastalWildlifeTotal * 100)} />
            <Metric label="Registro do ponto de água" value={state.coastalWaterMonitoringComplete ? 100 : 0} />
          </div>
          <div className="upgrade-grid">
            <article className="upgrade-card"><div className="eyebrow">BACIA E ESTUÁRIO</div><h3>{state.coastalSitesInspected}/{state.coastalSitesTotal} trechos investigados</h3><p>O curso da água conecta áreas a montante, estuário, manguezal e oceano. Resíduos e poluentes podem chegar à costa mesmo quando sua origem está distante da praia.</p></article>
            <article className="upgrade-card"><div className="eyebrow">RESÍDUOS E TRIAGEM</div><h3>{state.coastalWasteSorted}/{state.coastalWasteTotal} materiais separados</h3><p>O ponto educativo usa azul para papel/papelão, vermelho para plástico, verde para vidro de embalagem inteiro e amarelo para metal. A triagem encaminha os materiais; a reciclagem depende de etapas industriais posteriores.</p></article>
            <article className="upgrade-card"><div className="eyebrow">RESTAURAÇÃO DO MANGUEZAL</div><h3>{state.coastalMangrovesPlanted}/{state.coastalMangrovesTotal} pontos de plantio registrados</h3><p>O sucesso depende de espécies apropriadas, faixa de maré, hidrologia e acompanhamento. O plantio sozinho não comprova que o ecossistema foi recuperado.</p></article>
            <article className="upgrade-card"><div className="eyebrow">FAUNA E ÁGUA</div><h3>{state.coastalWildlifeRecorded}/{state.coastalWildlifeTotal} observações · {state.coastalWaterMonitoringComplete ? 'ponto de água registrado' : 'água pendente'}</h3><p>Observe a fauna à distância e não manipule animais. A aparência da água não atesta segurança: resultados reais exigem coleta, análises e monitoramento por equipes capacitadas.</p></article>
          </div>
        </>}
        {state.phase === 1 && !state.delivered && <div className="plan-hint">Primeiro: recolha os cinco resíduos e entregue a carga no EcoCentro.</div>}
        {state.delivered && state.solarBuildingsInstalled < 3 && <div className="plan-hint">Missão atual: instale energia solar em três prédios. A base do veículo será ativada automaticamente depois da terceira instalação.</div>}
        {state.delivered && state.solarBuildingsInstalled >= 3 && !state.electricVehicle && <div className="plan-hint">A base está ativa. Siga o marcador amarelo no minimapa, estacione completamente, desça e converta o veículo ao lado da vaga.</div>}
        {state.electricVehicle && state.solarBuildingsInstalled < state.solarBuildingsTotal && <div className="plan-hint">O veículo já é elétrico. Continue solarizando os prédios restantes para concluir a fase.</div>}
        {state.phase === 4 && <div className="plan-hint">Regra de separação: recicláveis secos limpos e secos seguem à cooperativa; restos de comida ficam em balde exclusivo ou composteira doméstica; rejeitos têm coleta própria. Se houver serviço de orgânicos, o prestador define a frequência de retirada (semanal, quinzenal ou mensal) conforme volume, rota e capacidade. Nunca misture o balde de orgânicos com a carga seca da cooperativa. Padrão de cores CONAMA 275/2001: azul papel/papelão; vermelho plástico; verde vidro; amarelo metal; marrom orgânicos; cinza rejeito; preto madeira; laranja perigosos; branco serviços de saúde; roxo radioativos.</div>}
        {state.phase === 5 && <div className="plan-hint">A coleta inclui somente resíduos comuns seguros e identificados. Não toque em cacos, óleo, animais ou materiais desconhecidos. Limpar a praia não substitui o controle das fontes ao longo da bacia; registrar um ponto de água no jogo também não é laudo de qualidade.</div>}
                {state.nextNeighborhoodUnlocked && <div className="success-line">✓ METAS DA REGIÃO ATINGIDAS · PRÓXIMA REGIÃO LIBERADA</div>}
        <small className="economy-note">CIT é uma pontuação fictícia do protótipo, sem valor monetário ou possibilidade de saque.</small>
      </section>
    </div>}

    {state.paused && <div className="pause-overlay">
      <div className="welcome-panel">
        <div className="eyebrow">PAUSA</div><h2>A cidade espera.</h2>
        <button onClick={() => gameRef.current?.setPaused(false)}>CONTINUAR <span>→</span></button>
        <button className="pause-back-button" onClick={() => void handleReturnToCampaign()}>VOLTAR AO MAPA DA CIDADE</button>
      </div>
    </div>}
    <button className="help-button" onClick={() => setShowHelp(!showHelp)} aria-label="Ajuda">?</button>
  </main>;
}
