import React, { useEffect, useState } from 'react';
import {
  launchStudy,
  getSessionStatus,
  confirmStart,
  getMaterials,
  submitResponse,
  advanceState,
  completeStudy,
} from './api';
import { eventQueue } from './services/eventQueue';
import { InitialMediaView } from './components/InitialMediaView';
import { MediaNoticeRenderer } from './components/renderers/MediaNoticeRenderer';
import { StructuredFactsRenderer } from './components/renderers/StructuredFactsRenderer';
import { VepRenderer } from './components/renderers/VepRenderer';
import {
  FactualQuestionRunner,
  ProtectionGatingRunner,
  FindabilityRunner,
} from './components/QuestionRunner';
import type { MaterialsPayload, StudySessionInfo, StudyStepId } from './types';
import {
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  Copy,
  ExternalLink,
  Loader2,
  HelpCircle,
} from 'lucide-react';

export const StudyRunner: React.FC = () => {
  const [sessionInfo, setSessionInfo] = useState<StudySessionInfo | null>(null);
  const [currentStep, setCurrentStep] = useState<StudyStepId>('launch_received');
  const [materialsPre, setMaterialsPre] = useState<MaterialsPayload | null>(null);
  const [materialsPost, setMaterialsPost] = useState<MaterialsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completionCode, setCompletionCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Safeguards & Actions local state
  const [selectedSafeguards, setSelectedSafeguards] = useState<string[]>([]);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [actionFeasibility, setActionFeasibility] = useState<number>(3);
  const [burdenScores, setBurdenScores] = useState<Record<string, string>>({});

  // 1. Initialize or Recover Session
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const urlParams = new URLSearchParams(window.location.search);
        const launchToken = urlParams.get('launch_token') || urlParams.get('token') || `pilot_${Date.now()}`;
        const storedSessionId = window.sessionStorage.getItem('vep_active_session_id');

        let sInfo: StudySessionInfo;
        if (storedSessionId) {
          try {
            sInfo = await getSessionStatus(storedSessionId);
          } catch {
            sInfo = await launchStudy(launchToken);
          }
        } else {
          sInfo = await launchStudy(launchToken);
        }

        window.sessionStorage.setItem('vep_active_session_id', sInfo.session_id);
        setSessionInfo(sInfo);
        setCurrentStep(sInfo.current_step);
        eventQueue.init(sInfo.session_id);

        // Fetch pre materials
        const matPre = await getMaterials(sInfo.session_id, 'pre');
        setMaterialsPre(matPre);

        // If post materials needed
        const matPost = await getMaterials(sInfo.session_id, 'post');
        setMaterialsPost(matPost);
      } catch (err: any) {
        setError(err.message || '系统连接失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    }
    init();

    return () => {
      eventQueue.dispose();
    };
  }, []);

  const handleStepTransition = async (nextStep: StudyStepId) => {
    if (!sessionInfo) return;
    try {
      setCurrentStep(nextStep);
      await advanceState(sessionInfo.session_id, nextStep);
      eventQueue.record('state_transition', nextStep);
    } catch (err: any) {
      console.error('Failed to advance state:', err);
    }
  };

  // Step 1 -> Step 2
  const handleStartConfirm = async () => {
    if (!sessionInfo) return;
    await confirmStart(sessionInfo.session_id);
    handleStepTransition('initial_media_once');
  };

  // Step 2 Initial Video Completed -> Step 3 Pre Q1/Q2
  const handleInitialMediaComplete = async () => {
    handleStepTransition('pre_q1_sufficiency');
  };

  // Pre Q1/Q2 submitted -> Step 4 Pre Factual Items
  const handlePreProtectionSubmit = async (res: { q1: string; q2: string | null; q2_asked: number; skip_reason: string | null }) => {
    if (!sessionInfo) return;
    await submitResponse({
      session_id: sessionInfo.session_id,
      phase: 'pre',
      question_id: 'Q1',
      response_value: res.q1,
      q2_asked: res.q2_asked,
      skip_reason: res.skip_reason || undefined,
    });

    if (res.q2) {
      await submitResponse({
        session_id: sessionInfo.session_id,
        phase: 'pre',
        question_id: 'Q2',
        response_value: res.q2,
        q2_asked: 1,
      });
    }

    handleStepTransition('pre_factual_questions');
  };

  // Pre Factual Items submitted -> Step 5 Disclosure View
  const handlePreFactualSubmit = async (answers: Record<string, string>) => {
    if (!sessionInfo) return;
    for (const [qId, val] of Object.entries(answers)) {
      await submitResponse({
        session_id: sessionInfo.session_id,
        phase: 'pre',
        question_id: qId,
        response_value: val,
      });
    }
    handleStepTransition('disclosure_view');
  };

  // Disclosure Finished -> Step 6 Post Factual Questions (Open-book)
  const handleContinueToPostFactual = () => {
    handleStepTransition('post_factual_questions');
  };

  // Post Factual submitted -> Step 7 Post Q1/Q2
  const handlePostFactualSubmit = async (answers: Record<string, string>) => {
    if (!sessionInfo) return;
    for (const [qId, val] of Object.entries(answers)) {
      await submitResponse({
        session_id: sessionInfo.session_id,
        phase: 'post',
        question_id: qId,
        response_value: val,
      });
    }
    handleStepTransition('post_q1_sufficiency');
  };

  // Post Q1/Q2 submitted -> Step 8 (S/V -> Findability, M -> Safeguards)
  const handlePostProtectionSubmit = async (res: { q1: string; q2: string | null; q2_asked: number; skip_reason: string | null }) => {
    if (!sessionInfo) return;
    await submitResponse({
      session_id: sessionInfo.session_id,
      phase: 'post',
      question_id: 'Q1',
      response_value: res.q1,
      q2_asked: res.q2_asked,
      skip_reason: res.skip_reason || undefined,
    });

    if (res.q2) {
      await submitResponse({
        session_id: sessionInfo.session_id,
        phase: 'post',
        question_id: 'Q2',
        response_value: res.q2,
        q2_asked: 1,
      });
    }

    if (sessionInfo.condition in ['S', 'V']) {
      handleStepTransition('findability_tasks');
    } else {
      handleStepTransition('requested_safeguards');
    }
  };

  // Step 8 Findability Complete -> Step 9 Safeguards
  const handleFindabilityComplete = () => {
    handleStepTransition('requested_safeguards');
  };

  // Step 9 Safeguards & Actions Submit -> Step 10 Burden & Debrief
  const handleSafeguardsSubmit = async () => {
    if (!sessionInfo) return;
    await submitResponse({
      session_id: sessionInfo.session_id,
      phase: 'post',
      question_id: 'SAFEGUARDS_ACTIONS',
      requested_conditions: selectedSafeguards,
      simulated_action: selectedAction || undefined,
      action_feasibility: actionFeasibility,
    });
    handleStepTransition('burden_and_debrief');
  };

  // Step 10 Burden & Debrief Complete -> Step 11 Complete & Get Code
  const handleFinalSubmit = async () => {
    if (!sessionInfo) return;
    for (const [bId, val] of Object.entries(burdenScores)) {
      await submitResponse({
        session_id: sessionInfo.session_id,
        phase: 'post',
        question_id: bId,
        response_value: val,
      });
    }

    const compRes = await completeStudy(sessionInfo.session_id);
    setCompletionCode(compRes.completion_code);
    handleStepTransition('completion_code_issued');
  };

  const copyCode = () => {
    if (completionCode) {
      navigator.clipboard.writeText(completionCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <Loader2 className="w-10 h-10 text-sky-400 animate-spin mb-4" />
        <div className="text-sm font-semibold text-slate-300">正在分配实验材料，请稍候...</div>
      </div>
    );
  }

  if (error || !sessionInfo) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="p-6 max-w-md bg-slate-900 border border-red-500/40 rounded-2xl text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">实验入口错误</h2>
          <p className="text-xs text-slate-400">{error || '无法加载分配的实验会话'}</p>
        </div>
      </div>
    );
  }

  const qs = materialsPost?.question_set || materialsPre?.question_set;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Banner Header */}
      <header className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="w-3 h-3 rounded-full bg-sky-500 animate-pulse" />
          <h1 className="text-sm font-bold text-slate-200">无人机低空飞行事件披露与保护评估研究</h1>
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Session ID: {sessionInfo.session_id.slice(0, 10)}...
        </div>
      </header>

      {/* Main Content State Router */}
      <main className="flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto flex flex-col justify-center">
        {/* Step 1: Assignment Ready & Start Confirmation */}
        {currentStep === 'assignment_locked' && (
          <div className="max-w-xl mx-auto p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mx-auto text-sky-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">模拟实验材料已准备就绪</h2>
            <p className="text-sm text-slate-300 leading-relaxed text-left">
              感谢您参与本项研究。接下来，系统将为您呈现一段模拟的无人机经过住宅阳台的实况材料，并邀请您回答若干理解与判断问题。
              <br /><br />
              <strong>【重要提示】：</strong>
              初始视频材料<strong>仅展示一次且无法暂停或回放</strong>，展示前会有 3 秒倒计时提示。请在安静、专注的环境下点击下方按钮开始。
            </p>
            <button
              onClick={handleStartConfirm}
              className="w-full py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-lg transition flex items-center justify-center"
            >
              <span>我已准备好，开始观看材料</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        )}

        {/* Step 2: Initial Media Player */}
        {currentStep === 'initial_media_once' && materialsPre?.initial_media && (
          <div className="space-y-4">
            <InitialMediaView
              asset={materialsPre.initial_media}
              onComplete={handleInitialMediaComplete}
            />
          </div>
        )}

        {/* Step 3: Pre Q1/Q2 Protection Assessment */}
        {currentStep === 'pre_q1_sufficiency' && qs && (
          <ProtectionGatingRunner
            q1Config={qs.protection_measures.q1}
            q2Config={qs.protection_measures.q2}
            phase="pre"
            onSubmit={handlePreProtectionSubmit}
          />
        )}

        {/* Step 4: Pre Factual Questions */}
        {currentStep === 'pre_factual_questions' && qs && (
          <FactualQuestionRunner
            questions={qs.factual_questions.slice(0, 13)}
            phase="pre"
            onSubmit={handlePreFactualSubmit}
          />
        )}

        {/* Step 5: Core Disclosure Phase (M / S / V) */}
        {currentStep === 'disclosure_view' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-white">事件详细信息披露与证据查阅</h2>
              <p className="text-xs text-slate-400">请仔细查阅下方提供的披露材料与证据事实。</p>
            </div>

            {sessionInfo.condition === 'M' && (
              <MediaNoticeRenderer factualData={materialsPost?.factual_data} />
            )}

            {sessionInfo.condition === 'S' && (
              <StructuredFactsRenderer
                revealMedia={materialsPost?.reveal_media}
                factualData={materialsPost?.factual_data}
              />
            )}

            {sessionInfo.condition === 'V' && (
              <VepRenderer
                revealMedia={materialsPost?.reveal_media}
                factualData={materialsPost?.factual_data}
              />
            )}

            <div className="flex justify-end pt-4">
              <button
                onClick={handleContinueToPostFactual}
                className="flex items-center px-8 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-xl transition"
              >
                <span>已查阅完毕，进入事实理解测试</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Post Factual Questions (Open-book mode) */}
        {currentStep === 'post_factual_questions' && qs && (
          <div className="space-y-6">
            {/* Show top disclosure for open-book reference */}
            {sessionInfo.condition === 'M' && <MediaNoticeRenderer factualData={materialsPost?.factual_data} />}
            {sessionInfo.condition === 'S' && (
              <StructuredFactsRenderer revealMedia={materialsPost?.reveal_media} factualData={materialsPost?.factual_data} />
            )}
            {sessionInfo.condition === 'V' && (
              <VepRenderer revealMedia={materialsPost?.reveal_media} factualData={materialsPost?.factual_data} />
            )}

            <FactualQuestionRunner
              questions={qs.factual_questions}
              phase="post"
              onSubmit={handlePostFactualSubmit}
            />
          </div>
        )}

        {/* Step 7: Post Q1/Q2 */}
        {currentStep === 'post_q1_sufficiency' && qs && (
          <ProtectionGatingRunner
            q1Config={qs.protection_measures.q1}
            q2Config={qs.protection_measures.q2}
            phase="post"
            onSubmit={handlePostProtectionSubmit}
          />
        )}

        {/* Step 8: Findability Tasks (S & V only) */}
        {currentStep === 'findability_tasks' && qs && (
          <div className="space-y-6">
            {sessionInfo.condition === 'S' && (
              <StructuredFactsRenderer revealMedia={materialsPost?.reveal_media} factualData={materialsPost?.factual_data} />
            )}
            {sessionInfo.condition === 'V' && (
              <VepRenderer revealMedia={materialsPost?.reveal_media} factualData={materialsPost?.factual_data} />
            )}

            <FindabilityRunner
              tasks={qs.findability_tasks}
              onComplete={handleFindabilityComplete}
            />
          </div>
        )}

        {/* Step 9: Requested Safeguards & Actions */}
        {currentStep === 'requested_safeguards' && qs && (
          <div className="max-w-3xl mx-auto my-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6 text-slate-100">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">隐私保护最低条件与模拟行动诉求</h3>
              <p className="text-xs text-slate-400 mt-1">请选择您认为在当前情境下最合理的保护诉求与行动方案。</p>
            </div>

            {/* Safeguards Selection (Max 3) */}
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-200">
                1. 如果要求该飞行继续进行，您认为必须增加的【最低保护条件】有哪些？（多选，至多选择 3 项）
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {qs.requested_conditions_catalog.map((c) => {
                  const checked = selectedSafeguards.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        if (checked) {
                          setSelectedSafeguards(selectedSafeguards.filter((x) => x !== c.id));
                        } else {
                          if (selectedSafeguards.length < 3) {
                            setSelectedSafeguards([...selectedSafeguards, c.id]);
                          }
                        }
                      }}
                      className={`p-3 rounded-lg text-xs font-medium text-left transition border flex items-center ${
                        checked
                          ? 'bg-sky-600/20 text-sky-300 border-sky-500'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border mr-2 flex items-center justify-center ${checked ? 'bg-sky-500 border-sky-400' : 'border-slate-600'}`}>
                        {checked && <span className="text-white text-[9px]">✓</span>}
                      </span>
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Simulated Action */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="text-sm font-semibold text-slate-200">
                2. 在本次研究情境中，如果您需要采取行动，您最倾向选择哪一项？（单选）
              </div>
              <div className="space-y-2">
                {qs.simulated_actions_catalog.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAction(a.id)}
                    className={`w-full p-3 rounded-lg text-xs font-medium text-left transition border flex items-center ${
                      selectedAction === a.id
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border mr-2.5 flex items-center justify-center ${selectedAction === a.id ? 'bg-emerald-400 border-emerald-400' : 'border-slate-600'}`}>
                      {selectedAction === a.id && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleSafeguardsSubmit}
                className="flex items-center px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition"
              >
                <span>下一步：主观体验评价</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 10: Burden & Debrief */}
        {currentStep === 'burden_and_debrief' && qs && (
          <div className="max-w-3xl mx-auto my-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6 text-slate-100">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">主观认知负担评价与研究说明 (Debrief)</h3>
            </div>

            <div className="space-y-4">
              {qs.burden_questions.map((b) => (
                <div key={b.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-slate-200">{b.prompt}</div>
                  <div className="grid grid-cols-5 gap-1.5 pt-1">
                    {b.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setBurdenScores({ ...burdenScores, [b.id]: opt })}
                        className={`p-2 rounded-lg text-[11px] font-medium text-center transition border ${
                          burdenScores[b.id] === opt
                            ? 'bg-sky-600/30 text-sky-300 border-sky-400'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-400 space-y-1 leading-relaxed">
              <div className="font-bold text-slate-300">【实验背景与知情说明 (Debrief)】</div>
              <p>
                本研究旨在探讨不同组织形式的低空无人机飞行信息披露对公众理解和隐私保护判断的影响。材料中涉及的飞行事件与运营方为学术模拟情境，旨在评估可视化证据与生命周期披露的可用性。
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleFinalSubmit}
                className="flex items-center px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl transition"
              >
                <span>完成实验并生成完成码</span>
                <CheckCircle2 className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 11: Completion Code Issued */}
        {currentStep === 'completion_code_issued' && completionCode && (
          <div className="max-w-md mx-auto my-12 p-8 rounded-2xl bg-slate-900 border border-emerald-500/40 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">实验已全部完成！</h2>
              <p className="text-xs text-slate-400">感谢您的认真参与，请妥善保存您的完成码。</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-xs text-slate-500 font-mono">您的唯一防伪完成码 (Completion Code):</div>
              <div className="text-2xl font-black font-mono text-emerald-400 tracking-wider">
                {completionCode}
              </div>
            </div>

            <button
              onClick={copyCode}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition flex items-center justify-center"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              <span>{copiedCode ? '已成功复制到剪贴板！' : '复制完成码'}</span>
            </button>

            <div className="text-xs text-amber-300/80 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 text-left">
              <strong>【下一步操作】：</strong>
              请返回原问卷调查页面，将上方完成码填入问卷末尾的核对框并最终提交问卷，以便审核发放报酬。
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
