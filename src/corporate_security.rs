use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// Experimental process-policy evaluation for local security/audit workflows.
/// Designed as an experimental policy-evaluation and audit-event prototype.
/// It does not provide or certify SOC 2 compliance.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ZeroTrustPolicy {
    pub policy_id: String,
    pub name: String,
    pub allowed_binary_hashes: Vec<String>,
    pub disallowed_parent_processes: Vec<String>,
    pub enforcement_mode: EnforcementMode,
    pub min_risk_score_alert_threshold: u32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum EnforcementMode {
    AuditOnly,
    Quarantine,
    Block,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Verdict {
    Allow,
    Flagged,
    Quarantine,
    Deny,
}

/// Structured audit event record; not a SOC 2 compliance assertion.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SecurityAuditEvent {
    pub event_id: String,
    pub timestamp_epoch_ms: u64,
    pub actor_id: String,
    pub process_name: String,
    pub process_id: u32,
    pub binary_hash: String,
    pub parent_process_name: Option<String>,
    pub verdict: Verdict,
    pub risk_score: u32,
    pub reason: String,
    pub policy_id: String,
    pub signature: String,
}

/// Computes a standard FIPS 180-4 SHA-256 digest in pure, safe Rust.
pub fn compute_sha256(data: &[u8]) -> [u8; 32] {
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];

    let k: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
        0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
        0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
        0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
        0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    let bit_len = (data.len() as u64).wrapping_mul(8);
    let mut msg = data.to_vec();
    msg.push(0x80);
    while (msg.len() % 64) != 56 {
        msg.push(0x00);
    }
    msg.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in msg.chunks_exact(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                chunk[i * 4],
                chunk[i * 4 + 1],
                chunk[i * 4 + 2],
                chunk[i * 4 + 3],
            ]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }

        let mut a = h[0];
        let mut b = h[1];
        let mut c = h[2];
        let mut d = h[3];
        let mut e = h[4];
        let mut f = h[5];
        let mut g = h[6];
        let mut hh = h[7];

        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh.wrapping_add(s1).wrapping_add(ch).wrapping_add(k[i]).wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);

            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }

        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }

    let mut out = [0u8; 32];
    for (i, val) in h.iter().enumerate() {
        out[i * 4..i * 4 + 4].copy_from_slice(&val.to_be_bytes());
    }
    out
}

