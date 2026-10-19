use anti_cheat_sdk::{compute_hmac_sha256, hash_to_hex, verify_hmac_sha256_hex};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleTelemetryFrame {
    pub vehicle_vin: String,
    pub speed_kph: f64,
    pub engine_rpm: u32,
    pub battery_temp_c: f64,
    pub brake_pressure_psi: f64,
    pub timestamp_ms: u64,
    pub signature: Option<String>,
}

#[derive(Serialize)]
struct UnsignedVehicleTelemetryFrame<'a> {
    vehicle_vin: &'a str,
    speed_kph: f64,
    engine_rpm: u32,
    battery_temp_c: f64,
    brake_pressure_psi: f64,
    timestamp_ms: u64,
}

impl VehicleTelemetryFrame {
    fn signing_payload(&self) -> Vec<u8> {
        let payload = UnsignedVehicleTelemetryFrame {
            vehicle_vin: &self.vehicle_vin,
            speed_kph: self.speed_kph,
            engine_rpm: self.engine_rpm,
            battery_temp_c: self.battery_temp_c,
            brake_pressure_psi: self.brake_pressure_psi,
            timestamp_ms: self.timestamp_ms,
        };
        serde_json::to_vec(&payload).expect("serializing telemetry fields cannot fail")
    }

    /// Sign every telemetry field except the signature using standard HMAC-SHA-256.
    pub fn sign_frame(&mut self, secret_key: &str) {
        let tag = compute_hmac_sha256(secret_key.as_bytes(), &self.signing_payload());
        self.signature = Some(hash_to_hex(&tag));
    }

    /// Verify the supplied HMAC-SHA-256 tag using a constant-time comparison.
    pub fn verify_signature(&self, secret_key: &str) -> bool {
        self.signature.as_deref().map_or(false, |signature| {
            verify_hmac_sha256_hex(secret_key.as_bytes(), &self.signing_payload(), signature)
        })
    }
}

fn main() {
    println!("=== Connected Vehicle Telemetry Ingestion Pipeline (Rust) ===");
    println!("Architecture: Rust telemetry example with HMAC-SHA-256 integrity checks");

    let secret_key = "local_demo_key_not_for_production";
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;

    let mut frame = VehicleTelemetryFrame {
        vehicle_vin: "4T1B11HK5JU123456".to_string(),
        speed_kph: 104.5,
        engine_rpm: 2450,
        battery_temp_c: 32.8,
        brake_pressure_psi: 0.0,
        timestamp_ms: now,
        signature: None,
    };

    println!("\n1. Ingesting raw sensor frame from vehicle CAN-bus...");
    println!("   VIN: {}, Speed: {} km/h, RPM: {}", frame.vehicle_vin, frame.speed_kph, frame.engine_rpm);

    // Cryptographic signing
    frame.sign_frame(secret_key);
    println!("2. Cryptographically signed with HMAC-SHA256: {}", frame.signature.as_ref().unwrap());

    // Verify
    let is_valid = frame.verify_signature(secret_key);
    println!("3. Signature verification status: {} (Anti-tamper integrity verified)", is_valid);

    // Throughput benchmark
    println!("\n4. Running 10,000-frame high-throughput stress test...");
    let start = std::time::Instant::now();
    for i in 0..10_000 {
        let mut test_frame = VehicleTelemetryFrame {
            vehicle_vin: "4T1B11HK5JU123456".to_string(),
            speed_kph: 100.0 + (i % 20) as f64,
            engine_rpm: 2000 + (i % 500) as u32,
            battery_temp_c: 30.0 + (i % 10) as f64,
            brake_pressure_psi: 15.0,
            timestamp_ms: now + i as u64,
            signature: None,
        };
        test_frame.sign_frame(secret_key);
        assert!(test_frame.verify_signature(secret_key));
    }
    let elapsed = start.elapsed();
    println!("   -> Processed and verified 10,000 signed telemetry frames in: {:?}", elapsed);
    println!("   -> Synthetic workload rate: {:.0} frames/second (build- and machine-dependent)", 10000.0 / elapsed.as_secs_f64());
    println!("\n[COMPLETE] Synthetic signing and verification example passed.");
}
