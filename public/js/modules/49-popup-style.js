// @2026-Alifiandra
/* =====================================================================
 * 49-popup-style.js  —  Satu gaya untuk semua popup SweetAlert2
 *
 *  Masalah yang dirapikan:
 *   - Judul popup ikut warna tema halaman (mis. hijau tua) sehingga hampir tak terbaca
 *     di atas latar gelap.
 *   - Ikon centang/peringatan punya potongan putih yang tidak menyatu dengan latar.
 *   - Popup muncul di BAWAH modal aplikasi (z-index SweetAlert 1060 < modal 10040).
 *   - Tombol, input, dan toast tidak seragam antar menu.
 *  Semua popup dibuat gelap, kontras tinggi, dan konsisten, apa pun tema halamannya.
 *  Warna tombol yang sengaja diberikan pemanggil (confirmButtonColor, dll.) dihormati.
 * ===================================================================== */
(function () {
    'use strict';
    if (document.getElementById('mc-popup-style')) return;

    var BG = '#1e293b', BG_DEEP = '#0f172a', LINE = '#334155', TX = '#f8fafc', TX2 = '#cbd5e1', MUT = '#94a3b8';
    var P = 'html body .swal2-popup';

    var css = [
        /* lapisan */
        'html body .swal2-container{z-index:100100!important;padding:16px!important}',
        'html body .swal2-container.swal2-backdrop-show,html body .swal2-container.swal2-noanimation{background:rgba(2,6,23,.62)!important;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}',

        /* kartu */
        P + '{background:' + BG + '!important;color:' + TX + '!important;border:1px solid ' + LINE + '!important;border-radius:16px!important;' +
            'padding:26px 24px 22px!important;width:min(26em,calc(100vw - 32px))!important;box-shadow:0 24px 60px rgba(0,0,0,.5)!important;' +
            'font-size:1rem!important;box-sizing:border-box}',
        P + ' .swal2-title{color:' + TX + '!important;font-size:1.3rem!important;font-weight:700!important;line-height:1.3!important;' +
            'padding:0!important;margin:0 0 4px!important;text-transform:none!important;letter-spacing:0!important}',
        P + ' .swal2-html-container,' + P + ' .swal2-content{color:' + TX2 + '!important;font-size:.95rem!important;line-height:1.55!important;' +
            'margin:.6em 0 0!important;padding:0!important;overflow-wrap:anywhere}',
        P + ' .swal2-html-container a{color:#60a5fa!important}',
        P + ' .swal2-footer{border-top:1px solid ' + LINE + '!important;color:' + MUT + '!important;margin-top:1.2em!important;padding-top:1em!important;font-size:.85rem!important}',

        /* ikon */
        P + ' .swal2-icon{margin:2px auto 14px!important;width:4.6em!important;height:4.6em!important;border-width:.22em!important}',
        P + ' .swal2-icon .swal2-icon-content{font-size:3.2em!important}',
        P + ' .swal2-icon.swal2-success{border-color:rgba(74,222,128,.35)!important;color:#4ade80!important}',
        P + ' .swal2-icon.swal2-success [class^=swal2-success-line]{background:#4ade80!important}',
        P + ' .swal2-icon.swal2-success .swal2-success-ring{border:.22em solid rgba(74,222,128,.28)!important}',
        P + ' .swal2-icon.swal2-success [class^=swal2-success-circular-line],' + P + ' .swal2-icon.swal2-success .swal2-success-fix{background:' + BG + '!important}',
        P + ' .swal2-icon.swal2-error{border-color:#f87171!important;color:#f87171!important}',
        P + ' .swal2-icon.swal2-error [class^=swal2-x-mark-line]{background:#f87171!important}',
        P + ' .swal2-icon.swal2-warning{border-color:#fbbf24!important;color:#fbbf24!important}',
        P + ' .swal2-icon.swal2-info{border-color:#38bdf8!important;color:#38bdf8!important}',
        P + ' .swal2-icon.swal2-question{border-color:#a5b4fc!important;color:#a5b4fc!important}',

        /* tombol */
        P + ' .swal2-actions{margin:1.4em auto 0!important;gap:10px;flex-wrap:wrap;width:100%}',
        P + ' .swal2-styled{margin:0!important;padding:.65em 1.4em!important;border-radius:10px!important;font-size:.92rem!important;font-weight:600!important;' +
            'box-shadow:none!important;border:1px solid transparent!important;min-width:96px;transition:filter .15s,background-color .15s}',
        P + ' .swal2-styled.swal2-confirm{color:#fff!important}',
        P + ' .swal2-styled.swal2-confirm:not([style*="background"]){background:#2563eb!important}',
        P + ' .swal2-styled.swal2-deny{color:#fff!important}',
        P + ' .swal2-styled.swal2-deny:not([style*="background"]){background:#dc2626!important}',
        P + ' .swal2-styled.swal2-cancel{color:' + TX + '!important}',
        P + ' .swal2-styled.swal2-cancel:not([style*="background"]){background:transparent!important;border-color:#475569!important}',
        P + ' .swal2-styled.swal2-cancel:not([style*="background"]):hover{background:' + LINE + '!important}',
        P + ' .swal2-styled:hover{filter:brightness(1.1)}',
        P + ' .swal2-styled:focus-visible,' + P + ' .swal2-styled:focus{outline:0!important;box-shadow:0 0 0 3px rgba(96,165,250,.45)!important}',
        P + ' .swal2-close{color:' + MUT + '!important;font-size:1.6rem!important;border-radius:10px!important}',
        P + ' .swal2-close:hover{color:' + TX + '!important;background:' + LINE + '!important}',

        /* input di dalam popup */
        P + ' .swal2-input,' + P + ' .swal2-select,' + P + ' .swal2-textarea,' + P + ' .swal2-file{background:' + BG_DEEP + '!important;color:#f1f5f9!important;' +
            'border:1px solid ' + LINE + '!important;border-radius:10px!important;box-shadow:none!important;margin:.8em auto 0!important;font-size:.95rem!important;width:100%!important;box-sizing:border-box!important}',
        P + ' .swal2-input:focus,' + P + ' .swal2-select:focus,' + P + ' .swal2-textarea:focus{border-color:#3b82f6!important;box-shadow:0 0 0 3px rgba(59,130,246,.3)!important}',
        P + ' .swal2-input::placeholder,' + P + ' .swal2-textarea::placeholder{color:#64748b!important}',
        P + ' .swal2-checkbox,' + P + ' .swal2-radio{color:' + TX2 + '!important;background:transparent!important}',
        P + ' .swal2-validation-message{background:rgba(248,113,113,.12)!important;color:#fca5a5!important;border-radius:10px!important;margin:.8em 0 0!important;font-size:.85rem!important}',
        P + ' .swal2-validation-message::before{background:#f87171!important}',
        P + ' .swal2-timer-progress-bar{background:#3b82f6!important}',
        P + ' .swal2-timer-progress-bar-container{border-radius:0 0 16px 16px;overflow:hidden}',
        P + ' .swal2-loader{border-color:#3b82f6 transparent #3b82f6 transparent!important}',

        /* toast (pojok kanan atas) — ringkas, tanpa latar gelap memanjang */
        'html body.swal2-toast-shown .swal2-container{background:transparent!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;' +
            'height:auto!important;width:auto!important;max-width:100vw!important;padding:14px 16px!important;pointer-events:none!important}',
        'html body.swal2-toast-shown .swal2-container .swal2-popup{pointer-events:auto!important}',
        P + '.swal2-toast{width:auto!important;min-width:240px!important;max-width:min(340px,calc(100vw - 32px))!important;padding:10px 14px 10px 12px!important;' +
            'border-radius:12px!important;border:1px solid rgba(148,163,184,.18)!important;border-left:4px solid #64748b!important;' +
            'background:rgba(15,23,42,.94)!important;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);' +
            'box-shadow:0 8px 24px rgba(2,6,23,.35),0 1px 2px rgba(2,6,23,.25)!important;column-gap:10px!important;overflow:hidden!important}',
        P + '.swal2-toast.swal2-icon-success{border-left-color:#22c55e!important}',
        P + '.swal2-toast.swal2-icon-error{border-left-color:#f87171!important}',
        P + '.swal2-toast.swal2-icon-warning{border-left-color:#fbbf24!important}',
        P + '.swal2-toast.swal2-icon-info{border-left-color:#38bdf8!important}',
        P + '.swal2-toast.swal2-icon-question{border-left-color:#a5b4fc!important}',
        P + '.swal2-toast .swal2-title{font-size:.86rem!important;font-weight:600!important;line-height:1.35!important;margin:0!important;padding:0!important;' +
            'text-align:left!important;color:#f1f5f9!important;align-self:center}',
        P + '.swal2-toast .swal2-icon{width:1.5em!important;min-width:1.5em!important;height:1.5em!important;margin:0!important;border-width:.13em!important;align-self:center}',
        P + '.swal2-toast .swal2-icon .swal2-icon-content{font-size:1.05em!important;font-weight:700!important}',
        P + '.swal2-toast .swal2-icon.swal2-success .swal2-success-ring{border-width:.13em!important}',
        P + '.swal2-toast .swal2-icon.swal2-success [class^=swal2-success-circular-line],' + P + '.swal2-toast .swal2-icon.swal2-success .swal2-success-fix{background:transparent!important}',
        P + '.swal2-toast .swal2-html-container{margin:2px 0 0!important;padding:0!important;font-size:.8rem!important;color:#cbd5e1!important;text-align:left!important}',
        P + '.swal2-toast .swal2-close{font-size:1.2rem!important;width:1.4em!important;height:1.4em!important;align-self:center}',
        P + '.swal2-toast .swal2-timer-progress-bar-container{border-radius:0!important;height:2px!important}',
        P + '.swal2-toast.swal2-icon-success .swal2-timer-progress-bar{background:#22c55e!important}',
        P + '.swal2-toast.swal2-icon-error .swal2-timer-progress-bar{background:#f87171!important}',
        P + '.swal2-toast.swal2-icon-warning .swal2-timer-progress-bar{background:#fbbf24!important}',
        P + '.swal2-toast .swal2-timer-progress-bar{opacity:.85}',
        P + '.swal2-toast.swal2-show{animation:mcToastIn .28s cubic-bezier(.2,.8,.2,1)!important}',
        P + '.swal2-toast.swal2-hide{animation:mcToastOut .2s ease-in forwards!important}',
        '@keyframes mcToastIn{from{opacity:0;transform:translateX(24px) scale(.98)}to{opacity:1;transform:none}}',
        '@keyframes mcToastOut{to{opacity:0;transform:translateX(24px)}}',

        /* layar kecil */
        '@media (max-width:480px){' + P + '{padding:22px 18px 18px!important}' + P + ' .swal2-actions{flex-direction:column-reverse;align-items:stretch}' + P + ' .swal2-styled{width:100%}}',
        '@media (prefers-reduced-motion:reduce){html body .swal2-popup,html body .swal2-popup *{animation-duration:.01ms!important;transition-duration:.01ms!important}}'
    ].join('\n');

    var st = document.createElement('style');
    st.id = 'mc-popup-style';
    st.textContent = css;
    document.head.appendChild(st);
})();
