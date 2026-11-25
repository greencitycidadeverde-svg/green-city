import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '../lib/supabase';

type ContentStatus = 'planning' | 'draft' | 'review' | 'approved';
type TextField = 'region_name' | 'theme' | 'challenge' | 'learning_problem' | 'mission_outline' | 'professions' | 'economy_notes' | 'scenario_notes';
type PhaseModuleConfig = {
  phase_number: number;
  region_name: string;
  theme: string;
  challenge: string;
  learning_problem: string;
  learning_goals: string[];
  mission_outline: string;
  professions: string;
  economy_notes: string;
  scenario_notes: string;
  content_status: ContentStatus;
  updated_at: string;
};

const STATUS_LABELS: Record<ContentStatus, string> = {
  planning: 'Planejamento',
  draft: 'Rascunho',
  review: 'Em revisão',
  approved: 'Conteúdo aprovado',
};
const PHASE_ICONS = ['🏭','⚓','🏘️','🌳','🌊','🌾','🏛️','🔬','💧','🦜'];
const MODULE_SELECT = 'phase_number,region_name,theme,challenge,learning_problem,learning_goals,mission_outline,professions,economy_notes,scenario_notes,content_status,updated_at';

export default function MasterPhaseStudio({ initialPhase, onBack }: { initialPhase: number; onBack: () => void }) {
  const [modules, setModules] = useState<PhaseModuleConfig[]>([]);
  const [selectedPhase, setSelectedPhase] = useState(initialPhase);
  const [draft, setDraft] = useState<PhaseModuleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!supabase) {
        setError('A conexão com o banco de dados não está disponível.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      const { data, error: queryError } = await supabase.from('phase_module_configs')
        .select(MODULE_SELECT).order('phase_number', { ascending: true });
      if (cancelled) return;
      if (queryError) {
        setError('Não foi possível carregar os módulos: ' + queryError.message);
        setModules([]);
      } else {
        const rows = (data ?? []) as PhaseModuleConfig[];
        setModules(rows);
        const selected = rows.find((item) => item.phase_number === initialPhase) ?? rows[0] ?? null;
        if (selected) {
          setSelectedPhase(selected.phase_number);
          setDraft({ ...selected, learning_goals: [...(selected.learning_goals ?? [])] });
        } else {
          setError('Nenhuma configuração de fase foi encontrada no banco.');
        }
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [initialPhase]);

  const selectModule = (phase: number) => {
    const selected = modules.find((item) => item.phase_number === phase);
    if (!selected) return;
    setSelectedPhase(phase);
    setDraft({ ...selected, learning_goals: [...(selected.learning_goals ?? [])] });
    setMessage('');
    setError('');
  };

  const updateText = (field: TextField, value: string) => {
    setDraft((current) => current ? { ...current, [field]: value } : current);
    setMessage('');
  };
  const updateStatus = (value: ContentStatus) => {
    setDraft((current) => current ? { ...current, content_status: value } : current);
    setMessage('');
  };
  const updateGoals = (value: string) => {
    setDraft((current) => current ? {
      ...current,
      learning_goals: value.split(/\r?\n/).map((goal) => goal.trim()).filter(Boolean),
    } : current);
    setMessage('');
  };

  const save = async () => {
    if (!supabase || !draft || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    const { data: authData } = await supabase.auth.getUser();
    const { data, error: saveError } = await supabase.from('phase_module_configs')
      .update({
        region_name: draft.region_name.trim(),
        theme: draft.theme.trim(),
        challenge: draft.challenge.trim(),
        learning_problem: draft.learning_problem.trim(),
        learning_goals: draft.learning_goals,
        mission_outline: draft.mission_outline.trim(),
        professions: draft.professions.trim(),
        economy_notes: draft.economy_notes.trim(),
        scenario_notes: draft.scenario_notes.trim(),
        content_status: draft.content_status,
        updated_by: authData.user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('phase_number', draft.phase_number)
      .select(MODULE_SELECT)
      .single();
    if (saveError || !data) {
      setError('Não foi possível salvar as alterações: ' + (saveError?.message ?? 'Nenhuma linha foi atualizada.'));
    } else {
      const saved = data as PhaseModuleConfig;
      setDraft({ ...saved, learning_goals: [...(saved.learning_goals ?? [])] });
      setModules((current) => current.map((item) => item.phase_number === saved.phase_number ? saved : item));
      setMessage('Fase ' + String(saved.phase_number).padStart(2, '0') + ' salva no banco de dados.');
    }
    setSaving(false);
  };

  const field = (name: string, fieldName: TextField, hint: string, rows = 3) => (
    <label className="master-editor-field">
      <span>{name}</span>
      <small>{hint}</small>
      <textarea rows={rows} value={draft?.[fieldName] ?? ''} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateText(fieldName, event.target.value)} />
    </label>
  );

  return <main className="campaign-shell master-studio-shell">
    <header className="campaign-header">
      <div className="campaign-brand">
        <img className="campaign-brand-mark" src="/brand/green-city-logo.webp" alt="Logotipo oficial GREEN CITY — Cidade Verde" />
        <div><strong>GREEN CITY</strong><small>ESTÚDIO MASTER · CONFIGURAÇÃO DE FASES</small></div>
      </div>
      <button type="button" className="master-studio-back" onClick={onBack}>← VOLTAR AO MAPA DA CIDADE</button>
    </header>
    <section className="master-studio-intro">
      <div className="campaign-eyebrow">ACESSO EXCLUSIVO · MASTER ADMIN</div>
      <h1>Configure a jornada das 10 regiões.</h1>
      <p>Edite o conteúdo pedagógico, os desafios, as missões, as profissões, a economia e as referências de cenário de cada fase. As alterações são salvas no banco de dados.</p>
      <div className="master-studio-warning"><strong>Importante:</strong> aprovar o conteúdo não libera automaticamente um cenário 3D. As fases 01 a 03 já possuem ambientes jogáveis; as fases 04 a 10 continuam em construção e podem ser planejadas aqui.</div>
    </section>
    <div className="master-studio-layout">
      <aside className="master-phase-picker">
        <h2>Mapa de módulos</h2>
        {modules.map((item) => <button type="button" key={item.phase_number}
          className={'master-phase-choice' + (selectedPhase === item.phase_number ? ' is-selected' : '')}
          onClick={() => selectModule(item.phase_number)}>
          <span className="master-phase-icon">{PHASE_ICONS[item.phase_number - 1]}</span>
          <span className="master-phase-choice-copy"><b>FASE {String(item.phase_number).padStart(2,'0')} · {item.region_name}</b><small>{STATUS_LABELS[item.content_status]}</small></span>
          <span className={'master-phase-dot ' + (item.phase_number <= 3 ? 'is-playable' : 'is-planning')} />
        </button>)}
        <div className="master-phase-legend"><span><i className="playable" /> Cenário 3D jogável</span><span><i className="planning" /> Em construção</span></div>
      </aside>
      <section className="master-phase-editor">
        {loading ? <div className="master-editor-loading">Carregando os dez módulos...</div> : draft ? <>
          <div className="master-editor-heading">
            <div><span>FASE {String(draft.phase_number).padStart(2,'0')} DE 10</span><h2>{draft.region_name}</h2><small>{draft.phase_number <= 3 ? 'CENÁRIO 3D JOGÁVEL · CONTEÚDO EM REVISÃO' : 'MÓDULO EM PLANEJAMENTO · SEM CENÁRIO 3D'}</small></div>
            <label className="master-status-select"><span>SITUAÇÃO DO CONTEÚDO</span><select value={draft.content_status} onChange={(event) => updateStatus(event.target.value as ContentStatus)}>
              <option value="planning">Planejamento</option><option value="draft">Rascunho</option><option value="review">Em revisão</option><option value="approved">Conteúdo aprovado</option>
            </select></label>
          </div>
          <div className="master-editor-grid">
            <label className="master-editor-field"><span>NOME DA REGIÃO</span><small>Nome exibido no mapa e nos módulos pedagógicos.</small><input value={draft.region_name} onChange={(event) => updateText('region_name', event.target.value)} /></label>
            <label className="master-editor-field"><span>TEMA PRINCIPAL</span><small>Assunto ambiental que dá identidade à fase.</small><input value={draft.theme} onChange={(event) => updateText('theme', event.target.value)} /></label>
            {field('DESAFIO CENTRAL', 'challenge', 'O que o jogador precisa ajudar a resolver?', 3)}
            {field('PROBLEMA E CAUSAS', 'learning_problem', 'Explique o problema, suas origens e consequências.', 4)}
            <label className="master-editor-field master-editor-field-wide"><span>OBJETIVOS DE APRENDIZAGEM</span><small>Um objetivo por linha. Mantenha verbos claros e observáveis.</small><textarea rows={5} value={(draft.learning_goals ?? []).join('\n')} onChange={(event) => updateGoals(event.target.value)} /></label>
            <label className="master-editor-field master-editor-field-wide"><span>ROTEIRO DE MISSÕES</span><small>Sequência de ações, investigações e intervenções esperadas.</small><textarea rows={5} value={draft.mission_outline} onChange={(event) => updateText('mission_outline', event.target.value)} /></label>
            {field('PROFISSÕES E PAPÉIS', 'professions', 'Quais profissionais, empresas, comunidade e governo participam?', 3)}
            {field('ECONOMIA DA REGIÃO', 'economy_notes', 'Custos, receitas, cadeias produtivas, trabalho e limites da simulação.', 3)}
            {field('REFERÊNCIAS PARA O CENÁRIO', 'scenario_notes', 'Objetos, prédios, equipamentos, placas, NPCs e detalhes visuais educativos.', 4)}
          </div>
          {error && <div className="master-editor-feedback is-error" role="alert">{error}</div>}
          {message && <div className="master-editor-feedback is-success" role="status">{message}</div>}
          <div className="master-editor-actions"><small>Última gravação: {draft.updated_at ? new Date(draft.updated_at).toLocaleString('pt-BR') : 'ainda não salva'}</small><button type="button" onClick={() => void save()} disabled={saving || loading}>{saving ? 'SALVANDO...' : 'SALVAR CONFIGURAÇÕES DA FASE'}</button></div>
        </> : <div className="master-editor-loading">Selecione uma fase para editar.</div>}
      </section>
    </div>
  </main>;
}
