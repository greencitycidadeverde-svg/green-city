import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { GameProgressData } from '../game/types';
import { supabase } from '../lib/supabase';
import GameExperience from './GameExperience';
import MasterPhaseStudio from './MasterPhaseStudio';

type AccountRole = 'master_admin' | 'admin' | 'user';
type AuthMode = 'signin' | 'signup' | 'forgot' | 'update';

type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
  role: AccountRole;
  created_at?: string;
};

type CampaignRow = {
  id: string;
  user_id: string;
  campaign_name: string;
  current_phase: number;
  highest_unlocked_phase: number;
  knowledge_points: number;
  level_title: string;
};

type PhaseRow = {
  phase_number: number;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  environment_state: 'locked' | 'degraded' | 'restoring' | 'restored';
  progress_percent: number;
  score: number;
  objective_state: Partial<GameProgressData>;
};

type AccountData = {
  profile: ProfileRow;
  campaign: CampaignRow;
  phases: PhaseRow[];
};

type AdminUser = ProfileRow;

const getAuthRedirectOrigin = (): string => import.meta.env.PROD
  ? 'https://green-city-beta.vercel.app'
  : window.location.origin;

const REGIONS = [
  { phase: 1, slug: 'centro-industrial', name: 'Centro Industrial', x: 13, y: 26, focus: 'Resíduos, energia e mobilidade' },
  { phase: 2, slug: 'porto', name: 'Porto', x: 34, y: 15, focus: 'Efluentes, saneamento e cooperativa' },
  { phase: 3, slug: 'periferia-verde', name: 'Periferia Verde', x: 55, y: 32, focus: 'Compostagem, coleta e drenagem' },
  { phase: 4, slug: 'reserva-florestal', name: 'Reserva Florestal', x: 78, y: 17, focus: 'Biodiversidade e habitats' },
  { phase: 5, slug: 'zona-costeira', name: 'Zona Costeira', x: 87, y: 46, focus: 'Rios, manguezais e oceano' },
  { phase: 6, slug: 'cinturao-agricola', name: 'Cinturão Agrícola', x: 73, y: 73, focus: 'Solo e produção sustentável' },
  { phase: 7, slug: 'centro-historico', name: 'Centro Histórico', x: 48, y: 67, focus: 'Mobilidade e qualidade do ar' },
  { phase: 8, slug: 'distrito-tecnologico', name: 'Distrito Tecnológico', x: 26, y: 78, focus: 'Materiais e logística reversa' },
  { phase: 9, slug: 'vale-das-nascentes', name: 'Vale das Nascentes', x: 8, y: 56, focus: 'Água, licenciamento e gestão' },
  { phase: 10, slug: 'ilha-da-biodiversidade', name: 'Ilha da Biodiversidade', x: 49, y: 46, focus: 'Gestão integrada e clima' },
] as const;

