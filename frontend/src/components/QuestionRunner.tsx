import React, { useState } from 'react';
import type {
  BurdenQuestion,
  FactualQuestion,
  FindabilityTask,
  ProtectionMeasureConfig,
  RequestedConditionOption,
  SimulatedActionOption,
} from '../types';
import { HelpCircle, CheckCircle, ShieldAlert, ArrowRight, Target } from 'lucide-react';

interface FactualQuestionProps {
  questions: FactualQuestion[];
  phase: 'pre' | 'post';
  onSubmit: (answers: Record<string, string>) => void;
}

export const FactualQuestionRunner: React.FC<FactualQuestionProps> = ({ questions, phase, onSubmit }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (qId: string, opt: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: opt }));
    setError(null);
  };

  const handleComplete = () => {
    const missing = questions.filter((q) => !answers[q.question_id]);
    if (missing.length > 0) {
      setError(`请完成所有题目后再提交（还有 ${missing.length} 题未作答）`);
      return;
    }
    onSubmit(answers);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 my-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl text-slate-100">
      <div className="border-b border-slate-800 pb-4">
        <h3 className="text-lg font-bold text-white">
          {phase === 'pre' ? '初始事实推测问答 (基于现场可见线索)' : '完整事实理解测试 (基于已披露档案)'}
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {phase === 'pre'
            ? '请根据刚才观看的模拟实况，对下列事实作出判断。若某些后台事实在现场无法确认，请选择【当前无法确认】。'
            : '请根据上方披露的事实材料回答下列问题。'}
        </p>
      </div>

      <div className="space-y-6">
        {questions.map((q, idx) => (
          <div key={q.question_id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="text-sm font-semibold text-slate-200">
              <span className="text-sky-400 font-mono mr-2">{idx + 1}.</span>
              {q.prompt}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
              {q.options.map((opt) => {
                const selected = answers[q.question_id] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => handleSelect(q.question_id, opt)}
                    className={`p-3 rounded-lg text-xs font-medium text-left transition border ${
                      selected
                        ? 'bg-sky-600/20 text-sky-300 border-sky-500 ring-1 ring-sky-500/50'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center">
                      <span className={`w-3.5 h-3.5 rounded-full border mr-2 flex items-center justify-center ${selected ? 'border-sky-400 bg-sky-400' : 'border-slate-600'}`}>
                        {selected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                      </span>
                      <span>{opt}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-medium">
          {error}
        </div>
      )}

      <div className="pt-4 flex justify-end">
        <button
          onClick={handleComplete}
          className="flex items-center px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold shadow-lg transition"
        >
          <span>提交回答并继续</span>
          <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );
};


interface ProtectionGatingProps {
  q1Config: ProtectionMeasureConfig;
  q2Config: ProtectionMeasureConfig;
  phase: 'pre' | 'post';
  onSubmit: (result: { q1: string; q2: string | null; q2_asked: number; skip_reason: string | null }) => void;
}

export const ProtectionGatingRunner: React.FC<ProtectionGatingProps> = ({ q1Config, q2Config, phase, onSubmit }) => {
  const [q1Answer, setQ1Answer] = useState<string | null>(null);
  const [q2Answer, setQ2Answer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!q1Answer) {
      setError('请先完成第 1 题信息充分性判断');
      return;
    }

    if (q1Answer === '3') {
      // Skipped Q2 structurally
      onSubmit({ q1: q1Answer, q2: null, q2_asked: 0, skip_reason: 'q1_insufficient' });
    } else {
      if (!q2Answer) {
        setError('请完成第 2 题保护担忧程度判断');
        return;
      }
      onSubmit({ q1: q1Answer, q2: q2Answer, q2_asked: 1, skip_reason: null });
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 my-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl text-slate-100">
      <div className="border-b border-slate-800 pb-3">
        <h3 className="text-lg font-bold text-white">
          {phase === 'pre' ? '隐私保护直觉判断 (Pre-assessment)' : '隐私保护综合评估 (Post-assessment)'}
        </h3>
        <p className="text-xs text-slate-400 mt-1">请根据当前阶段你所掌握的信息进行作答。</p>
      </div>

      {/* Q1: Information Sufficiency */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
        <div className="text-sm font-semibold text-slate-200">
          <span className="text-sky-400 font-mono mr-2">Q1.</span>
          {q1Config.prompt}
        </div>

        <div className="space-y-2">
          {q1Config.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setQ1Answer(opt.value);
                setError(null);
              }}
              className={`w-full p-3 rounded-lg text-xs font-medium text-left transition border flex items-center ${
                q1Answer === opt.value
                  ? 'bg-sky-600/20 text-sky-300 border-sky-500 ring-1 ring-sky-500/50'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-full border mr-2.5 flex items-center justify-center ${q1Answer === opt.value ? 'border-sky-400 bg-sky-400' : 'border-slate-600'}`}>
                {q1Answer === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
              </span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Q2: Gated Protection Level (Rendered ONLY if Q1 is 1 or 2) */}
      {q1Answer && q1Answer !== '3' && (
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 animate-fadeIn">
          <div className="text-sm font-semibold text-slate-200">
            <span className="text-amber-400 font-mono mr-2">Q2.</span>
            {q2Config.prompt}
          </div>

          <div className="space-y-2">
            {q2Config.options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setQ2Answer(opt.value);
                  setError(null);
                }}
                className={`w-full p-3 rounded-lg text-xs font-medium text-left transition border flex items-center ${
                  q2Answer === opt.value
                    ? 'bg-amber-600/20 text-amber-300 border-amber-500 ring-1 ring-amber-500/50'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded-full border mr-2.5 flex items-center justify-center ${q2Answer === opt.value ? 'border-amber-400 bg-amber-400' : 'border-slate-600'}`}>
                  {q2Answer === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                </span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {q1Answer === '3' && (
        <div className="p-3 rounded-lg bg-slate-800/60 text-slate-400 text-xs italic">
          因您选择‘信息不足，目前无法形成判断’，系统已按实验规范自动跳过保护程度量表，请直接点击下方按钮继续。
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-medium">
          {error}
        </div>
      )}

      <div className="pt-2 flex justify-end">
        <button
          onClick={handleSubmit}
          className="flex items-center px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold shadow-lg transition"
        >
          <span>确认并进入下一环节</span>
          <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );
};


interface FindabilityProps {
  tasks: FindabilityTask[];
  onComplete: () => void;
}

export const FindabilityRunner: React.FC<FindabilityProps> = ({ tasks, onComplete }) => {
  const [currentIdx, setCurrentIdx] = useState(0);

  const handleNext = () => {
    if (currentIdx + 1 < tasks.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      onComplete();
    }
  };

  const task = tasks[currentIdx];

  return (
    <div className="w-full max-w-2xl mx-auto my-6 p-6 rounded-2xl bg-slate-900 border border-purple-500/40 shadow-2xl text-slate-100 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm">
          <Target className="w-4 h-4" />
          <span>信息寻获性与可用性测试 (任务 {currentIdx + 1}/{tasks.length})</span>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/50 space-y-2">
        <div className="text-xs text-purple-300 font-semibold uppercase tracking-wide">查找任务目标:</div>
        <div className="text-sm font-bold text-white">{task.instruction}</div>
      </div>

      <p className="text-xs text-slate-400">
        请在页面中浏览查找对应信息。当您找到或了解该信息在界面中的位置后，请点击下方按钮完成该项任务。
      </p>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleNext}
          className="flex items-center px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition"
        >
          <span>{currentIdx + 1 === tasks.length ? '完成所有查找任务' : '已找到，下一个任务'}</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </button>
      </div>
    </div>
  );
};
