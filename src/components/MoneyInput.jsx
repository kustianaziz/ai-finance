import React from 'react';

export default function MoneyInput({ value, onChange, placeholder, className, disabled }) {
  // Format tampilan ke Ribuan (10.000)
  const displayValue = value ? new Intl.NumberFormat('id-ID').format(value) : '';

  const handleChange = (e) => {
    // Ambil hanya angka dari input
    const rawValue = e.target.value.replace(/\D/g, '');
    // Kirim nilai asli (angka) ke parent
    onChange(Number(rawValue));
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">Rp</span>
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`pl-10 ${className}`} // Padding kiri buat "Rp"
        disabled={disabled}
      />
    </div>
  );
}