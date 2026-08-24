import React from 'react';
import { FileText, ShieldCheck, PhoneCall, MapPin, Clock, Building } from 'lucide-react';
import type { FactualDataPayload } from '../../types';

interface MediaNoticeRendererProps {
  factualData?: FactualDataPayload | null;
}

export const MediaNoticeRenderer: React.FC<MediaNoticeRendererProps> = ({ factualData }) => {
  const card = factualData?.notice_card || {
    title: '无人机例行巡检飞行备案通知',
    time: '今日 14:00 - 16:00',
    location: '本住宅楼及周边公共空域',
    operator: '城市低空数智巡检运营中心 (模拟)',
    task: '住宅外立面及公共设施例行合规巡检',
    registration_code: 'UAV-REG-2026-08842',
    contact: '服务监督热线: 400-820-0099',
    note: '本次飞行已依法依规完成低空空域及任务报备。如对飞行作业有任何疑问或诉求，可通过上述渠道咨询。',
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-6 p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-xl text-slate-100 space-y-6">
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
        <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{card.title}</h3>
          <div className="text-xs text-slate-400 flex items-center mt-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mr-1" />
            官方备案编号: {card.registration_code}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
          <div className="text-xs text-slate-400 flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            作业时间窗口
          </div>
          <div className="font-semibold text-slate-200">{card.time}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
          <div className="text-xs text-slate-400 flex items-center">
            <MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            作业空域范围
          </div>
          <div className="font-semibold text-slate-200">{card.location}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
          <div className="text-xs text-slate-400 flex items-center">
            <Building className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            飞行运营责任主体
          </div>
          <div className="font-semibold text-slate-200">{card.operator}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
          <div className="text-xs text-slate-400 flex items-center">
            <PhoneCall className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            监督与服务联络渠道
          </div>
          <div className="font-semibold text-sky-400">{card.contact}</div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-300 leading-relaxed">
        <div className="font-semibold text-slate-200 mb-1">【任务说明与特别提示】</div>
        <p>{card.task}。{card.note}</p>
      </div>
    </div>
  );
};
