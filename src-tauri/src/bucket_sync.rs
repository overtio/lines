//! Attachments to and from an S3-compatible bucket, for sync (src/lib/sync/s3.ts). The page signs
//! the request, as for a note, and this sends it with the file as bytes both ways. The HTTP plugin
//! would take the body as JSON, a number for each byte: a 50 MB file was 180 MB of text, seconds
//! to write and nearly 2 GB of memory to read.
//!
//! It goes where the plugin may (capabilities/default.json), and only gets and puts.

use std::sync::OnceLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri_plugin_http::reqwest::{self, header, Url};

use crate::folder_sync::percent_decode;

/// A bucket that doesn't connect in this long, or stops sending for the other, is given up on. A
/// transfer as a whole takes as long as it needs: a large file on a slow line takes minutes.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
const READ_TIMEOUT: Duration = Duration::from_secs(60);

/// The request as the page signed it.
#[derive(Deserialize)]
struct Signed {
  method: String,
  url: String,
  headers: Vec<(String, String)>,
}

/// Why a transfer failed: what the bucket answered (an S3 error's XML), or, without a status, why
/// it couldn't be asked.
#[derive(Debug, PartialEq, Serialize)]
pub struct Failure {
  status: Option<u16>,
  text: String,
}

impl Failure {
  fn unsent(error: impl ToString) -> Self {
    Self { status: None, text: error.to_string() }
  }
}

/// Sends the request the page signed, percent-encoded JSON in the `x-request` header, with the
/// raw request body (empty for a get). Answers the bucket's response body as it is.
#[tauri::command]
pub async fn sync_bucket_transfer(request: Request<'_>) -> Result<Response, Failure> {
  let signed = request
    .headers()
    .get("x-request")
    .and_then(|value| value.to_str().ok())
    .and_then(percent_decode)
    .ok_or_else(|| Failure::unsent("Missing request"))?;
  let signed = serde_json::from_str(&signed).map_err(Failure::unsent)?;
  transfer(client(), signed, file(request.body())?).await.map(Response::new)
}

/// The file in the request body: its bytes, or from Android, where Tauri's IPC sends every body as
/// JSON, a number for each.
fn file(body: &InvokeBody) -> Result<Vec<u8>, Failure> {
  match body {
    // Copied: Tauri only lends a command its body, and the request needs one of its own.
    InvokeBody::Raw(bytes) => Ok(bytes.clone()),
    InvokeBody::Json(numbers) => Vec::deserialize(numbers).map_err(Failure::unsent),
  }
}

async fn transfer(client: &reqwest::Client, signed: Signed, file: Vec<u8>) -> Result<Vec<u8>, Failure> {
  let url = Url::parse(&signed.url).map_err(Failure::unsent)?;
  if !reachable(&url) {
    return Err(Failure::unsent(format!("Not a bucket lines may reach: {url}")));
  }
  let mut headers = header::HeaderMap::new();
  for (name, value) in &signed.headers {
    let name = header::HeaderName::from_bytes(name.as_bytes()).map_err(Failure::unsent)?;
    headers.append(name, header::HeaderValue::from_str(value).map_err(Failure::unsent)?);
  }
  let request = match signed.method.as_str() {
    "GET" => client.get(url),
    // Its length even when that's 0: a bucket needs it, and hyper would leave it out.
    "PUT" => client.put(url).header(header::CONTENT_LENGTH, file.len()).body(file),
    method => return Err(Failure::unsent(format!("Not a transfer: {method}"))),
  };
  let response = request.headers(headers).send().await.map_err(Failure::unsent)?;
  let status = response.status();
  let body = response.bytes().await.map_err(Failure::unsent)?;
  if status.is_success() {
    Ok(body.into())
  } else {
    Err(Failure { status: Some(status.as_u16()), text: String::from_utf8_lossy(&body).into_owned() })
  }
}

/// Anywhere over https, and over http only on this device (a bucket served here, such as MinIO).
fn reachable(url: &Url) -> bool {
  match url.scheme() {
    "https" => true,
    "http" => matches!(url.host_str(), Some("localhost" | "127.0.0.1")),
    _ => false,
  }
}

/// One client, so transfers share connections. It doesn't follow redirects: a signed request is
/// good only where it was signed for.
fn client() -> &'static reqwest::Client {
  static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
  CLIENT.get_or_init(|| client_waiting(READ_TIMEOUT))
}

/// A client that waits `read` at most for each next bytes from the bucket.
fn client_waiting(read: Duration) -> reqwest::Client {
  reqwest::Client::builder()
    .connect_timeout(CONNECT_TIMEOUT)
    .read_timeout(read)
    .redirect(reqwest::redirect::Policy::none())
    .build()
    .expect("couldn't make an HTTP client")
}

#[cfg(test)]
mod tests {
  use std::io::{BufRead, BufReader, Read, Write};
  use std::net::TcpListener;
  use std::thread::JoinHandle;

  use tauri::async_runtime::block_on;

  use super::*;

  /// What a bucket was sent: the request line and headers, and the body.
  struct Sent {
    head: String,
    body: Vec<u8>,
  }

