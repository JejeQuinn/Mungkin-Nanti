import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCw, Sparkles } from 'lucide-react';

interface Particle {
  id: number;
  x: number; // percentage left (0 to 100)
  size: number; // pixels
  delay: number; // seconds
  duration: number; // seconds
  rotate: number; // degrees
}

interface FallingPelletsProps {
  isActive: boolean;
}

export default function FallingPellets({ isActive }: FallingPelletsProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (isActive) {
      // Generate 45 random pellet particles
      const newParticles = Array.from({ length: 45 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100, // random horizontal position
        size: Math.random() * 8 + 6, // 6px to 14px pellet size
        delay: Math.random() * 0.8, // staggered start
        duration: Math.random() * 1.2 + 0.8, // fall speed
        rotate: Math.random() * 360, // initial rotation
      }));
      setParticles(newParticles);
    } else {
      setParticles([]);
    }
  }, [isActive]);

  return (
    <AnimatePresence>
      {isActive && (
        <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none overflow-hidden z-40 rounded-3xl">
          {/* Falling Pellets */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: -50, x: `${p.x}%`, opacity: 0.9, rotate: p.rotate }}
              animate={{
                y: '100%',
                opacity: [0.9, 0.9, 0],
                rotate: p.rotate + 360,
              }}
              exit={{ opacity: 0 }}
              transition={{
                delay: p.delay,
                duration: p.duration,
                ease: 'easeIn',
              }}
              style={{
                position: 'absolute',
                width: `${p.size}px`,
                height: `${p.size}px`,
              }}
              className="rounded-full bg-gradient-to-br from-amber-700 via-amber-800 to-yellow-900 border border-amber-950/40 shadow-sm"
            />
          ))}

          {/* Golden energy / sparkles */}
          {Array.from({ length: 15 }).map((_, i) => {
            const x = Math.random() * 100;
            const delay = Math.random() * 0.6;
            const size = Math.random() * 12 + 8;
            return (
              <motion.div
                key={`sparkle-${i}`}
                initial={{ y: '20%', x: `${x}%`, opacity: 0, scale: 0.5 }}
                animate={{
                  y: '80%',
                  opacity: [0, 1, 1, 0],
                  scale: [0.5, 1.2, 1, 0.5],
                }}
                transition={{
                  delay: delay,
                  duration: 1.4,
                  ease: 'easeOut',
                }}
                className="absolute text-yellow-300"
                style={{ left: `${x}%` }}
              >
                <Sparkles style={{ width: size, height: size }} />
              </motion.div>
            );
          })}

          {/* Virtual rotating MG90S Servo feedback banner */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 15, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-amber-500 text-white font-black text-xs px-5 py-2.5 rounded-full flex items-center gap-2 shadow-lg border border-amber-600 z-50 uppercase tracking-widest font-mono"
          >
            <motion.div
              animate={{ rotate: [0, 180, 0] }}
              transition={{ duration: 1.2, ease: "easeInOut", repeat: 1 }}
            >
              <RotateCw className="w-4 h-4 text-white" />
            </motion.div>
            <span>Motor Servo Aktif (MG90S) • Pakan Runtuh</span>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
