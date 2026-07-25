import React, { useState, useEffect } from "react";
import { 
  Database, 
  FileSpreadsheet, 
  Download, 
  Upload, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  CloudLightning,
  UserCheck
} from "lucide-react";
import { JadwalPakan, LogPakan } from "../types";
import { auth, googleAuthProvider } from "../lib/firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

interface CloudSyncProps {
  currentUser: any;
  authToken: string | null;
  schedules: JadwalPakan[];
  setSchedules: React.Dispatch<React.SetStateAction<JadwalPakan[]>>;
  logs: LogPakan[];
  apiFetch: (endpoint: string, method?: string, body?: any) => Promise<any>;
}

export default function CloudSync({
  currentUser,
  authToken,
  schedules,
  setSchedules,
  logs,
  apiFetch
}: CloudSyncProps) {
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  
  // Loading & status states
  const [isExporting, setIsExporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isAuthRefreshing, setIsAuthRefreshing] = useState(false);

  // Success / error messages
  const [sheetsMessage, setSheetsMessage] = useState<{ text: string; type: "success" | "error"; url?: string } | null>(null);
  const [driveMessage, setDriveMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Helper to retrieve/refresh Google Access Token via Firebase signInWithPopup
  const getGoogleToken = async (forcePrompt = false): Promise<string | null> => {
    if (googleAccessToken && !forcePrompt) return googleAccessToken;
    
    setIsAuthRefreshing(true);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        return credential.accessToken;
      } else {
        throw new Error("Gagal mendapatkan Access Token dari Google Provider");
      }
    } catch (err: any) {
      console.error("OAuth Error:", err);
      setSheetsMessage({
        text: `Otorisasi gagal: ${err.message || "Pastikan Anda memberikan izin akses Google Drive & Sheets."}`,
        type: "error"
      });
      return null;
    } finally {
      setIsAuthRefreshing(false);
    }
  };

  // ----------------------------------------------------
  // GOOGLE SHEETS: EXPORT LOGS
  // ----------------------------------------------------
  const handleExportToSheets = async () => {
    setSheetsMessage(null);
    setIsExporting(true);

    const token = await getGoogleToken();
    if (!token) {
      setIsExporting(false);
      return;
    }

    try {
      // 1. Search for existing spreadsheet in user's Drive
      const query = encodeURIComponent("name = 'Laporan Pakan Ikan - Otomatis' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!searchRes.ok) {
        throw new Error(`Gagal mencari spreadsheet: ${searchRes.statusText}`);
      }

      const searchData = await searchRes.json();
      let spreadsheetId = "";

      if (searchData.files && searchData.files.length > 0) {
        spreadsheetId = searchData.files[0].id;
      } else {
        // Create new spreadsheet
        const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            properties: { title: "Laporan Pakan Ikan - Otomatis" }
          })
        });

        if (!createRes.ok) {
          throw new Error(`Gagal membuat spreadsheet: ${createRes.statusText}`);
        }

        const createData = await createRes.json();
        spreadsheetId = createData.spreadsheetId;
      }

      // 2. Prepare headers and rows from current feeding logs
      const values = [
        ["No", "Waktu Eksekusi (WIB)", "Metode Pengumpanan", "Status Pengiriman/Servo"]
      ];

      logs.forEach((log, index) => {
        values.push([
          String(index + 1),
          log.waktu_eksekusi,
          log.metode,
          log.status
        ]);
      });

      // 3. Write rows to sheet using values update
      const range = `Sheet1!A1:D${values.length}`;
      const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values })
      });

      if (!updateRes.ok) {
        throw new Error(`Gagal mempopulasi data: ${updateRes.statusText}`);
      }

      setSheetsMessage({
        text: `Berhasil mengekspor ${logs.length} baris log pakan ke Google Sheets!`,
        type: "success",
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
      });
    } catch (err: any) {
      console.error(err);
      setSheetsMessage({
        text: `Gagal ekspor: ${err.message || "Kesalahan jaringan"}`,
        type: "error"
      });
    } finally {
      setIsExporting(false);
    }
  };

  // ----------------------------------------------------
  // GOOGLE DRIVE: BACKUP & RESTORE
  // ----------------------------------------------------
  const searchBackupFile = async (token: string): Promise<string | null> => {
    const query = encodeURIComponent("name = 'fish_feeder_schedules_backup.json' and trashed = false");
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!searchRes.ok) return null;
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  };

  const handleBackupSchedules = async () => {
    setDriveMessage(null);
    setIsBackingUp(true);

    const token = await getGoogleToken();
    if (!token) {
      setIsBackingUp(false);
      return;
    }

    try {
      const fileId = await searchBackupFile(token);
      const metadata = {
        name: "fish_feeder_schedules_backup.json",
        mimeType: "application/json"
      };
      const fileContent = JSON.stringify(schedules, null, 2);

      if (fileId) {
        // Update existing file
        const updateRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: fileContent
        });
        if (!updateRes.ok) throw new Error("Gagal memperbarui file cadangan di Google Drive");
      } else {
        // Create new file with multipart upload
        const boundary = "314159265358979323846";
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const multipartBody = 
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          fileContent +
          closeDelimiter;

        const createRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        });
        if (!createRes.ok) throw new Error("Gagal membuat file cadangan di Google Drive");
      }

      setDriveMessage({
        text: "Berhasil mencadangkan seluruh jadwal pakan Anda ke Google Drive!",
        type: "success"
      });
    } catch (err: any) {
      console.error(err);
      setDriveMessage({
        text: `Gagal mencadangkan: ${err.message || "Kesalahan jaringan"}`,
        type: "error"
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreSchedules = async () => {
    const confirmed = window.confirm(
      "Apakah Anda yakin ingin memulihkan jadwal pakan? Jadwal saat ini di database akan ditimpa dengan jadwal dari Google Drive."
    );
    if (!confirmed) return;

    setDriveMessage(null);
    setIsRestoring(true);

    const token = await getGoogleToken();
    if (!token) {
      setIsRestoring(false);
      return;
    }

    try {
      const fileId = await searchBackupFile(token);
      if (!fileId) {
        throw new Error("Cadangan jadwal 'fish_feeder_schedules_backup.json' tidak ditemukan di Google Drive Anda.");
      }

      const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!getRes.ok) throw new Error("Gagal mengunduh file cadangan dari Google Drive");

      const data = await getRes.json();
      if (!Array.isArray(data)) {
        throw new Error("Format file cadangan tidak valid (harus berupa array)");
      }

      // Sync backend database schedules
      if (authToken) {
        const syncRes = await apiFetch("/api/schedules", "POST", { list: data });
        if (!syncRes) throw new Error("Gagal memperbarui database Cloud SQL");
      }

      setSchedules(data);
      setDriveMessage({
        text: `Berhasil memulihkan ${data.length} jadwal pakan dari Google Drive ke Cloud SQL!`,
        type: "success"
      });
    } catch (err: any) {
      console.error(err);
      setDriveMessage({
        text: `Gagal memulihkan: ${err.message || "Kesalahan jaringan"}`,
        type: "error"
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" id="cloud-sync-panel">
      {/* Intro Header */}
      <div className="bg-white/80 border border-white/50 rounded-3xl p-6 md:p-8 shadow-xl backdrop-blur-md text-slate-800 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-100 text-[#134e5e] rounded-2xl">
            <CloudLightning className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#1F3E5A] tracking-tight">Integrasi Google Workspace Cloud Sync</h3>
            <p className="text-xs text-slate-500 font-medium">Hubungkan monitor pakan ikan IoT Anda langsung ke Google Drive dan Google Sheets untuk laporan & pencadangan data otomatis.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Google Sheets Card */}
        <div className="bg-white/95 border border-slate-150 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-6 text-slate-800">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                Google Sheets
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="text-lg font-bold text-[#1F3E5A]">Ekspor Log Pakan</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Ekspor seluruh data log pakan ikan yang tersimpan di database Cloud SQL Anda langsung ke selembar spreadsheet Google Sheets di akun Drive Anda.
              </p>
            </div>

            {sheetsMessage && (
              <div className={`p-3.5 rounded-2xl flex items-start gap-2.5 text-xs ${
                sheetsMessage.type === "success" 
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-150 font-bold" 
                  : "bg-red-50 text-red-800 border border-red-150"
              }`}>
                {sheetsMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5">
                  <p>{sheetsMessage.text}</p>
                  {sheetsMessage.url && (
                    <a 
                      href={sheetsMessage.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 underline font-black uppercase tracking-wider"
                    >
                      Buka Google Sheets <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleExportToSheets}
            disabled={isExporting || logs.length === 0}
            className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Mengekspor data...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Ekspor ke Google Sheets</span>
              </>
            )}
          </button>
        </div>

        {/* Google Drive Backup Card */}
        <div className="bg-white/95 border border-slate-150 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-6 text-slate-800">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Database className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                Google Drive
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="text-lg font-bold text-[#1F3E5A]">Cadangkan & Pulihkan Jadwal</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Simpan konfigurasi jadwal pakan aktif Anda saat ini langsung ke dalam folder aman Google Drive Anda, dan pulihkan kembali kapan saja dengan mudah.
              </p>
            </div>

            {driveMessage && (
              <div className={`p-3.5 rounded-2xl flex items-start gap-2.5 text-xs ${
                driveMessage.type === "success" 
                  ? "bg-blue-50 text-blue-800 border border-blue-150 font-bold" 
                  : "bg-red-50 text-red-800 border border-red-150"
              }`}>
                {driveMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <p>{driveMessage.text}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleBackupSchedules}
              disabled={isBackingUp || schedules.length === 0}
              className="py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer bg-[#1F3E5A] hover:bg-[#134e5e] text-white shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isBackingUp ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Backup...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Cadangkan</span>
                </>
              )}
            </button>

            <button
              onClick={handleRestoreSchedules}
              disabled={isRestoring}
              className="py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isRestoring ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Restore...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Pulihkan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Account Info / Status card */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 text-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-full">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-slate-800">Status Otorisasi Akun Google Workspace</h5>
            <p className="text-[11px] text-slate-500 font-medium">
              {currentUser 
                ? `Terhubung sebagai: ${currentUser.displayName || currentUser.email}` 
                : "Akun belum terhubung. Silakan Masuk menggunakan tombol Google di pojok kanan atas."}
            </p>
          </div>
        </div>
        {isAuthRefreshing && (
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-600 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Mendapatkan token Google...</span>
          </div>
        )}
      </div>
    </div>
  );
}