function AuthenticatedApp() {
  const teamInviteCode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('equipe') : null;
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>(teamInviteCode ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [accountError, setAccountError] = useState('');
  const [activePhase, setActivePhase] = useState<1 | 2 | 3 | null>(null);
  const [masterPhaseConfig, setMasterPhaseConfig] = useState<number | null>(null);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminBusyId, setAdminBusyId] = useState('');
  const [teamInvite, setTeamInvite] = useState<{ targetAdminId: string; teamName: string; url: string } | null>(null);
  const [teamInviteLoading, setTeamInviteLoading] = useState(false);
  const [teamInviteCopied, setTeamInviteCopied] = useState(false);
  const [studentTeamInvite, setStudentTeamInvite] = useState<{ teamName: string; url: string } | null>(null);
  const [studentShareMessage, setStudentShareMessage] = useState('');
  const [teamNotice, setTeamNotice] = useState('');

  const recoveryFlow = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('auth') === 'recovery'
    || new URLSearchParams(window.location.search).get('type') === 'recovery'
  );

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    let mounted = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setErrorMessage(error.message);
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setAuthMode('update');
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadAccount = useCallback(async (userId: string) => {
    if (!supabase) return;
    setAccountLoading(true);
    setAccountError('');
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id,email,display_name,role,created_at')
        .eq('id', userId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) {
        throw new Error('O perfil ainda não foi criado. Saia da conta e entre novamente depois da confirmação do e-mail.');
      }
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('id,user_id,campaign_name,current_phase,highest_unlocked_phase,knowledge_points,level_title')
        .eq('user_id', userId)
        .maybeSingle();
      if (campaignError) throw campaignError;
      if (!campaign) {
        throw new Error('A campanha individual ainda não foi inicializada. Entre novamente em alguns instantes.');
      }
      const { data: phases, error: phasesError } = await supabase
        .from('phase_progress')
        .select('phase_number,status,environment_state,progress_percent,score,objective_state')
        .eq('campaign_id', campaign.id)
        .order('phase_number', { ascending: true });
      if (phasesError) throw phasesError;
      setAccount({
        profile: profile as ProfileRow,
        campaign: campaign as CampaignRow,
        phases: (phases ?? []) as PhaseRow[],
      });
      setStudentTeamInvite(null);
      setStudentShareMessage('');
      if ((profile as ProfileRow).role === 'user') {
        const { data: inviteData, error: inviteError } = await supabase.rpc('get_my_team_invite');
        const inviteRow = (Array.isArray(inviteData) ? inviteData[0] : inviteData) as { team_name?: string; invite_code?: string } | null;
        if (!inviteError && inviteRow?.invite_code) {
          setStudentTeamInvite({
            teamName: inviteRow.team_name || 'Equipe GREEN CITY',
            url: window.location.origin + '/?equipe=' + encodeURIComponent(inviteRow.invite_code),
          });
        }
      }
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Não foi possível carregar sua campanha.');
      setAccount(null);
    } finally {
      setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user.id) {
      setAccount(null);
      setActivePhase(null);
      return;
    }
    if (recoveryFlow) setAuthMode('update');
    if (teamInviteCode && supabase) {
      let cancelled = false;
      void (async () => {
        const { error } = await supabase.rpc('join_team_with_invite', { invite_code: teamInviteCode });
        if (cancelled) return;
        await loadAccount(session.user.id);
        if (error) {
          setTeamNotice('Não foi possível vincular esta conta à equipe: ' + error.message);
        } else {
          setTeamNotice('Convite aceito! Esta conta agora faz parte da equipe GREEN CITY correspondente.');
          const nextUrl = new URL(window.location.href);
          nextUrl.searchParams.delete('equipe');
          window.history.replaceState({}, document.title, nextUrl.pathname + nextUrl.search + nextUrl.hash);
        }
      })();
      return () => { cancelled = true; };
    }
    void loadAccount(session.user.id);
  }, [session?.user.id, recoveryFlow, loadAccount, teamInviteCode]);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setErrorMessage('');
    setMessage('');
    try {
      if (authMode === 'signup') {
        if (password.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres.');
        if (password !== passwordConfirm) throw new Error('As senhas não coincidem.');
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: getAuthRedirectOrigin() + '/' + (teamInviteCode ? '?equipe=' + encodeURIComponent(teamInviteCode) : ''),
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage('Se este for um novo cadastro, enviamos um link de confirmação para seu e-mail. Abra a mensagem para confirmar. Se você já confirmou o endereço ou já possui uma conta, use “Já tenho uma conta” para entrar ou “Esqueci minha senha” para recuperar o acesso.');
        } else {
          setMessage('Conta criada. Preparando sua cidade...');
        }
      } else if (authMode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error?.code === 'invalid_credentials') {
          throw new Error('E-mail ou senha não conferem. Se você acabou de se cadastrar, confirme o e-mail primeiro. Se já confirmou e não lembra a senha, use “Esqueci minha senha”.');
        }
        if (error?.code === 'email_not_confirmed') {
          throw new Error('Seu e-mail ainda não foi confirmado. Abra a mensagem de confirmação enviada pelo GREEN CITY.');
        }
        if (error) throw error;
      } else if (authMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: getAuthRedirectOrigin() + '/?auth=recovery' + (teamInviteCode ? '&equipe=' + encodeURIComponent(teamInviteCode) : ''),
        });
        if (error) throw error;
        setMessage('Enviamos um link para redefinir sua senha. Confira sua caixa de entrada e a pasta de spam.');
      } else {
        if (password.length < 8) throw new Error('A nova senha precisa ter pelo menos 8 caracteres.');
        if (password !== passwordConfirm) throw new Error('As senhas não coincidem.');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage('Senha atualizada. Sua conta está pronta para continuar.');
        setAuthMode('signin');
        setPassword('');
        setPasswordConfirm('');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível concluir a operação.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setErrorMessage(error.message);
    setAccount(null);
    setActivePhase(null);
    setMessage('');
    setErrorMessage('');
  };

  const loadAdminUsers = async () => {
    if (!supabase || !['admin', 'master_admin'].includes(account?.profile.role ?? '')) return;
    setAdminUsersLoading(true);
    setAdminError('');
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,display_name,role,created_at')
      .order('created_at', { ascending: true });
    if (error) setAdminError(error.message);
    else setAdminUsers((data ?? []) as AdminUser[]);
    setAdminUsersLoading(false);
  };

  const loadTeamInvite = async (targetAdminId: string) => {
    if (!supabase || !['admin', 'master_admin'].includes(account?.profile.role ?? '')) return;
    if (account?.profile.role === 'admin' && targetAdminId !== account.profile.id) return;
    setTeamInviteLoading(true);
    setAdminError('');
    setTeamInviteCopied(false);
    const { data, error } = await supabase.rpc('admin_get_team_invite', { target_admin_id: targetAdminId });
    if (error) {
      setAdminError(error.message);
      setTeamInvite(null);
    } else {
      const row = (Array.isArray(data) ? data[0] : data) as { team_name?: string; invite_code?: string } | null;
      if (!row?.invite_code) {
        setAdminError('A equipe ainda não possui um link disponível.');
        setTeamInvite(null);
      } else {
        setTeamInvite({ targetAdminId, teamName: row.team_name || 'Equipe GREEN CITY', url: window.location.origin + '/?equipe=' + encodeURIComponent(row.invite_code) });
      }
    }
    setTeamInviteLoading(false);
  };

  const shareInviteLink = async (url: string, teamName: string, audience: 'admin' | 'student') => {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: 'Convite para ' + teamName + ' · GREEN CITY',
          text: 'Entre na equipe ' + teamName + ' no jogo educativo GREEN CITY:',
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
      if (audience === 'admin') {
        setTeamInviteCopied(true);
        setAdminError('');
      } else {
        setStudentShareMessage('Link da equipe copiado ou compartilhado. Envie para seus colegas.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (audience === 'admin') setAdminError('Não foi possível compartilhar automaticamente. Copie o endereço exibido.');
      else setStudentShareMessage('Não foi possível compartilhar automaticamente. Copie o endereço exibido.');
    }
  };

  const copyTeamInvite = async () => {
    if (!teamInvite) return;
    try {
      await navigator.clipboard.writeText(teamInvite.url);
      setTeamInviteCopied(true);
      setAdminError('');
    } catch {
      setAdminError('Não foi possível copiar automaticamente. Selecione e copie o endereço exibido.');
    }
  };

  useEffect(() => {
    if (adminPanelOpen && ['admin', 'master_admin'].includes(account?.profile.role ?? '')) {
      void loadAdminUsers();
      if (account?.profile.role === 'admin') void loadTeamInvite(account.profile.id);
    }
    // Protected data is fetched only when the team or Master panel is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPanelOpen, account?.profile.role]);

  const changeRole = async (target: AdminUser, newRole: AccountRole) => {
    if (!supabase || account?.profile.role !== 'master_admin' || adminBusyId) return;
    setAdminBusyId(target.id);
    setAdminError('');
    const { error } = await supabase.rpc('admin_set_user_role', {
      target_user_id: target.id,
      new_role: newRole,
    });
    if (error) setAdminError(error.message);
    else await loadAdminUsers();
    setAdminBusyId('');
  };

  const openGame = (phase: 1 | 2 | 3) => {
    setActivePhase(phase);
  };

  const returnToMap = async () => {
    setActivePhase(null);
    if (session?.user.id) await loadAccount(session.user.id);
  };

  const isMasterAccount = account?.profile.role === 'master_admin';

  const regionStates = useMemo(() => REGIONS.map((region) => {
    const row = account?.phases.find((item) => item.phase_number === region.phase);
    const playable = region.phase <= 3;
    const unlockedByCampaign = region.phase <= (account?.campaign.highest_unlocked_phase ?? 1);
    const environmentState = row?.environment_state ?? (unlockedByCampaign ? 'degraded' : 'locked');
    const status = row?.status ?? (unlockedByCampaign ? 'available' : 'locked');
    const colorState = !playable
      ? 'planned'
      : environmentState === 'restored' || status === 'completed'
        ? 'restored'
        : environmentState === 'restoring' || status === 'in_progress'
          ? 'restoring'
          : status === 'available' || environmentState === 'degraded'
            ? 'degraded'
            : 'locked';
    const canPlay = playable && (['admin', 'master_admin'].includes(account?.profile.role ?? '') || status === 'available' || status === 'in_progress' || status === 'completed');
    const canConfigure = isMasterAccount && !playable;
    return { ...region, row, playable, colorState, canPlay, canConfigure };
  }), [account]);

  const restoredCount = regionStates.filter((region) => region.colorState === 'restored').length;
  const currentProgress = account?.campaign ? Math.round((restoredCount / 10) * 100) : 0;
  const defaultPhase: 1 | 2 | 3 | null = account && ['admin', 'master_admin'].includes(account.profile.role)
    ? (account.campaign.current_phase >= 3 ? 3 : account.campaign.current_phase >= 2 ? 2 : 1)
    : regionStates[2]?.canPlay ? 3
      : regionStates[1]?.canPlay ? 2
        : regionStates[0]?.canPlay ? 1 : null;
  const activeProgress = activePhase ? account?.phases.find((item) => item.phase_number === activePhase)?.objective_state ?? {} : {};

  if (!supabase) {
    return <main className="auth-shell"><section className="auth-card auth-unconfigured">
      <div className="auth-brand"><img className="auth-brand-mark" src="/brand/green-city-logo.webp" alt="Logotipo oficial GREEN CITY — Cidade Verde" /><div><strong>GREEN CITY</strong><small>PLATAFORMA EDUCACIONAL</small></div></div>
      <h1>Estamos preparando sua cidade.</h1>
      <p>A configuração pública do Supabase ainda não está disponível nesta publicação. Assim que a integração for configurada, o acesso aparecerá aqui.</p>
    </section></main>;
  }

  if (authLoading) {
    return <main className="auth-shell"><section className="auth-card auth-loading"><span className="auth-spinner" /><b>Conectando à sua cidade...</b></section></main>;
  }

  if (!session) {
    const titles: Record<AuthMode, { eyebrow: string; title: string; helper: string }> = {
      signin: { eyebrow: 'BEM-VINDO DE VOLTA', title: 'Sua cidade espera por você.', helper: 'Entre para continuar a transformação do seu mapa ambiental.' },
      signup: { eyebrow: teamInviteCode ? 'CONVITE DE EQUIPE' : 'NOVA JORNADA', title: 'Crie sua conta GREEN CITY.', helper: teamInviteCode ? 'Seu cadastro será vinculado à equipe que enviou este convite.' : 'Crie sua conta. Se entrar por um link de equipe, seu cadastro será vinculado automaticamente; sem convite, sua conta ficará aguardando vínculo.' },
      forgot: { eyebrow: 'RECUPERAR ACESSO', title: 'Vamos recuperar sua conta.', helper: 'Informe o e-mail cadastrado para receber um link de redefinição de senha.' },
      update: { eyebrow: 'NOVA SENHA', title: 'Atualize sua senha.', helper: 'Escolha uma senha segura para voltar à sua campanha.' },
    };
    const title = titles[authMode];
    return <main className="auth-shell">
      <div className="auth-atmosphere"><span /><span /><span /><span /></div>
      <section className="auth-card">
        <div className="auth-brand auth-brand-login">
          <div><strong>GREEN CITY</strong><small>PLATAFORMA EDUCACIONAL</small></div>
          <span className="auth-version">AMBIENTE DE APRENDIZAGEM</span>
        </div>
        <div className="auth-visual auth-visual-brand">
          <div className="auth-visual-glow" />
          <img className="auth-hero-logo" src="/brand/green-city-logo.webp" alt="Logotipo oficial GREEN CITY — Cidade Verde" />
          <div className="auth-visual-caption">APRENDER · AGIR · TRANSFORMAR</div>
        </div>
        <div className="auth-copy">
          <div className="auth-eyebrow">{title.eyebrow}</div>
          <h1>{title.title}</h1>
          <p>{title.helper}</p>
        </div>
        <form className="auth-form" onSubmit={submitAuth}>
          {authMode === 'signup' && <label>
            <span>SEU NOME</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required maxLength={80} placeholder="Como podemos chamar você?" />
          </label>}
          {authMode !== 'update' && <label>
            <span>E-MAIL</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="seuemail@exemplo.com" />
          </label>}
          {(authMode === 'signin' || authMode === 'signup' || authMode === 'update') && <label>
            <span>{authMode === 'update' ? 'NOVA SENHA' : 'SENHA'}</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} required minLength={8} placeholder="Mínimo de 8 caracteres" />
          </label>}
          {(authMode === 'signup' || authMode === 'update') && <label>
            <span>CONFIRMAR SENHA</span>
            <input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} autoComplete="new-password" required minLength={8} placeholder="Digite a senha novamente" />
          </label>}
          {errorMessage && <div className="auth-feedback auth-feedback-error" role="alert">{errorMessage}</div>}
          {message && <div className="auth-feedback auth-feedback-success" role="status">{message}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'AGUARDE...' : authMode === 'signin' ? 'ENTRAR NA MINHA CIDADE' : authMode === 'signup' ? 'CRIAR MINHA CONTA' : authMode === 'forgot' ? 'ENVIAR LINK DE RECUPERAÇÃO' : 'SALVAR NOVA SENHA'}
            {!busy && <span>→</span>}
          </button>
        </form>
        <div className="auth-links">
          {authMode === 'signin' && <>
            <button type="button" onClick={() => { setAuthMode('signup'); setMessage(''); setErrorMessage(''); }}>{teamInviteCode ? 'CRIAR CONTA PELO CONVITE' : 'CRIAR UMA CONTA'}</button>
            <button type="button" onClick={() => { setAuthMode('forgot'); setMessage(''); setErrorMessage(''); }}>Esqueci minha senha</button>
          </>}
          {authMode === 'signup' && <button type="button" onClick={() => { setAuthMode('signin'); setMessage(''); setErrorMessage(''); }}>Já tenho uma conta · Entrar</button>}
          {authMode === 'forgot' && <button type="button" onClick={() => { setAuthMode('signin'); setMessage(''); setErrorMessage(''); }}>Voltar para o login</button>}
          {authMode === 'update' && <button type="button" onClick={() => { setAuthMode('signin'); setMessage(''); setErrorMessage(''); }}>Voltar para o login</button>}
        </div>
        <footer className="auth-footer"><span>APRENDER · AGIR · TRANSFORMAR</span><span>GREEN CITY ©</span></footer>
      </section>
    </main>;
  }

  if (accountLoading) {
    return <main className="auth-shell"><section className="auth-card auth-loading"><span className="auth-spinner" /><b>Carregando seu mapa e seu progresso...</b></section></main>;
  }

  if (session && authMode === 'update') {
    return <main className="auth-shell">
      <div className="auth-atmosphere"><span /><span /><span /><span /></div>
      <section className="auth-card">
        <div className="auth-brand"><img className="auth-brand-mark" src="/brand/green-city-logo.webp" alt="Logotipo oficial GREEN CITY — Cidade Verde" /><div><strong>GREEN CITY</strong><small>PLATAFORMA EDUCACIONAL</small></div></div>
        <div className="auth-copy"><div className="auth-eyebrow">RECUPERAÇÃO DE ACESSO</div><h1>Escolha sua nova senha.</h1><p>Depois de salvar, você poderá entrar novamente na sua campanha.</p></div>
        <form className="auth-form" onSubmit={submitAuth}>
          <label><span>NOVA SENHA</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} placeholder="Mínimo de 8 caracteres" /></label>
          <label><span>CONFIRMAR SENHA</span><input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} autoComplete="new-password" required minLength={8} placeholder="Digite novamente" /></label>
          {errorMessage && <div className="auth-feedback auth-feedback-error" role="alert">{errorMessage}</div>}
          {message && <div className="auth-feedback auth-feedback-success" role="status">{message}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'AGUARDE...' : 'SALVAR NOVA SENHA'} <span>→</span></button>
        </form>
        <div className="auth-links"><button type="button" onClick={() => void signOut()}>Sair da recuperação</button></div>
      </section>
    </main>;
  }

  if (!account) {
    return <main className="auth-shell"><section className="auth-card">
      <div className="auth-brand"><img className="auth-brand-mark" src="/brand/green-city-logo.webp" alt="Logotipo oficial GREEN CITY — Cidade Verde" /><div><strong>GREEN CITY</strong><small>CONTA AUTENTICADA</small></div></div>
      <h1>Não conseguimos abrir sua campanha.</h1>
      <p>{accountError || 'O perfil do usuário ainda não está disponível.'}</p>
      <div className="auth-error-actions"><button className="auth-submit" onClick={() => session.user.id && void loadAccount(session.user.id)}>TENTAR NOVAMENTE</button><button className="auth-secondary" onClick={() => void signOut()}>SAIR DA CONTA</button></div>
    </section></main>;
  }

  if (activePhase !== null) {
    return <GameExperience
      userId={account.profile.id}
      campaignId={account.campaign.id}
      initialPhase={activePhase}
      savedProgress={activeProgress}
      isMaster={account.profile.role === 'master_admin'}
      onConfigurePhase={(phase) => setMasterPhaseConfig(phase)}
      onExitToCampaign={returnToMap}
    />;
  }

  if (masterPhaseConfig !== null && account.profile.role === 'master_admin') {
    return <MasterPhaseStudio key={masterPhaseConfig} initialPhase={masterPhaseConfig} onBack={() => setMasterPhaseConfig(null)} />;
  }

  return <main className="campaign-shell">
    <header className="campaign-header">
      <div className="campaign-brand">
        <img className="campaign-brand-mark" src="/brand/green-city-logo.webp" alt="Logotipo oficial GREEN CITY — Cidade Verde" />
        <div><strong>GREEN CITY</strong><small>PLATAFORMA DE TRANSFORMAÇÃO AMBIENTAL</small></div>
      </div>
      <div className="campaign-user">
        <div className="campaign-avatar">{(account.profile.display_name || account.profile.email).slice(0, 1).toUpperCase()}</div>
        <div className="campaign-user-copy"><strong>{account.profile.display_name || 'Agente Ambiental'}</strong><small>{account.profile.role === 'master_admin' ? 'ADMINISTRADOR MASTER' : account.profile.role === 'admin' ? 'ADMINISTRADOR DE EQUIPE' : 'MINHA CAMPANHA'}</small></div>
        <button type="button" className="campaign-signout" onClick={() => void signOut()}>SAIR</button>
      </div>
    </header>

    {teamNotice && <div className="team-notice" role="status">{teamNotice}</div>}
    <section className="campaign-intro">
      <div>
        <div className="campaign-eyebrow">PAINEL DA SUA JORNADA</div>
        <h1>Uma cidade melhor começa com suas decisões.</h1>
        <p>Explore cada região, investigue os desafios e acompanhe a transformação ambiental da sua campanha.</p>
      </div>
      <div className="campaign-level">
        <span>NÍVEL ATUAL</span>
        <strong>{account.campaign.level_title || 'Aprendiz Ambiental'}</strong>
        <small>{account.campaign.knowledge_points} pontos de conhecimento</small>
      </div>
    </section>

    <section className="campaign-progress-strip">
      <div className="campaign-progress-title"><strong>EVOLUÇÃO DA CIDADE</strong><span>{restoredCount} de 10 regiões recuperadas</span></div>
      <div className="campaign-progress-track"><span style={{ width: currentProgress + '%' }} /></div>
      <div className="campaign-progress-legend">
        <span><i className="legend-green" /> Recuperada</span><span><i className="legend-yellow" /> Em recuperação</span><span><i className="legend-red" /> Degradada</span><span><i className="legend-gray" /> Em desenvolvimento</span>
      </div>
    </section>

    <section className="campaign-map-section">
      <div className="campaign-section-heading">
        <div><div className="campaign-eyebrow">MAPA GERAL DA CIDADE</div><h2>Escolha sua próxima região.</h2></div>
        <button type="button" className="campaign-continue" disabled={defaultPhase === null} onClick={() => defaultPhase && openGame(defaultPhase)}>{defaultPhase === null ? 'PRÓXIMA REGIÃO EM DESENVOLVIMENTO' : 'CONTINUAR JOGO'} <span>→</span></button>
      </div>
      <div className="campaign-map-layout">
        <div className="campaign-map-board">
          <div className="map-compass"><b>N</b><span>↑</span></div>
          <div className="map-water map-water-one" /><div className="map-water map-water-two" />
          <div className="map-park map-park-one" /><div className="map-park map-park-two" /><div className="map-park map-park-three" />
          <div className="map-road-h map-road-h-one" /><div className="map-road-h map-road-h-two" />
          <div className="map-road-v map-road-v-one" /><div className="map-road-v map-road-v-two" />
          <div className="map-district-block block-a" /><div className="map-district-block block-b" />
          <div className="map-district-block block-c" /><div className="map-district-block block-d" />
          <svg className="campaign-route-lines" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">
            <path d="M130 170 L340 98 L550 208 L780 110 L870 299 L730 474 L480 435 L260 507 L80 364" />
            <path d="M480 435 L490 299 L550 208" className="route-branch" />
          </svg>
          {regionStates.map((region) => {
            const row = region.row;
            const label = region.colorState === 'restored' ? 'RECUPERADA'
              : region.colorState === 'restoring' ? 'EM RECUPERAÇÃO'
                : region.colorState === 'degraded' ? (row?.status === 'in_progress' ? 'EM MISSÃO' : 'PRECISA DE AÇÃO')
                  : region.colorState === 'locked' ? 'BLOQUEADA' : 'EM DESENVOLVIMENTO';
            return <button
              type="button"
              key={region.phase}
              className={'map-region-node map-region-' + region.colorState + (region.canPlay ? ' map-region-clickable' : '')}
              style={{ left: region.x + '%', top: region.y + '%' }}
              disabled={!region.canPlay && !region.canConfigure}
              onClick={() => {
                if (region.canPlay && region.phase <= 3) openGame(region.phase as 1 | 2 | 3);
                else if (region.canConfigure) setMasterPhaseConfig(region.phase);
              }}
              title={region.name + ' · ' + label}
            >
              <span className="map-region-number">{String(region.phase).padStart(2, '0')}</span>
              <strong>{region.name}</strong>
              <small>{region.canConfigure ? 'CONFIGURAR MÓDULO' : label}</small>
            </button>;
          })}
          <div className="map-board-label"><span>CIDADE MODELO · 10 REGIÕES</span><strong>GREEN CITY</strong><small>MAPA DA CAMPANHA INDIVIDUAL</small></div>
        </div>
        <aside className="campaign-map-aside">
          <div className="campaign-aside-card campaign-aside-current">
            <div className="campaign-eyebrow">PRÓXIMO PASSO</div>
            <span className="campaign-aside-number">{defaultPhase ? 'FASE ' + String(defaultPhase).padStart(2, '0') : 'PRÓXIMA ETAPA'}</span>
            <h3>{defaultPhase ? REGIONS[defaultPhase - 1].name : 'Periferia Verde'}</h3>
            <p>{defaultPhase ? REGIONS[defaultPhase - 1].focus : 'A próxima região está sendo preparada para continuar sua jornada.'}</p>
            <button type="button" disabled={defaultPhase === null} onClick={() => defaultPhase && openGame(defaultPhase)}>{defaultPhase ? 'ENTRAR NA REGIÃO' : 'EM DESENVOLVIMENTO'} <span>→</span></button>
          </div>
          <div className="campaign-aside-card">
            <div className="campaign-eyebrow">SUA EVOLUÇÃO</div>
            <div className="campaign-stat-row"><strong>{account.campaign.highest_unlocked_phase}</strong><span>maior fase liberada</span></div>
            <div className="campaign-stat-row"><strong>{account.phases.filter((phase) => phase.status === 'completed').length}</strong><span>fases concluídas</span></div>
            <div className="campaign-stat-row"><strong>{account.campaign.knowledge_points}</strong><span>pontos de conhecimento</span></div>
          </div>
          <div className="campaign-map-note"><b>LEMBRE-SE</b><span>Uma região só fica verde quando seus objetivos essenciais são cumpridos. Conhecimento e recuperação caminham juntos.</span></div>
        </aside>
      </div>
      <div className="campaign-region-list">
        {regionStates.map((region) => <button type="button" className="campaign-region-row" key={region.phase}
          disabled={!region.canPlay && !region.canConfigure} onClick={() => {
            if (region.canPlay && region.phase <= 3) openGame(region.phase as 1 | 2 | 3);
            else if (region.canConfigure) setMasterPhaseConfig(region.phase);
          }}>
          <span className={'campaign-region-dot dot-' + region.colorState} />
          <span className="campaign-region-number">{String(region.phase).padStart(2, '0')}</span>
          <span className="campaign-region-copy"><strong>{region.name}</strong><small>{region.focus}</small></span>
          <span className="campaign-region-state">{region.canConfigure ? 'CONFIGURAR MÓDULO' : region.colorState === 'restored' ? 'RECUPERADA' : region.colorState === 'restoring' ? 'EM RECUPERAÇÃO' : region.colorState === 'degraded' ? 'DEGRADADA' : 'EM DESENVOLVIMENTO'}</span>
          <span className="campaign-region-arrow">{region.canPlay ? '→' : '·'}</span>
        </button>)}
      </div>
    </section>

    <section className="campaign-footer-actions">
      <div><b>CADERNO DE APRENDIZADO</b><span>Seus registros acompanham cada fase e cada descoberta.</span></div>
      <button type="button" className="campaign-journal-button" onClick={() => setMessage('O Caderno de Aprendizado será aberto na próxima entrega do painel.')}>VER MEU CADERNO</button>
      {studentTeamInvite && account.profile.role === 'user' && <button type="button" className="campaign-share-button" onClick={() => void shareInviteLink(studentTeamInvite.url, studentTeamInvite.teamName, 'student')}>COMPARTILHAR LINK DA EQUIPE</button>}
      {['admin', 'master_admin'].includes(account.profile.role) && <button type="button" className="campaign-admin-button" onClick={() => setAdminPanelOpen((open) => !open)}>{adminPanelOpen ? 'FECHAR PAINEL' : account.profile.role === 'master_admin' ? 'PAINEL MASTER' : 'MINHA EQUIPE'}</button>}
    </section>
    {studentTeamInvite && account.profile.role === 'user' && <div className="student-team-share">
      <div><strong>{studentTeamInvite.teamName}</strong><span>Você está vinculado a esta equipe. Compartilhe o convite para que seus colegas entrem no mesmo grupo.</span><code>{studentTeamInvite.url}</code>{studentShareMessage && <small>{studentShareMessage}</small>}</div>
      <button type="button" onClick={() => void shareInviteLink(studentTeamInvite.url, studentTeamInvite.teamName, 'student')}>COMPARTILHAR CONVITE</button>
    </div>}

    {['admin', 'master_admin'].includes(account.profile.role) && adminPanelOpen && <section className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <div className="campaign-eyebrow">{account.profile.role === 'master_admin' ? 'ACESSO MASTER · VISÃO GLOBAL' : 'ACESSO DA EQUIPE · VISÃO RESTRITA'}</div>
          <h2>{account.profile.role === 'master_admin' ? 'Administradores e usuários GREEN CITY' : 'Minha equipe GREEN CITY'}</h2>
          <p>{account.profile.role === 'master_admin' ? 'Consulte todas as contas, promova usuários a administradores, acompanhe equipes e configure o conteúdo pedagógico das dez fases.' : 'Aqui aparecem apenas sua conta e os usuários vinculados ao seu link de equipe. Você não tem acesso às demais equipes.'}</p>
        </div>
        {account.profile.role === 'master_admin' && <button type="button" className="master-studio-launch" onClick={() => setMasterPhaseConfig(1)}>CONFIGURAR AS 10 FASES</button>}
        <button type="button" onClick={() => void loadAdminUsers()}>ATUALIZAR</button>
      </div>
      {account.profile.role === 'admin' && <div className="team-invite-help"><strong>LINK DA SUA EQUIPE</strong><span>Compartilhe este endereço com seus alunos. As novas contas que entrarem por ele serão vinculadas à sua equipe.</span><button type="button" onClick={() => void loadTeamInvite(account.profile.id)} disabled={teamInviteLoading}>{teamInviteLoading ? 'GERANDO...' : 'GERAR / ATUALIZAR LINK'}</button></div>}
      {teamInvite && <div className="team-invite-card">
        <div><small>{teamInvite.teamName} · LINK DE CONVITE</small><code>{teamInvite.url}</code></div>
        <div className="team-invite-actions">
          <button type="button" onClick={() => void shareInviteLink(teamInvite.url, teamInvite.teamName, 'admin')}>COMPARTILHAR</button>
          <button type="button" onClick={() => void copyTeamInvite()}>{teamInviteCopied ? 'LINK COPIADO' : 'COPIAR LINK'}</button>
        </div>
      </div>}
      {adminError && <div className="auth-feedback auth-feedback-error">{adminError}</div>}
      {adminUsersLoading ? <div className="admin-loading">Carregando contas...</div> : <div className="admin-user-list">
        {adminUsers.map((user) => <div className="admin-user-row" key={user.id}>
          <div className="admin-user-avatar">{(user.display_name || user.email).slice(0,1).toUpperCase()}</div>
          <div className="admin-user-info"><strong>{user.display_name || 'Usuário GREEN CITY'}</strong><small>{user.email}</small></div>
          <span className={'admin-role-pill ' + (user.role !== 'user' ? 'admin-role-pill-admin' : '') + (user.role === 'master_admin' ? ' admin-role-pill-master' : '')}>{user.role === 'master_admin' ? 'MASTER' : user.role === 'admin' ? 'ADMINISTRADOR' : 'ALUNO / USUÁRIO'}</span>
          {account.profile.role === 'master_admin' && user.role === 'admin' && <button type="button" className="admin-team-link" onClick={() => void loadTeamInvite(user.id)} disabled={teamInviteLoading}>LINK DA EQUIPE</button>}
          {account.profile.role === 'master_admin' && user.role !== 'master_admin' && <button type="button" className="admin-role-action" disabled={adminBusyId === user.id} onClick={() => void changeRole(user, user.role === 'admin' ? 'user' : 'admin')}>{adminBusyId === user.id ? 'AGUARDE...' : user.role === 'admin' ? 'REBAIXAR' : 'TORNAR ADMIN'}</button>}
        </div>)}
      </div>}
    </section>}

    <footer className="campaign-site-footer"><span>GREEN CITY · APRENDER PARA TRANSFORMAR</span><span>AMBIENTE EDUCACIONAL · CAMPANHA INDIVIDUAL</span></footer>
  </main>;
}

export default AuthenticatedApp;
