import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, Layers, Sparkles, BatteryCharging, Power, HardDrive, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface IotHardwareSimulatorProps {
  persentasePakan: number;
  jarakCm: number;
  isFeeding: boolean;
  onDispenseSuccess: (metode: 'Manual' | 'Otomatis') => void;
  wifiConnected: boolean;
  setWifiConnected: (status: boolean) => void;
  onTriggerManualFeed: () => void;
  onRefill: () => void;
  formattedTime: string;
  nextPollCountdown: number;
  triggerPoll: () => void;
  lastApiResponse: string;
}

interface Fish {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facingRight: boolean;
  color: string;
  size: number;
  eyeX: number;
  mouthOpen: boolean;
}

interface Pellet {
  id: number;
  x: number;
  y: number;
  speed: number;
}

export default function IotHardwareSimulator({
  persentasePakan,
  jarakCm,
  isFeeding,
  onDispenseSuccess,
  wifiConnected,
  setWifiConnected,
  onTriggerManualFeed,
  onRefill,
  formattedTime,
  nextPollCountdown,
  triggerPoll,
  lastApiResponse,
}: IotHardwareSimulatorProps) {
  const [servoAngle, setServoAngle] = useState(0);
  const [pellets, setPellets] = useState<Pellet[]>([]);
  const [fishes, setFishes] = useState<Fish[]>([
    { id: 1, x: 80, y: 160, targetX: 180, targetY: 150, facingRight: true, color: 'from-orange-500 to-amber-400', size: 45, eyeX: 12, mouthOpen: false },
    { id: 2, x: 210, y: 120, targetX: 60, targetY: 170, facingRight: false, color: 'from-rose-500 to-orange-400', size: 36, eyeX: -8, mouthOpen: false },
  ]);

  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  // Handle physical servo motion whenever 'isFeeding' triggers
  useEffect(() => {
    if (isFeeding) {
      setServoAngle(90);
      
      // Spawn flowing pellets in intervals during the 1.5s open time
      const pelletTimer = setInterval(() => {
        const newPellets = Array.from({ length: 4 }).map((_, i) => ({
          id: Math.random() + i,
          x: 160 + (Math.random() * 20 - 10), // drop below bottle neck
          y: 65, // bottom of bottle valve / top of tank water
          speed: 1.5 + Math.random() * 1.5,
        }));
        setPellets((prev) => [...prev, ...newPellets]);
      }, 150);

      const restoreTimer = setTimeout(() => {
        setServoAngle(0);
        clearInterval(pelletTimer);
      }, 1500);

      return () => {
        clearTimeout(restoreTimer);
        clearInterval(pelletTimer);
      };
    }
  }, [isFeeding]);

  // Main game-loop for water pellets and fish simulation
  useEffect(() => {
    const updatePhysics = (time: number) => {
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // Update pellets sinking physics
      setPellets((prevPellets) => {
        return prevPellets
          .map((p) => ({ ...p, y: p.y + p.speed * 85 * delta }))
          .filter((p) => p.y < 210); // remove once reach sand bed
      });

      // Update fish intelligence and swimming toward food if it exists
      setFishes((prevFishes) => {
        return prevFishes.map((f) => {
          let currentTargetX = f.targetX;
          let currentTargetY = f.targetY;

          // If there's floating food, prioritize swimming toward the closest one!
          if (pellets.length > 0) {
            const nearestPellet = pellets.reduce((nearest, current) => {
              const distC = Math.hypot(current.x - f.x, current.y - f.y);
              const distN = Math.hypot(nearest.x - f.x, nearest.y - f.y);
              return distC < distN ? current : nearest;
            }, pellets[0]);

            // Add slight target noise so it seems natural
            currentTargetX = nearestPellet.x + (Math.random() * 8 - 4);
            currentTargetY = nearestPellet.y + (Math.random() * 8 - 4);
          } else {
            // Normal wandering: if fish is close to target, select new random target
            const distToTarget = Math.hypot(f.x - f.targetX, f.y - f.targetY);
            if (distToTarget < 15 || Math.random() < 0.015) {
              currentTargetX = 40 + Math.random() * 240;
              currentTargetY = 110 + Math.random() * 80;
            }
          }

          // Move fish gradually toward target
          const dx = currentTargetX - f.x;
          const dy = currentTargetY - f.y;
          const dist = Math.hypot(dx, dy);

          let newX = f.x;
          let newY = f.y;
          let facingRight = f.facingRight;
          let mouthOpen = f.mouthOpen;

          if (dist > 2) {
            const speed = pellets.length > 0 ? 90 : 45; // swim faster if food is present!
            newX += (dx / dist) * speed * delta;
            newY += (dy / dist) * speed * delta;
            facingRight = dx > 0;
          }

          // Open mouth if close to food
          if (pellets.length > 0) {
            const closedPelletDist = pellets.some(p => Math.hypot(p.x - f.x, p.y - f.y) < 20);
            mouthOpen = closedPelletDist;
          } else {
            mouthOpen = Math.random() < 0.1 ? !mouthOpen : mouthOpen;
          }

          return {
            ...f,
            x: newX,
            y: newY,
            targetX: currentTargetX,
            targetY: currentTargetY,
            facingRight,
            mouthOpen,
          };
        });
      });

      requestRef.current = requestAnimationFrame(updatePhysics);
    };

    requestRef.current = requestAnimationFrame(updatePhysics);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [pellets]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="hardware_simulator_grid">
      {/* Visual Workspace (Aquarium, Bottle, Sensor, Servo) */}
      <div className="lg:col-span-8 bg-[#14171C] rounded-2xl border border-slate-800 p-6 flex flex-col justify-between items-center relative overflow-hidden min-h-[480px]">
        {/* Background ambient grid glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/20 via-transparent to-transparent pointer-events-none"></div>

        {/* Top-Label */}
        <div className="w-full flex justify-between items-center z-10">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            <Sparkles className="w-3 h-3" />
            VIRTUAL HARDWARE LABORATORY
          </span>
          <span className="text-xs font-mono text-slate-500">Scale: ESP32 NodeMCU MG90S</span>
        </div>

        {/* Core Schematic Representation */}
        <div className="relative w-full max-w-[420px] flex-1 flex flex-col items-center justify-start mt-6 z-10 select-none">
          
          {/* HC-SR04 SENSOR & SPANER NYLON ASSEMBLY AT THE VERY TOP */}
          <div className="relative flex flex-col items-center mb-1">
            {/* Ultrasonic Sensor Representation */}
            <div className="relative bg-[#0A0B0E] border-2 border-slate-800 rounded-md px-3 py-1.5 shadow-xl flex items-center gap-3 z-30">
              {/* Receiver Eyes */}
              <div className="w-6 h-6 rounded-full bg-slate-900 border-2 border-slate-705 flex items-center justify-center relative overflow-hidden">
                <span className="text-[6px] text-slate-400 font-bold z-10 font-mono">T</span>
                <div className="absolute inset-0.5 rounded-full border border-slate-850 bg-slate-950 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping absolute"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div>
                </div>
              </div>
              <div className="text-[7px] text-white font-mono font-bold flex flex-col items-center justify-center">
                <span className="text-white">HC-SR04</span>
                <span className="text-[5px] text-cyan-400 font-extrabold uppercase tracking-widest">Ultrasonic</span>
              </div>
              <div className="w-6 h-6 rounded-full bg-slate-900 border-2 border-slate-705 flex items-center justify-center relative overflow-hidden">
                <span className="text-[6px] text-slate-400 font-bold z-10 font-mono">R</span>
                <div className="absolute inset-0.5 rounded-full border border-slate-850 bg-slate-950"></div>
              </div>
            </div>

            {/* SPACER NYLON M2 x 10mm (VERY IMPORTANT) - RENDERED HIGHLIGHTED */}
            <div className="flex justify-between w-24 absolute -bottom-[13px] z-20">
              <div className="flex flex-col items-center group relative cursor-help">
                <div className="w-2.5 h-4 bg-cyan-500/25 rounded border border-cyan-500/40 flex flex-col justify-between items-center shadow-lg">
                  <div className="w-1.5 h-0.5 bg-slate-550 rounded-full"></div>
                  <div className="w-1.5 h-0.5 bg-slate-550 rounded-full"></div>
                </div>
                <div className="w-0.5 h-1 bg-gray-500"></div>
                {/* Custom hover tooltip detailing specifications */}
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-[#14171C] text-cyan-400 border border-slate-800 text-[10px] w-28 p-1.5 rounded shadow-lg hidden group-hover:block z-50 text-center leading-tight">
                  <strong>Peninggi Nylon M2 x 10mm:</strong> Mencegah kondensasi uap air akuarium pemicu korosi!
                </div>
              </div>

              <div className="flex flex-col items-center group relative cursor-help">
                <div className="w-2.5 h-4 bg-cyan-500/25 rounded border border-cyan-500/40 flex flex-col justify-between items-center shadow-lg">
                  <div className="w-1.5 h-0.5 bg-slate-550 rounded-full"></div>
                  <div className="w-1.5 h-0.5 bg-slate-550 rounded-full"></div>
                </div>
                <div className="w-0.5 h-1 bg-gray-500"></div>
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-[#14171C] text-cyan-400 border border-slate-800 text-[10px] w-28 p-1.5 rounded shadow-lg hidden group-hover:block z-50 text-center leading-tight">
                  <strong>Peninggi Nylon M2 x 10mm:</strong> Mencegah kondensasi uap air akuarium pemicu korosi!
                </div>
              </div>
            </div>
          </div>

          {/* 600ml PLASTIC FEED CONTAINER BOTTLE */}
          <div className="relative w-36 h-32 bg-[#0A0B0E]/60 rounded-t-3xl rounded-b-lg border-2 border-slate-800 overflow-hidden flex flex-col justify-end items-center mt-2.5 shadow-lg group">
            {/* Top load opening line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-teal-500/20 border-b border-gray-800"></div>
            
            {/* SENSOR MEASUREMENT RAYS (ULTRASONIC WAVES EMISSION) */}
            <div className="absolute top-1 bottom-0 left-0 right-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-full border-x border-teal-500/10 bg-gradient-to-b from-teal-500/20 to-transparent flex flex-col justify-around items-center">
                <div className="w-10 h-[1.5px] bg-teal-400/30 rounded animate-pulse"></div>
                <div className="w-8 h-[1.5px] bg-teal-400/20 rounded animate-pulse delay-75"></div>
                <div className="w-6 h-[1.5px] bg-teal-400/10 rounded animate-pulse delay-150"></div>
              </div>
            </div>

            {/* Fish Food Level Fill */}
            <div
              className="w-full bg-gradient-to-t from-amber-800 via-amber-700 to-amber-600/90 transition-all duration-700 relative flex items-center justify-center overflow-hidden"
              style={{ height: `${persentasePakan}%` }}
            >
              {/* Pellet Grains texture */}
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#000_15%,_transparent_15%)] bg-[size:10px_10px]"></div>
              
              {/* Glowing fill boundary indicator */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-400 shadow-lg shadow-amber-400/50 flex justify-between px-2">
                <span className="text-[8px] text-amber-200 font-mono -mt-3">{persentasePakan}%</span>
                <span className="text-[8px] text-amber-200 font-mono -mt-3">{jarakCm.toFixed(1)} cm</span>
              </div>
            </div>
          </div>

          {/* BOTTLE CAP NECK, MG90S SERVO MOTOR & MECHANICAL VALVE */}
          <div className="relative w-28 h-8 flex justify-center items-start z-20">
            {/* Bottle neck spout */}
            <div className="w-14 h-4 bg-gray-800 border-x border-b border-gray-650 flex flex-col justify-end items-center">
              <div className="w-11 h-1.5 bg-blue-900 border border-blue-500 rounded-sm"></div>
            </div>

            {/* MG90S SERVO ASSEMBLY MOUNTED RIGHT BESIDE */}
            <div className="absolute left-1/2 translate-x-2 -top-1 flex items-center gap-1">
              <div className="w-2.5 h-1 bg-gray-800"></div> {/* coupling shaft */}
              
              {/* MG90S Body */}
              <div className="relative bg-blue-600 border border-blue-800 rounded-sm p-1 shadow-lg w-16 text-[7px] text-white font-mono flex flex-col justify-between leading-none h-9">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-[8px] text-amber-400">MG90S</span>
                  <div className="w-2 h-2 rounded-full bg-gray-200 border border-gray-400 flex items-center justify-center">
                    {/* Rotating Axle Arm */}
                    <div
                      className="w-4 h-1 bg-slate-100 rounded-full origin-left transition-transform duration-300"
                      style={{ transform: `rotate(${servoAngle}deg)` }}
                    ></div>
                  </div>
                </div>
                <span className="text-[5px] text-blue-200">METAL GEAR</span>
                {/* Fasteners detail */}
                <div className="flex justify-between text-[4px] text-gray-400">
                  <span>🔩 M2.5x10</span>
                  <span>🔩 M2.5x10</span>
                </div>
              </div>
            </div>
          </div>

          {/* WATER AQUARIUM GLASS CONTAINER */}
          <div className="w-[340px] h-[160px] bg-cyan-950/20 border-4 border-slate-700/80 rounded-b-2xl relative overflow-hidden mt-0 backdrop-blur-xs flex items-end">
            
            {/* Water Fill Boundary */}
            <div className="absolute inset-x-0 bottom-0 top-3 bg-gradient-to-b from-cyan-400/20 via-cyan-600/10 to-cyan-800/30 border-t-2 border-cyan-300/30">
              
              {/* Water Bubbles */}
              <div className="absolute left-1/4 bottom-1 w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce"></div>
              <div className="absolute left-3/4 bottom-3 w-1 h-1 rounded-full bg-white/10 animate-ping delay-100"></div>
              <div className="absolute left-1/2 bottom-2 w-1.5 h-1.5 rounded-full bg-white/25 animate-bounce delay-150"></div>

              {/* Underwater decorations: Seaweeds */}
              <div className="absolute left-4 bottom-0 w-4 h-16 bg-emerald-700/40 rounded-full blur-xs skew-x-3 origin-bottom"></div>
              <div className="absolute right-6 bottom-0 w-5 h-20 bg-emerald-600/35 rounded-full blur-xs -skew-x-2 origin-bottom"></div>

              {/* Rain of Food Pellets */}
              <AnimatePresence>
                {pellets.map((pellet) => (
                  <motion.div
                    key={pellet.id}
                    className="absolute w-2 h-2 rounded-full bg-amber-500 border border-amber-700 shadow-md"
                    style={{ left: pellet.x, top: pellet.y }}
                    initial={{ scale: 0.8, opacity: 0.9 }}
                    animate={{ scale: 1 }}
                    exit={{ opacity: 0 }}
                  />
                ))}
              </AnimatePresence>

              {/* Animated Goldfishes swimming & eating */}
              {fishes.map((fish) => (
                <div
                  key={fish.id}
                  className="absolute transition-transform duration-100 ease-linear top-0 left-0"
                  style={{
                    transform: `translate(${fish.x}px, ${fish.y}px) scaleX(${fish.facingRight ? 1 : -1})`,
                  }}
                >
                  <div className={`relative flex items-center`}>
                    {/* Fish Body */}
                    <div className={`w-12 h-6 rounded-full bg-gradient-to-r ${fish.color} shadow-lg flex items-center relative`}>
                      {/* Tail Fin */}
                      <div className={`w-3.5 h-5 rounded-full bg-orange-400 absolute -left-2 top-1.5 skew-y-3 origin-right animate-pulse`}></div>
                      {/* Eye */}
                      <div className="absolute w-2 h-2 bg-white rounded-full flex items-center justify-center" style={{ right: fish.eyeX, top: '4px' }}>
                        <div className="w-1 h-1 bg-black rounded-full"></div>
                      </div>
                      {/* Mouth (animated open when eating) */}
                      <div
                        className={`absolute w-2.5 h-2.5 bg-cyan-900 border border-orange-400 rounded-full -right-0.5 top-2.5 flex items-center justify-center transition-all ${
                          fish.mouthOpen ? 'scale-110 opacity-100' : 'scale-50 opacity-0'
                        }`}
                      >
                        <div className="w-1 h-1 bg-black rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Soft Sand Bed */}
              <div className="absolute bottom-0 left-0 right-0 h-4 bg-amber-100/10 flex items-end">
                <div className="w-full h-2 bg-yellow-900/20 blur-xs"></div>
              </div>

            </div>
          </div>

        </div>

        {/* Board Diagnostics Overlay */}
        <div className="w-full grid grid-cols-3 gap-2 mt-4 text-[10px] font-mono text-slate-400 z-10 border-t border-slate-800/80 pt-4 bg-[#0A0B0E]/40 px-2 rounded-xl">
          <div className="flex items-center gap-1 bg-[#0A0B0E]/60 px-2 py-1.5 rounded-lg border border-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>POLLED: <strong className="text-white">{nextPollCountdown}s</strong></span>
          </div>
          <div className="flex items-center gap-1 bg-[#0A0B0E]/60 px-2 py-1.5 rounded-lg border border-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>NTP time: <strong className="text-white">{formattedTime}</strong></span>
          </div>
          <div className="flex items-center gap-1 bg-[#0A0B0E]/60 px-2 py-1.5 rounded-lg border border-slate-800">
            <ArrowRightLeft className="w-3 text-cyan-400 h-3 shrink-0" />
            <span className="truncate">PAYLOAD: <strong className="text-white">{lastApiResponse}</strong></span>
          </div>
        </div>
      </div>

      {/* Control Console (ESP32 Board Interface) */}
      <div className="lg:col-span-4 flex flex-col gap-6" id="esp32_control_sidepanel">
        
        {/* ESP32 Mock Controller Box */}
        <div className="bg-[#14171C] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col">
          <div className="flex justify-between items-center pb-4 border-b border-slate-800/80 mb-4 bg-slate-900/10 -mx-6 px-6">
            <h4 className="text-white font-bold text-sm tracking-tight flex items-center gap-2 uppercase font-display">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              ESP32 NodeMCU Wi-Fi
            </h4>
            <div className={`flex items-center gap-1 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded border ${
              wifiConnected ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
            }`}>
              {wifiConnected ? <Wifi className="w-3" /> : <WifiOff className="w-3" />}
              <span>{wifiConnected ? 'Online' : 'Offline'}</span>
            </div>
          </div>

          {/* Hardware Diagnostic Logs Console Screen (OLED style) */}
          <div className="bg-[#0A0B0E] border-2 border-slate-800 p-4 rounded-xl font-mono text-[11px] text-cyan-400 shadow-inner h-40 overflow-y-auto space-y-1.5 mb-5 flex flex-col justify-start select-text leading-snug">
            <div className="text-slate-500 border-b border-cyan-950/60 pb-1 text-[10px] flex justify-between items-center">
              <span>🖥️ OLED SCREEN (SSD1306)</span>
              <span className="text-cyan-600 font-bold">128x64px</span>
            </div>
            
            {wifiConnected ? (
              <>
                <div className="text-cyan-300">RSSI: -53dBm [Good]</div>
                <div>IP: 192.168.1.135</div>
                <div>NTP: Sync id.pool.ntp.org</div>
                <div className="text-cyan-400 font-semibold">Time: {formattedTime} WIB</div>
                <div className="border-t border-cyan-950/40 my-1"></div>
                <div className="flex justify-between">
                  <span>Wadah Pakan:</span>
                  <span className="text-white font-bold">{persentasePakan}%</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[10px]">
                  <span>Ultrasonic HC-SR04:</span>
                  <span>{jarakCm.toFixed(1)} cm</span>
                </div>
                
                {isFeeding ? (
                  <div className="bg-cyan-950/60 border border-cyan-800/80 text-cyan-300 px-1 py-0.5 rounded text-center font-bold text-[10px] tracking-wide animate-pulse mt-1">
                    [MG90S ENERGISED: OPENING]
                  </div>
                ) : (
                  <div className="text-slate-500 text-[10px] italic mt-1">
                    System OK. Standby. Check in {nextPollCountdown}s
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-rose-500 py-4 gap-2">
                <WifiOff className="w-7 h-7 text-rose-600 animate-pulse" />
                <span className="font-bold text-[11px] tracking-wider uppercase">WiFi Connection Failure</span>
                <span className="text-slate-500 text-[10px]">Verify SSID "NAMA_WIFI" on ESP32 block parameters.</span>
              </div>
            )}
          </div>

          {/* Quick Hardware Controls & Override Switch */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0A0B0E] border border-slate-800">
              <div className="flex flex-col">
                <span className="text-xs text-white font-semibold">Simulasi Wi-Fi</span>
                <span className="text-[10px] text-slate-500">Hubungkan/Putus Wi-Fi ESP32</span>
              </div>
              <button
                onClick={() => setWifiConnected(!wifiConnected)}
                className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors focus:outline-none ${
                  wifiConnected ? 'bg-cyan-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-[#0A0B0E] transition-transform ${
                    wifiConnected ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Force Poll Button */}
            <button
              onClick={triggerPoll}
              disabled={!wifiConnected || isFeeding}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs text-cyan-400 hover:text-white bg-cyan-950/20 hover:bg-cyan-900/40 border border-cyan-800/30 hover:border-cyan-700/60 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm uppercase tracking-wider"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFeeding ? 'animate-spin' : ''}`} />
              <span>Paksa Kirim Polling ESP32</span>
            </button>

            {/* Refill Container */}
            <button
              onClick={onRefill}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs text-amber-300 hover:text-white bg-amber-950/20 hover:bg-amber-900/40 border border-amber-800/30 hover:border-amber-700/60 rounded-xl transition font-semibold shadow-sm uppercase tracking-wider"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Isi Penuh Wadah Pakan (Refill)</span>
            </button>
          </div>
        </div>

        {/* Technical Guidelines Card */}
        <div className="bg-[#14171C] p-5 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-3">
          <h4 className="text-white font-bold flex items-center gap-2 mb-1.5 uppercase font-display tracking-widest text-xs">
            <Power className="w-4 h-4 text-emerald-400" />
            Logika Siklus Server
          </h4>
          <ol className="list-decimal list-inside space-y-1.5 pl-0.5 leading-relaxed text-slate-400">
            <li>Mikrokontroler <span className="text-white font-bold">ESP32</span> memicu query GET ke server API PHP setiap <span className="font-bold text-cyan-400">15 Detik</span>.</li>
            <li>Ia menyertakan parameter payload query string berupa <span className="text-white">waktu hari</span>, <span className="text-white">sisa pakan (%)</span> dan <span className="text-white">jarak_cm</span>.</li>
            <li>Server API PHP mencatat sisa pakan ke tabel <span className="text-cyan-400 font-mono">status_pakan</span> (ID=1).</li>
            <li>API mengevaluasi antrean <span className="text-white">trigger_manual=1</span> pada jadwal pakan, mengembalikan status <span className="text-cyan-400 font-bold font-mono">SERVO_TRIGGER_MANUAL</span> dan mereset status flag di database.</li>
            <li>Bila tdk ada manual, API mencocokkan jadwal otomatis, mengembalikan status <span className="text-indigo-400 font-bold font-mono">SERVO_TRIGGER_AUTO</span>.</li>
            <li>Bila ESP32 menerima payload trigger, Servo digerakkan <span className="text-white">1.5 detik</span>, lalu log dikirim via <span className="text-white">POST (action=log_pakan)</span>.</li>
          </ol>
        </div>

      </div>
    </div>
  );
}
