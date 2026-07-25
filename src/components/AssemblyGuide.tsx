import React, { useState } from 'react';
import { Copy, Check, Shield, Drill, Minimize, Cpu, Eye, Info, PenTool, ClipboardList } from 'lucide-react';

interface AssemblyGuideProps {
  jarakPenuh: number;
  setJarakPenuh: (val: number) => void;
  jarakKosong: number;
  setJarakKosong: (val: number) => void;
}

export default function AssemblyGuide({
  jarakPenuh,
  setJarakPenuh,
  jarakKosong,
  setJarakKosong,
}: AssemblyGuideProps) {
  const [copied, setCopied] = useState(false);
  const [customUnitHeight, setCustomUnitHeight] = useState(16); // total bottle height
  const [safetyMargin, setSafetyMargin] = useState(3); // sensor blind spot margin

  const copyConfig = () => {
    const text = `const float JARAK_PENUH = ${jarakPenuh.toFixed(1)};\nconst float JARAK_KOSONG = ${jarakKosong.toFixed(1)};`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Recalculate based on input dimensions
  const updateFractions = (height: number, margin: number) => {
    setCustomUnitHeight(height);
    setSafetyMargin(margin);
    setJarakPenuh(margin); // full distance is the sensor blind margin
    setJarakKosong(height - 1); // empty distance is max bottle depth
  };

  return (
    <div id="assembly_guide_card" className="bg-gray-900 border border-teal-800/40 rounded-2xl p-6 shadow-xl space-y-8 select-text">
      
      {/* Top Header */}
      <div>
        <span className="text-xs uppercase tracking-widest text-teal-400 font-mono font-bold">Instruksi Kerajinan & Teknik DIY</span>
        <h3 className="text-white text-xl font-bold mt-1">Panduan Perakitan Mekanik & Kalibrasi Sensor</h3>
        <p className="text-xs text-gray-400 mt-1">Langkah terperinci mengubah botol plastik 600ml menjadi dispenser pakan ikan pintar IoT.</p>
      </div>

      {/* Assembly Layout Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="diy_layout_steps">
        {/* Step 1: Modifikasi Wadah */}
        <div className="p-5 rounded-xl bg-gray-950 border border-gray-850 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-12 h-12 bg-teal-500/5 rounded-bl-full flex items-center justify-center text-teal-400/20 font-bold font-mono">
            01
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
              <Drill className="w-5 h-5" />
            </div>
            <h4 className="text-white font-bold text-sm">Modifikasi Wadah Pakan (Botol 600ml)</h4>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Potong bagian dasar botol plastik bekas 600ml secara melintang untuk memfasilitasi pengisian ulang pakan dari atas (Top-loading). Buat lubang berdiameter 1.5cm pada tutup botol kayu/samping penutup untuk keluaran pakan.
          </p>
          <ul className="text-[11px] text-gray-500 space-y-1 list-disc list-inside">
            <li>Gunakan cutter panas untuk memotong plastik agar rapi.</li>
            <li>Pasang corong kecil internal untuk memusatkan butiran pakan.</li>
          </ul>
        </div>

        {/* Step 2: Instalasi Aktuator Servo */}
        <div className="p-5 rounded-xl bg-gray-950 border border-gray-850 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-12 h-12 bg-teal-500/5 rounded-bl-full flex items-center justify-center text-teal-400/20 font-bold font-mono">
            02
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Minimize className="w-5 h-5" />
            </div>
            <h4 className="text-white font-bold text-sm">Pemosisian Katup & Motor Servo MG90S</h4>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Pasang motor servo MG90S (Metal Gear) menggunakan <strong className="text-white">Baut & Mur Stainless M2.5x10mm</strong> agar tahan karat di uap akuarium. Servo memutar katup flap penutup lubang botol yang membuka selama 1.5 detik.
          </p>
          <ul className="text-[11px] text-gray-500 space-y-1 list-disc list-inside">
            <li>Kalibrasi servo pada sudut 0° (keadaan tertutup rapat).</li>
            <li>Gunakan flap plastik tebal sebagai katup pengontrol.</li>
          </ul>
        </div>

        {/* Step 3: Sensor Ultrasonik Moisture Shield */}
        <div className="p-5 rounded-xl bg-gray-950 border border-gray-850 space-y-3 relative overflow-hidden md:col-span-2">
          <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/5 rounded-bl-full flex items-center justify-center text-amber-400/20 font-bold font-mono">
            03
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <h4 className="text-white font-bold text-sm">Proteksi Kelembaban Sensor HC-SR04 (PENTING WILAYAH BASAH)</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-400 leading-relaxed">
                Lubangi tutup atas sensor dengan 2 lubang sesuai diameter receiver/transmitter HC-SR04. Pasang sensor menghadap ke dalam wadah pakan dari bagian paling atas botol.
              </p>
              <div className="bg-amber-950/20 border border-amber-900/40 p-3 rounded-lg text-amber-200 text-[11px] mt-2.5 leading-relaxed">
                ⚠️ <strong>WAJIB:</strong> Gunakan <strong className="text-white">Spacer / Peninggi Nylon M2 x 10mm</strong> sebagai tiang peninggi antara PCB sensor dan tutup/dinding botol atas. Spacer ini berfungsi mencegah rembesan air dan timbunan uap kondensasi akuarium yang merembes ke sirkuit ultrasonik yang kerap memicu korsleting sirkuit (short-circuit) atau korosi cepat!
              </div>
            </div>
            {/* Visual spacer representation */}
            <div className="bg-gray-950 border border-gray-800 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1">
              <div className="w-3.5 h-8 bg-amber-400 rounded-lg border border-amber-600 flex flex-col justify-between py-1 items-center">
                <span className="w-1.5 h-1 bg-gray-500 rounded-full"></span>
                <span className="w-1.5 h-1 bg-gray-500 rounded-full"></span>
              </div>
              <span className="text-[10px] text-white font-mono font-bold mt-1">Spacer Nylon M2 x 10mm</span>
              <span className="text-[9px] text-gray-500">Tiang Isolasi Korosi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Schematics Section */}
      <div className="bg-gray-950 border border-gray-850 p-6 rounded-2xl flex flex-col md:flex-row gap-6 justify-between items-stretch">
        <div className="flex flex-col justify-between md:w-1/2">
          <div>
            <h4 className="text-white font-bold text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-teal-400" />
              Skema Kelistrikan & Pinout ESP32
            </h4>
            <p className="text-xs text-gray-450 mt-1 leading-relaxed">
              Koneksi listrik mikrokontroler menggunakan adaptor 5V 2A reguler demi menjamin asupan arus yang stabil saat kumparan servo MG90S menyala.
            </p>
          </div>
          <div className="border border-gray-850 rounded-xl overflow-hidden mt-4">
            <table className="w-full text-left font-mono text-xs text-gray-400">
              <thead className="bg-gray-900 text-[10px] uppercase font-bold text-white">
                <tr>
                  <th className="py-2.5 px-3">Komponen</th>
                  <th className="py-2.5 px-3">Kabel F-D</th>
                  <th className="py-2.5 px-3">Pin ESP32 NodeMCU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-850">
                <tr>
                  <td className="py-2 px-3 text-cyan-400">HC-SR04 TRIG</td>
                  <td className="py-2 px-3">Merah/Hijau</td>
                  <td className="py-2 px-3 text-white font-bold">GPIO 5</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-cyan-400">HC-SR04 ECHO</td>
                  <td className="py-2 px-3">Kuning/Biru</td>
                  <td className="py-2 px-3 text-white font-bold">GPIO 18</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-indigo-400">Servo MG90S PWM</td>
                  <td className="py-2 px-3">Oranye (Signal)</td>
                  <td className="py-2 px-3 text-white font-bold">GPIO 19</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-red-500">Power VCC</td>
                  <td className="py-2 px-3">Merah (+5V)</td>
                  <td className="py-2 px-3 text-white">VIN (atau 5V)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-gray-500">Pentanahan GND</td>
                  <td className="py-2 px-3 font-mono">Hitam (GND)</td>
                  <td className="py-2 px-3 text-white">GND</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Wire schematic cartoon visual */}
        <div className="md:w-1/2 bg-gray-990 border border-gray-850 rounded-xl p-4 flex flex-col justify-center items-center font-mono text-[9px] text-gray-500 select-none relative">
          <div className="text-[10px] text-white font-bold mb-3 flex items-center gap-1.5 self-start">
            <PenTool className="w-3.5 h-3.5 text-teal-400" />
            Diagram Alur Fisik
          </div>
          
          <div className="w-full flex justify-around items-center h-28 relative">
            {/* ESP32 Board Graphic Representation */}
            <div className="w-20 h-16 bg-blue-950 border border-blue-500 rounded-md p-1.5 flex flex-col justify-between text-center relative shadow-md">
              <span className="text-white text-[7px] font-bold">ESP32 NodeMCU</span>
              <div className="flex justify-between text-[5px]">
                <span className="text-teal-400">G5</span>
                <span className="text-teal-400">G18</span>
                <span className="text-indigo-400">G19</span>
              </div>
              <div className="absolute bottom-1 right-1 w-2 h-1 bg-gray-600 rounded-sm"></div>
            </div>

            {/* Simulated Colored wire paths */}
            <div className="absolute inset-0 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 200 100">
                {/* TRIG Wire (Blue) */}
                <path d="M 60,40 C 80,10 110,10 145,25" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="3 3" />
                {/* ECHO Wire (Cyan) */}
                <path d="M 60,45 C 80,30 110,25 145,35" fill="none" stroke="#06b6d4" strokeWidth="1.5" />
                {/* SERVO Wire (Orange) */}
                <path d="M 60,50 C 75,80 120,80 145,70" fill="none" stroke="#f97316" strokeWidth="1.5" />
              </svg>
            </div>

            <div className="flex flex-col gap-5">
              {/* HC-SR04 bubble */}
              <div className="w-16 h-10 bg-gray-900 border border-cyan-700 rounded-sm flex flex-col justify-center items-center text-center p-1 shadow">
                <span className="text-white font-bold text-[7px]">HC-SR04</span>
                <span className="text-cyan-400 text-[6px]">Ultrasonic</span>
              </div>
              
              {/* MG90S Servo bubble */}
              <div className="w-16 h-10 bg-gray-900 border border-orange-700 rounded-sm flex flex-col justify-center items-center text-center p-1 shadow">
                <span className="text-white font-bold text-[7px]">MG90S</span>
                <span className="text-orange-400 text-[6px]">Servo MG90S</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Calibration Calculator */}
      <div className="bg-gradient-to-br from-teal-950/20 to-gray-950 border border-teal-500/20 p-6 rounded-2xl space-y-5">
        <div>
          <h4 className="text-teal-300 font-bold text-sm flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-teal-400" />
            Uji Kalibrasi Sensor Digital
          </h4>
          <p className="text-xs text-gray-400 mt-1">
            Gunakan penggeser di bawah untuk menyimulasikan kontainer pakan fisik Anda sendiri. Nilai konstanta C++ di sisi kanan akan dihitung secara langsung!
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4 bg-gray-950/60 p-4 rounded-xl border border-gray-850">
              {/* Total Height Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-300">Total Kedalaman Wadah:</span>
                  <span className="text-teal-400 font-mono">{customUnitHeight} cm</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="45"
                  step="1"
                  value={customUnitHeight}
                  onChange={(e) => updateFractions(parseInt(e.target.value), safetyMargin)}
                  className="w-full accent-teal-500 cursor-pointer"
                />
                <span className="text-[10px] text-gray-500 block">Jarak sensor ke bagian dasar lubang keluaran botol saat kosong.</span>
              </div>

              {/* Blind Spot Margin */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-300">Batas Jarak Penuh (Blank spot):</span>
                  <span className="text-teal-400 font-mono">{safetyMargin} cm</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="8"
                  step="0.5"
                  value={safetyMargin}
                  onChange={(e) => updateFractions(customUnitHeight, parseFloat(e.target.value))}
                  className="w-full accent-teal-500 cursor-pointer"
                />
                <span className="text-[10px] text-gray-500 block">Rekomendasi minimal 3cm demi menghindari tabrakan fisik sensor ke pakan.</span>
              </div>
            </div>

            {/* Recalculated Output Box */}
            <div className="bg-gray-950 p-4 rounded-xl border border-teal-950 flex flex-col justify-between">
              <div className="text-[11px] font-mono text-gray-400 space-y-2">
                <span className="text-teal-400 font-bold block uppercase text-xs tracking-wider">Hasil Kalibrasi C++ Arduino</span>
                <div className="bg-gray-900/80 p-3 rounded-lg border border-gray-800 text-teal-300">
                  <p>// Masukkan konstanta ini ke baris 26-27</p>
                  <p className="font-bold">const float JARAK_PENUH = {jarakPenuh.toFixed(1)};</p>
                  <p className="font-bold">const float JARAK_KOSONG = {jarakKosong.toFixed(1)};</p>
                </div>
                <div className="flex flex-col gap-1 text-[10px] text-gray-500">
                  <p>• Persentase pakan adalah 100% jika jarak sensor ke pakan = {jarakPenuh.toFixed(1)} cm.</p>
                  <p>• Persentase pakan adalah 0% jika jarak sensor ke pakan = {jarakKosong.toFixed(1)} cm.</p>
                </div>
              </div>

              <button
                onClick={copyConfig}
                className="w-full mt-3 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg transition"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin Konfigurasi'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 bg-teal-950/20 p-4 rounded-xl border border-teal-900/30 text-xs text-teal-200">
          <Info className="w-5 text-teal-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Instruksi Kalibrasi Fisik:</strong> Gantilah nilai konstanta ini ke IDE Arduino Anda. Sesaat setelah perakitan, nyalakan serial monitor ESP32, tuang pakan hingga batas maksimal (sisakan celah kosong 3cm agar tidak menyentuh silikon sensor), amatilah keluaran angka centimeter di layar Serial Monitor, ganti <code className="text-white">JARAK_PENUH</code>. Jalankan hal yang sama saat pakan kosong untuk <code className="text-white">JARAK_KOSONG</code>.
          </div>
        </div>
      </div>

    </div>
  );
}
