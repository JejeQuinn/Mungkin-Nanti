import React, { useState } from 'react';
import { Database, Table, PlusCircle, Trash2, ShieldCheck, Play, Radio, Calendar, History, TrendingUp } from 'lucide-react';
import { JadwalPakan, LogPakan, StatusPakan } from '../types';

interface DbExplorerProps {
  jadwalList: JadwalPakan[];
  logList: LogPakan[];
  statusPakan: StatusPakan;
  onAddJadwal: (waktu: string) => void;
  onDeleteJadwal: (id: number) => void;
  onToggleActive: (id: number) => void;
  onClearLogs: () => void;
}

export default function DbExplorer({
  jadwalList,
  logList,
  statusPakan,
  onAddJadwal,
  onDeleteJadwal,
  onToggleActive,
  onClearLogs,
}: DbExplorerProps) {
  const [activeTable, setActiveTable] = useState<'jadwal_pakan' | 'log_pakan' | 'status_pakan'>('jadwal_pakan');
  const [inputWaktu, setInputWaktu] = useState('08:00');

  const handleSubmitJadwal = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputWaktu) {
      onAddJadwal(inputWaktu);
    }
  };

  return (
    <div id="mysql_db_explorer_card" className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full">
      {/* DB Client Header bar */}
      <div className="bg-gray-950 px-6 py-4 border-b border-gray-850 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Database className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-indigo-400 font-bold uppercase">MySQL Client Simulator</span>
              <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-semibold px-1 rounded font-mono">io_Engine: InnoDB</span>
            </div>
            <h3 className="text-white text-base font-bold">Database: iot_pakan_ikan</h3>
          </div>
        </div>

        {/* Database Table selector tabs */}
        <div className="flex bg-gray-900 p-1 rounded-xl border border-gray-800 self-stretch sm:self-auto overflow-x-auto text-xs font-mono">
          <button
            onClick={() => setActiveTable('jadwal_pakan')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 shrink-0 ${
              activeTable === 'jadwal_pakan'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-800/60 font-semibold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Table className="w-3.5 h-3.5 text-indigo-400" />
            <span>jadwal_pakan ({jadwalList.length})</span>
          </button>
          <button
            onClick={() => setActiveTable('log_pakan')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 shrink-0 ${
              activeTable === 'log_pakan'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-800/60 font-semibold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Table className="w-3.5 h-3.5 text-indigo-400" />
            <span>log_pakan ({logList.length})</span>
          </button>
          <button
            onClick={() => setActiveTable('status_pakan')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 shrink-0 ${
              activeTable === 'status_pakan'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-800/60 font-semibold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Table className="w-3.5 h-3.5 text-indigo-400" />
            <span>status_pakan (1)</span>
          </button>
        </div>
      </div>

      {/* SQL Table Interactive Grid */}
      <div className="flex-1 p-6 overflow-x-auto min-h-[300px]">
        
        {/* TABEL A: jadwal_pakan */}
        {activeTable === 'jadwal_pakan' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-950/40 border border-gray-805/60 p-4 rounded-xl">
              <div>
                <h4 className="text-white text-xs font-bold tracking-wider uppercase font-mono text-indigo-300 flex items-center gap-1.5">
                  <Calendar className="w-4 text-indigo-400" />
                  Struktur Tabel: jadwal_pakan
                </h4>
                <p className="text-[11px] text-gray-500 mt-1">Mengatur waktu pakan otomatis berskala harian dan trigger pakan manual lewat dashboard.</p>
              </div>

              {/* Add row form */}
              <form onSubmit={handleSubmitJadwal} className="flex items-center gap-2">
                <input
                  type="time"
                  value={inputWaktu}
                  onChange={(e) => setInputWaktu(e.target.value)}
                  className="bg-gray-950 text-indigo-300 text-xs font-semibold px-3 py-1.5 border border-gray-800 rounded-lg outline-none focus:border-indigo-500 font-mono"
                  required
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Tambah Baris</span>
                </button>
              </form>
            </div>

            {/* Simulated Schema Rows */}
            <div className="border border-gray-850/60 rounded-xl overflow-hidden bg-gray-950/50">
              <table className="w-full text-left font-mono text-xs text-gray-400">
                <thead>
                  <tr className="bg-gray-950 border-b border-gray-850 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">id (INT AI PK)</th>
                    <th className="py-3 px-4">waktu (TIME)</th>
                    <th className="py-3 px-4">is_active (TINYINT BIT)</th>
                    <th className="py-3 px-4">trigger_manual (TINYINT BIT)</th>
                    <th className="py-3 px-4 text-center">Operasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-850/60">
                  {jadwalList.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-900/40 group transition-colors">
                      <td className="py-3.5 px-4 font-bold text-gray-500">{row.id}</td>
                      <td className="py-3.5 px-4 text-white font-semibold text-sm">{row.waktu}</td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => onToggleActive(row.id)}
                          className={`inline-flex items-center px-2 py-0.5 rounded font-semibold text-[10px] border ${
                            row.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-gray-800 text-gray-500 border-gray-800'
                          }`}
                        >
                          {row.is_active ? '1 (Active)' : '0 (Inactive)'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-[10px] border ${
                            row.trigger_manual
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse'
                              : 'bg-gray-950 text-gray-600 border-gray-850'
                          }`}
                        >
                          {row.trigger_manual ? '1 (TRIG_PENDING)' : '0 (STANDBY)'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => onDeleteJadwal(row.id)}
                          className="p-1 rounded-md text-red-500 hover:bg-red-950/20 hover:text-red-400 opacity-60 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {jadwalList.length === 0 && (
                    <tr>
                      <td colspan="5" className="py-6 text-center text-gray-500 italic">
                        SELECT * FROM jadwal_pakan returns empty set (0.00 sec)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TABEL B: log_pakan */}
        {activeTable === 'log_pakan' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-950/40 border border-gray-805/60 p-4 rounded-xl">
              <div>
                <h4 className="text-white text-xs font-bold tracking-wider uppercase font-mono text-indigo-300 flex items-center gap-1.5">
                  <History className="w-4 text-indigo-400" />
                  Struktur Tabel: log_pakan
                </h4>
                <p className="text-[11px] text-gray-500 mt-1">Laporan historis aktivitas pemberian pakan sukses dari ESP32.</p>
              </div>

              {logList.length > 0 && (
                <button
                  onClick={onClearLogs}
                  className="text-[10px] text-gray-400 hover:text-rose-400 border border-gray-800 hover:border-rose-950 px-2.5 py-1.5 rounded-lg bg-gray-955 transition font-semibold"
                >
                  Truncate Logs
                </button>
              )}
            </div>

            <div className="border border-gray-850/60 rounded-xl overflow-hidden bg-gray-950/50">
              <table className="w-full text-left font-mono text-xs text-gray-400">
                <thead>
                  <tr className="bg-gray-950 border-b border-gray-850 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">id (INT AI PK)</th>
                    <th className="py-3 px-4">waktu_eksekusi (TIMESTAMP)</th>
                    <th className="py-3 px-4">metode (ENUM)</th>
                    <th className="py-3 px-4">status (VARCHAR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-850/60">
                  {logList.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-900/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-gray-500">{row.id}</td>
                      <td className="py-3 px-4 text-gray-300">{row.waktu_eksekusi}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            row.metode === 'Manual'
                              ? 'bg-amber-400/10 text-amber-400 border border-amber-500/10'
                              : 'bg-indigo-400/10 text-indigo-400 border border-indigo-500/10'
                          }`}
                        >
                          {row.metode}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{row.status}</span>
                      </td>
                    </tr>
                  ))}
                  {logList.length === 0 && (
                    <tr>
                      <td colspan="4" className="py-6 text-center text-gray-500 italic">
                        SELECT * FROM log_pakan returns empty set (0.00 sec)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TABEL C: status_pakan */}
        {activeTable === 'status_pakan' && (
          <div className="space-y-4">
            <div className="bg-gray-950/40 border border-gray-805/60 p-4 rounded-xl">
              <h4 className="text-white text-xs font-bold tracking-wider uppercase font-mono text-indigo-300 flex items-center gap-1.5">
                <TrendingUp className="w-4 text-indigo-400" />
                Struktur Tabel: status_pakan (One Row Base)
              </h4>
              <p className="text-[11px] text-gray-500 mt-1">Menampung persentase pakan dan jarak (cm) terkini, dilaporkan real-time oleh sensor HC-SR04 di mikrokontroler.</p>
            </div>

            <div className="border border-gray-850/60 rounded-xl overflow-hidden bg-gray-950/50">
              <table className="w-full text-left font-mono text-xs text-gray-400">
                <thead>
                  <tr className="bg-gray-950 border-b border-gray-850 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">id (INT PK)</th>
                    <th className="py-3 px-4">persentase (INT)</th>
                    <th className="py-3 px-4">jarak_cm (FLOAT)</th>
                    <th className="py-3 px-4">terakhir_diperbarui (TIMESTAMP ON UPDATE)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-850">
                  <tr className="hover:bg-gray-900/20 bg-indigo-950/5">
                    <td className="py-4 px-4 font-bold text-gray-500">{statusPakan.id}</td>
                    <td className="py-4 px-4 text-emerald-400 font-bold text-sm">{statusPakan.persentase}%</td>
                    <td className="py-4 px-4 text-white font-semibold">{statusPakan.jarak_cm.toFixed(1)} cm</td>
                    <td className="py-4 px-4 text-indigo-300">{statusPakan.terakhir_diperbarui}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Mini Query Console output text */}
      <div className="bg-gray-950 px-6 py-2.5 border-t border-gray-850 text-[10px] text-gray-500 font-mono flex justify-between items-center">
        <span>MySQL connection: <strong className="text-emerald-500 font-normal">Active (Localhost)</strong></span>
        <span>Query: SELECT * FROM {activeTable} ORDER BY id DESC</span>
      </div>
    </div>
  );
}
