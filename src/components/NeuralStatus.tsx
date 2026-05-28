"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function NeuralStatus() {
  const [nodes, setNodes] = useState<{ x: number; y: number; active: boolean }[]>([]);
  
  useEffect(() => {
    const newNodes = Array.from({ length: 40 }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      active: Math.random() > 0.5
    }));
    setNodes(newNodes);
    
    const interval = setInterval(() => {
      setNodes(prev => prev.map(n => ({ ...n, active: Math.random() > 0.3 })));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-[200px] w-full bg-[#111827]/30 rounded-3xl border border-white/[0.05] p-6 overflow-hidden flex flex-col justify-between group">
      <div className="flex justify-between items-start z-10">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Neural Linkage</span>
          <span className="text-[12px] font-mono font-black text-indigo-400 mt-1">ACTIVE NODES: {nodes.filter(n => n.active).length}</span>
        </div>
        <div className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black text-emerald-400 uppercase">Synced</div>
      </div>

      <div className="absolute inset-0 z-0">
        <svg width="100%" height="100%" className="opacity-20 scale-125">
          {nodes.map((node, i) => (
            <React.Fragment key={i}>
              <motion.circle 
                cx={`${node.x}%`} cy={`${node.y}%`} r={node.active ? 1.5 : 0.8}
                fill={node.active ? "#6366f1" : "#ffffff"} 
                initial={false}
                animate={{ opacity: node.active ? 1 : 0.2, scale: node.active ? 1.2 : 0.8 }}
              />
              {node.active && i < nodes.length - 1 && nodes[i+1].active && (
                <line 
                  x1={`${node.x}%`} y1={`${node.y}%`} 
                  x2={`${nodes[i+1].x}%`} y2={`${nodes[i+1].y}%`} 
                  stroke="#6366f1" strokeWidth="0.5" strokeOpacity="0.1" 
                />
              )}
            </React.Fragment>
          ))}
        </svg>
      </div>

      <div className="flex items-center gap-3 z-10 pt-4 border-t border-white/5">
         <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              animate={{ width: ["10%", "85%", "40%", "95%"] }} 
              transition={{ duration: 10, repeat: Infinity }}
              className="h-full bg-indigo-500/40" 
            />
         </div>
         <span className="text-[9px] font-mono text-white/20 uppercase tracking-tighter shrink-0">Processing Load</span>
      </div>
    </div>
  );
}
