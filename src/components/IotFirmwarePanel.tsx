import React, { useState } from 'react';
import { Copy, Check, FileCode, Database, Cpu, Globe, Info } from 'lucide-react';

interface IotFirmwarePanelProps {
  jarakPenuh: number;
  jarakKosong: number;
}

export default function IotFirmwarePanel({ jarakPenuh, jarakKosong }: IotFirmwarePanelProps) {
  const [activeTab, setActiveTab] = useState<'ino' | 'php' | 'sql'>('ino');
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getEsp32Code = () => `/**
 * PROYEK: Pengembangan Sistem Pemberi Pakan Ikan Otomatis Jarak Jauh Berbasis IoT dengan ESP32
 * DESKRIPSI: Kode firmware ESP32 untuk pembacaan HC-SR04, kontrol servo MG90S, dan integrasi API PHP.
 * LIBRARY DIPERLUKAN: WiFi, HTTPClient, NTPClient, ESP32Servo
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <ESP32Servo.h>

// ==========================================
// KREDENSIAL WI-FI & URL SERVER
// ==========================================
const char* ssid = "NAMA_WIFI_WADAH_ANDA";
const char* password = "PASSWORD_WIFI_ANDA";
// Ganti IP di bawah sesuai dengan alamat web server Anda
const char* serverURL = "http://192.168.1.100/iot_pakan_ikan/api_pakan_ikan.php";

// ==========================================
// KONFIGURASI PINOUT SENSOR DAN SERVO
// ==========================================
#define PIN_TRIG 5
#define PIN_ECHO 18
#define PIN_SERVO 19

// ==========================================
// VARIABEL KALIBRASI WAKTU & JAWABAN WADAH
// ==========================================
// Jarak sensor ke pakan (dalam Centimeter)
const float JARAK_PENUH = ${jarakPenuh.toFixed(1)};   // Jarak pembacaan saat pakan penuh (jarak pendek)
const float JARAK_KOSONG = ${jarakKosong.toFixed(1)}; // Jarak pembacaan saat pakan kosong (jarak jauh dasar wadah)

// Pengaturan NTP (id.pool.ntp.org)
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "id.pool.ntp.org", 25200, 60000); // Offset 25200 detik = WIB/GMT+7

// Pengaturan Servo
Servo myServo;

// Waktu checking interval (setiap 15 detik sesuai spesifikasi)
unsigned long lastCheckTime = 0;
const unsigned long checkInterval = 15000; 

void setup() {
  Serial.begin(115200);
  Serial.println("--- Booting ESP32 Smart Fish Feeder ---");

  // Inisialisasi Sensor HC-SR04
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);

  // Hubungkan ke Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("Menghubungkan ke Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[Wi-Fi] Sukses Terhubung!");
  Serial.print("[Wi-Fi] IP Address: ");
  Serial.println(WiFi.localIP());

  // Inisialisasi server NTP
  timeClient.begin();

  // Alokasikan pewaktu PWM dan pasang servo MG90S
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  myServo.setPeriodHertz(50); // Standar SG90 / MG90S 50Hz
  myServo.attach(PIN_SERVO, 500, 2400); // rentang pulsa lebar servo
  
  // Pastikan posisi katup servo dalam keadaan tertutup rapat pada awal system
  myServo.write(0); 
  Serial.println("[Servo] Terkunci pada posisi 0 derajat (Katup Tertutup)");
}

void loop() {
  // Selalu perbarui waktu dari NTP server
  timeClient.update();
  
  unsigned long currentMillis = millis();
  // Jalankan cek jadwal ke API setiap 15 detik
  if (currentMillis - lastCheckTime >= checkInterval) {
    lastCheckTime = currentMillis;
    cekJadwalDanServer();
  }
}

/**
 * Membaca sisa pakan dengan sensor Ultrasonik HC-SR04
 * Mengembalikan rentang persentase 0 - 100%
 */
float hitungPersentasePakan() {
  float jarak_cm = bacaJarakCm();
  
  // Filter batas pembacaan agar sesuai kalibrasi kosong-penuh
  if (jarak_cm < JARAK_PENUH) jarak_cm = JARAK_PENUH;
  if (jarak_cm > JARAK_KOSONG) jarak_cm = JARAK_KOSONG;
  
  // Persentase pakan: semakin dekat ke sensor, persentase semakin besar.
  float persentase = ((JARAK_KOSONG - jarak_cm) / (JARAK_KOSONG - JARAK_PENUH)) * 100.0;
  if (persentase < 0) persentase = 0.0;
  if (persentase > 100) persentase = 100.0;
  
  return persentase;
}

/**
 * Mengirim gelombang ultrasonik dan menghitung jarak objek (cm)
 */
float bacaJarakCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  
  // Baca pulsa pantul HIGH pada pin ECHO dengan timeout 30.000 mikrodetik
  long duration = pulseIn(PIN_ECHO, HIGH, 30000); 
  if (duration == 0) {
    return JARAK_KOSONG; // Kembalikan batas terjauh jika tidak ada pembacaan valid (wadah kosong)
  }
  
  // Rumus jarak: kecepatan suara 343 m/s -> 0.0343 cm/us divisi 2 (pergi-pulang)
  float jarak = (duration * 0.0343) / 2.0;
  return jarak;
}

/**
 * Mekanisme mengaktifkan Servo MG90S untuk menjatuhkan pakan
 */
void jalankanMekanismePakan() {
  Serial.println("[Servo] Membuka katup pakan (90 Derajat)...");
  myServo.write(90); 
  
  delay(1500); // Katup terbuka selama 1.5 detik (sesuai modul instruksi)
  
  Serial.println("[Servo] Menutup kembali katup pakan (0 Derajat)...");
  myServo.write(0); 
}

/**
 * Fungsi utama mengecek jadwal makan otomatis dan manual pemicu ke server API
 */
void cekJadwalDanServer() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    // Format waktu saat ini "HH:MM:SS", kita ambil jam dan menitnya "HH:MM"
    String formattedTime = timeClient.getFormattedTime();
    String waktuSekarang = formattedTime.substring(0, 5); 
    
    float sisa_pakan = hitungPersentasePakan();
    float jarak = bacaJarakCm();
    
    // Susun parameter URL string GET 
    String requestURL = String(serverURL) + "?waktu=" + waktuSekarang + "&sisa=" + String(sisa_pakan, 1) + "&jarak=" + String(jarak, 1);
    
    Serial.println("\n[HTTP] Menghubungi API server...");
    Serial.print("[HTTP] Request URL: ");
    Serial.println(requestURL);
    
    http.begin(requestURL);
    int httpResponseCode = http.GET();
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("[HTTP] Respon dari PHP API: ");
      Serial.println(response);
      
      if (response == "SERVO_TRIGGER_MANUAL") {
        Serial.println("[Sistem] Menerima Pemicuan MANUAL dari Web Dashboard!");
        jalankanMekanismePakan();
        kirimLogSukses("Manual"); // Laporkan log ke database
      } 
      else if (response == "SERVO_TRIGGER_AUTO") {
        Serial.println("[Sistem] Waktu Cocok! Menerima Pemicuan OTOMATIS!");
        jalankanMekanismePakan();
        kirimLogSukses("Otomatis"); // Laporkan log ke database
      } 
      else {
        Serial.println("[Sistem] Status Standby. Belum waktunya pakan.");
      }
    } else {
      Serial.print("[HTTP] Pengiriman data gagal! Error Code: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  } else {
    Serial.println("[Wi-Fi] Koneksi terputus! Tidak dapat mengecek database.");
  }
}

/**
 * Mengirimkan status aktivitas sukses pakan lewat metode POST
 */
void kirimLogSukses(String metode) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverURL);
    // Setup Header content-type form urlencoded
    http.addHeader("Content-Type", "application/x-www-form-urlencoded");
    
    String postData = "action=log_pakan&metode=" + metode;
    Serial.print("[HTTP POST] Mengirim data log pakan... ");
    Serial.println(postData);
    
    int httpResponseCode = http.POST(postData);
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("[HTTP POST] Log berhasil disimpan: ");
      Serial.println(response);
    } else {
      Serial.print("[HTTP POST] Gagal kirim log. Code: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  }
}
`;

  const getPhpCode = () => `<?xml version="1.0" encoding="utf-8"?>
<?php
/**
 * NAMA FILE: api_pakan_ikan.php
 * DESKRIPSI: Backend PHP API terpadu yang sekaligus bertindak sebagai Web Admin Dashboard monitoring
 * DATABASE: MySQL (iot_pakan_ikan)
 */

// ==========================================
// KONFIGURASI DATABASE
// ==========================================
$db_host = "localhost";
$db_user = "root";
$db_pass = "";
$db_name = "iot_pakan_ikan";

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

// Cek koneksi db
if ($conn->connect_error) {
    die("Koneksi Database gagal: " . $conn->connect_error);
}

// Atur timezone sesuai Waktu Indonesia Barat (WIB)
date_default_timezone_set('Asia/Jakarta');

// ==========================================
// LOGIKA PEMROSESAN API (DENGAN REQ DARI ESP32)
// ==========================================

// 1. Logika API GET (Polling ESP32 setiap 15 detik)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['waktu']) && isset($_GET['sisa'])) {
    
    $waktu_esp = $conn->real_escape_string($_GET['waktu']); // Format "HH:MM"
    $sisa_persen = floatval($_GET['sisa']);
    $jarak_cm = isset($_GET['jarak']) ? floatval($_GET['jarak']) : 0.0;
    
    // Perbarui tabel status_pakan (id = 1)
    $update_status_sql = "UPDATE status_pakan SET persentase = ?, jarak_cm = ?, terakhir_diperbarui = NOW() WHERE id = 1";
    $stmt = $conn->prepare($update_status_sql);
    $stmt->bind_param("id", $sisa_persen, $jarak_cm);
    $stmt->execute();
    $stmt->close();
    
    // A. Periksa apakah ada Trigger Pakan Manual dari Web
    $check_manual_sql = "SELECT id FROM jadwal_pakan WHERE trigger_manual = 1 LIMIT 1";
    $result_manual = $conn->query($check_manual_sql);
    
    if ($result_manual && $result_manual->num_rows > 0) {
        $row = $result_manual->fetch_assoc();
        $id_jadwal = $row['id'];
        
        // Reset kembali trigger manual di database agar tidak berulang
        $reset_manual = "UPDATE jadwal_pakan SET trigger_manual = 0 WHERE id = $id_jadwal";
        $conn->query($reset_manual);
        
        echo "SERVO_TRIGGER_MANUAL";
        exit;
    }
    
    // B. Periksa jadwal otomatis yang cocok dengan waktu ESP32 ("HH:MM") dan aktif
    // Query mencocokan kolom waktu berformat TIME (HH:MM:SS) dengan string (HH:MM)
    $check_auto_sql = "SELECT id FROM jadwal_pakan WHERE TIME_FORMAT(waktu, '%H:%i') = ? AND is_active = 1 LIMIT 1";
    $stmt_auto = $conn->prepare($check_auto_sql);
    $stmt_auto->bind_param("s", $waktu_esp);
    $stmt_auto->execute();
    $result_auto = $stmt_auto->get_result();
    
    if ($result_auto && $result_auto->num_rows > 0) {
        // Keamanan deduplikasi: Jangan trigger lagi jika log sukses otomatis sudah ada di menit yang sama
        $waktu_menit_sekarang = date('Y-m-d H:i') . '%';
        $check_duplicate_log = "SELECT id FROM log_pakan WHERE metode = 'Otomatis' AND waktu_eksekusi LIKE ? LIMIT 1";
        $stmt_dup = $conn->prepare($check_duplicate_log);
        $stmt_dup->bind_param("s", $waktu_menit_sekarang);
        $stmt_dup->execute();
        $res_dup = $stmt_dup->get_result();
        
        if ($res_dup->num_rows === 0) {
            echo "SERVO_TRIGGER_AUTO";
        } else {
            echo "STANDBY"; // Di menit ini sudah dieksekusi sekali
        }
        $stmt_dup->close();
        $stmt_auto->close();
        exit;
    }
    
    echo "STANDBY";
    exit;
}

// 2. Logika API POST (ESP32 mengirim laporan log aktivitas setelah servo berputar)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'log_pakan') {
    
    $metode = isset($_POST['metode']) && $_POST['metode'] === 'Manual' ? 'Manual' : 'Otomatis';
    $status = 'Berhasil';
    
    $insert_log_sql = "INSERT INTO log_pakan (waktu_eksekusi, metode, status) VALUES (NOW(), ?, ?)";
    $stmt_log = $conn->prepare($insert_log_sql);
    $stmt_log->bind_param("ss", $metode, $status);
    
    if ($stmt_log->execute()) {
        echo "LOG_SUCCESS";
    } else {
        echo "LOG_FAILED";
    }
    $stmt_log->close();
    exit;
}

// 3. Logika Aksi Web (Dipicu oleh Form Tambah Jadwal & Klik Button "Beri Pakan")
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    
    // Aksi memicu pakan instan / manual dari tombol halaman web
    if (isset($_POST['aksi']) && $_POST['aksi'] === 'beri_pakan_instan') {
        // Set salah satu jadwal aktif memiliki flag trigger_manual = 1
        // Jika tidak ada jadwal sama sekali, masukkan 1 jadwal temporary untuk memfasilitasi komunikasi
        $check_exist = $conn->query("SELECT id FROM jadwal_pakan LIMIT 1");
        if ($check_exist && $check_exist->num_rows > 0) {
            $conn->query("UPDATE jadwal_pakan SET trigger_manual = 1 LIMIT 1");
        } else {
            $conn->query("INSERT INTO jadwal_pakan (waktu, is_active, trigger_manual) VALUES (NOW(), 1, 1)");
        }
        header("Location: " . $_SERVER['PHP_SELF'] . "?status=triggered");
        exit;
    }
    
    // Aksi submit formulir menambah jadwal pakan baru
    if (isset($_POST['aksi']) && $_POST['aksi'] === 'tambah_jadwal') {
        $waktu_input = $conn->real_escape_string($_POST['waktu_pakan']);
        if (!empty($waktu_input)) {
            $insert_sql = "INSERT INTO jadwal_pakan (waktu, is_active, trigger_manual) VALUES (?, 1, 0)";
            $stmt = $conn->prepare($insert_sql);
            $stmt->bind_param("s", $waktu_input);
            $stmt->execute();
            $stmt->close();
        }
        header("Location: " . $_SERVER['PHP_SELF'] . "?status=added");
        exit;
    }

    // Aksi menghapus jadwal pakan
    if (isset($_POST['aksi']) && $_POST['aksi'] === 'hapus_jadwal') {
        $id_jadwal = intval($_POST['id_jadwal']);
        $conn->query("DELETE FROM jadwal_pakan WHERE id = $id_jadwal");
        header("Location: " . $_SERVER['PHP_SELF'] . "?status=deleted");
        exit;
    }
}

// 4. Ambil data terbaru untuk dirender ke halaman web monitoring
// Data Status Pakan (Gendongan Air & Sensor)
$status_pakan_result = $conn->query("SELECT * FROM status_pakan WHERE id = 1 LIMIT 1");
$status_data = $status_pakan_result->fetch_assoc();
$sisa_persen = isset($status_data['persentase']) ? intval($status_data['persentase']) : 0;
$jarak_cm = isset($status_data['jarak_cm']) ? floatval($status_data['jarak_cm']) : 0.0;
$update_terakhir = isset($status_data['terakhir_diperbarui']) ? $status_data['terakhir_diperbarui'] : "-";

// Data Jadwal Pakan
$jadwal_list = $conn->query("SELECT * FROM jadwal_pakan ORDER BY waktu ASC");

// Data 5 Log Pakan Terakhir
$log_list = $conn->query("SELECT * FROM log_pakan ORDER BY waktu_eksekusi DESC LIMIT 5");

?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IoT Fish Feeder - Monitoring Panel</title>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Auto-refresh halaman setiap 10 detik sesuai spesifikasi -->
    <meta http-equiv="refresh" content="10">
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen">
    <div class="max-w-4xl mx-auto px-4 py-8">
        <!-- Header -->
        <header class="flex flex-col md:flex-row justify-between items-center pb-6 border-b border-slate-800 mb-8 gap-4">
            <div>
                <h1 class="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                    🐟 FishFeeder <span class="text-xs bg-emerald-500/20 text-emerald-400 font-normal px-2 py-1 rounded">IoT Online</span>
                </h1>
                <p class="text-slate-400 text-sm mt-1">Sistem Kontrol & Monitoring Pakan Ikan Jarak Jauh (ESP32)</p>
            </div>
            <div class="text-right text-xs text-slate-500 font-mono">
                Waktu Server: <?php echo date('H:i:s d-m-Y'); ?><br>
                Auto Refresh: <span class="text-emerald-400">10 Detik</span>
            </div>
        </header>

        <!-- Main Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <!-- Kiri/Status Pakan UTAMA -->
            <div class="md:col-span-2 space-y-6">
                <!-- Status Sisa Pakan Widget -->
                <div class="bg-slate-850 bg-opacity-40 p-6 rounded-2xl border border-slate-800 backdrop-blur">
                    <h2 class="text-lg font-semibold mb-4 text-white">Status Kapasitas Wadah</h2>
                    
                    <!-- Progress Bar -->
                    <div class="mb-6">
                        <div class="flex justify-between text-sm text-slate-400 mb-2">
                            <span>Kapasitas Tersisa</span>
                            <span class="font-bold text-white"><?php echo $sisa_persen; ?>%</span>
                        </div>
                        <div class="w-full bg-slate-850 rounded-full h-4 overflow-hidden border border-slate-700">
                            <!-- Warna progress bar berubah hijau sesuai instruksi, opsional berganti jingga jika menipis -->
                            <?php 
                            $bar_color = "bg-emerald-500";
                            if ($sisa_persen < 25) $bar_color = "bg-amber-500";
                            if ($sisa_persen < 10) $bar_color = "bg-red-500";
                            ?>
                            <div class="<?php echo $bar_color; ?> h-full transition-all duration-500" style="width: <?php echo $sisa_persen; ?>%"></div>
                        </div>
                        <div class="flex justify-between text-xs text-slate-500 mt-2 font-mono">
                            <span>Jarak Sensor: <?php echo $jarak_cm; ?> cm</span>
                            <span>Diperbarui: <?php echo $update_terakhir; ?></span>
                        </div>
                    </div>

                    <!-- Tombol Manual Feed -->
                    <form method="POST" action="">
                        <input type="hidden" name="aksi" value="beri_pakan_instan">
                        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl transition duration-250 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40">
                            ⚡ Beri Pakan Sekarang
                        </button>
                    </form>
                </div>

                <!-- Formulir & Daftar Jadwal -->
                <div class="bg-slate-850 p-6 rounded-2xl border border-slate-800">
                    <h2 class="text-lg font-semibold mb-4 text-white">Atur Jadwal Pakan</h2>
                    
                    <form method="POST" action="" class="flex gap-3 mb-6">
                        <input type="hidden" name="aksi" value="tambah_jadwal">
                        <input type="time" name="waktu_pakan" required class="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 transition font-mono">
                        <button type="submit" class="bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-300 hover:text-white px-5 rounded-xl text-sm font-semibold transition">
                            + Tambah
                        </button>
                    </form>

                    <!-- Daftar Jadwal -->
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-sm text-slate-400">
                            <thead>
                                <tr class="border-b border-slate-800 font-semibold text-white">
                                    <th class="py-2">ID</th>
                                    <th class="py-2">Waktu Pakan</th>
                                    <th class="py-2">Status</th>
                                    <th class="py-2 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-800 font-mono">
                                <?php if ($jadwal_list && $jadwal_list->num_rows > 0): ?>
                                    <?php while($jadwal = $jadwal_list->fetch_assoc()): ?>
                                    <tr>
                                        <td class="py-3"><?php echo $jadwal['id']; ?></td>
                                        <td class="py-3 text-white font-bold text-base"><?php echo substr($jadwal['waktu'], 0, 5); ?></td>
                                        <td class="py-3">
                                            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium <?php echo $jadwal['is_active'] ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'; ?>">
                                                <?php echo $jadwal['is_active'] ? 'Aktif' : 'Nonaktif'; ?>
                                            </span>
                                        </td>
                                        <td class="py-3 text-right">
                                            <form method="POST" action="" onsubmit="return confirm('Hapus jadwal ini?');">
                                                <input type="hidden" name="aksi" value="hapus_jadwal">
                                                <input type="hidden" name="id_jadwal" value="<?php echo $jadwal['id']; ?>">
                                                <button type="submit" class="text-rose-500 hover:text-rose-400 text-xs">Hapus</button>
                                            </form>
                                        </td>
                                    </tr>
                                    <?php endwhile; ?>
                                <?php else: ?>
                                    <tr>
                                        <td colspan="4" class="py-4 text-center text-slate-600 italic">Belum ada jadwal pakan bersetup.</td>
                                    </tr>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Kanan/Logs Aktivitas -->
            <div class="space-y-6">
                <div class="bg-slate-850 p-6 rounded-2xl border border-slate-800 min-h-full">
                    <h2 class="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                        📜 Log Aktivitas
                    </h2>
                    
                    <div class="space-y-4 font-mono">
                        <?php if ($log_list && $log_list->num_rows > 0): ?>
                            <?php while($log = $log_list->fetch_assoc()): ?>
                            <div class="border-l-2 <?php echo $log['metode'] === 'Manual' ? 'border-amber-500' : 'border-indigo-500'; ?> PL-3 py-1 text-xs">
                                <div class="flex justify-between">
                                    <span class="text-white font-semibold">Pemberian <?php echo $log['metode']; ?></span>
                                    <span class="text-emerald-400"><?php echo $log['status']; ?></span>
                                </div>
                                <div class="text-slate-500 text-[10px] mt-0.5">
                                    <?php echo $log['waktu_eksekusi']; ?>
                                </div>
                            </div>
                            <?php endwhile; ?>
                        <?php else: ?>
                            <div class="text-center text-slate-600 italic py-8 text-xs">
                                Batang log pakan kosong. ESP32 belum mengirimkan record.
                            </div>
                        <?php endif; ?>
                    </div>
                    
                    <div class="text-[11px] text-slate-500 mt-6 pt-4 border-t border-slate-800">
                        <p class="font-semibold">Info Response Payload:</p>
                        <p class="mt-1">GET -> "SERVO_TRIGGER_AUTO" | "SERVO_TRIGGER_MANUAL" | "STANDBY"</p>
                        <p class="mt-0.5">POST -> Send action=log_pakan & metode="Manual"/"Otomatis"</p>
                    </div>
                </div>
            </div>

        </div>
        
        <footer class="mt-12 text-center text-xs text-slate-600 border-t border-slate-800 pt-6">
            IoT Fish Feeding Automation System Module. Designed with standard native PHP-MySQL API template.
        </footer>
    </div>
</body>
</html>
<?php 
$conn->close();
?>
`;

  const getSqlCode = () => `-- ==========================================
-- SKEMA BASE DATABASE: iot_pakan_ikan
-- PENGEMBANGAN SISTEM PEMBERI PAKAN IKAN OTOMATIS BERBASIS IOT
-- Driver: MySQL / MariaDB
-- ==========================================

-- Buat Database
CREATE DATABASE IF NOT EXISTS \`iot_pakan_ikan\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`iot_pakan_ikan\`;

-- 1. Tabel jadwal_pakan: Menyimpan daftar jam feeding otomatis dan trigger manual
CREATE TABLE IF NOT EXISTS \`jadwal_pakan\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`waktu\` TIME NOT NULL,
  \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
  \`trigger_manual\` TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel log_pakan: Menyimpan riwayat setiap kali ESP32 sukses menggerakkan servo
CREATE TABLE IF NOT EXISTS \`log_pakan\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`waktu_eksekusi\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`metode\` ENUM('Otomatis', 'Manual') NOT NULL,
  \`status\` VARCHAR(20) NOT NULL DEFAULT 'Berhasil'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel status_pakan: Menyimpan persentase kapasitas pakan yang dibaca HC-SR04
CREATE TABLE IF NOT EXISTS \`status_pakan\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`persentase\` INT NOT NULL DEFAULT 0,
  \`jarak_cm\` FLOAT NOT NULL DEFAULT 0.0,
  \`terakhir_diperbarui\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ==========================================
-- INITIAL DATA SEEDING (Sangat Penting)
-- ==========================================

-- Inisialisasi record status pakan tunggal (ID=1) yang diperbarui oleh mikrokontroler
INSERT INTO \`status_pakan\` (\`id\`, \`persentase\`, \`jarak_cm\`, \`terakhir_diperbarui\`)
VALUES (1, 0, 0.0, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE \`id\`=\`id\`;

-- Tambahkan beberapa jadwal makan default opsional sebagai demo awal
INSERT INTO \`jadwal_pakan\` (\`waktu\`, \`is_active\`, \`trigger_manual\`) VALUES
('07:00:00', 1, 0),
('12:00:00', 1, 0),
('17:00:00', 1, 0);

-- Tambahkan contoh log pakan dummy terdahulu
INSERT INTO \`log_pakan\` (\`waktu_eksekusi\`, \`metode\`, \`status\`) VALUES
(NOW() - INTERVAL 12 HOUR, 'Otomatis', 'Berhasil'),
(NOW() - INTERVAL 5 HOUR, 'Manual', 'Berhasil');
`;

  const tabs = [
    { id: 'ino', label: 'ESP32 Firmware (.ino)', icon: Cpu, file: 'pakan_ikan_esp32.ino', lang: 'C++', code: getEsp32Code() },
    { id: 'php', label: 'Unified PHP API & Web Dashboard', icon: Globe, file: 'api_pakan_ikan.php', lang: 'PHP', code: getPhpCode() },
    { id: 'sql', label: 'MySQL Schema (.sql)', icon: Database, file: 'iot_pakan_ikan.sql', lang: 'SQL', code: getSqlCode() },
  ];

  const currentCodeObj = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <div id="firmware_workspace_panel" className="bg-gray-900 border border-teal-800/60 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full">
      {/* Top Header */}
      <div className="bg-gray-950/80 px-6 py-4 border-b border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <span className="text-xs uppercase tracking-widest text-teal-400 font-mono font-semibold">Workspace Programmer</span>
          <h3 className="text-white text-lg font-bold">Kode Sumber & Skema Database</h3>
        </div>
        <div className="flex flex-wrap gap-1 bg-gray-900 p-1 rounded-xl border border-gray-850">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.id.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Code Area Wrapper */}
      <div className="flex-1 overflow-hidden relative group min-h-[400px] flex flex-col bg-gray-950 text-gray-200">
        <div className="flex items-center justify-between px-6 py-2 border-b border-gray-850/60 bg-gray-950/40 text-[11px] font-mono text-gray-500">
          <span>File Name: <strong className="text-teal-400 font-normal">{currentCodeObj.file}</strong></span>
          <button
            onClick={() => copyToClipboard(currentCodeObj.code, currentCodeObj.id)}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-900 hover:bg-teal-950 hover:text-teal-400 border border-gray-800 hover:border-teal-900/60 transition text-gray-400"
          >
            {copied === currentCodeObj.id ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Kode</span>
              </>
            )}
          </button>
        </div>

        {/* Code Block Container */}
        <div className="flex-1 overflow-auto p-6 font-mono text-xs md:text-sm leading-relaxed text-gray-300 bg-gray-950 selection:bg-teal-500/30">
          <pre className="whitespace-pre">{currentCodeObj.code}</pre>
        </div>
      </div>

      {/* Footer Info banner */}
      <div className="bg-gray-950 px-6 py-3.5 border-t border-gray-800 text-xs text-gray-400 flex items-start gap-2.5">
        <Info className="w-4.5 h-4.5 text-teal-400 shrink-0 mt-0.5" />
        <div>
          {activeTab === 'ino' && (
            <p>
              <strong>ESP32 NodeMCU Setup:</strong> Kode ini menyinkronkan waktu langsung dari NTP pool server dan mengecek jadwal ke server lokal setiap 15 detik. Variabel <code className="text-teal-300">JARAK_PENUH</code> ({jarakPenuh} cm) dan <code className="text-teal-300">JARAK_KOSONG</code> ({jarakKosong} cm) disinkronkan secara dinamis berdasarkan kalkulator kalibrasi di panel perakitan.
            </p>
          )}
          {activeTab === 'php' && (
            <p>
              <strong>API PHP & Monitoring:</strong> Menangani panggilan balik ESP32 (GET dan POST) dan menyajikan UI Admin Dashboard yang responsif. Menyertakan mekanisme anti-double-firing dalam menit yang sama untuk memicu pemberian makan otomatis yang andal.
            </p>
          )}
          {activeTab === 'sql' && (
            <p>
              <strong>MySQL iot_pakan_ikan:</strong> Struktur 3 tabel (<code className="text-teal-300">jadwal_pakan</code>, <code className="text-teal-300">log_pakan</code>, dan <code className="text-teal-300">status_pakan</code>) lengkap dengan pendefinisian foreign data awal (seeding) untuk sensor agar tidak bernilai kosong demi mencegah runtuhnya query.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
