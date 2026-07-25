export interface JadwalPakan {
  id: number;
  waktu: string; // TIME format e.g. "08:00"
  is_active: boolean;
  trigger_manual: boolean;
}

export interface LogPakan {
  id: number;
  waktu_eksekusi: string; // ISO string/timestamp
  metode: 'Manual' | 'Otomatis';
  status: 'Berhasil' | 'Gagal';
}

export interface StatusPakan {
  id: number;
  persentase: number; // 0 - 100%
  jarak_cm: number; // float
  terakhir_diperbarui: string; // ISO string/timestamp
}

export interface HardwareConfig {
  jarakPenuh: number; // default 3.0cm
  jarakKosong: number; // default 20.0cm
  serverUrl: string;
  ssid: string;
  wifiPass: string;
}
