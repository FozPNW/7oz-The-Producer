import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Music, 
  Activity, 
  Settings, 
  Play, 
  Square, 
  ChevronRight, 
  Code,
  Volume2,
  Waves,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeAudioKey, generateAbletonScript } from './services/audioService';

interface AudioAnalysis {
  frequency: number;
  key: string;
  noteName: string;
  confidence: number;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [tuning, setTuning] = useState<number>(0); // semitones
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCode, setShowCode] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const intervals = [
    { label: '-6th', value: -9, color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
    { label: '-5th', value: -7, color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
    { label: '-3rd', value: -4, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
    { label: 'Fundamental', value: 0, color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50' },
    { label: '+3rd', value: 4, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
    { label: '+5th', value: 7, color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
    { label: '+6th', value: 9, color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    const url = URL.createObjectURL(uploadedFile);
    setAudioUrl(url);
    setIsAnalyzing(true);
    setAnalysis(null);
    setTuning(0);

    // Load into Web Audio
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const arrayBuffer = await uploadedFile.arrayBuffer();
    audioBufferRef.current = await audioContextRef.current.decodeAudioData(arrayBuffer);
    
    drawWaveform();

    // Convert to base64 for Gemini
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const result = await analyzeAudioKey(base64, uploadedFile.type);
      setAnalysis(result);
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(uploadedFile);
  };

  const drawWaveform = () => {
    if (!audioBufferRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = audioBufferRef.current.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.strokeStyle = '#f27d26';
    ctx.lineWidth = 2;

    for (let i = 0; i < canvas.width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.moveTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();
  };

  const playSound = () => {
    if (!audioContextRef.current || !audioBufferRef.current) return;
    
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    
    // Pitch shifting via playbackRate
    // semitones to playbackRate: 2^(semitones/12)
    source.playbackRate.value = Math.pow(2, tuning / 12);
    
    source.connect(audioContextRef.current.destination);
    source.start();
    sourceNodeRef.current = source;
    setIsPlaying(true);
    
    source.onended = () => setIsPlaying(false);
  };

  const stopSound = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      setIsPlaying(false);
    }
  };

  const getIntervalName = (val: number) => {
    if (val === 0) return 'fundamental';
    const abs = Math.abs(val);
    const dir = val > 0 ? 'up' : 'down';
    if (abs === 4) return `3rd_${dir}`;
    if (abs === 7) return `5th_${dir}`;
    if (abs === 9) return `6th_${dir}`;
    return 'fundamental';
  };

  return (
    <div className="min-h-screen ableton-grid p-4 md:p-8 flex flex-col items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl glass-panel rounded-2xl overflow-hidden shadow-2xl border border-white/10"
      >
        {/* Header */}
        <div className="p-6 border-bottom border-white/5 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Waves className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight">Harmonic Simpler</h1>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">v1.0.0 // AI-Powered Tuner</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowCode(!showCode)}
              className={`p-2 rounded-lg transition-colors ${showCode ? 'bg-orange-500 text-white' : 'hover:bg-white/5 text-zinc-400'}`}
              title="View Ableton Script"
            >
              <Code size={20} />
            </button>
            <button className="p-2 rounded-lg hover:bg-white/5 text-zinc-400">
              <Settings size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 divide-x divide-white/5">
          {/* Left Panel: Controls & Analysis */}
          <div className="p-6 space-y-8 lg:col-span-1">
            <section className="space-y-4">
              <label className="block text-xs font-mono uppercase text-zinc-500 tracking-wider">Sample Input</label>
              <div className="relative group">
                <input 
                  type="file" 
                  accept="audio/*" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-all ${file ? 'border-orange-500/50 bg-orange-500/5' : 'border-zinc-800 group-hover:border-zinc-700'}`}>
                  {file ? (
                    <>
                      <Music className="text-orange-500" size={32} />
                      <span className="text-sm font-medium text-zinc-300 truncate w-full text-center px-4">{file.name}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="text-zinc-600 group-hover:text-zinc-400 transition-colors" size={32} />
                      <span className="text-sm text-zinc-500">Drop sample here</span>
                    </>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono uppercase text-zinc-500 tracking-wider">Analysis</label>
                {isAnalyzing && <RefreshCw className="animate-spin text-orange-500" size={14} />}
              </div>
              
              <div className="bg-black/40 rounded-xl p-4 border border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">Fundamental</span>
                  <span className="text-sm font-mono text-orange-400">{analysis?.noteName || (isAnalyzing ? 'Analyzing...' : '--')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">Frequency</span>
                  <span className="text-sm font-mono text-zinc-300">{analysis?.frequency ? `${analysis.frequency} Hz` : '--'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">Key</span>
                  <span className="text-sm font-mono text-zinc-300">{analysis?.key || '--'}</span>
                </div>
                <div className="pt-2">
                  <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: analysis ? `${analysis.confidence * 100}%` : 0 }}
                      className="h-full bg-orange-500"
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-zinc-600 uppercase">Confidence</span>
                    <span className="text-[10px] text-zinc-600">{analysis ? `${Math.round(analysis.confidence * 100)}%` : '0%'}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Panel: Simpler Interface */}
          <div className="lg:col-span-2 flex flex-col">
            {/* Waveform Display */}
            <div className="p-6 flex-1 bg-black/20 relative min-h-[200px] flex items-center justify-center">
              {!file && (
                <div className="text-zinc-700 flex flex-col items-center gap-2">
                  <Activity size={48} strokeWidth={1} />
                  <p className="text-sm">No sample loaded</p>
                </div>
              )}
              <canvas 
                ref={canvasRef} 
                width={600} 
                height={200} 
                className="w-full h-full max-h-[240px] opacity-80"
              />
              
              {/* Playback Controls */}
              <div className="absolute bottom-6 right-6 flex gap-2">
                <button 
                  onClick={isPlaying ? stopSound : playSound}
                  disabled={!file}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${!file ? 'bg-zinc-800 text-zinc-600 opacity-50' : 'bg-orange-500 text-white hover:scale-105 active:scale-95 shadow-lg shadow-orange-500/20'}`}
                >
                  {isPlaying ? <Square size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                </button>
              </div>
            </div>

            {/* Tuning Grid */}
            <div className="p-6 border-t border-white/5 bg-black/40">
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs font-mono uppercase text-zinc-500 tracking-wider">Harmonic Tuning Constraints</label>
                <div className="flex items-center gap-2 text-xs font-mono text-orange-500">
                  <Volume2 size={12} />
                  <span>{tuning > 0 ? `+${tuning}` : tuning} ST</span>
                </div>
              </div>
              
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {intervals.map((interval) => (
                  <button
                    key={interval.label}
                    onClick={() => setTuning(interval.value)}
                    disabled={!file}
                    className={`h-16 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${!file ? 'opacity-30 grayscale cursor-not-allowed' : tuning === interval.value ? 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-inner' : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800 hover:border-white/10'}`}
                  >
                    <span className="text-[10px] font-mono uppercase opacity-60">{interval.label}</span>
                    <span className="text-sm font-bold">{interval.value > 0 ? `+${interval.value}` : interval.value}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Code Overlay */}
        <AnimatePresence>
          {showCode && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-white/10 bg-zinc-950 overflow-hidden"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code size={16} className="text-orange-500" />
                    <h3 className="text-sm font-bold">Ableton Live Python Script</h3>
                  </div>
                  <button 
                    onClick={() => {
                      const code = generateAbletonScript(analysis?.noteName || 'C', getIntervalName(tuning));
                      navigator.clipboard.writeText(code);
                    }}
                    className="text-[10px] font-mono uppercase bg-white/5 hover:bg-white/10 px-2 py-1 rounded border border-white/10 transition-colors"
                  >
                    Copy to Clipboard
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-zinc-400 bg-black/50 p-4 rounded-lg overflow-x-auto border border-white/5 leading-relaxed">
                  {generateAbletonScript(analysis?.noteName || 'C', getIntervalName(tuning))}
                </pre>
                <div className="flex gap-4 p-4 bg-orange-500/5 rounded-lg border border-orange-500/10">
                  <div className="text-orange-500 shrink-0">
                    <Activity size={20} />
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    <strong className="text-zinc-200 block mb-1">How to use:</strong>
                    1. Place this script in your Ableton Remote Scripts folder.<br/>
                    2. Select a track with a Simpler device.<br/>
                    3. The script will automatically bind to the Transpose parameter based on the detected fundamental.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer Info */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center space-y-2"
      >
        <p className="text-zinc-600 text-xs font-mono uppercase tracking-widest">Designed for Ableton Live Workflow</p>
        <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-700 font-mono">
          <span>GEMINI 3.0 FLASH</span>
          <span className="w-1 h-1 rounded-full bg-zinc-800" />
          <span>WEB AUDIO API</span>
          <span className="w-1 h-1 rounded-full bg-zinc-800" />
          <span>PYTHON GENERATOR</span>
        </div>
      </motion.div>
    </div>
  );
}
