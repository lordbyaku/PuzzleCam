@echo off
setlocal

rem ============================================================
rem  sync.bat - kirim perubahan Puzzle Udara ke GitHub
rem
rem  Pakai:
rem    sync.bat                  tanya pesan commit, lalu kirim
rem    sync.bat "pesan commit"   langsung pakai pesan itu
rem    sync.bat -cek             hanya periksa, tidak commit & tidak kirim
rem
rem  Mengikuti branch yang sedang aktif, bukan mematok main. Pekerjaan
rem  besar dikerjakan di branch supaya main - yang ter-deploy ke kios -
rem  tetap berisi versi yang sudah terverifikasi.
rem
rem  Urutannya sengaja: uji dulu, versi dulu, baru commit. Aturan
rem  "npm test harus hijau sebelum commit" di CLAUDE.md jadi tidak
rem  bergantung pada ingatan.
rem
rem  Alurnya memakai label, bukan blok kurung. Di batch, variabel yang
rem  diisi di dalam blok ( ) tidak terbaca di blok yang sama tanpa
rem  delayed expansion - sumber bug yang senyap dan susah dilacak.
rem ============================================================

cd /d "%~dp0"

set "MODE=kirim"
set "PESAN=%~1"
if /i "%PESAN%"=="-cek" set "MODE=cek"
if /i "%PESAN%"=="-cek" set "PESAN="

echo.
echo ===============================================
echo  Puzzle Udara - sinkronisasi ke GitHub
echo ===============================================

rem --- 0. Pastikan ini benar-benar repo -------------------------
git rev-parse --show-toplevel >nul 2>&1
if errorlevel 1 goto :bukan_repo

rem --- 1. Uji otomatis ------------------------------------------
echo.
echo [1/5] Uji otomatis
call npm test
if errorlevel 1 goto :uji_gagal

rem --- 2. Konsistensi versi -------------------------------------
echo.
echo [2/5] Konsistensi versi
call npm run --silent cek-versi
if errorlevel 1 goto :versi_gagal

rem --- 3. Apa yang berubah --------------------------------------
echo.
echo [3/5] Perubahan di folder kerja
git status --short
git status --porcelain >"%TEMP%\pc-sync-status.txt"
set "ADA=0"
for %%A in ("%TEMP%\pc-sync-status.txt") do if %%~zA GTR 0 set "ADA=1"
del "%TEMP%\pc-sync-status.txt" >nul 2>&1
if "%ADA%"=="0" echo    (bersih - tidak ada perubahan baru^)

if "%MODE%"=="cek" goto :cek_selesai

rem --- 4. Commit ------------------------------------------------
echo.
echo [4/5] Commit
if "%ADA%"=="0" goto :lewati_commit
if not "%PESAN%"=="" goto :lakukan_commit

echo.
echo Tulis pesan commit. Kosongkan lalu Enter untuk membatalkan.
echo Hindari tanda kutip ganda di dalam pesan.
set /p "PESAN=Pesan: "
if "%PESAN%"=="" goto :batal

:lakukan_commit
git add -A
git commit -m "%PESAN%"
if errorlevel 1 goto :commit_gagal
goto :kirim

:lewati_commit
echo    Tidak ada perubahan baru. Memeriksa commit yang belum terkirim.

rem --- 5. Kirim -------------------------------------------------
:kirim
echo.
echo [5/5] Kirim ke GitHub
git remote get-url origin >nul 2>&1
if errorlevel 1 git remote add origin https://github.com/lordbyaku/PuzzleCam.git

for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD') do set "CABANG=%%B"
if "%CABANG%"=="" goto :cabang_gagal
if "%CABANG%"=="HEAD" goto :cabang_lepas
echo    Branch aktif: %CABANG%

rem Branch yang belum pernah ada di GitHub tidak bisa ditarik - push yang
rem akan membuatnya. Tanpa pemeriksaan ini, pengiriman pertama sebuah
rem branch baru selalu gagal di tahap pull.
git ls-remote --exit-code --heads origin %CABANG% >nul 2>&1
if errorlevel 1 goto :lewati_tarik

rem Tarik dulu supaya perubahan yang dibuat lewat web GitHub tidak menabrak.
git pull --rebase origin %CABANG%
if errorlevel 1 goto :tarik_gagal
goto :dorong

:lewati_tarik
echo    Branch ini belum ada di GitHub, akan dibuat oleh push.

:dorong
git push -u origin %CABANG%
if errorlevel 1 goto :kirim_gagal

echo.
echo ===============================================
echo  Selesai - branch %CABANG% terkirim.
echo  https://github.com/lordbyaku/PuzzleCam
echo ===============================================
echo.
echo Vercel men-deploy sendiri kalau repo ini sudah tersambung ke sana.
goto :akhir

rem ============================================================
rem  Jalur gagal - masing-masing menjelaskan langkah berikutnya
rem  Semua label di bawah ini harus berada SESUDAH "goto :akhir",
rem  supaya alur normal tidak pernah jatuh ke sini.
rem ============================================================
:cabang_gagal
echo.
echo GAGAL: tidak bisa membaca nama branch yang sedang aktif.
goto :akhir_gagal

:cabang_lepas
echo.
echo GAGAL: HEAD sedang terlepas (detached), tidak berada di sebuah branch.
echo Pindah dulu ke sebuah branch, misalnya:  git switch main
goto :akhir_gagal

:bukan_repo
echo.
echo GAGAL: folder ini bukan repo git.
echo.
echo Kalau pesannya soal "dubious ownership", jalankan sekali:
echo    git config --global --add safe.directory D:/0ANTIGRAVITY/AIRTOUCH/PuzzleCam
goto :akhir_gagal

:uji_gagal
echo.
echo GAGAL: ada uji yang tidak lolos. Tidak ada yang di-commit maupun dikirim.
echo Perbaiki dulu, lalu jalankan sync.bat lagi.
goto :akhir_gagal

:versi_gagal
echo.
echo GAGAL: versi tidak sama di keempat tempatnya. Tidak ada yang dikirim.
echo Samakan index.html, package.json, changelog.md, dan VERSI di sw.js.
goto :akhir_gagal

:commit_gagal
echo.
echo GAGAL saat commit. Cek pesan di atas.
echo Kalau pesan commit memuat tanda kutip ganda, hapus dulu tanda kutipnya.
goto :akhir_gagal

:tarik_gagal
echo.
echo GAGAL saat git pull --rebase branch %CABANG%, biasanya karena bentrok
echo dengan perubahan di GitHub. Belum ada yang dikirim, commit lokal aman.
echo Selesaikan bentrokannya, lalu jalankan sync.bat lagi.
goto :akhir_gagal

:kirim_gagal
echo.
echo GAGAL saat push. Commit sudah tersimpan di lokal, jadi tidak ada yang hilang.
echo Kalau muncul jendela login GitHub, selesaikan dulu lalu ulangi.
goto :akhir_gagal

:batal
echo.
echo Dibatalkan. Tidak ada yang di-commit maupun dikirim.
goto :akhir

:cek_selesai
echo.
echo ===============================================
echo  Pemeriksaan selesai. Tidak ada yang dikirim.
echo ===============================================
goto :akhir

:akhir_gagal
echo.
pause
exit /b 1

:akhir
echo.
pause
exit /b 0
