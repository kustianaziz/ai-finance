// src/utils/budgetUtils.js

/**
 * Menghitung Range Tanggal berdasarkan Siklus Gajian User
 * @param {Date} currentDate - Tanggal yang sedang dilihat (default: hari ini)
 * @param {number} startCycle - Tanggal gajian (misal: 25)
 * @returns {Object} { startStr, endStr, periodLabel, periodCode }
 */
export const calculateBudgetPeriod = (currentDate, startCycle = 1) => {
    const targetDate = new Date(currentDate);
    const day = targetDate.getDate();
    const month = targetDate.getMonth();
    const year = targetDate.getFullYear();

    let startDate, endDate;

    if (startCycle === 1) {
        // Logika Standar (Tanggal 1 - 30/31)
        startDate = new Date(year, month, 1);
        endDate = new Date(year, month + 1, 0);
    } else {
        // Logika Custom (Misal Gajian Tgl 25)
        
        // Cek: Apakah hari ini SUDAH lewat tanggal gajian?
        if (day >= startCycle) {
            // Periode dimulai bulan ini tgl 25
            startDate = new Date(year, month, startCycle);
            // Berakhir bulan depan tgl 24
            endDate = new Date(year, month + 1, startCycle - 1);
        } else {
            // Periode dimulai bulan LALU tgl 25
            startDate = new Date(year, month - 1, startCycle);
            // Berakhir bulan ini tgl 24
            endDate = new Date(year, month, startCycle - 1);
        }
    }

    // Format YYYY-MM-DD untuk query DB
    const toISO = (d) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };

    // Label untuk UI (Misal: "25 Jan - 24 Feb")
    const labelOptions = { day: 'numeric', month: 'short' };
    const periodLabel = `${startDate.toLocaleDateString('id-ID', labelOptions)} - ${endDate.toLocaleDateString('id-ID', labelOptions)}`;

    // Period Code (PENTING untuk ID Budget di DB)
    // Kita gunakan tanggal awal periode sebagai patokan ID
    // Contoh: Periode 25 Jan - 24 Feb, periodCode-nya "2024-01-25"
    const periodCode = toISO(startDate);

    return {
        startStr: toISO(startDate), // "2024-01-25"
        endStr: toISO(endDate),     // "2024-02-24"
        periodLabel,                // "25 Jan - 24 Feb"
        periodCode                  // "2024-01-25" (Gunakan ini untuk field 'month_period' di DB)
    };
};