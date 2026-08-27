'use client';

import {useEffect,useState} from 'react';

type Theme='dark'|'light';
const STORAGE_KEY='media-runtime-theme';

export function ThemeToggle(){
  const [theme,setTheme]=useState<Theme>('dark');
  useEffect(()=>{const saved=window.localStorage.getItem(STORAGE_KEY);const initial:Theme=saved==='light'||saved==='dark'?saved:window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=initial;setTheme(initial);},[]);
  const toggle=()=>{const next:Theme=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;window.localStorage.setItem(STORAGE_KEY,next);setTheme(next);};
  return <button className="theme-toggle" type="button" onClick={toggle} aria-label={`切換為${theme==='dark'?'明亮':'暗色'}主題`}>{theme==='dark'?'☀ 明亮主題':'☾ 暗色主題'}</button>;
}
