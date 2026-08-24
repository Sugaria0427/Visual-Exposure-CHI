import React, { useRef, useState } from 'react';
import { Play, Pause, Maximize2, Minimize2, Video, CheckCircle2, AlertCircle, Eye } from 'lucide-react';
import type { RevealMediaAsset } from '../types';
import { eventQueue } from '../services/eventQueue';
import { StudyMeshScene } from '../StudyMeshScene';

interface RevealMediaViewProps {
  asset: RevealMediaAsset;
  onTimeChange?: (time: number) => void;
}

export const RevealMediaView: React.FC<RevealMediaViewProps> = ({ asset, onTimeChange }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(12.0); // Default to middle
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const duration = asset.duration_s || 24;

  const inViewSegments = asset.in_view_segments || [];
  const isInView = inViewSegments.some((seg) => currentTime >= seg.start_s && currentTime <= seg.end_s);

  const handleSeek = (time: number) => {
    const clamped = Math.max(0, Math.min(duration, time));
    setCurrentTime(clamped);
    onTimeChange?.(clamped);
    eventQueue.record('reveal_media_seek', 'disclosure_view', { seek_time_s: clamped });
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    eventQueue.record(isPlaying ? 'reveal_media_pause' : 'reveal_media_play', 'disclosure_view', { time_s: currentTime });
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl select-none flex flex-col ${
        isFullscreen ? 'h-screen p-4' : 'aspect-[16/10] min-h-[520px]'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-200">3D 同步揭示证据播放器 (三视角 3D 联动，可自由拖动查看)</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs font-mono text-emerald-400 font-bold bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
            {currentTime.toFixed(1)}s / {duration}s
          </span>
          <button
            onClick={toggleFullscreen}
            className="flex items-center px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 mr-1" /> : <Maximize2 className="w-3.5 h-3.5 mr-1" />}
            {isFullscreen ? '退出' : '全屏'}
          </button>
        </div>
      </div>

      {/* Synchronized 3-Views 3D Display Area */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 p-2 bg-slate-950">
        {/* View 1: 3D External Context */}
        <div className="relative rounded-xl bg-slate-900 border border-slate-800 flex flex-col overflow-hidden shadow-inner">
          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/70 backdrop-blur text-[11px] text-sky-300 font-medium rounded border border-sky-500/30 flex items-center">
            <Eye className="w-3 h-3 mr-1" />
            视角 1: 外部飞行宏观情境
          </div>
          <div className="flex-1 w-full h-full relative">
            <StudyMeshScene
              mode="observer"
              time={currentTime}
              reveal={true}
              droneAppearance={asset.drone_appearance}
            />
          </div>
        </div>

        {/* View 2: 3D Resident Perspective */}
        <div className="relative rounded-xl bg-slate-900 border border-slate-800 flex flex-col overflow-hidden shadow-inner">
          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/70 backdrop-blur text-[11px] text-emerald-300 font-medium rounded border border-emerald-500/30 flex items-center">
            <Eye className="w-3 h-3 mr-1" />
            视角 2: 阳台居民第一人称
          </div>
          <div className="flex-1 w-full h-full relative">
            <StudyMeshScene
              mode="resident"
              time={currentTime}
              reveal={true}
              droneAppearance={asset.drone_appearance}
            />
          </div>
        </div>

        {/* View 3: 3D UAV In-Flight Camera Feed (Key Reveal) */}
        <div className="relative rounded-xl bg-slate-900 border border-amber-500/40 flex flex-col overflow-hidden shadow-inner ring-1 ring-amber-500/20">
          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-amber-500/20 backdrop-blur text-[11px] text-amber-300 font-bold rounded border border-amber-500/40 flex items-center justify-between">
            <span>视角 3: 无人机机载相机 3D 实时画面 (审计事实)</span>
          </div>

          <div className="flex-1 w-full h-full relative">
            <StudyMeshScene
              mode="camera"
              time={currentTime}
              reveal={true}
              droneAppearance={asset.drone_appearance}
            />

            {/* In-View FOV HUD Tag */}
            <div className="absolute bottom-2 left-2 right-2 z-10">
              {isInView ? (
                <div className="p-2 rounded bg-emerald-950/80 backdrop-blur border border-emerald-500/50 text-center animate-pulse">
                  <div className="flex items-center justify-center text-emerald-300 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    [已审计入镜] 目标阳台居民处于有效视场
                  </div>
                  <div className="text-[10px] text-emerald-400">支持检测有人 / 支持日常活动 / 不支持面部识别</div>
                </div>
              ) : (
                <div className="p-2 rounded bg-slate-950/80 backdrop-blur border border-slate-800 text-center">
                  <div className="flex items-center justify-center text-slate-400 font-medium text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5 mr-1" />
                    [未入镜] 目标阳台处于视场盲区外 (Outside FOV)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Timeline & Controls */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2">
        <div className="flex items-center space-x-3">
          <button
            onClick={togglePlay}
            className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center shadow-lg"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Draggable Timeline Slider */}
          <div className="flex-1 relative flex flex-col justify-center">
            {/* Exposure Segments Background Bar */}
            <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-1">
              {inViewSegments.map((seg, idx) => {
                const leftPct = (seg.start_s / duration) * 100;
                const widthPct = ((seg.end_s - seg.start_s) / duration) * 100;
                return (
                  <div
                    key={idx}
                    className="absolute top-0 bottom-0 bg-emerald-500/60 border-l border-r border-emerald-400"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={`入镜时段: ${seg.start_s}s - ${seg.end_s}s`}
                  />
                );
              })}
            </div>

            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/60 mr-1.5 border border-emerald-400" />
              绿色高亮条：确凿审计入镜时间段
            </span>
            <span className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-800 mr-1.5" />
              深色条：目标未入镜时段
            </span>
          </div>
          <div>拖动滑块可联动控制 3 个 3D 视口渲染</div>
        </div>
      </div>
    </div>
  );
};
