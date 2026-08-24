import React from 'react';
import { RevealMediaView } from '../RevealMediaView';
import type { FactualDataPayload, RevealMediaAsset } from '../../types';
import { ShieldCheck, AlertCircle, Info, Database, UserCheck, Shield } from 'lucide-react';

interface StructuredFactsRendererProps {
  revealMedia?: RevealMediaAsset | null;
  factualData?: FactualDataPayload | null;
}

export const StructuredFactsRenderer: React.FC<StructuredFactsRendererProps> = ({
  revealMedia,
  factualData,
}) => {
  if (!factualData) return null;

  const dp = factualData.data_practices || {};
  const tb = factualData.task_boundaries || {};
  const resp = factualData.responsibility?.R01;

  const getEvidenceBadge = (state: string) => {
    switch (state) {
      case 'audited':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">已技术审计核对</span>;
      case 'verified':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">已由事件记录核对</span>;
      case 'operator-declared':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">运行方业务声明</span>;
      case 'unknown':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">当前无法确认 (Unknown)</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-700 text-slate-300">{state}</span>;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 my-4">
      {/* Top Reveal Video Player */}
      {revealMedia && <RevealMediaView asset={revealMedia} />}

      {/* Linearly Flattened Structured Document (Condition S: Linear Document) */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-8 text-slate-100 shadow-xl">
        <div className="border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">完整事件事实档案 (线性平铺清单)</h2>
            <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full font-mono">
              档案编号: {factualData.record_id} ({factualData.profile_name})
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">以下列出本次飞行事件全部经过审计或声明的客观事实与数据流向，所有信息直接平铺展开。</p>
        </div>

        {/* Section 1: Visual & Tasks */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-sky-400 flex items-center tracking-wide uppercase">
            <Info className="w-4 h-4 mr-2" />
            一、 视觉采集与相机识别能力边界
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-xs text-slate-400 font-medium">检测画面中是否有人 (I01)</div>
              <div className="text-sm font-bold text-slate-200">
                {tb.I01_person_presence?.supported ? '✅ 支持自动检测' : '❌ 不支持'}
              </div>
              <div className="text-[11px] text-slate-500">{tb.I01_person_presence?.note}</div>
              <div>{getEvidenceBadge(tb.I01_person_presence?.evidence_state)}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-xs text-slate-400 font-medium">粗粒度日常活动判断 (I02)</div>
              <div className="text-sm font-bold text-slate-200">
                {tb.I02_activity_recognition?.supported ? '✅ 支持轮廓判断' : '❌ 不支持'}
              </div>
              <div className="text-[11px] text-slate-500">{tb.I02_activity_recognition?.note}</div>
              <div>{getEvidenceBadge(tb.I02_activity_recognition?.evidence_state)}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-xs text-slate-400 font-medium">面部与个人身份识别 (I03)</div>
              <div className="text-sm font-bold text-slate-200">❌ 明确不支持</div>
              <div className="text-[11px] text-slate-500">{tb.I03_identity_recognition?.note}</div>
              <div>{getEvidenceBadge(tb.I03_identity_recognition?.evidence_state)}</div>
            </div>
          </div>
        </div>

        {/* Section 2: Data Practices D01-D07 */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center tracking-wide uppercase">
            <Database className="w-4 h-4 mr-2" />
            二、 数据流向与生命周期实践 (D01–D07)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(dp).map(([key, field]) => (
              <div key={key} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-400">[{field.field_id}] {field.label}</span>
                  {getEvidenceBadge(field.evidence_state)}
                </div>
                <div className="text-sm font-bold text-white">{field.value}</div>
                <div className="text-[11px] text-slate-400">来源依据: {field.source}</div>
                {field.unknown_reason && (
                  <div className="text-[11px] text-purple-300 bg-purple-950/30 p-2 rounded border border-purple-900/40">
                    <span className="font-semibold">无法确认原因:</span> {field.unknown_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Responsibility & Safeguards */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-amber-400 flex items-center tracking-wide uppercase">
            <UserCheck className="w-4 h-4 mr-2" />
            三、 责任主体、已启用保护与应对渠道
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-400">运营主体与解释责任角色 (R01)</div>
              <div className="text-sm font-bold text-slate-200">{resp?.operator_name}</div>
              <div className="text-xs text-sky-400">责任岗位: {resp?.responsible_role}</div>
              <div className="text-[11px] text-slate-500">联络入口: {resp?.contact_channel}</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-400 flex items-center">
                <Shield className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                当前已启用的安全保护措施
              </div>
              <ul className="space-y-1">
                {factualData.active_safeguards?.map((sg, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-center">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mr-1.5 flex-shrink-0" />
                    {sg}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