  /// A bucket on this device that answers one request with `status` and `body`, and its address.
  fn bucket(status: &'static str, body: Vec<u8>) -> (String, JoinHandle<Sent>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://127.0.0.1:{}/notes/attachments/", listener.local_addr().unwrap().port());
    let answer = std::thread::spawn(move || {
      let (mut stream, _) = listener.accept().unwrap();
      let mut reader = BufReader::new(stream.try_clone().unwrap());
      let mut head = String::new();
      while !head.ends_with("\r\n\r\n") {
        reader.read_line(&mut head).unwrap();
      }
      let length = head
        .lines()
        .find_map(|line| line.to_ascii_lowercase().strip_prefix("content-length: ").map(|n| n.parse().unwrap()))
        .unwrap_or(0);
      let mut sent = vec![0; length];
      reader.read_exact(&mut sent).unwrap();
      write!(stream, "HTTP/1.1 {status}\r\ncontent-length: {}\r\nconnection: close\r\n\r\n", body.len()).unwrap();
      stream.write_all(&body).unwrap();
      Sent { head, body: sent }
    });
    (url, answer)
  }

  fn signed(method: &str, url: &str) -> Signed {
    let headers = [("authorization", "AWS4-HMAC-SHA256 Credential=key/20261113/auto/s3/aws4_request"), ("x-amz-date", "20261113T120000Z")];
    Signed { method: method.into(), url: url.into(), headers: headers.map(|(name, value)| (name.into(), value.into())).into() }
  }

  /// Sends a signed request as the command does.
  fn send(method: &str, url: &str, file: Vec<u8>) -> Result<Vec<u8>, Failure> {
    block_on(transfer(client(), signed(method, url), file))
  }

  /// Every byte value, a few megabytes of them.
  fn photo() -> Vec<u8> {
    (0..3_000_000).map(|i| (i % 251) as u8).collect()
  }

  #[test]
  fn puts_a_file_as_it_is() {
    let (url, bucket) = bucket("200 OK", Vec::new());
    assert_eq!(send("PUT", &format!("{url}a.png"), photo()), Ok(Vec::new()));
    let sent = bucket.join().unwrap();
    assert!(sent.head.starts_with("PUT /notes/attachments/a.png HTTP/1.1\r\n"), "{}", sent.head);
    assert!(sent.head.contains("\r\nauthorization: AWS4-HMAC-SHA256 Credential=key/20261113/auto/s3/aws4_request\r\n"));
    assert!(sent.head.contains("\r\nx-amz-date: 20261113T120000Z\r\n"));
    assert_eq!(sent.head.matches("content-length: ").count(), 1);
    assert!(sent.body == photo());
  }

  #[test]
  fn an_empty_file_is_put_with_its_length() {
    let (url, bucket) = bucket("200 OK", Vec::new());
    assert_eq!(send("PUT", &format!("{url}a.txt"), Vec::new()), Ok(Vec::new()));
    assert!(bucket.join().unwrap().head.contains("\r\ncontent-length: 0\r\n"));
  }

  #[test]
  fn gets_a_file_as_it_is() {
    let (url, bucket) = bucket("200 OK", photo());
    assert!(send("GET", &format!("{url}a.png"), Vec::new()) == Ok(photo()));
    assert!(bucket.join().unwrap().head.starts_with("GET /notes/attachments/a.png HTTP/1.1\r\n"));
  }

  #[test]
  fn says_what_the_bucket_answered() {
    let error = "<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>";
    let (url, bucket) = bucket("403 Forbidden", error.into());
    let failure = Failure { status: Some(403), text: error.into() };
    assert_eq!(send("GET", &format!("{url}a.png"), Vec::new()), Err(failure));
    bucket.join().unwrap();
  }

  #[test]
  fn gives_up_on_a_bucket_that_stops_sending() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://127.0.0.1:{}/notes/attachments/a.png", listener.local_addr().unwrap().port());
    // The start of a file, and then nothing, the connection still open.
    std::thread::spawn(move || {
      let (mut stream, _) = listener.accept().unwrap();
      let mut reader = BufReader::new(stream.try_clone().unwrap());
      let mut line = String::new();
      while line != "\r\n" {
        line.clear();
        reader.read_line(&mut line).unwrap();
      }
      stream.write_all(b"HTTP/1.1 200 OK\r\ncontent-length: 1000\r\n\r\n0123456789").unwrap();
      std::thread::sleep(Duration::from_secs(10));
    });
    let started = std::time::Instant::now();
    let failure = block_on(transfer(&client_waiting(Duration::from_millis(200)), signed("GET", &url), Vec::new()));
    assert_eq!(failure.unwrap_err().status, None);
    assert!(started.elapsed() < Duration::from_secs(2), "{:?}", started.elapsed());
  }

  #[test]
  fn goes_only_where_the_http_plugin_may() {
    for url in ["https://s3.us-west-004.backblazeb2.com/notes", "http://127.0.0.1:9000/notes", "http://localhost:9000/notes"] {
      assert!(reachable(&Url::parse(url).unwrap()), "{url}");
    }
    for url in ["http://s3.example.com/notes", "http://192.168.1.2:9000/notes", "file:///etc/hosts", "ftp://example.com/notes"] {
      assert!(!reachable(&Url::parse(url).unwrap()), "{url}");
      assert_eq!(send("GET", url, Vec::new()).unwrap_err().status, None);
    }
    let deleted = send("DELETE", "https://s3.example.com/notes/attachments/a.png", Vec::new());
    assert_eq!(deleted, Err(Failure::unsent("Not a transfer: DELETE")));
  }

  #[test]
  fn reads_the_file_as_android_sends_it() {
    assert_eq!(file(&InvokeBody::Raw(vec![0, 7, 255])), Ok(vec![0, 7, 255]));
    assert_eq!(file(&InvokeBody::Json(serde_json::json!([0, 7, 255]))), Ok(vec![0, 7, 255]));
    assert_eq!(file(&InvokeBody::Json(serde_json::json!([]))), Ok(Vec::new()));
  }
}
