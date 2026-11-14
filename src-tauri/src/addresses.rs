//! Whether a site's name stands only for addresses on the web at large, which src/lib/outside.ts
//! asks before it follows an address something on the web gave (a feed, a page, a picture): so a
//! name such as `127.0.0.1.nip.io` can't lead the app to this computer or the network it's on,
//! which web pages can't reach but the app can.

use std::net::{IpAddr, Ipv4Addr, ToSocketAddrs};

/// Whether every address `host` stands for is on the web at large. One that can't be looked up is
/// let be: asking it fails just as it would.
#[tauri::command]
pub async fn host_is_public(host: String) -> bool {
  tauri::async_runtime::spawn_blocking(move || resolves_publicly(&host)).await.unwrap_or(false)
}

/// The system's answer for `host`, every address of it public; true where it has none.
fn resolves_publicly(host: &str) -> bool {
  match (host.trim_start_matches('[').trim_end_matches(']'), 443).to_socket_addrs() {
    Ok(addresses) => addresses.map(|address| address.ip()).all(is_public),
    Err(_) => true,
  }
}

/// Whether an address is on the web at large: not this computer, its network, a link's own, shared
/// by a carrier, or one kept for something else (documentation, broadcasts, groups).
pub fn is_public(ip: IpAddr) -> bool {
  match ip {
    IpAddr::V4(v4) => is_public_v4(v4),
    IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
      Some(v4) => is_public_v4(v4),
      None => !(v6.is_loopback() || v6.is_unspecified() || v6.is_unique_local() || v6.is_unicast_link_local() || v6.is_multicast()),
    },
  }
}

fn is_public_v4(v4: Ipv4Addr) -> bool {
  let [a, b, ..] = v4.octets();
  // 0.0.0.0/8 is "this network", and 100.64.0.0/10 a carrier's, shared by those behind it.
  let this_network = a == 0;
  let shared = a == 100 && (b & 0xc0) == 64;
  !(this_network || shared || v4.is_private() || v4.is_loopback() || v4.is_link_local() || v4.is_broadcast() || v4.is_documentation() || v4.is_multicast())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn on_the_web_at_large_or_not() {
    for public in ["8.8.8.8", "93.184.215.14", "172.32.0.1", "100.128.0.1", "2606:4700:4700::1111"] {
      assert!(is_public(public.parse().unwrap()), "{public}");
    }
    for local in [
      "127.0.0.1",
      "10.0.0.2",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "255.255.255.255",
      "::1",
      "::",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:192.168.1.1",
    ] {
      assert!(!is_public(local.parse().unwrap()), "{local}");
    }
  }

  #[test]
  fn names_for_this_computer_arent() {
    // Answered by the system's own hosts file, not the network.
    assert!(!resolves_publicly("localhost"));
    assert!(!resolves_publicly("127.0.0.1"));
    assert!(!resolves_publicly("[::1]"));
  }
}
