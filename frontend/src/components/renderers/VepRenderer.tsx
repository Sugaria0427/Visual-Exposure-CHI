import React, { useState } from 'react';
import { RevealMediaView } from '../RevealMediaView';
import type { FactualDataPayload, RevealMediaAsset } from '../../types';
import {
  Eye,
  Database,
  UserCheck,
  LayoutDashboard,
  ShieldCheck,
  ArrowRight,
  HelpCircle,
  Shield,
  Layers,
} from 'lucide-react';
import { eventQueue } from '../../services/eventQueue';

interface VepRendererProps {
  revealMedia?: RevealMediaAsset | null;
  factualData?: FactualDataPayload | null;
}

type VepTab = 'overview' | 'visual_task' | 'lifecycle' | 'recourse';

export const VepRenderer: React.FC<VepRendererProps> = ({ revealMedia, factualData }) => {
  const [activeTab, setActiveTab] = useState<VepTab>('overview');

  if (!factualData) return null;

  const dp = factualData.data_practices || {};
  const tb = factualData.task_boundaries || {};
  const resp = factualData.responsibility?.R01;

  const handleTabChange = (tab: VepTab) => {
    setActiveTab(tab);
    eventQueue.record('vep_tab_change', 'disclosure_view', { target_tab: tab });
  };

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

      {/* VEP 4-Views Navigation Container */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl text-slate-100">
        {/* Navigation Tabs Header */}
        <div className="grid grid-cols-2 md:grid-cols-4 bg-slate-950 border-b border-slate-800">
          <button
            onClick={() => handleTabChange('overview')}
            className={`flex items-center justify-center space-x-2 py-3.5 px-4 text-xs font-bold transition border-b-2 ${
              activeTab === 'overview'
                ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>① 事件核心概览</span>
          </button>

          <button
            onClick={() => handleTabChange('visual_task')}
            className={`flex items-center justify-center space-x-2 py-3.5 px-4 text-xs font-bold transition border-b-2 ${
              activeTab === 'visual_task'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>② 相机能看到什么</span>
          </button>

          <button
            onClick={() => handleTabChange('lifecycle')}
            className={`flex items-center justify-center space-x-2 py-3.5 px-4 text-xs font-bold transition border-b-2 ${
              activeTab === 'lifecycle'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>③ 录像后发生什么</span>
          </button>

          <button
            onClick={() => handleTabChange('recourse')}
            className={`flex items-center justify-center space-x-2 py-3.5 px-4 text-xs font-bold transition border-b-2 ${
              activeTab === 'recourse'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>④ 谁负责与应对渠道</span>
          </button>
        </div>

        {/* Tab Content Display Area */}
        <div className="p-6 space-y-6">
          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center">
                  <LayoutDashboard className="w-4 h-4 mr-2 text-sky-400" />
                  事件事实摘要与关键风险速览
                </h3>
                <span className="text-xs text-slate-400 font-mono">档案 ID: {factualData.record_id}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400 font-semibold">视觉暴露与入镜审计结论</div>
                  <div className="text-sm font-bold text-white">
                    {factualData.visual_exposure === 'high' ? '⚠️ 高暴露：阳台居民部分时段入镜' : '✅ 低暴露：阳台居民全程未入镜'}
                  </div>
                  <div className="text-xs text-slate-400">已由独立几何视场分析核对</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400 font-semibold">关键未知项 (Unknown) 提醒</div>
                  <div className="text-sm font-bold text-purple-400">
                    [D07] 任务外额外推断：当前无法确认
                  </div>
                  <div className="text-xs text-slate-400">运行方未提供推理模型第三方审计报告</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Visual & Tasks */}
          {activeTab === 'visual_task' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center">
                  <Eye className="w-4 h-4 mr-2 text-emerald-400" />
                  相机有效视场与三级识别任务边界
                </h3>
                <p className="text-xs text-slate-400 mt-1">清晰划定当前飞行任务算法在阳台区域‘能做到什么’与‘禁止/无法做到什么’。</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400 font-semibold">1. 检测有人 (I01)</div>
                  <div className="text-base font-bold text-slate-100">
                    {tb.I01_person_presence?.supported ? '✅ 支持自动检测' : '❌ 不支持'}
                  </div>
                  <div className="text-xs text-slate-400">{tb.I01_person_presence?.note}</div>
                  <div>{getEvidenceBadge(tb.I01_person_presence?.evidence_state)}</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400 font-semibold">2. 粗粒度日常活动 (I02)</div>
                  <div className="text-base font-bold text-slate-100">
                    {tb.I02_activity_recognition?.supported ? '✅ 支持轮廓判断' : '❌ 不支持'}
                  </div>
                  <div className="text-xs text-slate-400">{tb.I02_activity_recognition?.note}</div>
                  <div>{getEvidenceBadge(tb.I02_activity_recognition?.evidence_state)}</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400 font-semibold">3. 个人身份识别 (I03)</div>
                  <div className="text-base font-bold text-slate-100">❌ 明确不支持</div>
                  <div className="text-xs text-slate-400">{tb.I03_identity_recognition?.note}</div>
                  <div>{getEvidenceBadge(tb.I03_identity_recognition?.evidence_state)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Data Lifecycle Flow (Interactive Lifecycle) */}
          {activeTab === 'lifecycle' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center">
                  <Database className="w-4 h-4 mr-2 text-purple-400" />
                  数据全生命周期流向图 (D01–D07)
                </h3>
                <p className="text-xs text-slate-400 mt-1">从采集录制、机载处理、云端归档到访问授权的全链条审计证据。</p>
              </div>

              <div className="space-y-3">
                {Object.entries(dp).map(([key, field]) => (
                  <div key={key} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1 max-w-md">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-sky-400">[{field.field_id}]</span>
                        <span className="text-xs font-bold text-slate-200">{field.label}</span>
                      </div>
                      <div className="text-sm font-semibold text-white">{field.value}</div>
                      <div className="text-[11px] text-slate-500">证据来源: {field.source}</div>
                    </div>

                    <div className="flex flex-col items-start md:items-end space-y-1">
                      {getEvidenceBadge(field.evidence_state)}
                      {field.unknown_reason && (
                        <div className="text-[11px] text-purple-300 bg-purple-950/40 px-2 py-1 rounded border border-purple-800/40 max-w-xs text-left md:text-right">
                          {field.unknown_reason}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Recourse & Responsibility */}
          {activeTab === 'recourse' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center">
                  <UserCheck className="w-4 h-4 mr-2 text-amber-400" />
                  责任主体、当前防护与模拟应对渠道
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400 font-semibold">合规责任岗位 (R01)</div>
                  <div className="text-base font-bold text-slate-100">{resp?.operator_name}</div>
                  <div className="text-xs text-sky-400">责任官: {resp?.responsible_role}</div>
                  <div className="text-[11px] text-slate-500">联络入口: {resp?.contact_channel}</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400 font-semibold flex items-center">
                    <Shield className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                    已启用的安全措施
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
          )}
        </div>
      </div>
    </div>
  );
};
