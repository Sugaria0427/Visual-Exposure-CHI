import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';

const pathname = window.location.pathname;
const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
const isLegacy = pathname === '/legacy' || pathname.startsWith('/legacy/');

const RoutedExperience = isAdmin
  ? lazy(() => import('./AdminDashboard').then((m) => ({ default: m.AdminDashboard })))
  : isLegacy
    ? lazy(() => import('./App').then((m) => ({ default: m.App })))
    : lazy(() => import('./StudyRunner').then((m) => ({ default: m.StudyRunner })));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">加载中...</div>}>
      <RoutedExperience />
    </Suspense>
  </React.StrictMode>,
);
