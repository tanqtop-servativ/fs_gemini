// js/debug.js
console.log("--- DEBUG LOADER ---");
try {
    import('./views/dashboard.js').then(() => console.log("✅ Dashboard Module Loaded"));
    import('./views/calendar.js').then(() => console.log("✅ Calendar Module Loaded"));
    import('./views/properties.js').then(() => console.log("✅ Properties Module Loaded"));
} catch(e) {
    console.error("❌ MODULE IMPORT ERROR:", e);
}
