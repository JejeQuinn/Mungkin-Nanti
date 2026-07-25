import React, { useState, useEffect } from 'react';
import { Cpu, Database, Layout, BookOpen, Smartphone, Activity, ChevronRight, HelpCircle, CheckCircle2, RotateCcw, Wifi, Calendar, Clock, Sliders, Check, Trash2, Shield, Settings, Info, Terminal, RefreshCw, Fish, Facebook, Instagram, Mail, Phone, MapPin, User, Power, Sun, Sunrise, Sunset } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import IotHardwareSimulator from './components/IotHardwareSimulator';
import DbExplorer from './components/DbExplorer';
import IotFirmwarePanel from './components/IotFirmwarePanel';
import AssemblyGuide from './components/AssemblyGuide';
import FeedingStatsChart from './components/FeedingStatsChart';
import FallingPellets from './components/FallingPellets';
import CloudSync from './components/CloudSync';
import { JadwalPakan, LogPakan, StatusPakan } from './types';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'sisa-pakan' | 'jadwal-manual' | 'history' | 'about-contact' | 'admin' | 'cloud-sync'>('home');
  const [adminSubTab, setAdminSubTab] = useState<'api' | 'guide' | 'code' | 'db' | 'simulator'>('api');

  // Firebase Auth State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  // Custom calibration parameters matching AssemblyGuide
  const [jarakPenuh, setJarakPenuh] = useState(3.0); // full feed = 3cm distance
  const [jarakKosong, setJarakKosong] = useState(15.0); // empty feed = 15cm distance
  
  // Physical capacity parameter
  const [sisaPakan, setSisaPakan] = useState(78); // start at 78%
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);
  
  // Auto reset dismissal when capacity is filled
  useEffect(() => {
    if (sisaPakan > 5) {
      setIsAlertDismissed(false);
    }
  }, [sisaPakan]);
  
  // Clean custom feeding notifications
  const [successToast, setSuccessToast] = useState<{ id: string; message: string; timestamp: string } | null>(null);

  // Auto dismiss toast notification
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => {
        setSuccessToast(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const token = await user.getIdToken();
          setAuthToken(token);
        } catch (err) {
          console.error("Error getting ID token:", err);
        }
      } else {
        setCurrentUser(null);
        setAuthToken(null);
        setIsLoadingAuth(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Secure API Fetch Helper
  const apiFetch = async (endpoint: string, method: string = "GET", body?: any) => {
    if (!auth.currentUser) return null;
    try {
      const token = await auth.currentUser.getIdToken();
      const headers: HeadersInit = {
        "Authorization": `Bearer ${token}`,
      };
      if (body) {
        headers["Content-Type"] = "application/json";
      }
      const response = await fetch(endpoint, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.error(`Error in apiFetch ${endpoint}:`, err);
      return null;
    }
  };

  // Sync state with database upon successful login
  useEffect(() => {
    const loadUserData = async () => {
      if (!authToken) return;
      setIsLoadingAuth(true);
      try {
        const syncRes = await apiFetch("/api/auth/sync", "POST");
        if (syncRes && syncRes.success) {
          // Fetch schedules
          const schedRes = await fetch("/api/schedules", {
            headers: { "Authorization": `Bearer ${authToken}` }
          });
          if (schedRes.ok) {
            const data = await schedRes.json();
            const mappedSchedules = data.map((s: any) => ({
              id: s.id,
              waktu: s.waktu,
              is_active: s.isActive,
              trigger_manual: s.triggerManual
            }));
            setSchedules(mappedSchedules);
          }

          // Fetch status
          const statusRes = await fetch("/api/status", {
            headers: { "Authorization": `Bearer ${authToken}` }
          });
          if (statusRes.ok) {
            const data = await statusRes.json();
            setSisaPakan(data.persentase);
            setStatusPakanRow({
              id: data.id,
              persentase: data.persentase,
              jarak_cm: data.jarakCm,
              terakhir_diperbarui: new Date(data.terakhirDiperbarui).toISOString().replace("T", " ").substring(0, 19)
            });
          }

          // Fetch logs
          const logsRes = await fetch("/api/logs", {
            headers: { "Authorization": `Bearer ${authToken}` }
          });
          if (logsRes.ok) {
            const data = await logsRes.json();
            const mappedLogs = data.map((l: any) => ({
              id: l.id,
              waktu_eksekusi: new Date(l.waktuEksekusi).toISOString().replace("T", " ").substring(0, 19),
              metode: l.metode,
              status: l.status
            }));
            setLogs(mappedLogs);
          }
        }
      } catch (err) {
        console.error("Error loading user data from backend:", err);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    loadUserData();
  }, [authToken]);

  // Auth Sign In and Sign Out Handlers
  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      console.error("Google login failed:", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // Reset to default local mock state
      setSchedules([
        { id: 1, waktu: "07:00", is_active: true, trigger_manual: false },
        { id: 2, waktu: "12:00", is_active: true, trigger_manual: false },
        { id: 3, waktu: "17:00", is_active: true, trigger_manual: false },
      ]);
      setSisaPakan(78);
      setStatusPakanRow({
        id: 1,
        persentase: 78,
        jarak_cm: 6.74,
        terakhir_diperbarui: getFullTimestamp(ntpTime)
      });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };
  
  // Connect variables
  const [wifiConnected, setWifiConnected] = useState(true);
  const [isFeeding, setIsFeeding] = useState(false);
  const [lastApiResponse, setLastApiResponse] = useState('STANDBY');
  const [nextPollCountdown, setNextPollCountdown] = useState(15);

  // Time state (NTP Server Simulation)
  const [ntpTime, setNtpTime] = useState<Date>(new Date());

  // Database States Mockup
  const [schedules, setSchedules] = useState<JadwalPakan[]>(() => {
    const saved = localStorage.getItem('fish_feeder_schedules_db');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [
      { id: 1, waktu: "07:00", is_active: true, trigger_manual: false },
      { id: 2, waktu: "12:00", is_active: true, trigger_manual: false },
      { id: 3, waktu: "17:00", is_active: true, trigger_manual: false },
    ];
  });

  const [logs, setLogs] = useState<LogPakan[]>(() => {
    const saved = localStorage.getItem('fish_feeder_logs_db');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }

    // Default simulation data across multiple months (June and May 2026)
    const result: LogPakan[] = [];
    let currentId = 1;

    // May 2026 (Historical database month)
    for (let day = 1; day <= 31; day++) {
      if (day % 7 === 0) continue; // skip some days for realism
      
      const feeds = day % 3 === 0 ? 3 : 2; // either 2 or 3 feedings per day
      const times = ["07:02:15", "12:05:22", "17:08:18"];
      
      for (let f = 0; f < feeds; f++) {
        result.push({
          id: currentId++,
          waktu_eksekusi: `2026-05-${String(day).padStart(2, '0')} ${times[f]}`,
          metode: f === 2 ? 'Manual' : 'Otomatis',
          status: 'Berhasil'
        });
      }
    }

    // June 2026 (including current June 22)
    for (let day = 1; day <= 22; day++) {
      if (day % 9 === 0) continue;
      
      const feeds = day % 4 === 0 ? 3 : 2;
      const times = ["07:03:05", "12:01:12", "17:04:44"];
      
      for (let f = 0; f < feeds; f++) {
        result.push({
          id: currentId++,
          waktu_eksekusi: `2026-06-${String(day).padStart(2, '0')} ${times[f]}`,
          metode: f === 2 ? 'Manual' : 'Otomatis',
          status: 'Berhasil'
        });
      }
    }

    // Sort descending by date/time
    result.sort((a, b) => b.waktu_eksekusi.localeCompare(a.waktu_eksekusi));
    return result;
  });

  // LocalStorage synchronizers
  useEffect(() => {
    localStorage.setItem('fish_feeder_schedules_db', JSON.stringify(schedules));
  }, [schedules]);

  useEffect(() => {
    localStorage.setItem('fish_feeder_logs_db', JSON.stringify(logs));
  }, [logs]);

  // Form input on the simulated PHP page
  const [newScheduleTime, setNewScheduleTime] = useState('08:00');

  // Input states for 3 Daily Feedings representing Image 2 mockup
  const [time1, setTime1] = useState(() => schedules.find(s => s.id === 1)?.waktu || '07:00');
  const [time2, setTime2] = useState(() => schedules.find(s => s.id === 2)?.waktu || '12:00');
  const [time3, setTime3] = useState(() => schedules.find(s => s.id === 3)?.waktu || '17:00');

  const [active1, setActive1] = useState(() => schedules.find(s => s.id === 1)?.is_active ?? true);
  const [active2, setActive2] = useState(() => schedules.find(s => s.id === 2)?.is_active ?? true);
  const [active3, setActive3] = useState(() => schedules.find(s => s.id === 3)?.is_active ?? true);
  const [isScheduleMasterEnabled, setIsScheduleMasterEnabled] = useState(true);

  // Sync schedules whenever core schedules collection changes
  useEffect(() => {
    const s1 = schedules.find(s => s.id === 1);
    const s2 = schedules.find(s => s.id === 2);
    const s3 = schedules.find(s => s.id === 3);
    if (s1) { setTime1(s1.waktu); setActive1(s1.is_active); }
    if (s2) { setTime2(s2.waktu); setActive2(s2.is_active); }
    if (s3) { setTime3(s3.waktu); setActive3(s3.is_active); }
  }, [schedules]);

  // Compute physical distance from percentage
  const jarakCm = jarakKosong - (sisaPakan / 100) * (jarakKosong - jarakPenuh);

  // Simulated MySQL status table (ID = 1)
  const [statusPakanRow, setStatusPakanRow] = useState<StatusPakan>({
    id: 1,
    persentase: 78,
    jarak_cm: 6.74,
    terakhir_diperbarui: "2026-06-22 07:22:15"
  });

  // Keep ticking simulated clock locally
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setNtpTime((prev) => new Date(prev.getTime() + 1000));
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Poll server tick countdown (handles ESP32 request GET / POST)
  useEffect(() => {
    const countTimer = setInterval(() => {
      setNextPollCountdown((prev) => {
        if (prev <= 1) {
          triggerServerPoll();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countTimer);
  }, [schedules, sisaPakan, wifiConnected, ntpTime, logs]);

  // NTP formatted time string
  const getFormattedTime = () => {
    const hh = String(ntpTime.getHours()).padStart(2, '0');
    const mm = String(ntpTime.getMinutes()).padStart(2, '0');
    const ss = String(ntpTime.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  const getFullTimestamp = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  };

  // Perform API transaction check schedules
  const triggerServerPoll = () => {
    if (!wifiConnected) {
      setLastApiResponse('TIMEOUT_ERR');
      return;
    }

    const currentHhMm = getFormattedTime().substring(0, 5);

    // 1. Check for manual trigger_manual flags in table jadwal_pakan
    const activeManualTrigger = schedules.find((s) => s.trigger_manual === true);

    if (activeManualTrigger) {
      // Rotate MG90S physical motor model and reduce capacity
      executeFeeding('Manual');
      setLastApiResponse('SERVO_TRIGGER_MANUAL');
      
      // Reset trigger manual flag in MySQL mock
      setSchedules((prev) =>
        prev.map((s) => (s.id === activeManualTrigger.id ? { ...s, trigger_manual: false } : s))
      );
      return;
    }

    // 2. Check for matching active scheduled hour (HH:MM)
    const matchingSchedule = schedules.find(
      (s) => s.is_active && s.waktu === currentHhMm
    );

    if (matchingSchedule) {
      // Deduplicate: avoid double-triggering in same minute
      const alreadyRunThisMinute = logs.some((l) => {
        if (l.metode !== 'Otomatis') return false;
        const logMin = l.waktu_eksekusi.substring(11, 16);
        return logMin === currentHhMm;
      });

      if (!alreadyRunThisMinute) {
        executeFeeding('Otomatis');
        setLastApiResponse('SERVO_TRIGGER_AUTO');
      } else {
        setLastApiResponse('STANDBY');
      }
    } else {
      setLastApiResponse('STANDBY');
    }

    // Perform database UPDATE request on status_pakan table
    setStatusPakanRow({
      id: 1,
      persentase: sisaPakan,
      jarak_cm: jarakCm,
      terakhir_diperbarui: getFullTimestamp(ntpTime),
    });
  };

  // Turn actuator, deplete physical container volume slightly, log successes
  const executeFeeding = (metode: 'Manual' | 'Otomatis') => {
    setIsFeeding(true);
    
    // Decrease capacities simulated (e.g. drops 6-10%)
    const depletion = Math.floor(6 + Math.random() * 4);
    const nextSisaPakan = Math.max(0, sisaPakan - depletion);
    setSisaPakan(nextSisaPakan);

    const nextJarakCm = jarakKosong - (nextSisaPakan / 100) * (jarakKosong - jarakPenuh);

    setTimeout(() => {
      setIsFeeding(false);
      
      const currentTimeStr = getFullTimestamp(ntpTime);
      
      // Push record success into log_pakan table mock
      const newLog: LogPakan = {
        id: logs.length > 0 ? Math.max(...logs.map((l) => l.id)) + 1 : 1,
        waktu_eksekusi: currentTimeStr,
        metode,
        status: 'Berhasil'
      };
      setLogs((prev) => [newLog, ...prev]);

      // Trigger beautiful success feeding notification
      setSuccessToast({
        id: Math.random().toString(),
        message: `KABEL DATA TERHUBUNG: Pakan berhasil diberikan (${metode})! Servo berputar dan pakan dijatuhkan.`,
        timestamp: currentTimeStr.substring(11,19)
      });

      // Update phone dashboard values
      setStatusPakanRow({
        id: 1,
        persentase: nextSisaPakan,
        jarak_cm: nextJarakCm,
        terakhir_diperbarui: currentTimeStr
      });
    }, 1500);
  };

  // Refill high capacity function
  const handleRefillPakan = () => {
    setSisaPakan(100);
    const currentTimeStr = getFullTimestamp(ntpTime);
    setStatusPakanRow({
      id: 1,
      persentase: 100,
      jarak_cm: jarakPenuh,
      terakhir_diperbarui: currentTimeStr
    });
    setSuccessToast({
      id: Math.random().toString(),
      message: "BERHASIL: Wadah pakan harian (botol/tabung) telah diisi ulang hingga 100%!",
      timestamp: currentTimeStr.substring(11, 19)
    });
  };

  // Estimate food consumption based on logs history
  const pakanEstimation = React.useMemo(() => {
    // 1. Group logs by date (YYYY-MM-DD)
    const logsByDate: Record<string, number> = {};
    logs.forEach(log => {
      const datePart = log.waktu_eksekusi.split(' ')[0]; // "2026-06-22"
      if (datePart) {
        logsByDate[datePart] = (logsByDate[datePart] || 0) + 1;
      }
    });

    const totalDaysRecorded = Object.keys(logsByDate).length;
    const totalFeedings = logs.length;

    // Average feeding events per active day
    const avgFeedingsPerDay = totalDaysRecorded > 0 ? (totalFeedings / totalDaysRecorded) : 2.5;

    // Average percentage consumed per feeding (approx 8% according to executeFeeding)
    const avgDepletionPerFeed = 8; 
    const avgDailyDepletionPercent = avgFeedingsPerDay * avgDepletionPerFeed;

    // Estimated days left
    const daysLeft = avgDailyDepletionPercent > 0 ? (sisaPakan / avgDailyDepletionPercent) : 0;

    return {
      avgFeedingsPerDay: avgFeedingsPerDay.toFixed(1),
      avgDailyDepletionPercent: avgDailyDepletionPercent.toFixed(1),
      daysLeft: daysLeft.toFixed(1),
      daysLeftNum: daysLeft,
      totalDaysRecorded
    };
  }, [logs, sisaPakan]);

  // Interactive callbacks on DB Explorer GUI
  const handleAddJadwal = (waktu: string) => {
    const newJ: JadwalPakan = {
      id: schedules.length > 0 ? Math.max(...schedules.map((s) => s.id)) + 1 : 1,
      waktu,
      is_active: true,
      trigger_manual: false
    };
    setSchedules((prev) => {
      const nextList = [...prev, newJ].sort((a,b) => a.waktu.localeCompare(b.waktu));
      if (authToken) {
        apiFetch("/api/schedules", "POST", { list: nextList });
      }
      return nextList;
    });
  };

  const handleDeleteJadwal = (id: number) => {
    setSchedules((prev) => {
      const nextList = prev.filter((s) => s.id !== id);
      if (authToken) {
        apiFetch("/api/schedules", "POST", { list: nextList });
      }
      return nextList;
    });
  };

  const handleToggleActive = (id: number) => {
    setSchedules((prev) => {
      const nextList = prev.map((s) => (s.id === id ? { ...s, is_active: !s.is_active } : s));
      if (authToken) {
        apiFetch("/api/schedules", "POST", { list: nextList });
      }
      return nextList;
    });
  };

  const handleSaveJadwalImages = () => {
    setSchedules((prev) => {
      const otherSchedules = prev.filter((s) => s.id !== 1 && s.id !== 2 && s.id !== 3);
      const s1: JadwalPakan = { id: 1, waktu: time1, is_active: active1, trigger_manual: false };
      const s2: JadwalPakan = { id: 2, waktu: time2, is_active: active2, trigger_manual: false };
      const s3: JadwalPakan = { id: 3, waktu: time3, is_active: active3, trigger_manual: false };
      const nextList = [s1, s2, s3, ...otherSchedules].sort((a, b) => a.waktu.localeCompare(b.waktu));
      if (authToken) {
        apiFetch("/api/schedules", "POST", { list: nextList });
      }
      return nextList;
    });

    const currentTimeStr = getFullTimestamp(ntpTime);
    setSuccessToast({
      id: Math.random().toString(),
      message: "BERHASIL: 3 Jadwal utama berhasil diperbarui dan disimpan ke Cloud SQL database!",
      timestamp: currentTimeStr.substring(11, 19)
    });
  };

  // MOCK ACTIONS FROM RENDERED PHP WEB PAGE
  const handleTriggerManualFromWeb = () => {
    // sets trigger_manual flag in target MySQL schedule
    if (schedules.length > 0) {
      setSchedules((prev) => {
        const copy = [...prev];
        copy[0] = { ...copy[0], trigger_manual: true };
        return copy;
      });
    } else {
      // create temporary schedule holding trigger
      const tempJ: JadwalPakan = {
        id: 99,
        waktu: getFormattedTime().substring(0, 5),
        is_active: true,
        trigger_manual: true
      };
      setSchedules([tempJ]);
    }
    // Force immediate polling instead of waiting
    setTimeout(() => triggerServerPoll(), 500);
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col antialiased transition-colors duration-500 relative ${
      activeTab === 'admin' 
        ? 'bg-[#0A0B0E] text-slate-300' 
        : 'bg-[#A0D8F7] text-slate-800 select-none'
    }`}>
      
      {/* Water ripple graphics underlay on non-admin screens */}
      {activeTab !== 'admin' && (
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] overflow-hidden" id="aquatic-underlay">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#134e5e_2.5px,transparent_2.5px)] [background-size:24px_24px]"></div>
          {/* Circular light overlays simulated in water */}
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-white/20 blur-[130px]" />
          <div className="absolute bottom-10 right-1/4 w-[600px] h-[600px] rounded-full bg-cyan-100/35 blur-[150px]" />
        </div>
      )}

      {/* Dynamic Success Toast Notification */}
      {successToast && (
        <div className="fixed top-24 right-4 md:right-8 z-55 max-w-sm bg-[#134e5e] border-2 border-white/70 rounded-2xl p-4 shadow-2xl flex items-start gap-3 backdrop-blur-lg transform transition-all duration-300 animate-[bounce_1s_ease-out_1]">
          <div className="p-2 bg-white/20 text-white rounded-xl shrink-0 border border-white/10">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
              <span className="text-[9px] uppercase font-bold tracking-widest text-cyan-200 font-mono">Pakan Berhasil!</span>
              <span className="text-[9px] text-white/50 font-mono ml-4">{successToast.timestamp}</span>
            </div>
            <p className="text-white text-xs font-semibold mt-1 leading-relaxed">
              {successToast.message}
            </p>
          </div>
          <button 
            onClick={() => setSuccessToast(null)}
            className="text-white hover:opacity-80 transition duration-150 text-xs font-bold leading-none p-1 bg-white/10 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Emergency Low Feed Critical Alert Modal */}
      <AnimatePresence>
        {sisaPakan <= 5 && !isAlertDismissed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
              onClick={() => setIsAlertDismissed(true)}
            />
            
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-[#0D0E12] border-2 border-red-500/80 rounded-[32px] p-6 max-w-md w-full shadow-2xl relative overflow-hidden text-center space-y-6 z-10"
            >
              {/* Pulsing hazard ring */}
              <div className="mx-auto w-20 h-20 bg-red-500/10 border-2 border-red-500/40 rounded-full flex items-center justify-center text-red-500 animate-pulse">
                <Shield className="w-10 h-10 stroke-[2.5]" />
              </div>
              
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-red-500/15 text-red-400 border border-red-500/30 uppercase tracking-widest animate-pulse">
                  ⚠️ Peringatan Kritis (Urgent)
                </span>
                <h3 className="text-white text-2xl font-black uppercase tracking-tight font-sans">
                  DARURAT: SEGERA ISI PAKAN!
                </h3>
                <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                  Sensor ultrasonik HC-SR04 mendeteksi tingkat kapasitas pakan harian saat ini menyusut drastis hingga <strong className="text-red-400 text-sm font-black underline">{sisaPakan}%</strong>! Segera isi ulang tangki/tabung dispenser pakan sekarang untuk mencegah kegagalan mekanis motor servo ESP32.
                </p>
              </div>

              <div className="p-4 bg-red-950/20 rounded-2xl border border-red-900/35 text-left flex gap-3 text-[11px] text-slate-300 font-medium leading-relaxed">
                <span className="text-lg">💡</span>
                <span>
                  Jika tangki pakan kosong total, motor servo berputar tanpa pakan jatuh dapat melebihi torsi penahan mekanis dan menyebabkan kerusakan roda gigi mikro pendorong pakan.
                </span>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleRefillPakan}
                  className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-red-600/20 active:scale-98 cursor-pointer border border-red-500"
                >
                  ISI ULANG SEKARANG (REFILL 100%)
                </button>
                <button
                  onClick={() => setIsAlertDismissed(true)}
                  className="w-full py-3 bg-transparent hover:bg-white/5 text-slate-400 hover:text-white font-bold rounded-2xl text-xs uppercase transition-all cursor-pointer"
                >
                  TUTUP JENDELA SEMENTARA
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Top Navigation Bar mimicking Mockup Header exactly */}
      <nav className={`px-6 py-4 sticky top-0 z-45 backdrop-blur-md border-b transition-all duration-300 ${
        activeTab === 'admin'
          ? 'bg-[#14171C]/95 border-slate-800 text-slate-300'
          : 'bg-white/70 border-white/20 text-[#134e5e] shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-row justify-between items-center gap-4">
          
          {/* Left Brand Area */}
          <button 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2 group text-left cursor-pointer focus:outline-none"
          >
            <div className={`p-2 rounded-xl transition-all ${
              activeTab === 'admin' ? 'bg-cyan-950/20 text-cyan-400' : 'bg-[#134e5e]/10 text-[#134e5e]'
            }`}>
              <Fish className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className={`text-lg md:text-xl font-black tracking-tight ${
                activeTab === 'admin' ? 'text-white' : 'text-[#1F3E5A]'
              }`}>
                Pakan Ikan
              </h1>
              <p className="text-[9px] opacity-70 font-mono tracking-wider uppercase">Smarter IoT Feeder</p>
            </div>
          </button>

          {/* Center Links - 5 Main requested menus */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-8 text-xs font-extrabold tracking-wider uppercase">
            <button
              onClick={() => setActiveTab('home')}
              className={`py-1.5 transition-all relative cursor-pointer ${
                activeTab === 'home' 
                  ? 'text-white bg-[#134e5e] px-3.5 py-1 rounded-full' 
                  : 'hover:opacity-100 opacity-80'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setActiveTab('sisa-pakan')}
              className={`py-1.5 transition-all relative cursor-pointer ${
                activeTab === 'sisa-pakan'
                  ? 'text-white bg-[#134e5e] px-3.5 py-1 rounded-full' 
                  : 'hover:opacity-100 opacity-80'
              }`}
            >
              Sisa Pakan
            </button>
            <button
              onClick={() => setActiveTab('jadwal-manual')}
              className={`py-1.5 transition-all relative cursor-pointer ${
                activeTab === 'jadwal-manual'
                  ? 'text-white bg-[#134e5e] px-3.5 py-1 rounded-full' 
                  : 'hover:opacity-100 opacity-80'
              }`}
            >
              Jadwal & Manual
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-1.5 transition-all relative cursor-pointer ${
                activeTab === 'history'
                  ? 'text-white bg-[#134e5e] px-3.5 py-1 rounded-full' 
                  : 'hover:opacity-100 opacity-80'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setActiveTab('cloud-sync')}
              className={`py-1.5 transition-all relative cursor-pointer ${
                activeTab === 'cloud-sync'
                  ? 'text-white bg-[#134e5e] px-3.5 py-1 rounded-full' 
                  : 'hover:opacity-100 opacity-80'
              }`}
            >
              Cloud Sync
            </button>
            <button
              onClick={() => setActiveTab('about-contact')}
              className={`py-1.5 transition-all relative cursor-pointer ${
                activeTab === 'about-contact'
                  ? 'text-white bg-[#134e5e] px-3.5 py-1 rounded-full' 
                  : 'hover:opacity-100 opacity-80'
              }`}
            >
              About & Contact
            </button>
          </div>

          {/* Far Right action button - Google Sign-In and Admin switch */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/40 p-1 pr-3 rounded-full border border-slate-200 dark:border-slate-800">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="User Avatar" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full border border-white" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                    {currentUser.email ? currentUser.email[0].toUpperCase() : "U"}
                  </div>
                )}
                <span className="hidden md:inline text-xs font-extrabold text-[#1F3E5A] dark:text-slate-200">
                  {currentUser.displayName || currentUser.email?.split("@")[0]}
                </span>
                <button
                  onClick={handleSignOut}
                  className="ml-2 text-[10px] font-black uppercase tracking-wider text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded-full transition-all cursor-pointer"
                >
                  Keluar
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="p-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-2 bg-white text-[#1F3E5A] hover:bg-slate-50 border border-slate-200"
              >
                <Database className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Masuk Google</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab(activeTab === 'admin' ? 'home' : 'admin')}
              className={`p-2.5 px-4 md:px-5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-2 ${
                activeTab === 'admin'
                  ? 'bg-red-500 hover:bg-red-400 text-white'
                  : 'bg-[#1F3E5A] hover:bg-[#134e5e] text-white'
              }`}
            >
              <Cpu className="w-4 h-4 shrink-0" />
              <span>{activeTab === 'admin' ? "Console Out" : "Console Admin"}</span>
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Sub-menu banner for absolute accessibility on smartphones */}
        <div className="lg:hidden flex justify-around items-center mt-3 pt-2.5 border-t border-slate-200/50 text-[10px] uppercase font-black tracking-wider text-[#134e5e]">
          <button onClick={() => setActiveTab('home')} className={`pb-1 ${activeTab === 'home' ? 'border-b-2 border-[#134e5e]' : 'opacity-70'}`}>Home</button>
          <button onClick={() => setActiveTab('sisa-pakan')} className={`pb-1 ${activeTab === 'sisa-pakan' ? 'border-b-2 border-[#134e5e]' : 'opacity-70'}`}>Pakan</button>
          <button onClick={() => setActiveTab('jadwal-manual')} className={`pb-1 ${activeTab === 'jadwal-manual' ? 'border-b-2 border-[#134e5e]' : 'opacity-70'}`}>Jadwal</button>
          <button onClick={() => setActiveTab('history')} className={`pb-1 ${activeTab === 'history' ? 'border-b-2 border-[#134e5e]' : 'opacity-70'}`}>Histomoni</button>
          <button onClick={() => setActiveTab('cloud-sync')} className={`pb-1 ${activeTab === 'cloud-sync' ? 'border-b-2 border-[#134e5e]' : 'opacity-70'}`}>Cloud</button>
          <button onClick={() => setActiveTab('about-contact')} className={`pb-1 ${activeTab === 'about-contact' ? 'border-b-2 border-[#134e5e]' : 'opacity-70'}`}>About</button>
        </div>
      </nav>

      {/* Main Body container */}
      <main className="flex-1 max-w-7xl mx-auto p-4 md:p-8 w-full">
        
        {/* ==================== MENU 1: HOME TAB ==================== */}
        {activeTab === 'home' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-4 md:py-12" id="home-dashboard-mockup">
            
            {/* Left Column: Slogans and Actions */}
            <div className="lg:col-span-6 space-y-6 md:space-y-8 text-center lg:text-left">
              <div className="space-y-3">
                <span className="text-xs uppercase font-extrabold tracking-widest text-[#134e5e] bg-white/50 px-3.5 py-1.5 rounded-full border border-white/40 shadow-sm inline-block">
                  Sistem Pakan IoT Aktif 🐠
                </span>
                <h2 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tighter leading-none font-sans uppercase">
                  <span className="text-white block drop-shadow-sm">BERI</span>
                  <span className="text-[#1F3E5A] block">MAKAN</span>
                  <span className="text-white block drop-shadow-sm">IKAN KAMU</span>
                </h2>
              </div>

              <div className="space-y-2.5 max-w-md mx-auto lg:mx-0 text-slate-800 font-bold text-sm sm:text-base leading-relaxed">
                <p className="text-[#1F3E5A]">sudah kah kamu hari ini memberi makan ikanmu!!</p>
                <p className="text-slate-600 font-medium">Yukk kita Lihat sudah berapa kali kamu memberikan makan ikanmu</p>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-4 justify-center lg:justify-start">
                <button
                  onClick={() => setActiveTab('sisa-pakan')}
                  className="px-8 py-4 border-3 border-[#1F3E5A] hover:bg-[#1F3E5A]/95 hover:text-white text-[#1F3E5A] font-black rounded-2xl transition-all duration-300 text-sm uppercase tracking-wider shadow-lg bg-white/20 cursor-pointer hover:shadow-xl active:scale-95"
                >
                  Lihat pakan
                </button>
                <button
                  onClick={() => executeFeeding('Manual')}
                  disabled={isFeeding || sisaPakan <= 0}
                  className={`px-8 py-4 rounded-2xl border-3 border-transparent bg-amber-500 hover:bg-amber-600 text-white font-black text-sm uppercase tracking-wider transition-all shadow-lg cursor-pointer hover:shadow-xl active:scale-95 disabled:opacity-50 flex items-center gap-2`}
                >
                  {isFeeding ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>SERVO BERPUTAR...</span>
                    </>
                  ) : (
                    <span>BERI MAKAN SEKARANG</span>
                  )}
                </button>
              </div>

              {/* Bottom Social Handles */}
              <div className="pt-6 border-t border-white/20 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#1F3E5A]/80">Ikuti Kami:</span>
                <div className="flex gap-3">
                  <a href="#facebook" className="w-10 h-10 rounded-full bg-black text-[#A0D8F7] hover:bg-slate-900 transition-all flex items-center justify-center shadow-md cursor-pointer" title="Facebook">
                    <Facebook className="w-5 h-5" />
                  </a>
                  <a href="#instagram" className="w-10 h-10 rounded-full bg-black text-[#A0D8F7] hover:bg-slate-900 transition-all flex items-center justify-center shadow-md cursor-pointer" title="Instagram">
                    <Instagram className="w-5 h-5" />
                  </a>
                  <a href="#tiktok" className="w-10 h-10 rounded-full bg-black text-[#A0D8F7] hover:bg-slate-900 transition-all flex items-center justify-center shadow-md cursor-pointer text-[10px] font-black uppercase tracking-wider font-sans px-3" title="TikTok">
                    <span>TikTok</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Right Column: Three Slanted Parallel Rectangles holding Fish Portraits */}
            <div className="lg:col-span-6 flex items-center justify-center gap-3 sm:gap-4 pt-8 lg:pt-0 relative">
              
              {/* Falling Pellets Animation */}
              <FallingPellets isActive={isFeeding} />
              
              {/* Slanted Card 1: Gold Koi Fish representing first mockup */}
              <div className="relative group overflow-hidden w-[100px] sm:w-[150px] md:w-[170px] h-[280px] sm:h-[380px] md:h-[440px] -skew-x-[12deg] rounded-[32px] border-2 border-white/90 bg-[#134e5e]/10 shadow-[0_30px_60px_rgba(19,78,94,0.2)] transition-all duration-500 ease-out hover:scale-[1.06] hover:-translate-y-2.5 hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.75),_0_45px_75px_rgba(19,78,94,0.35)] cursor-pointer">
                <img 
                  src="/fb5d450319bd277e9f11920cf7d71f25.jpg" 
                  className="w-full h-full object-cover object-center skew-x-[12deg] scale-[1.25] transition-transform duration-700 group-hover:scale-[1.32]" 
                  referrerPolicy="no-referrer"
                  alt="Koi Fish"
                  onError={(e) => {
                    // fallback to elegant high-quality gold/koi image if local resource proxy isn't loaded
                    e.currentTarget.src = "https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&q=80&w=600";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent pointer-events-none"></div>
                <div className="absolute top-3 right-3 skew-x-[12deg] bg-indigo-600/90 text-[7px] text-white font-black font-mono px-1.5 py-0.5 rounded uppercase tracking-wider shadow border border-indigo-500">
                  DB SECURE • LOCKED
                </div>
                <span className="absolute bottom-4 left-4 text-[10px] uppercase font-black tracking-widest text-white skew-x-[12deg]">Koipen</span>
              </div>

              {/* Slanted Card 2: Splendid Blue Betta Fish in center */}
              <div className="relative group overflow-hidden w-[100px] sm:w-[150px] md:w-[170px] h-[280px] sm:h-[380px] md:h-[440px] -skew-x-[12deg] rounded-[32px] border-2 border-white/90 bg-[#134e5e]/10 shadow-[0_30px_60px_rgba(19,78,94,0.2)] transition-all duration-500 ease-out hover:scale-[1.06] hover:-translate-y-2.5 hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.75),_0_45px_75px_rgba(19,78,94,0.35)] cursor-pointer z-10">
                <img 
                  src="/wp6070827.jpg" 
                  className="w-full h-full object-cover object-center skew-x-[12deg] scale-[1.25] transition-transform duration-700 group-hover:scale-[1.32]" 
                  referrerPolicy="no-referrer"
                  alt="Betta Fish"
                  onError={(e) => {
                    // fallback to elegant blue/purple betta image if local resource proxy isn't loaded
                    e.currentTarget.src = "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=600";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent pointer-events-none"></div>
                <div className="absolute top-3 right-3 skew-x-[12deg] bg-indigo-600/90 text-[7px] text-white font-black font-mono px-1.5 py-0.5 rounded uppercase tracking-wider shadow border border-indigo-500">
                  DB SECURE • LOCKED
                </div>
                <span className="absolute bottom-4 left-4 text-[10px] uppercase font-black tracking-widest text-white skew-x-[12deg]">Cupang</span>
              </div>

              {/* Slanted Card 3: Clownfish on reef */}
              <div className="relative group overflow-hidden w-[100px] sm:w-[150px] md:w-[170px] h-[280px] sm:h-[380px] md:h-[440px] -skew-x-[12deg] rounded-[32px] border-2 border-white/90 bg-[#134e5e]/10 shadow-[0_30px_60px_rgba(19,78,94,0.2)] transition-all duration-500 ease-out hover:scale-[1.06] hover:-translate-y-2.5 hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.75),_0_45px_75px_rgba(19,78,94,0.35)] cursor-pointer">
                <img 
                  src="/fcUdE5rXb4Ovlp7Q2ZHh.jpg" 
                  className="w-full h-full object-cover object-center skew-x-[12deg] scale-[1.25] transition-transform duration-700 group-hover:scale-[1.32]" 
                  referrerPolicy="no-referrer"
                  alt="Clownfish"
                  onError={(e) => {
                    // fallback to elegant clownfish image if local resource proxy isn't loaded
                    e.currentTarget.src = "https://images.unsplash.com/photo-1524704654690-b56006bc4a47?auto=format&fit=crop&q=80&w=600";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent pointer-events-none"></div>
                <div className="absolute top-3 right-3 skew-x-[12deg] bg-indigo-600/90 text-[7px] text-white font-black font-mono px-1.5 py-0.5 rounded uppercase tracking-wider shadow border border-indigo-500">
                  DB SECURE • LOCKED
                </div>
                <span className="absolute bottom-4 left-4 text-[10px] uppercase font-black tracking-widest text-white skew-x-[12deg]">Anemon</span>
              </div>

            </div>
          </div>
        )}

        {/* ==================== MENU 2: SISA PAKAN TAB ==================== */}
        {activeTab === 'sisa-pakan' && (
          <div className="max-w-3xl mx-auto space-y-6" id="sisa-pakan-dashboard">
            
            <div className="bg-white/80 border border-white/50 rounded-3xl p-6 md:p-8 text-slate-800 shadow-xl backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#134e5e]/5 rounded-full blur-3xl -z-10"></div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4 mb-6">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#134e5e] font-mono">PENGUKURAN ULTRASONIK (HC-SR04)</span>
                  <h3 className="text-[#1F3E5A] text-2xl font-black mt-0.5">Sisa Pakan dalam Tabung</h3>
                </div>
                <span className="p-1 px-3 bg-[#134e5e]/10 text-[#134e5e] rounded-xl text-xs font-bold uppercase shrink-0 border border-[#134e5e]/20">
                  Tinggi Sensor: {jarakCm.toFixed(1)} cm
                </span>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                
                {/* Physical bottle visual cylinder */}
                <div className="relative w-24 h-56 flex flex-col items-center select-none shrink-0">
                  {/* Bottle Cap */}
                  <div className="w-14 h-3 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-800 rounded-t-md shadow-md border-b border-slate-950 z-10"></div>

                  {/* Transparent cylinder bottle */}
                  <div className="relative w-20 h-44 bg-slate-950/90 rounded-b-xl border-2 border-white/80 overflow-hidden flex flex-col justify-end shadow-[inset_0_3px_12px_rgba(0,0,0,0.8)]">
                    
                    {/* Level Scale */}
                    <div className="absolute inset-y-0 left-2 flex flex-col justify-between text-[7px] font-mono text-white/50 py-3 select-none pointer-events-none z-15">
                      <span>- 100%</span>
                      <span>- 80%</span>
                      <span>- 60%</span>
                      <span>- 40%</span>
                      <span className="text-red-400 font-bold">- 20% limit</span>
                      <span>- 0%</span>
                    </div>

                    {/* Pellets volume with spring bounce and particles */}
                    <motion.div 
                      className={`w-full relative rounded-b-[8px] overflow-hidden ${
                        sisaPakan <= 20 
                          ? 'bg-gradient-to-t from-red-800 via-red-650 to-red-500' 
                          : 'bg-gradient-to-t from-amber-850 via-amber-700 to-yellow-600'
                      }`}
                      animate={{ height: `${sisaPakan}%` }}
                      transition={{ type: "spring", stiffness: 55, damping: 14 }}
                    >
                      {/* Pellet grains pattern */}
                      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#000000_1.5px,transparent_1.5px)] [background-size:6px_6px]"></div>
                      
                      {/* Dynamic light reflection particles floating upwards */}
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute w-2 h-2 rounded-full bg-white/20 blur-[1px] animate-pulse left-4 bottom-6 duration-700"></div>
                        <div className="absolute w-1.5 h-1.5 rounded-full bg-white/10 blur-[1px] animate-pulse right-5 bottom-12 duration-1000"></div>
                        <div className="absolute w-2.5 h-2.5 rounded-full bg-white/15 blur-[1px] animate-pulse left-10 bottom-24 duration-500"></div>
                      </div>

                      {/* Animated Wave container line for a rich physical slosh effect */}
                      <motion.div 
                        className={`absolute top-0 inset-x-0 h-1.5 z-25 ${
                          sisaPakan <= 20 
                            ? 'bg-gradient-to-r from-red-400 via-red-500 to-red-400 shadow-[0_0_12px_#ef4444]' 
                            : 'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300 shadow-[0_0_12px_#f59e0b]'
                        }`}
                        animate={{
                          y: [0, -1, 1, 0],
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 2.5,
                          ease: "easeInOut"
                        }}
                      />
                    </motion.div>

                    {/* Glass sheen */}
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-black/20 pointer-events-none"></div>

                    {/* Flashing danger alert icon */}
                    {sisaPakan <= 20 && (
                      <div className="absolute inset-x-0 bottom-4 flex justify-center items-center pointer-events-none animate-bounce">
                        <div className="w-5 h-5 rounded-full bg-red-650 animate-ping absolute opacity-80"></div>
                        <div className="w-4 h-4 rounded-full bg-red-650 flex items-center justify-center text-[10px] font-bold text-white z-20">!</div>
                      </div>
                    )}
                  </div>

                  {/* Funnel Slope */}
                  <div className="w-10 h-3 bg-gradient-to-b from-slate-700 to-slate-900 rounded-b-md shadow-md"></div>
                  <div className="w-4 h-3 bg-slate-950 border-t border-slate-900"></div>
                </div>

                {/* Level parameters descriptions & Refill triggers */}
                <div className="flex-1 space-y-5 w-full text-center md:text-left">
                  
                  <div className="space-y-1">
                    <span className="text-xs uppercase font-extrabold tracking-wider text-slate-500">Status Kapasitas</span>
                    <div className="flex items-baseline justify-center md:justify-start gap-2.5">
                      <span className={`text-5xl font-black tracking-tight ${sisaPakan <= 20 ? 'text-red-600 animate-pulse' : 'text-[#1F3E5A]'}`}>
                        {sisaPakan}%
                      </span>
                      <span className="text-xs font-bold text-slate-550">
                        {sisaPakan <= 20 ? '(Segera Isi Ulang!)' : '(Persediaan Cukup)'}
                      </span>
                    </div>
                  </div>

                  {/* Estimasi Hari Sisa Pakan Widget */}
                  <div className="bg-[#134e5e]/5 border border-[#134e5e]/15 p-4 rounded-2xl text-left space-y-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="p-1 bg-[#134e5e]/10 text-[#134e5e] rounded-lg">
                        <Activity className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-black text-[#134e5e] uppercase tracking-wider">
                        ESTIMASI SISA HARI PAKAN (INTELLIGENT PREDICTION)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Sisa Waktu Operasional</span>
                        <span className={`text-3xl font-black ${pakanEstimation.daysLeftNum <= 1.5 ? 'text-red-600 animate-pulse' : 'text-[#1F3E5A]'}`}>
                          {pakanEstimation.daysLeft} Hari
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="text-[10px] text-slate-600 leading-none font-bold">
                          Frekuensi Rerata: <strong className="text-[#134e5e] font-extrabold">{pakanEstimation.avgFeedingsPerDay}x / hari</strong>
                        </div>
                        <div className="text-[10px] text-slate-600 leading-none font-bold">
                          Deplesi Harian: <strong className="text-[#134e5e] font-extrabold">~{pakanEstimation.avgDailyDepletionPercent}% / hari</strong>
                        </div>
                      </div>
                    </div>

                    <div className="text-[9px] text-slate-550 border-t border-[#134e5e]/10 pt-2 font-mono flex items-center justify-between">
                      <span>Sampel: {pakanEstimation.totalDaysRecorded} hari aktif di database</span>
                      {pakanEstimation.daysLeftNum <= 1.5 && (
                        <span className="text-red-600 font-bold animate-pulse">⚠️ Segera Refill!</span>
                      )}
                    </div>
                  </div>

                  {/* Siren alarm active warning cards */}
                  {sisaPakan <= 20 ? (
                    <div className="bg-red-50 border-2 border-red-200 p-4 rounded-2xl space-y-2 text-left" id="critical-hopper-sirens">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                        </span>
                        <span className="text-xs font-black text-red-700 uppercase tracking-wider">SIRENE PAKAN KRITIS AKTIF</span>
                      </div>
                      <p className="text-xs text-red-650 font-semibold leading-relaxed">
                        Perhatian: Level pakan di botol penampung kurang dari 20%! Motor servo dan pompa rotasi berisiko macet karena tabung kosong. Silakan letakkan pakan baru ke wadah sekarang.
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600 bg-[#A0D8F7]/20 p-4 rounded-2xl border border-white/60 leading-relaxed text-left">
                      💡 <strong>Fungsi Kalibrasi:</strong> Sensor ultrasonik diprogram untuk mendeteksi tinggi tabung botol pakan sejauh <strong>{jarakKosong} cm</strong>. Apabila pakan penuh, jarak ke pakan adalah <strong>{jarakPenuh} cm</strong>. Sistem sinkron ini mengoperasikan data secara akurat.
                    </div>
                  )}

                  {/* Big Manual Refill Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleRefillPakan}
                      className="w-full sm:w-auto px-6 py-3 bg-[#134e5e] hover:bg-[#1F3E5A] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Selesaikan Isi Ulang Tabung (Refill 100%)</span>
                    </button>
                  </div>

                </div>
              </div>

            </div>

          </div>
        )}

        {/* ==================== MENU 3: JADWAL & PAKAN MANUAL TAB (Image 2 Replica) ==================== */}
        {activeTab === 'jadwal-manual' && (
          <div className="max-w-4xl mx-auto space-y-8" id="schedule-dashboard-mockup">
            
            {/* Header row: SCHEDULE with big toggle switch next to it */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 p-5 rounded-2xl border border-white/40">
              <div className="flex items-center gap-4 select-none">
                <h2 className="text-5xl md:text-6xl font-black tracking-tighter text-[#1F3E5A] uppercase">
                  SCHEDULE
                </h2>
                {/* Giant toggle switch next to Schedule title representing Mockup exactly */}
                <button
                  onClick={() => {
                    const nextSt = !isScheduleMasterEnabled;
                    setIsScheduleMasterEnabled(nextSt);
                    setActive1(nextSt);
                    setActive2(nextSt);
                    setActive3(nextSt);
                  }}
                  className={`w-20 h-10 rounded-full p-1 transition-colors duration-300 relative focus:outline-none cursor-pointer ${
                    isScheduleMasterEnabled ? 'bg-[#1F3E5A]' : 'bg-slate-450/75 bg-slate-400'
                  }`}
                  title="Aktifkan/Matikan Penjadwal Otomatis"
                >
                  <div className={`w-8 h-8 rounded-full bg-white shadow-md transform transition-transform duration-300 flex items-center justify-center ${
                    isScheduleMasterEnabled ? 'translate-x-10' : 'translate-x-0'
                  }`}>
                    <Power className={`w-4 h-4 ${isScheduleMasterEnabled ? 'text-emerald-500' : 'text-slate-400'}`} />
                  </div>
                </button>
              </div>

              <div className="text-xs font-bold text-[#134e5e] font-mono uppercase bg-white/70 p-2.5 rounded-xl border border-white/50">
                Sistem Waktu NTP: <span className="text-white bg-[#1F3E5A] px-2 py-0.5 rounded ml-1 font-bold">{getFormattedTime()}</span>
              </div>
            </div>

            {/* Grid for schedule selectors & instructions */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              
              {/* Left Column: 1st, 2nd, and 3rd custom scheduled inputs */}
              <div className="md:col-span-12 xl:col-span-8 space-y-4" id="premium-schedulers-list">
                
                {/* Slot 1 input */}
                <motion.div 
                  whileHover={{ scale: 1.01 }}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border-2 transition-all shadow-sm ${
                    active1 && isScheduleMasterEnabled
                      ? 'bg-[#1F3E5A]/10 border-[#1F3E5A]/40 shadow-[rgba(31,62,90,0.06)_0px_8px_24px]'
                      : 'bg-white border-slate-100/80 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${
                      active1 && isScheduleMasterEnabled ? 'bg-amber-100 text-amber-600 shadow-[0_4px_12px_rgba(230,138,0,0.15)] animate-pulse' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <Sunrise className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-[#1F3E5A] font-black text-sm uppercase tracking-wider">Pakan 1 (Pagi)</h4>
                      <p className="text-[10px] text-slate-500 font-bold block mt-0.5">⏱️ Rekomendasi: 06:00 - 08:30 WIB</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3.5 self-end sm:self-auto shrink-0">
                    <input 
                      type="time" 
                      value={time1}
                      onChange={(e) => setTime1(e.target.value)}
                      disabled={!isScheduleMasterEnabled}
                      className="bg-[#1F3E5A] text-[#A0D8F7] font-black text-lg sm:text-xl rounded-xl p-2.5 px-4 outline-none border border-slate-700/20 focus:ring-2 focus:ring-[#00BDFF]/30 select-all font-mono shadow-inner disabled:opacity-40 transition-all cursor-pointer"
                    />
                    {/* Tick Checkbox representation of the mockup */}
                    <button
                      onClick={() => isScheduleMasterEnabled && setActive1(!active1)}
                      disabled={!isScheduleMasterEnabled}
                      className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                        active1 && isScheduleMasterEnabled
                          ? 'bg-[#1F3E5A] text-[#A0D8F7] border-[#1F3E5A] scale-102 hover:bg-[#134e5e]'
                          : 'bg-white text-slate-350 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      title="Aktifkan jadwal ini"
                    >
                      {active1 && isScheduleMasterEnabled ? (
                        <Check className="w-6 h-6 stroke-[3.5]" />
                      ) : (
                        <Check className="w-6 h-6 text-slate-200" />
                      )}
                    </button>
                  </div>
                </motion.div>

                {/* Slot 2 input */}
                <motion.div 
                  whileHover={{ scale: 1.01 }}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border-2 transition-all shadow-sm ${
                    active2 && isScheduleMasterEnabled
                      ? 'bg-[#1F3E5A]/10 border-[#1F3E5A]/40 shadow-[rgba(31,62,90,0.06)_0px_8px_24px]'
                      : 'bg-white border-slate-100/80 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${
                      active2 && isScheduleMasterEnabled ? 'bg-orange-100 text-orange-600 shadow-[0_4px_12px_rgba(234,88,12,0.15)] animate-pulse' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <Sun className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-[#1F3E5A] font-black text-sm uppercase tracking-wider">Pakan 2 (Siang)</h4>
                      <p className="text-[10px] text-slate-500 font-bold block mt-0.5">⏱️ Rekomendasi: 11:30 - 13:30 WIB</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3.5 self-end sm:self-auto shrink-0">
                    <input 
                      type="time" 
                      value={time2}
                      onChange={(e) => setTime2(e.target.value)}
                      disabled={!isScheduleMasterEnabled}
                      className="bg-[#1F3E5A] text-[#A0D8F7] font-black text-lg sm:text-xl rounded-xl p-2.5 px-4 outline-none border border-slate-700/20 focus:ring-2 focus:ring-[#00BDFF]/30 select-all font-mono shadow-inner disabled:opacity-40 transition-all cursor-pointer"
                    />
                    {/* Tick Checkbox representation of the mockup */}
                    <button
                      onClick={() => isScheduleMasterEnabled && setActive2(!active2)}
                      disabled={!isScheduleMasterEnabled}
                      className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                        active2 && isScheduleMasterEnabled
                          ? 'bg-[#1F3E5A] text-[#A0D8F7] border-[#1F3E5A] scale-102 hover:bg-[#134e5e]'
                          : 'bg-white text-slate-350 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      title="Aktifkan jadwal ini"
                    >
                      {active2 && isScheduleMasterEnabled ? (
                        <Check className="w-6 h-6 stroke-[3.5]" />
                      ) : (
                        <Check className="w-6 h-6 text-slate-200" />
                      )}
                    </button>
                  </div>
                </motion.div>

                {/* Slot 3 input */}
                <motion.div 
                  whileHover={{ scale: 1.01 }}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border-2 transition-all shadow-sm ${
                    active3 && isScheduleMasterEnabled
                      ? 'bg-[#1F3E5A]/10 border-[#1F3E5A]/40 shadow-[rgba(31,62,90,0.06)_0px_8px_24px]'
                      : 'bg-white border-slate-100/80 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${
                      active3 && isScheduleMasterEnabled ? 'bg-indigo-100 text-indigo-600 shadow-[0_4px_12px_rgba(79,70,229,0.15)] animate-pulse' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <Sunset className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-[#1F3E5A] font-black text-sm uppercase tracking-wider">Pakan 3 (Sore)</h4>
                      <p className="text-[10px] text-slate-500 font-bold block mt-0.5">⏱️ Rekomendasi: 16:30 - 18:30 WIB</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3.5 self-end sm:self-auto shrink-0">
                    <input 
                      type="time" 
                      value={time3}
                      onChange={(e) => setTime3(e.target.value)}
                      disabled={!isScheduleMasterEnabled}
                      className="bg-[#1F3E5A] text-[#A0D8F7] font-black text-lg sm:text-xl rounded-xl p-2.5 px-4 outline-none border border-slate-700/20 focus:ring-2 focus:ring-[#00BDFF]/30 select-all font-mono shadow-inner disabled:opacity-40 transition-all cursor-pointer"
                    />
                    {/* Tick Checkbox representation of the mockup */}
                    <button
                      onClick={() => isScheduleMasterEnabled && setActive3(!active3)}
                      disabled={!isScheduleMasterEnabled}
                      className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                        active3 && isScheduleMasterEnabled
                          ? 'bg-[#1F3E5A] text-[#A0D8F7] border-[#1F3E5A] scale-102 hover:bg-[#134e5e]'
                          : 'bg-white text-slate-350 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      title="Aktifkan jadwal ini"
                    >
                      {active3 && isScheduleMasterEnabled ? (
                        <Check className="w-6 h-6 stroke-[3.5]" />
                      ) : (
                        <Check className="w-6 h-6 text-slate-200" />
                      )}
                    </button>
                  </div>
                </motion.div>

              </div>

              {/* Right Column: Instructions from Image 2 & Save Schedules button */}
              <div className="md:col-span-12 xl:col-span-4 bg-white/80 border border-white/50 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-xl backdrop-blur-md">
                
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#1F3E5A]/10 text-[#1F3E5A] uppercase">
                    Petunjuk Dokter Hewan
                  </span>
                  <h3 className="text-xl font-black text-[#1F3E5A] tracking-tight leading-snug">
                     MAXIMAL IKAN DI BERI MAKAN 3X SEHARI
                  </h3>
                  <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                     Pemberian pakan 3 kali sehari (pagi, siang, sore) sudah optimal untuk memelihara sisa metabolisme air akuarium/kolam tetap bersih dan ikan koki atau koi tetap lincah.
                  </p>
                </div>

                <div className="pt-6">
                  <button
                    onClick={handleSaveJadwalImages}
                    disabled={!isScheduleMasterEnabled}
                    className="w-full py-4 bg-[#1F3E5A] hover:bg-[#134e5e] text-white font-black rounded-2xl text-xs uppercase cursor-pointer tracking-wider transition-all shadow-md hover:shadow-xl hover:scale-[1.01] active:translate-y-0.5 select-none disabled:opacity-50 disabled:pointer-events-none"
                  >
                    SIMPAN JADWAL
                  </button>
                </div>

              </div>

            </div>

            {/* Manual Feed Prompt Section below */}
            <div className="bg-white/40 border border-white/40 p-6 md:p-8 rounded-3xl text-center space-y-4">
               <h3 className="text-xl sm:text-2xl font-black text-[#1F3E5A]">
                  Ingin Memberikan Manual?
               </h3>
               
               <div className="max-w-md mx-auto">
                 <button
                   onClick={handleTriggerManualFromWeb}
                   disabled={isFeeding || sisaPakan <= 0}
                   className={`w-full py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                     isFeeding 
                       ? 'bg-slate-650 text-white animate-pulse'
                       : 'bg-[#1F3E5A] hover:bg-[#134e5e] text-white hover:shadow-xl hover:scale-[1.01] active:scale-95'
                   }`}
                 >
                   {isFeeding ? (
                     <>
                       <RefreshCw className="w-4 h-4 animate-spin" />
                       <span>SERVO BERPUTAR... MENYALURKAN PAKAN</span>
                     </>
                   ) : (
                     <>
                       <span>AYO BERI MAKAN!!</span>
                     </>
                   )}
                 </button>
               </div>

               {isFeeding && (
                 <p className="text-[10px] text-[#134e5e] font-bold font-mono tracking-wide animate-pulse">
                   *NodeMCU ESP32 mendeteksi pemicu manual web. Mengirimkan sinyal rotasi 180° ke servo MG90S.
                 </p>
               )}
            </div>

          </div>
        )}

        {/* ==================== MENU 4: HISTORY (GRAFIK & KAPAN TERAKHIR) ==================== */}
        {activeTab === 'history' && (
          <div className="space-y-6" id="history-dashboard">
            
            {/* Top stats highlighting Last Feed date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Highlight Card: Kapan terakhir kali memberi makan */}
              <div className="bg-white/80 border border-white/50 rounded-3xl p-6 shadow-xl backdrop-blur-md flex items-center gap-5 relative overflow-hidden text-slate-800">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100/40 rounded-full blur-2xl"></div>
                <div className="p-4 bg-emerald-150 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200">
                  <Clock className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">Pemberian Pakan Terakhir</span>
                  <h4 className="text-[#1F3E5A] text-xl font-black mt-1 font-mono">
                    {logs[0] ? logs[0].waktu_eksekusi : 'Belum Pernah'}
                  </h4>
                  <p className="text-[11px] text-emerald-600 font-bold mt-0.5 uppercase tracking-wide">
                     Metode: <strong className="underline uppercase">{logs[0]?.metode || 'Otomatis'}</strong> ({logs[0]?.status || 'Sukses'})
                  </p>
                </div>
              </div>

              {/* Mini statistic counters */}
              <div className="bg-white/80 border border-white/50 rounded-3xl p-6 shadow-xl backdrop-blur-md flex justify-around items-center text-slate-800 text-center">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-[#134e5e] font-mono">Makan Hari Ini</span>
                  <div className="text-4xl font-extrabold text-[#1F3E5A] font-mono">
                    {logs.filter(l => l.waktu_eksekusi.includes("2026-06-22")).length} Kali
                  </div>
                  <p className="text-[9px] text-slate-500">Tanggal 22 Juni 2026</p>
                </div>
                <div className="h-10 w-px bg-slate-200"></div>
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-[#134e5e] font-mono">Total Pemberian</span>
                  <div className="text-4xl font-extrabold text-[#1F3E5A] font-mono">
                    {logs.length} Kali
                  </div>
                  <p className="text-[9px] text-slate-500">Database Aktif MySQL</p>
                </div>
              </div>

            </div>

            {/* Chart stats panel from server mockups */}
            <div className="bg-white/80 border border-white/50 p-6 rounded-3xl shadow-xl backdrop-blur-md">
              <FeedingStatsChart logs={logs} />
            </div>

            {/* Log list details */}
            <div className="bg-white/80 border border-white/50 p-6 rounded-3xl shadow-xl backdrop-blur-md text-slate-850">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                <h4 className="text-[#1F3E5A] text-base font-black uppercase">Daftar Audit Log Pakan</h4>
                <span className="text-xs text-slate-500 font-mono">Tabel log_pakan: {logs.length} baris</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                      <th className="p-3">ID Log</th>
                      <th className="p-3">Waktu Eksekusi</th>
                      <th className="p-3">Metode Trigger</th>
                      <th className="p-3">Status Servo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {logs.slice(0, 15).map((lg) => (
                      <tr key={lg.id} className="hover:bg-slate-50/50">
                        <td className="p-3 text-slate-400 font-bold">#{lg.id}</td>
                        <td className="p-3 text-slate-800 font-bold">{lg.waktu_eksekusi}</td>
                        <td className="p-3 font-semibold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            lg.metode === 'Manual' 
                              ? 'bg-blue-50 text-blue-700 border border-blue-150' 
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                          }`}>
                            {lg.metode}
                          </span>
                        </td>
                        <td className="p-3 text-emerald-600 font-bold uppercase select-none">● {lg.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ==================== MENU 5: CLOUD SYNC GOOGLE WORKSPACE ==================== */}
        {activeTab === 'cloud-sync' && (
          <CloudSync
            currentUser={currentUser}
            authToken={authToken}
            schedules={schedules}
            setSchedules={setSchedules}
            logs={logs}
            apiFetch={apiFetch}
          />
        )}

        {/* ==================== MENU 6: ABOUT & CONTACT TAB ==================== */}
        {activeTab === 'about-contact' && (
          <div className="max-w-4xl mx-auto space-y-6" id="about-contact-dashboard">
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              
              {/* Left Column: Story & System components */}
              <div className="md:col-span-7 bg-white/80 border border-white/50 rounded-3xl p-6 md:p-8 shadow-xl backdrop-blur-md space-y-5 text-slate-800 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-[#1F3E5A] tracking-tight">Tentang Proyek Pakan Ikan IoT</h3>
                    <div className="h-1 w-16 bg-[#134e5e] rounded"></div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-semibold">
                    <strong>Smart IoT Feeder</strong> adalah platform monitoring dan otomatisasi pakan pintar kolam atau akuarium jarak jauh berbasis <strong>NodeMCU ESP32</strong>.
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Sistem ini mengintegrasikan komponen fisik dengan teknologi cloud, di mana sensor ultrasonik bertindak sebagai pengukur volume pakan, dan penjadwalan presisi disinkronkan langsung via NTP Server. Seluruh data histori dan konfigurasi disimpan di database MySQL yang dapat diakses secara real-time melalui panel web ini.
                  </p>
                </div>

                <div className="bg-sky-50/60 p-5 rounded-2xl border border-white/80 space-y-3 mt-4">
                  <h4 className="text-xs font-black text-[#1F3E5A] uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-sky-600" />
                    🛠️ SPESIFIKASI HARDWARE FISIK
                  </h4>
                  <ul className="text-xs space-y-2 text-slate-700 list-none font-medium">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
                      <span><strong>Mikrokontroler:</strong> NodeMCU ESP32 (Wi-Fi 2.4GHz)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
                      <span><strong>Sensor Kapasitas:</strong> Sensor Ultrasonik HC-SR04</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
                      <span><strong>Aktuator Valve:</strong> Mikro Servo Motor MG90S</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
                      <span><strong>Wadah Dispenser:</strong> Botol Plastik</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Right Column: Contact & Team Details */}
              <div className="md:col-span-5 bg-white/80 border border-white/50 rounded-3xl p-6 md:p-8 shadow-xl backdrop-blur-md space-y-6 text-slate-800">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-[#1F3E5A]">Tim Pengembang & Kolaborasi</h3>
                  <p className="text-xs text-slate-500 font-semibold">Asistensi, Desain Aplikasi & Dukungan Integrasi IoT</p>
                </div>

                {/* Scrollable Team List */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">👥 TIM PENGEMBANG</span>
                  <div className="max-h-56 overflow-y-auto pr-2 space-y-4 border border-slate-100 rounded-2xl p-3 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-200">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-sky-700 tracking-wider">Computer & Network Engineering (TKJ):</p>
                      <ul className="text-xs space-y-1 text-slate-750 font-bold list-disc list-inside">
                        <li>Malik Khadafi Al Ghoni (XI TKJ)</li>
                        <li>Muhammad Adriansyah Ghozali (XI TKJ)</li>
                        <li>Omar Yusuf Ibrahim (XI TKJ)</li>
                        <li>Raihan Ahmad (XI TKJ)</li>
                        <li>Afredo Noval Hadiansyah (XI TKJ)</li>
                        <li>Yasir Hidayatullah (XI TKJ)</li>
                      </ul>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-slate-100">
                      <p className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Software Engineering (RPL):</p>
                      <ul className="text-xs space-y-1 text-slate-750 font-bold list-disc list-inside">
                        <li>Adnan Wijaya (XI RPL)</li>
                        <li>Muhammad Rayhan (XI RPL)</li>
                        <li>Daffa Arya Perkasa (XI RPL)</li>
                        <li>Fathier Assyarief (XI RPL)</li>
                        <li>Arya Azriel Rahmandani (XI RPL)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Hubungi Kami Section */}
                <div className="space-y-3.5 pt-4 border-t border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">🏢 HUBUNGI KAMI</span>
                  
                  <div className="grid grid-cols-1 gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-600">Lembaga: <strong className="text-slate-800">SMK Bakti Idhata</strong></span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="font-medium text-slate-600">
                        Kontak Telepon / WA:{" "}
                        <a 
                          href="https://wa.me/6287740813186" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[#134e5e] font-extrabold hover:underline"
                        >
                          +62 877-4081-3186
                        </a>
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <BookOpen className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="font-medium text-slate-600">
                        Website Resmi:{" "}
                        <a 
                          href="https://smkbaktiidhata.sch.id" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[#134e5e] font-extrabold hover:underline"
                        >
                          smkbaktiidhata.sch.id
                        </a>
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Instagram className="w-4 h-4 text-pink-500 shrink-0" />
                      <span className="font-medium text-slate-600">
                        Instagram:{" "}
                        <a 
                          href="https://instagram.com/smkbaktiidhata_official" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[#134e5e] font-extrabold hover:underline"
                        >
                          @smkbaktiidhata_official
                        </a>
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Facebook className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-medium text-slate-600">
                        Facebook:{" "}
                        <a 
                          href="https://www.facebook.com/smkbaktiidhata" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[#134e5e] font-extrabold hover:underline"
                        >
                          SMK Bakti Idhata
                        </a>
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Fish className="w-4 h-4 text-red-500 shrink-0" />
                      <span className="font-medium text-slate-600">
                        YouTube:{" "}
                        <a 
                          href="https://www.youtube.com/results?search_query=SMK+Bakti+Idhata+Official" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[#134e5e] font-extrabold hover:underline"
                        >
                          SMK Bakti Idhata Official
                        </a>
                      </span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ==================== TAB 2: ADMIN VIEW (COMPREHENSIVE) ==================== */}
        {activeTab === 'admin' && (
          <div className="space-y-6">
            
            {/* Admin Header Notification Banner */}
            <div className="bg-purple-950/15 border border-purple-500/30 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-white font-bold text-base flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-400" />
                  Pusat Integrasi & Konsol Pembuat (Developer / Admin Panel)
                </h2>
                <p className="text-xs text-slate-450 mt-1">Konfigurasikan skema database MySQL, unduh firmware C++ Arduino IDE, dan kalibrasi sensor fisik ultrasonic Anda.</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    localStorage.removeItem('fish_feeder_logs_db');
                    localStorage.removeItem('fish_feeder_schedules_db');
                    window.location.reload();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 hover:bg-slate-850 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  Format Memori State
                </button>
              </div>
            </div>

            {/* 5-part Horizontal Tab bar for Admin subtabs */}
            <div className="flex bg-[#14171C] p-1 rounded-xl border border-slate-800 overflow-x-auto text-xs shrink-0 max-w-full">
              <button
                onClick={() => setAdminSubTab('api')}
                className={`flex-1 min-w-[130px] px-3.5 py-2.5 rounded-lg font-bold transition flex items-center justify-center gap-2 text-center whitespace-nowrap cursor-pointer ${
                  adminSubTab === 'api'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-450 hover:text-white hover:bg-slate-900/30'
                }`}
              >
                <Terminal className="w-4 h-4 text-purple-400" />
                <span>🔌 Cara Integrasi Fisik</span>
              </button>

              <button
                onClick={() => setAdminSubTab('guide')}
                className={`flex-1 min-w-[140px] px-3.5 py-2.5 rounded-lg font-bold transition flex items-center justify-center gap-2 text-center whitespace-nowrap cursor-pointer ${
                  adminSubTab === 'guide'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-450 hover:text-white hover:bg-slate-900/30'
                }`}
              >
                <BookOpen className="w-4 h-4 text-teal-400" />
                <span>📐 Kalibrasi Sensor</span>
              </button>

              <button
                onClick={() => setAdminSubTab('code')}
                className={`flex-1 min-w-[130px] px-3.5 py-2.5 rounded-lg font-bold transition flex items-center justify-center gap-2 text-center whitespace-nowrap cursor-pointer ${
                  adminSubTab === 'code'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-450 hover:text-white hover:bg-slate-900/30'
                }`}
              >
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>💻 Source Code C++</span>
              </button>

              <button
                onClick={() => setAdminSubTab('db')}
                className={`flex-1 min-w-[140px] px-3.5 py-2.5 rounded-lg font-bold transition flex items-center justify-center gap-2 text-center whitespace-nowrap cursor-pointer ${
                  adminSubTab === 'db'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-450 hover:text-white hover:bg-slate-900/30'
                }`}
              >
                <Database className="w-4 h-4 text-amber-400" />
                <span>🗄️ MySQL Explorer</span>
              </button>

              <button
                onClick={() => setAdminSubTab('simulator')}
                className={`flex-1 min-w-[140px] px-3.5 py-2.5 rounded-lg font-bold transition flex items-center justify-center gap-2 text-center whitespace-nowrap cursor-pointer ${
                  adminSubTab === 'simulator'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-450 hover:text-white hover:bg-slate-900/30'
                }`}
              >
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>🧪 Uji Coba Simulator</span>
              </button>
            </div>

            {/* Sub-tab 1: Cara Integrasi Hardware Arduino Fisik */}
            {adminSubTab === 'api' && (
              <div className="bg-[#14171C] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-purple-400 font-mono">Arsitektur Komunikasi IoT</span>
                  <h3 className="text-white text-lg font-bold mt-0.5">Panduan Koneksi Hardware Arduino / ESP32 Fisik</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">
                    Mikrokontroler ESP32 Anda di kolam membutuhkan endpoint backend php untuk melakukan pencocokan database MySQL harian. Berikut adalah cara kerja logic serta file backend PHP (PDO) asli yang digunakan sebagai perantara:
                  </p>
                </div>

                {/* Workflow Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 bg-[#0A0B0E]/60 border border-slate-850 rounded-xl space-y-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-950/40 text-cyan-400 font-bold font-mono">1</div>
                    <h4 className="text-white font-bold uppercase tracking-wider text-[11px]">Polling Jadwal</h4>
                    <p className="text-[11px] text-slate-450 leading-relaxed">
                      ESP32 mengirim request HTTP GET ke endpoint <code>get_jadwal.php</code> secara berkala (setiap 10-15 detik) untuk membaca daftar jam makan aktif dari database.
                    </p>
                  </div>

                  <div className="p-4 bg-[#0A0B0E]/60 border border-slate-850 rounded-xl space-y-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-950/40 text-indigo-400 font-bold font-mono">2</div>
                    <h4 className="text-white font-bold uppercase tracking-wider text-[11px]">Deteksi Trigger</h4>
                    <p className="text-[11px] text-slate-450 leading-relaxed">
                      Bila ada jadwal jam yang cocok ATAU status <code>trigger_manual = 1</code> pada data JSON jadwal pakan, ESP32 menyalakan relay/motor servo MG90S untuk menjatuhkan pakan.
                    </p>
                  </div>

                  <div className="p-4 bg-[#0A0B0E]/60 border border-slate-850 rounded-xl space-y-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-950/40 text-emerald-400 font-bold font-mono">3</div>
                    <h4 className="text-white font-bold uppercase tracking-wider text-[11px]">Update Status & Log</h4>
                    <p className="text-[11px] text-slate-450 leading-relaxed">
                      Selesai memberi makan, ESP32 mengukur pakan tersisa dengan sensor ultrasonik HC-SR04, lalu mengirim update status pakan dan menyimpan record log sukses ke tabel <code>log_pakan</code>.
                    </p>
                  </div>
                </div>

                {/* Endpoint API codes representation files */}
                <div className="space-y-4">
                  <div className="border-t border-slate-800 pt-4">
                    <h4 className="text-xs text-white font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5 font-mono">
                      <Terminal className="w-4 h-4 text-purple-400" />
                      1. Endpoint Ambil Jadwal (get_jadwal.php)
                    </h4>
                    <pre className="p-4 bg-[#0A0B0E] rounded-xl border border-slate-850 text-[10px] text-cyan-400 font-mono overflow-x-auto leading-normal whitespace-pre">
{`<?php
header("Content-Type: application/json");
require_once "db_config.php"; // Koneksi PDO database MySQL

// 1. Ambil daftar jadwal aktif
$stmt = $pdo->prepare("SELECT id, waktu, is_active, trigger_manual FROM jadwal_pakan WHERE is_active = 1");
$stmt->execute();
$schedules = $stmt->fetchAll(PDO::FETCH_ASSOC);

// 2. Berikan output JSON rapi ke ESP32
echo json_encode([
    "status" => "success",
    "schedules" => $schedules,
    "timestamp" => date("Y-m-d H:i:s")
]);
?>`}
                    </pre>
                  </div>

                  <div className="border-t border-slate-800 pt-4">
                    <h4 className="text-xs text-white font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5 font-mono">
                      <Terminal className="w-4 h-4 text-purple-400" />
                      2. Endpoint Laporkan Status & Log Mandiri (update_status.php)
                    </h4>
                    <pre className="p-4 bg-[#0A0B0E] rounded-xl border border-slate-850 text-[10px] text-indigo-400 font-mono overflow-x-auto leading-normal whitespace-pre">
{`<?php
header("Content-Type: application/json");
require_once "db_config.php"; 

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $persentase = intval($_POST['persentase']);
    $jarak_cm = floatval($_POST['jarak_cm']);
    $metode_terakhir = $_POST['metode']; // 'Manual' atau 'Otomatis'

    // 1. Update persentase kapasitas pakan saat ini ke MySQL status_pakan
    $stmt = $pdo->prepare("UPDATE status_pakan SET persentase = ?, jarak_cm = ?, terakhir_diperbarui = NOW() WHERE id = 1");
    $stmt->execute([$persentase, $jarak_cm]);

    // 2. Catat riwayat pakan sukses ke tabel log_pakan
    $stmtLog = $pdo->prepare("INSERT INTO log_pakan (waktu_eksekusi, metode, status) VALUES (NOW(), ?, 'Berhasil')");
    $stmtLog->execute([$metode_terakhir]);

    // 3. Reset flag trigger_manual jadwal pakan ke 0 apabila sebelumnya dipicu manual web
    $stmtReset = $pdo->prepare("UPDATE jadwal_pakan SET trigger_manual = 0 WHERE trigger_manual = 1");
    $stmtReset->execute();

    echo json_encode(["status" => "success", "message" => "Database updated successfully"]);
} else {
    echo json_encode(["status" => "error", "message" => "Hanya menerima metode POST"]);
}
?>`}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 2: Kalibrasi Sensor & Manual Perakitan (AssemblyGuide) */}
            {adminSubTab === 'guide' && (
              <AssemblyGuide
                jarakPenuh={jarakPenuh}
                setJarakPenuh={setJarakPenuh}
                jarakKosong={jarakKosong}
                setJarakKosong={setJarakKosong}
              />
            )}

            {/* Sub-tab 3: Source Code C++ Assembly (IotFirmwarePanel) */}
            {adminSubTab === 'code' && (
              <IotFirmwarePanel
                jarakPenuh={jarakPenuh}
                jarakKosong={jarakKosong}
              />
            )}

            {/* Sub-tab 4: MySQL Database Explorer (DbExplorer) */}
            {adminSubTab === 'db' && (
              <DbExplorer
                jadwalList={schedules}
                logList={logs}
                statusPakan={statusPakanRow}
                onAddJadwal={handleAddJadwal}
                onDeleteJadwal={handleDeleteJadwal}
                onToggleActive={handleToggleActive}
                onClearLogs={() => setLogs([])}
              />
            )}

            {/* Sub-tab 5: Uji Coba Simulator Sandbox (Visual model and iPhone mock browser) */}
            {adminSubTab === 'simulator' && (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs leading-relaxed text-slate-400">
                  ⚠️ <strong>Info Debugging:</strong> Halaman simulator interaktif ini berguna bagi Anda atau teknisi untuk mensimulasikan logika rotasi motor MG90S dan polling respon server tanpa harus menyambungkan hardware fisik.
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
                  <div className="xl:col-span-8 flex flex-col justify-stretch">
                    <IotHardwareSimulator
                      persentasePakan={sisaPakan}
                      jarakCm={jarakCm}
                      isFeeding={isFeeding}
                      onDispenseSuccess={executeFeeding}
                      wifiConnected={wifiConnected}
                      setWifiConnected={setWifiConnected}
                      onTriggerManualFeed={handleTriggerManualFromWeb}
                      onRefill={() => setSisaPakan(100)}
                      formattedTime={getFormattedTime()}
                      nextPollCountdown={nextPollCountdown}
                      triggerPoll={() => triggerServerPoll()}
                      lastApiResponse={lastApiResponse}
                    />
                  </div>

                  <div className="xl:col-span-4" id="iphone_mockup_browser">
                    <div className="bg-[#14171C] border border-slate-800 rounded-3xl p-3 shadow-2xl flex flex-col h-full relative overflow-hidden">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#14171C] w-36 h-5 rounded-b-xl flex items-center justify-center gap-2 z-35 border-b border-slate-800">
                        <div className="w-12 h-1 bg-slate-750 rounded-full"></div>
                        <div className="w-2.5 h-2.5 bg-[#0A0B0E] rounded-full border border-slate-800 flex justify-center items-center">
                          <div className="w-1 h-1 bg-[#22d3ee] rounded-full"></div>
                        </div>
                      </div>

                      <div className="rounded-2xl border-2 border-slate-800 flex-1 overflow-hidden bg-[#0A0B0E] flex flex-col relative min-h-[500px]">
                        <div className="bg-slate-900/60 px-4 pt-6 pb-2 text-[10px] text-slate-500 font-mono flex justify-between items-center border-b border-slate-800 z-10">
                          <span className="flex items-center gap-1">
                            <Smartphone className="w-3 text-cyan-400" />
                            <span>api_pakan_ikan.php</span>
                          </span>
                          <span className="text-cyan-400 font-semibold animate-pulse uppercase">● LIVE PHP MON</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs leading-normal">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-white font-bold text-sm flex items-center gap-1 uppercase tracking-tight">
                                🐟 FishFeeder <span className="text-[8px] bg-cyan-500/10 text-cyan-400 font-bold px-1.5 py-0.5 rounded border border-cyan-500/20">IoT Active</span>
                              </h4>
                              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">192.168.1.104 • PHP Native</p>
                            </div>
                            <div className="text-[8px] text-slate-500 font-mono text-right">
                              Refresh: <span className="text-cyan-400">10s</span><br/>
                              {getFullTimestamp(ntpTime).substring(11, 19)}
                            </div>
                          </div>

                          <div className={`p-4 rounded-xl border ${sisaPakan < 20 ? 'bg-amber-950/15 border-amber-500/40' : 'bg-[#14171C] border-slate-800'} space-y-3 relative overflow-hidden`}>
                            <div className={`absolute top-0 left-0 w-full h-[1.5px] ${sisaPakan < 20 ? 'bg-gradient-to-r from-amber-500 to-yellow-500 animate-pulse' : 'bg-gradient-to-r from-cyan-500 to-blue-500'}`}></div>
                            <div className="flex justify-between items-center">
                              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Kapasitas Wadah Pakan</h5>
                            </div>
                            
                            <div className="space-y-1.5">
                              <div className="flex justify-between font-mono text-[10px] font-bold">
                                <span className="text-slate-400">Sisa Pakan</span>
                                <span className={`${sisaPakan < 20 ? 'text-amber-500 animate-pulse' : 'text-white'}`}>{sisaPakan}%</span>
                              </div>
                              <div className="w-full bg-[#0A0B0E] h-2 rounded-full overflow-hidden border border-slate-800">
                                <div
                                  className={`h-full transition-all duration-500 ${sisaPakan < 20 ? 'bg-gradient-to-r from-amber-500 to-yellow-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-gradient-to-r from-cyan-200 to-blue-500'}`}
                                  style={{ width: `${sisaPakan}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="bg-[#14171C] p-4 rounded-xl border border-slate-800 space-y-2.5">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Atur Jadwal Pakan</h4>
                            <div className="flex gap-1.5">
                              <input
                                type="time"
                                value={newScheduleTime}
                                onChange={(e) => setNewScheduleTime(e.target.value)}
                                className="flex-1 bg-[#0A0B0E] border border-slate-800 rounded-lg px-2.5 py-1 text-white text-[11px] font-mono outline-none"
                              />
                              <button
                                onClick={() => handleAddJadwal(newScheduleTime)}
                                className="bg-cyan-950/30 hover:bg-cyan-600 border border-cyan-800/55 text-cyan-400 hover:text-white px-3 rounded-lg text-[10px] font-bold uppercase"
                              >
                                + Tambah
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* Footer copyright */}
      <footer className="mt-auto bg-[#14171C] border-t border-slate-800 px-6 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© 2026 Pengembangan Sistem Pemberi Pakan Ikan Otomatis - IoT ESP32 Suite.</p>
          <div className="flex gap-4 text-slate-500 font-mono text-[10px]">
            <span>Database: MySQL (Localhost, root)</span>
            <span>Firmware: ESP32 NodeMCU Wi-Fi (C++)</span>
            <span>API ID: AQUA-992-PORT</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

