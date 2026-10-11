// Evita la finestra console aggiuntiva su Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    toodly_lib::run()
}
