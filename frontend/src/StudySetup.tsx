import { ArrowRight, Check, Clipboard, FlaskConical, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { loadScenario } from './api';
import { buildStudyUrl } from './studySession';
import type { CameraProfile, StudyCondition, StudyLanguage } from './types';

export function StudySetup() {
  const [participantId, setParticipantId] = useState('P001');
  const [sessionId, setSessionId] = useState(() => createSessionId());
  const [condition, setCondition] = useState<StudyCondition>('visual_exposure');
  const [language, setLanguage] = useState<StudyLanguage>('en');
  const [cameraProfileId, setCameraProfileId] = useState('inspection_balanced');
  const [profiles, setProfiles] = useState<CameraProfile[]>([]);
  const [copied, setCopied] = useState<'warmup' | 'study' | null>(null);

  useEffect(() => {
    loadScenario().then((scenario) => {
      setProfiles(scenario.camera_profiles);
      setCameraProfileId(scenario.default_camera_profile_id);
    }).catch(() => setProfiles([]));
  }, []);

  const session = useMemo(() => ({
    condition,
    language,
    participantId,
    sessionId,
    scenarioId: 'hong_kong_mong_kok_01',
    cameraProfileId,
  }), [cameraProfileId, condition, language, participantId, sessionId]);
  const warmupUrl = buildStudyUrl(window.location.origin, session, '/warmup');
  const studyUrl = buildStudyUrl(window.location.origin, session, '/');

  const copy = async (kind: 'warmup' | 'study', value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1400);
  };

  return (
    <main className="setup-shell">
      <header className="setup-header">
        <div className="setup-mark"><FlaskConical size={20} /></div>
        <div>
          <p>实验管理工作区</p>
          <h1>准备一次受控实验</h1>
          <span>完成配置后，将锁定的实验页面交给参与者使用。</span>
        </div>
      </header>

      <section className="setup-grid">
        <div className="setup-form">
          <div className="setup-section-title"><span>01</span><div><strong>会话信息</strong><small>会写入每一条导出的实验记录。</small></div></div>
          <div className="setup-field-grid">
            <label><span>参与者编号</span><input aria-label="Participant ID" value={participantId} onChange={(event) => setParticipantId(event.target.value)} /></label>
            <label><span>会话编号</span><div className="setup-input-action"><input aria-label="Session ID" value={sessionId} onChange={(event) => setSessionId(event.target.value)} /><button title="生成新的会话编号" aria-label="Generate new session ID" onClick={() => setSessionId(createSessionId())}><RefreshCw size={15} /></button></div></label>
          </div>

          <div className="setup-section-title"><span>02</span><div><strong>实验条件</strong><small>参与者进入实验后不能切换条件。</small></div></div>
          <div className="setup-choice-grid three">
            {([
              ['basic_notice', 'C1', '基础通知'],
              ['camera_footprint', 'C2', '航线与视野范围'],
              ['visual_exposure', 'C3', '视觉暴露'],
            ] as const).map(([value, code, label]) => (
              <button key={value} className={condition === value ? 'selected' : ''} onClick={() => setCondition(value)}>
                <small>{code}</small><strong>{label}</strong>{condition === value && <Check size={15} />}
              </button>
            ))}
          </div>

          <div className="setup-section-title"><span>03</span><div><strong>语言与摄像机</strong><small>参与者使用的语言和摄像机模式都会锁定。</small></div></div>
          <div className="setup-field-grid">
            <label><span>参与者语言</span><select aria-label="Session language" value={language} onChange={(event) => setLanguage(event.target.value as StudyLanguage)}><option value="en">English</option><option value="zh">中文</option></select></label>
            <label><span>摄像机模式</span><select aria-label="Camera profile" value={cameraProfileId} onChange={(event) => setCameraProfileId(event.target.value)}>{profiles.length ? profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>) : <option value="inspection_balanced">Balanced Inspection</option>}</select></label>
          </div>
        </div>

        <aside className="setup-launch">
          <p className="setup-kicker">准备启动</p>
          <h2>{participantId || '参与者'}</h2>
          <div className="setup-summary"><span>{condition === 'basic_notice' ? 'C1 基础通知' : condition === 'camera_footprint' ? 'C2 航线与视野范围' : 'C3 视觉暴露'}</span><span>{language === 'zh' ? '中文' : 'English'}</span><span>{cameraProfileLabel(cameraProfileId)}</span></div>
          <div className="launch-link"><div><small>从预热校准开始</small><strong>/warmup</strong></div><button title="复制预热页面链接" aria-label="Copy warm-up URL" onClick={() => void copy('warmup', warmupUrl)}>{copied === 'warmup' ? <Check size={16} /> : <Clipboard size={16} />}</button></div>
          <a className="setup-primary" aria-label="Open participant warm-up" href={warmupUrl}>打开参与者预热页面 <ArrowRight size={17} /></a>
          <div className="launch-link"><div><small>跳过预热校准</small><strong>直接进入实验</strong></div><button title="复制实验页面链接" aria-label="Copy study URL" onClick={() => void copy('study', studyUrl)}>{copied === 'study' ? <Check size={16} /> : <Clipboard size={16} />}</button></div>
          <a className="setup-secondary" aria-label="Open study directly" href={studyUrl}>直接打开实验页面</a>
          <p className="setup-note">实验管理页面不会写入参与者的实验日志。</p>
        </aside>
      </section>
    </main>
  );
}

function createSessionId(): string {
  return `S-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

function cameraProfileLabel(profileId: string): string {
  const labels: Record<string, string> = {
    wide_survey: '广角巡视',
    inspection_balanced: '均衡巡检',
    focused_detail: '重点细节',
  };
  return labels[profileId] ?? profileId.replaceAll('_', ' ');
}