pub fn hash_to_hex(hash: &[u8; 32]) -> String {
    hash.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Compute a standard HMAC-SHA-256 message authentication code.
pub fn compute_hmac_sha256(key: &[u8], data: &[u8]) -> [u8; 32] {
    let mut mac = HmacSha256::new_from_slice(key)
        .expect("HMAC-SHA-256 accepts keys of any length");
    mac.update(data);
    let tag = mac.finalize().into_bytes();
    let mut out = [0u8; 32];
    out.copy_from_slice(&tag);
    out
}

fn hex_nibble(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

/// Verify a hex-encoded HMAC-SHA-256 tag using the crate's constant-time tag check.
pub fn verify_hmac_sha256_hex(key: &[u8], data: &[u8], signature_hex: &str) -> bool {
    let encoded = signature_hex.as_bytes();
    if encoded.len() != 64 {
        return false;
    }

    let mut signature = [0u8; 32];
    for (index, out) in signature.iter_mut().enumerate() {
        let Some(high) = hex_nibble(encoded[index * 2]) else {
            return false;
        };
        let Some(low) = hex_nibble(encoded[index * 2 + 1]) else {
            return false;
        };
        *out = (high << 4) | low;
    }

    let Ok(mut mac) = HmacSha256::new_from_slice(key) else {
        return false;
    };
    mac.update(data);
    mac.verify_slice(&signature).is_ok()
}

#[derive(Serialize)]
struct SecurityAuditEventPayload<'a> {
    event_id: &'a str,
    timestamp_epoch_ms: u64,
    actor_id: &'a str,
    process_name: &'a str,
    process_id: u32,
    binary_hash: &'a str,
    parent_process_name: Option<&'a str>,
    verdict: Verdict,
    risk_score: u32,
    reason: &'a str,
    policy_id: &'a str,
}

fn audit_event_payload(event: &SecurityAuditEvent) -> Vec<u8> {
    let payload = SecurityAuditEventPayload {
        event_id: &event.event_id,
        timestamp_epoch_ms: event.timestamp_epoch_ms,
        actor_id: &event.actor_id,
        process_name: &event.process_name,
        process_id: event.process_id,
        binary_hash: &event.binary_hash,
        parent_process_name: event.parent_process_name.as_deref(),
        verdict: event.verdict,
        risk_score: event.risk_score,
        reason: &event.reason,
        policy_id: &event.policy_id,
    };
    serde_json::to_vec(&payload).expect("serializing audit event fields cannot fail")
}

pub struct ZeroTrustAuditor {
    policy: ZeroTrustPolicy,
    signing_secret: String,
}

impl ZeroTrustAuditor {
    pub fn new(policy: ZeroTrustPolicy, signing_secret: &str) -> Self {
        Self {
            policy,
            signing_secret: signing_secret.to_string(),
        }
    }

    /// Evaluates a process execution context against the Zero-Trust policy.
    pub fn audit_process(
        &self,
        event_id: &str,
        timestamp_epoch_ms: u64,
        actor_id: &str,
        process_name: &str,
        process_id: u32,
        binary_bytes: &[u8],
        parent_process_name: Option<&str>,
    ) -> SecurityAuditEvent {
        let binary_hash = hash_to_hex(&compute_sha256(binary_bytes));
        let mut risk_score = 0u32;
        let mut reasons = Vec::new();

        // Rule 1: Binary Hash Verification
        let hash_match = self.policy.allowed_binary_hashes.iter().any(|h| h.eq_ignore_ascii_case(&binary_hash));
        if !hash_match {
            risk_score += 60;
            reasons.push(format!("Binary hash {} not in allowed manifest", binary_hash));
        }

        // Rule 2: Parent Process Security Verification
        if let Some(parent) = parent_process_name {
            let parent_lower = parent.to_lowercase();
            for disallowed in &self.policy.disallowed_parent_processes {
                if parent_lower.contains(&disallowed.to_lowercase()) {
                    risk_score += 40;
                    reasons.push(format!("Disallowed parent process detected: {}", parent));
                    break;
                }
            }
        }

        // Verdict Determination
        let verdict = if risk_score == 0 {
            Verdict::Allow
        } else if risk_score >= self.policy.min_risk_score_alert_threshold {
            match self.policy.enforcement_mode {
                EnforcementMode::AuditOnly => Verdict::Flagged,
                EnforcementMode::Quarantine => Verdict::Quarantine,
                EnforcementMode::Block => Verdict::Deny,
            }
        } else {
            Verdict::Flagged
        };

        let reason_text = if reasons.is_empty() {
            "Verified compliant with zero-trust security manifest".to_string()
        } else {
            reasons.join(" | ")
        };

        let mut event = SecurityAuditEvent {
            event_id: event_id.to_string(),
            timestamp_epoch_ms,
            actor_id: actor_id.to_string(),
            process_name: process_name.to_string(),
            process_id,
            binary_hash,
            parent_process_name: parent_process_name.map(|s| s.to_string()),
            verdict,
            risk_score,
            reason: reason_text,
            policy_id: self.policy.policy_id.clone(),
            signature: String::new(),
        };
        event.signature = self.sign_event(&event);
        event
    }

    fn sign_event(&self, event: &SecurityAuditEvent) -> String {
        let payload = audit_event_payload(event);
        hash_to_hex(&compute_hmac_sha256(self.signing_secret.as_bytes(), &payload))
    }

    /// Verifies the event's HMAC over all serialized event fields except the signature.
    pub fn verify_signature(&self, event: &SecurityAuditEvent) -> bool {
        verify_hmac_sha256_hex(
            self.signing_secret.as_bytes(),
            &audit_event_payload(event),
            &event.signature,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hmac_sha256_matches_rfc4231_case_1() {
        let key = [0x0bu8; 20];
        let tag = compute_hmac_sha256(&key, b"Hi There");
        assert_eq!(
            hash_to_hex(&tag),
            "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7"
        );
    }

    #[test]
    fn test_sha256_known_vector() {
        // Known NIST vector: "abc" -> ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
        let hash = compute_sha256(b"abc");
        let hex = hash_to_hex(&hash);
        assert_eq!(hex, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    #[test]
    fn test_zero_trust_auditor_allow() {
        let sample_binary = b"valid_cockroach_database_binary_content_v1";
        let valid_hash = hash_to_hex(&compute_sha256(sample_binary));

        let policy = ZeroTrustPolicy {
            policy_id: "POL-SEC-001".into(),
            name: "Default Corporate Production Zero-Trust".into(),
            allowed_binary_hashes: vec![valid_hash.clone()],
            disallowed_parent_processes: vec!["cmd.exe".into(), "powershell.exe".into()],
            enforcement_mode: EnforcementMode::Block,
            min_risk_score_alert_threshold: 50,
        };

        let auditor = ZeroTrustAuditor::new(policy, "enterprise_audit_secret_key_9988");
        let event = auditor.audit_process(
            "EVT-9001",
            1760600000000,
            "cockroach-operator-01",
            "cockroach.exe",
            1244,
            sample_binary,
            Some("services.exe"),
        );

        assert_eq!(event.verdict, Verdict::Allow);
        assert_eq!(event.risk_score, 0);
        assert!(auditor.verify_signature(&event));
        let mut tampered = event.clone();
        tampered.actor_id.push_str("-modified");
        assert!(!auditor.verify_signature(&tampered));
    }

    #[test]
    fn test_zero_trust_auditor_block_unauthorized_hash() {
        let sample_binary = b"valid_cockroach_database_binary_content_v1";
        let rogue_binary = b"tampered_binary_with_backdoor";
        let valid_hash = hash_to_hex(&compute_sha256(sample_binary));

        let policy = ZeroTrustPolicy {
            policy_id: "POL-SEC-001".into(),
            name: "Default Corporate Production Zero-Trust".into(),
            allowed_binary_hashes: vec![valid_hash],
            disallowed_parent_processes: vec!["cmd.exe".into()],
            enforcement_mode: EnforcementMode::Block,
            min_risk_score_alert_threshold: 50,
        };

        let auditor = ZeroTrustAuditor::new(policy, "enterprise_audit_secret_key_9988");
        let event = auditor.audit_process(
            "EVT-9002",
            1760600001000,
            "untrusted_actor",
            "malicious.exe",
            4092,
            rogue_binary,
            Some("cmd.exe"),
        );

        assert_eq!(event.verdict, Verdict::Deny);
        assert_eq!(event.risk_score, 100); // 60 for hash mismatch + 40 for cmd.exe parent
        assert!(auditor.verify_signature(&event));
    }

    #[test]
    fn test_audit_event_json_roundtrip() {
        let sample_binary = b"binary_data";
        let hash = hash_to_hex(&compute_sha256(sample_binary));
        let policy = ZeroTrustPolicy {
            policy_id: "POL-AUDIT-001".into(),
            name: "Sample Audit Policy".into(),
            allowed_binary_hashes: vec![hash],
            disallowed_parent_processes: vec![],
            enforcement_mode: EnforcementMode::AuditOnly,
            min_risk_score_alert_threshold: 30,
        };

        let auditor = ZeroTrustAuditor::new(policy, "test_secret");
        let event = auditor.audit_process(
            "EVT-SOC2-881",
            1760600002000,
            "security-auditor",
            "agent.exe",
            812,
            sample_binary,
            None,
        );

        let json_repr = serde_json::to_string_pretty(&event).expect("Serialization failed");
        assert!(json_repr.contains("\"verdict\": \"Allow\""));
        assert!(json_repr.contains("\"policy_id\": \"POL-AUDIT-001\""));

        let deserialized: SecurityAuditEvent = serde_json::from_str(&json_repr).expect("Deserialization failed");
        assert_eq!(deserialized, event);
    }
}
