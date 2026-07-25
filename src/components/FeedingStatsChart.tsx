import React, { useState, useMemo } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { Calendar, Clock, BarChart3, HelpCircle, Sparkles, Sliders } from 'lucide-react';
import { LogPakan } from '../types';

interface FeedingStatsChartProps {
  logs: LogPakan[];
}

export default function FeedingStatsChart({ logs }: FeedingStatsChartProps) {
  // Available months list extracted from the logs database
  const monthOptions = useMemo(() => {
    const list: string[] = [];
    logs.forEach(log => {
      // log.waktu_eksekusi is like "2026-06-22 07:00:15"
      const datePart = log.waktu_eksekusi.split(' ')[0];
      if (datePart) {
        const parts = datePart.split('-');
        if (parts.length >= 2) {
          const yearMonth = `${parts[0]}-${parts[1]}`; // "2026-06"
          if (!list.includes(yearMonth)) {
            list.push(yearMonth);
          }
        }
      }
    });
    // Ensure both 2026-05 and 2026-06 exist by default if logs are populated, sorted descending
    if (list.length === 0) {
      list.push('2026-06', '2026-05');
    }
    return list.sort().reverse();
  }, [logs]);

  // Selected Month State (defaults to most recent month, e.g., June 2026)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return monthOptions[0] || '2026-06';
  });

  // Selected Day State for Daily Chart (Default to highest day number with logs in that month)
  const logsInMonth = useMemo(() => {
    return logs.filter(log => log.waktu_eksekusi.startsWith(selectedMonth));
  }, [logs, selectedMonth]);

  const daysInMonthList = useMemo(() => {
    const set = new Set<number>();
    logsInMonth.forEach(log => {
      const dayStr = log.waktu_eksekusi.split(' ')[0].split('-')[2];
      if (dayStr) {
        set.add(parseInt(dayStr, 10));
      }
    });
    return Array.from(set).sort((a, b) => b - a); // descending
  }, [logsInMonth]);

  const [selectedDay, setSelectedDay] = useState<number | null>(() => {
    return daysInMonthList[0] || 22;
  });

  // If selected day is not in current month's list, auto-reset to highest available day
  React.useEffect(() => {
    if (daysInMonthList.length > 0 && (!selectedDay || !daysInMonthList.includes(selectedDay))) {
      setSelectedDay(daysInMonthList[0]);
    }
  }, [selectedMonth, daysInMonthList]);

  // Format Helper for Month Label
  const getIndonesianMonthLabel = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-');
    const months: Record<string, string> = {
      '01': 'Januari', '02': 'Februari', '03': 'Maret', '04': 'April',
      '05': 'Mei', '06': 'Juni', '07': 'Juli', '08': 'Agustus',
      '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember'
    };
    return `${months[month] || month} ${year}`;
  };

  // --- COMPUTE MONTHLY DATA (Days of selected month vs No. of feeds) ---
  const monthlyChartData = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    
    // Total days in that month
    const totalDays = new Date(year, month, 0).getDate();
    
    // Initialize day map
    const counts: Record<number, { day: string, tanggal: number, Otomatis: number, Manual: number, Total: number }> = {};
    for (let d = 1; d <= totalDays; d++) {
      counts[d] = {
        day: `${d}`,
        tanggal: d,
        Otomatis: 0,
        Manual: 0,
        Total: 0
      };
    }

    // Accumulate logs
    logsInMonth.forEach(log => {
      const datePart = log.waktu_eksekusi.split(' ')[0];
      const dayNum = parseInt(datePart.split('-')[2], 10);
      if (counts[dayNum]) {
        if (log.metode === 'Otomatis') {
          counts[dayNum].Otomatis += 1;
        } else {
          counts[dayNum].Manual += 1;
        }
        counts[dayNum].Total += 1;
      }
    });

    return Object.values(counts);
  }, [logsInMonth, selectedMonth]);

  // --- COMPUTE DAILY DATA (Hours of selected day vs No. of feeds) ---
  const dailyChartData = useMemo(() => {
    if (!selectedDay) return [];
    
    const dayPrefix = `${selectedMonth}-${String(selectedDay).padStart(2, '0')}`;
    const targetLogs = logs.filter(log => log.waktu_eksekusi.startsWith(dayPrefix));

    // Group by hour blocks: Pagi (05-11), Siang (11-15), Sore (15-18), Malam (18-24), Dini Hari (00-05)
    const blocks = [
      { name: 'Dini Hari (00-05)', count: 0, items: [] as string[] },
      { name: 'Pagi Hari (05-11)', count: 0, items: [] as string[] },
      { name: 'Siang Hari (11-15)', count: 0, items: [] as string[] },
      { name: 'Sore Hari (15-18)', count: 0, items: [] as string[] },
      { name: 'Malam Hari (18-00)', count: 0, items: [] as string[] },
    ];

    targetLogs.forEach(log => {
      const timePart = log.waktu_eksekusi.split(' ')[1]; // "07:02:11"
      if (timePart) {
        const hour = parseInt(timePart.split(':')[0], 10);
        if (hour >= 0 && hour < 5) {
          blocks[0].count += 1;
          blocks[0].items.push(timePart.substring(0, 5));
        } else if (hour >= 5 && hour < 11) {
          blocks[1].count += 1;
          blocks[1].items.push(timePart.substring(0, 5));
        } else if (hour >= 11 && hour < 15) {
          blocks[2].count += 1;
          blocks[2].items.push(timePart.substring(0, 5));
        } else if (hour >= 15 && hour < 18) {
          blocks[3].count += 1;
          blocks[3].items.push(timePart.substring(0, 5));
        } else {
          blocks[4].count += 1;
          blocks[4].items.push(timePart.substring(0, 5));
        }
      }
    });

    return blocks;
  }, [logs, selectedMonth, selectedDay]);

  // Summary widgets computation
  const totalFeedsThisMonth = logsInMonth.length;
  const autoFeedsThisMonth = logsInMonth.filter(l => l.metode === 'Otomatis').length;
  const manualFeedsThisMonth = logsInMonth.filter(l => l.metode === 'Manual').length;
  const avgFeedsPerActiveDay = useMemo(() => {
    const daysWithData = daysInMonthList.length;
    if (daysWithData === 0) return 0;
    return (totalFeedsThisMonth / daysWithData).toFixed(1);
  }, [totalFeedsThisMonth, daysInMonthList]);

  return (
    <div className="bg-transparent space-y-6" id="dashboard_feeding_statistics">
      
      {/* Top Header Row styled with elegant light theme branding */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 border-b border-slate-200 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-[#1F3E5A]/10 text-[#1F3E5A] border border-[#1F3E5A]/15 tracking-wider">
              <BarChart3 className="w-3.5 h-3.5" />
              SISTEM ANALISIS RIWAYAT PAKAN
            </span>
          </div>
          <h3 className="text-[#1F3E5A] text-xl sm:text-2xl font-black font-sans uppercase tracking-tight">
            STATISTIK PEMBERIAN MAKANAN IKAN (DATABASE TERINTEGRASI)
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 font-bold leading-relaxed">
            Menganalisis frekuensi pemberian makanan harian dan riwayat bulanan yang diakses dinamis dari media penyimpanan.
          </p>
        </div>

        {/* Month Selector Filter Widget styled in white-glass theme */}
        <div className="flex items-center gap-2.5 bg-[#1F3E5A]/5 px-4 py-2.5 rounded-2xl border border-[#1F3E5A]/10 self-stretch md:self-auto justify-between shrink-0">
          <span className="text-[11px] font-mono font-bold text-[#1F3E5A] flex items-center gap-1.5 shrink-0 uppercase">
            <Calendar className="w-4 h-4 text-[#1F3E5A]" />
            PILIH BULAN:
          </span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-white border border-slate-200 text-[#1F3E5A] text-xs font-black px-3 py-1.5 rounded-xl outline-none focus:border-[#1F3E5A] focus:ring-2 focus:ring-[#1F3E5A]/10 font-sans cursor-pointer transition-all"
          >
            {monthOptions.map((opt) => (
              <option key={opt} value={opt}>
                {getIndonesianMonthLabel(opt).toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Overview Metric Cards styled in elegant clean cards with left borders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" id="stat_metrics_grid">
        
        {/* Metric 1 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden border-l-4 border-l-[#1F3E5A] shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-[#1F3E5A]/10 border border-[#1F3E5A]/10 flex items-center justify-center text-[#1F3E5A] shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block font-sans">Total Pakan Bulan Ini</span>
            <span className="text-3xl font-black font-sans text-[#1F3E5A] block">{totalFeedsThisMonth} Kali</span>
            <span className="text-[10px] text-slate-600 block font-mono">
              <span className="text-[#1F3E5A] font-bold">{autoFeedsThisMonth}</span> Auto • <span className="text-amber-600 font-bold">{manualFeedsThisMonth}</span> Manual
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden border-l-4 border-l-emerald-500 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block font-sans">Rata-rata Frekuensi</span>
            <span className="text-3xl font-black font-sans text-emerald-600 block">{avgFeedsPerActiveDay}x / Hari</span>
            <span className="text-[10px] text-slate-600 block font-bold">
              Diambil dari {daysInMonthList.length} hari aktif simulasi
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden border-l-4 border-l-amber-500 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
            <Sliders className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block font-sans">Metode Kerja Dominan</span>
            <span className="text-3xl font-black font-sans text-amber-500 block">
              {autoFeedsThisMonth >= manualFeedsThisMonth ? 'Otomatis' : 'Manual'}
            </span>
            <span className="text-[10px] text-slate-600 block font-semibold">
              {totalFeedsThisMonth > 0 
                ? `${Math.round((autoFeedsThisMonth / totalFeedsThisMonth) * 100)}% otomatis via ESP32`
                : 'Belum ada data pakan'
              }
            </span>
          </div>
        </div>

      </div>

      {/* Main Charts Row styled cleanly with white-glass backgrounds */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CHART A: monthly histogram (Days vs Feed counts) */}
        <div className="lg:col-span-8 bg-white/70 border border-slate-100 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h4 className="text-xs font-black text-[#1F3E5A] uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4.5 h-4.5 text-[#1F3E5A]" />
              Grafik Bulanan: Tren Pemberian Pakan ({getIndonesianMonthLabel(selectedMonth)})
            </h4>
            <span className="text-[9px] text-slate-500 font-bold font-mono">Klik Titik Grafik untuk Detail Harian</span>
          </div>

          <div className="h-68">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyChartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                onClick={(state: any) => {
                  if (state && state.activePayload && state.activePayload.length > 0) {
                    const dayNum = state.activePayload[0].payload.tanggal;
                    if (daysInMonthList.includes(dayNum)) {
                      setSelectedDay(dayNum);
                    }
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="day" 
                  stroke="#1F3E5A" 
                  fontSize={10} 
                  fontWeight="bold"
                  tickLine={false}
                  label={{ value: 'Tanggal', position: 'insideBottom', offset: -5, fill: '#1F3E5A', fontSize: 10, fontWeight: 'bold' }}
                />
                <YAxis 
                  stroke="#1F3E5A" 
                  fontSize={10} 
                  fontWeight="bold"
                  allowDecimals={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#1F3E5A',
                    fontWeight: '600',
                    boxShadow: '0 10px 15px -3px rgba(31, 62, 90, 0.1)'
                  }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 'bold' }} />
                <Line 
                  name="Otomatis (Scheduled)" 
                  type="monotone" 
                  dataKey="Otomatis" 
                  stroke="#1F3E5A" 
                  strokeWidth={3} 
                  dot={{ r: 4, strokeWidth: 1.5, fill: '#ffffff' }} 
                  activeDot={{ r: 7 }} 
                />
                <Line 
                  name="Manual (Instant Button)" 
                  type="monotone" 
                  dataKey="Manual" 
                  stroke="#FF9F43" 
                  strokeWidth={3} 
                  dot={{ r: 4, strokeWidth: 1.5, fill: '#ffffff' }} 
                  activeDot={{ r: 7 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <p className="text-[10px] text-[#1F3E5A] bg-[#1F3E5A]/5 border border-[#1F3E5A]/10 p-2.5 rounded-xl leading-relaxed font-bold">
            💡 <strong>Petunjuk Mudah:</strong> Setiap titik grafik menampilkan tren pemberian pakan otomatis (biru tua) dan manual (kuning jingga) dalam 1 hari penuh. Anda dapat mengeklik salah satu titik untuk melihat aktivitas jam di panel kanan!
          </p>
        </div>

        {/* CHART B: Hourly logs (feedings at hours blocks) */}
        <div className="lg:col-span-4 bg-white/70 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="text-xs font-black text-[#1F3E5A] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4.5 h-4.5 text-emerald-500" />
                Detail Jam Tanggal {selectedDay} {getIndonesianMonthLabel(selectedMonth).split(' ')[0]}
              </h4>
            </div>

            {selectedDay ? (
              <div className="space-y-4 flex-1">
                <div className="text-[11px] text-[#1F3E5A] bg-[#1F3E5A]/5 border border-[#1F3E5A]/10 p-3 rounded-xl flex justify-between items-center">
                  <span className="font-bold">Pilihan Tanggal Aktif:</span>
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(parseInt(e.target.value, 10))}
                    className="bg-white border border-slate-200 text-[#1F3E5A] text-xs font-black px-3 py-1 rounded-lg outline-none cursor-pointer focus:border-[#1F3E5A] transition-all"
                  >
                    {daysInMonthList.length > 0 ? (
                      daysInMonthList.map((d) => (
                        <option key={d} value={d}>
                          Tanggal {d}
                        </option>
                      ))
                    ) : (
                      <option value={selectedDay}>Tanggal {selectedDay}</option>
                    )}
                  </select>
                </div>

                {/* Draw clean indicators per Hour Slots */}
                <div className="h-44 flex flex-col justify-between py-1">
                  {dailyChartData.map((block) => (
                    <div key={block.name} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono leading-none">
                        <span className="text-slate-600 font-bold">{block.name}</span>
                        <span className="text-emerald-600 font-black">{block.count}x Porsi</span>
                      </div>
                      
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200 flex relative items-center">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                          style={{ width: `${block.count === 0 ? 0 : Math.min(100, block.count * 33)}%` }}
                        />
                      </div>
                      
                      {block.items.length > 0 && (
                        <div className="text-[8px] text-[#1F3E5A] font-mono font-bold mt-0.5 pl-1">
                          Jam Eksekusi: {block.items.join(', ')} WIB
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center space-y-2 flex-1">
                <HelpCircle className="w-8 h-8 opacity-40 animate-pulse" />
                <p className="text-[11px] italic">Silakan pilih tanggal pada tabel/batang di sebelah kiri.</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3 mt-3 text-[10px] text-slate-500 leading-relaxed font-bold">
            <strong>Pemberian pakan yang cerdas</strong> membantu sisa pakan tidak mengendap di dasar kolam/akuarium dan menjaga pH air stabil!
          </div>

        </div>

      </div>

    </div>
  );
}
