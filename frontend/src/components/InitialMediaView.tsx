import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, ShieldAlert, Eye, Radio, Shield } from 'lucide-react';
import type { InitialMediaAsset } from '../types';
import { eventQueue } from '../services/eventQueue';
import { StudyMeshScene } from '../StudyMeshScene';

interface InitialMediaViewProps {
  asset: InitialMediaAsset;
  onComplete: () => void;
}

export const InitialMediaView: React.FC<InitialMediaViewProps> = ({ asset, onComplete }) => {
  const [promptCountdown, setPromptCountdown] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const duration = asset.duration_s || 24;

  // 3s Attention Countdown
  useEffect(() => {
    if (promptCountdown > 0) {
      const timer = window.setInterval(() => {
        setPromptCountdown((prev) => prev - 1);
      }, 1000);
      return () => window.clearInterval(timer);
    } else {
      setIsPlaying(true);
      eventQueue.record('initial_media_start', 'initial_media_once', { duration_s: duration });
    }
  }, [promptCountdown, duration]);

  // Video timeline progress (Strictly non-pausable, non-seekable)
  useEffect(() => {
    if (!isPlaying) return;

    const startTimestamp = performance.now() - currentTime * 1000;
    const interval = window.setInterval(() => {
      const elapsed = (performance.now() - startTimestamp) / 1000;
      if (elapsed >= duration) {
        setCurrentTime(duration);
        setIsPlaying(false);
        window.clearInterval(interval);
        eventQueue.record('initial_media_complete', 'initial_media_once');
        onComplete();
      } else {
        setCurrentTime(elapsed);
      }
    }, 40);

    return () => window.clearInterval(interval);
  }, [isPlaying, duration, onComplete]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const progressPercent = Math.min(100, (currentTime / duration) * 100);

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl select-none ${
        isFullscreen ? 'h-screen p-4 flex flex-col justify-between' : 'aspect-[16/9] min-h-[520px]'
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top Header & HUD */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-transparent">
        <div className="flex items-center space-x-3">
          <div className="flex items-center px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold backdrop-blur-md">
            <Radio className="w-3.5 h-3.5 mr-1.5 animate-pulse text-amber-400" />
            3D 模拟飞行实况展示 (材料仅展示一次，不可暂停/拖动)
          </div>
          <div className="text-slate-300 text-xs font-mono bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800 backdrop-blur">
            {currentTime.toFixed(1)}s / {duration}s
          </div>
          {asset.drone_appearance?.has_police_marking && (
            <div className="hidden sm:flex items-center px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs">
              <Shield className="w-3.5 h-3.5 mr-1 text-blue-400" />
              警用机身涂装 (蓝白条纹)
            </div>
          )}
        </div>

        <button
          onClick={toggleFullscreen}
          className="flex items-center px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs transition border border-slate-700 backdrop-blur shadow-lg"
          title={isFullscreen ? '退出全屏' : '全屏播放'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4 mr-1.5" /> : <Maximize2 className="w-4 h-4 mr-1.5" />}
          {isFullscreen ? '退出全屏' : '全屏放大'}
        </button>
      </div>

      {/* 3s Fullscreen Countdown Overlay */}
      {promptCountdown > 0 && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-amber-400 animate-bounce" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">请注意仔细观看接下来的 3D 模拟材料</h2>
          <p className="text-slate-300 text-sm max-w-md mb-6 leading-relaxed">
            接下来将呈现 3D 建筑物街区与无人机经过住宅的同步双视角画面。材料<strong>仅展示一次且无法暂停或回放</strong>，请重点观察无人机的机身外观特征、飞行路线与拍摄朝向。
          </p>
          <div className="text-3xl font-black font-mono text-amber-400 px-6 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            {promptCountdown}
          </div>
        </div>
      )}

      {/* Synchronized 3D Dual-View Container */}
      <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-2 p-2 pt-14 pb-4">
        {/* Left: 3D External Flight Context View */}
        <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex flex-col shadow-inner">
          <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded bg-black/70 backdrop-blur text-xs text-sky-300 border border-sky-500/30 flex items-center shadow-lg">
            <Eye className="w-3.5 h-3.5 mr-1" />
            视角 1: {asset.external_view_label || '外部宏观飞行情境 (3D 城市街区)'}
          </div>

          <div className="flex-1 w-full h-full relative">
            <StudyMeshScene
              mode="observer"
              time={currentTime}
              droneAppearance={asset.drone_appearance}
              flightCue={asset.flight_cue}
            />
          </div>
        </div>

        {/* Right: 3D Resident First-Person View */}
        <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex flex-col shadow-inner">
          <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded bg-black/70 backdrop-blur text-xs text-emerald-300 border border-emerald-500/30 flex items-center shadow-lg">
            <Eye className="w-3.5 h-3.5 mr-1" />
            视角 2: {asset.resident_view_label || '居民第一人称视角 (6F阳台仰望天空)'}
          </div>

          <div className="flex-1 w-full h-full relative">
            <StudyMeshScene
              mode="resident"
              time={currentTime}
              droneAppearance={asset.drone_appearance}
              flightCue={asset.flight_cue}
            />
          </div>
        </div>
      </div>

      {/* Bottom Progress Bar (Strictly Read-Only Indicator) */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-900">
        <div
          className="h-full bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-500 transition-all duration-75"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
