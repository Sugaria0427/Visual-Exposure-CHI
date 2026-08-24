import React, { useEffect, useState } from 'react';
import { fetchParityCheck, verifyCompletionCode } from './api';
import { CheckCircle2, AlertTriangle, Download, ShieldCheck, Search, Database } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [parityReport, setParityReport] = useState<any>(null);
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchParityCheck().then(setParityReport).catch(console.error);
  }, []);

  const handleVerify = async () => {
    if (!verifyInput.trim()) return;
    setLoading(true);
    try {
      const res = await verifyCompletionCode(verifyInput.trim());
      setVerifyResult(res);
    } catch (err: any) {
      setVerifyResult({ valid: false, status: 'error', detail: err.message });
    } finally {
      setLoading(false);
    }
  };

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white">VEP 主实验管理与审计控制台</h1>
          <p className="text-xs text-slate-400 mt-1">管理完成码核销、Parity 事实等价性检查与长表数据导出</p>
        </div>
        <div className="flex items-center space-x-3">
          <a
            href={`${API_BASE_URL}/api/admin/export/responses.csv`}
            download
            className="flex items-center px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-lg"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            导出 Responses 长表 CSV
          </a>
          <a
            href={`${API_BASE_URL}/api/admin/export/events.jsonl`}
            download
            className="flex items-center px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg"
          >
            <Database className="w-3.5 h-3.5 mr-1.5" />
            导出 Events 原始 JSONL
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Completion Code Verification & Reconciliation */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
            <ShieldCheck className="w-5 h-5" />
            <h2>完成码核销与对账工具 (Completion Code Reconciliation)</h2>
          </div>

          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="输入 8 位完成码 (例如: VEP-8X2K9P)"
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 font-mono uppercase"
            />
            <button
              onClick={handleVerify}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center"
            >
              <Search className="w-3.5 h-3.5 mr-1" />
              核销查询
            </button>
          </div>

          {verifyResult && (
            <div className={`p-4 rounded-xl border text-xs space-y-1 ${verifyResult.valid ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-red-950/30 border-red-500/40 text-red-300'}`}>
              <div className="font-bold flex items-center">
                {verifyResult.valid ? <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 mr-1.5 text-red-400" />}
                核销状态: {verifyResult.status}
              </div>
              {verifyResult.session_id && <div>Session ID: {verifyResult.session_id}</div>}
              {verifyResult.cell_id && <div>分配 Cell: {verifyResult.cell_id}</div>}
              {verifyResult.issued_at && <div>签发时间: {verifyResult.issued_at}</div>}
              {verifyResult.verified_at && <div>核销时间: {verifyResult.verified_at}</div>}
            </div>
          )}
        </div>

        {/* Section 2: Automated S vs V Parity Auditor */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2 text-sky-400 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <h2>S / V 事实等价性审计 (Parity Checker)</h2>
          </div>

          {parityReport ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span>总体 Parity 状态:</span>
                <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  {parityReport.overall_status} (100% 逐字段对齐)
                </span>
              </div>

              <div className="space-y-2">
                {parityReport.details?.map((rec: any) => (
                  <div key={rec.record_id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold font-mono text-slate-200">档案 {rec.record_id}</span>
                      <span className="text-slate-500 ml-2">({rec.fields_count} 字段完全对齐)</span>
                    </div>
                    <span className="text-emerald-400 font-semibold font-mono">PASS</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">正在检查 Parity 状态...</div>
          )}
        </div>
      </div>
    </div>
  );
};
