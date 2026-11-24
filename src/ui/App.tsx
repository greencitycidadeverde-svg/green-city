import { useEffect, useRef, useState } from 'react';
import { GreenCityGame } from '../game/Game';
import type { GameSnapshot } from '../game/types';

const initial: GameSnapshot = { cit: 0, collected: 0, total: 5, missionComplete: false, restored: false, paused: false, mapOpen: false, inVehicle: false, vehicleSpeed: 0, playerX: 0, playerZ: 25, message: 'Encontre os resíduos e pressione E para recolher.' };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GreenCityGame | null>(null);
  const [state, setState] = useState(initial);
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = new GreenCityGame(canvasRef.current, setState);
    gameRef.current = game;
    return () => { game.dispose(); gameRef.current = null; };
  }, []);

  return <main className="game-shell">
    <canvas ref={canvasRef} className="game-canvas" tabIndex={0} aria-label="Mundo 3D jogável de GREEN CITY" />
    <header className="topbar">
      <div className="brand"><span className="brand-mark">G</span><div><strong>GREEN CITY</strong><small>FIRST IMPACT · DISTRITO CENTRAL</small></div></div>
      <div className="wallet"><span>CIT SIMULADOS</span><strong>◆ {state.cit.toString().padStart(3, '0')}</strong></div>
    </header>
    <section className="mission-card">
      <div className="eyebrow">MISSÃO ATIVA · OPERAÇÃO RIO LIMPO</div>
      <h1>Recupere o trecho urbano</h1>
      <p>Recolha os resíduos espalhados pelo distrito para iniciar a recuperação ambiental.</p>
      <div className="progress-row"><div className="progress-track"><span style={{ width: `${(state.collected / state.total) * 100}%` }} /></div><b>{state.collected}/{state.total}</b></div>
      {state.missionComplete && <div className="success-line">✓ MISSÃO CONCLUÍDA · ÁREA RECUPERADA</div>}
    </section>
    <div className="status-message">{state.message}</div>
    <div className="vehicle-status">{state.inVehicle ? `VEÍCULO ELÉTRICO · ${state.vehicleSpeed} KM/H` : 'A PÉ · DISTRITO CENTRAL'}</div>
    <button className="map-button" onClick={() => gameRef.current?.setMapOpen(!state.mapOpen)}>M · MAPA</button>
    <div className="minimap" aria-label="Minimapa do distrito"><div className="map-road map-road-v"/><div className="map-road map-road-h"/><div className="map-river"/><span className="map-player" style={{ left: `${Math.max(8, Math.min(92, 50 + state.playerX * 0.75))}%`, top: `${Math.max(8, Math.min(92, 50 + state.playerZ * 0.75))}%` }} /></div>
    <div className="bottom-left"><span className="dot" /> SINGLE PLAYER · PROTÓTIPO WEB</div>
    <div className="controls"><span><b>WASD</b> mover</span><span><b>SHIFT</b> correr</span><span><b>ESPAÇO</b> pular</span><span><b>E</b> recolher</span><span><b>F</b> veículo</span><span><b>M</b> mapa</span><span><b>MOUSE</b> câmera</span><span><b>ESC</b> pausa</span></div>
    {showHelp && <div className="welcome-overlay"><div className="welcome-panel"><div className="eyebrow">PLANT IN REAL LIFE. RULE THE GREEN CITY.</div><h2>Bem-vindo à Green City.</h2><p>Explore o primeiro distrito, recolha os cinco resíduos e veja o ambiente mudar. Esta versão usa CIT fictício, sem valor financeiro.</p><button onClick={() => setShowHelp(false)}>ENTRAR NA CIDADE <span>→</span></button><small>Dica: aproxime-se do carro verde e pressione F para dirigir. Arraste o mouse para girar a câmera.</small></div></div>}
    {state.mapOpen && <div className="world-map-overlay"><section className="world-map-panel"><button className="world-map-close" onClick={() => gameRef.current?.setMapOpen(false)}>FECHAR · M</button><div className="eyebrow">GREEN CITY · MAPA DO DISTRITO</div><h2>Distrito Central</h2><p>Explore ruas, praça, construções e a margem do rio. O marcador mostra sua posição atual.</p><div className="world-map-canvas"><div className="world-map-road vertical"/><div className="world-map-road horizontal"/><div className="world-map-river"/><span className="world-map-block" style={{left:'9%',top:'12%',width:'24%',height:'22%'}}>SETOR COMERCIAL</span><span className="world-map-block" style={{left:'65%',top:'12%',width:'20%',height:'22%'}}>QUADRA RESIDENCIAL</span><span className="world-map-block" style={{left:'9%',top:'64%',width:'25%',height:'22%'}}>PRAÇA CENTRAL</span><span className="world-map-block" style={{left:'63%',top:'65%',width:'21%',height:'20%'}}>ÁREA VERDE</span><span className="world-map-player" style={{left: `${Math.max(8, Math.min(92, 50 + state.playerX * 0.75))}%`, top: `${Math.max(8, Math.min(92, 50 + state.playerZ * 0.75))}%`}} /></div><div className="world-map-legend"><span>● Você</span><span>━ Vias principais</span><span>▰ Edificações</span><span>▰ Rio</span></div></section></div>}
    {state.paused && <div className="pause-overlay"><div className="welcome-panel"><div className="eyebrow">PAUSA</div><h2>Respire. A cidade espera.</h2><button onClick={() => gameRef.current?.setPaused(false)}>CONTINUAR <span>→</span></button></div></div>}
    <button className="help-button" onClick={() => setShowHelp(!showHelp)} aria-label="Ajuda">?</button>
  </main>;
}
