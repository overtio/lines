//! Serves SF Symbols to the web view as PNGs at `sfsymbol://localhost/<name>?size=&scale=`.
//!
//! Apple's license only allows SF Symbols on Apple platforms, so they're never
//! bundled with lines: the operating system draws them on the user's device.
//! Other platforms answer 404 and the UI keeps using Lucide.

use tauri::http::{header, Request, Response, StatusCode};

pub const SCHEME: &str = "sfsymbol";

pub fn handle(request: Request<Vec<u8>>) -> Response<Vec<u8>> {
  let uri = request.uri();
  let name = uri.path().trim_start_matches('/');
  let (size, scale) = sizes(uri.query().unwrap_or_default());

  let valid = !name.is_empty() && name.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'.');
  let png = if valid { render(name, size, scale) } else { None };

  let builder = Response::builder()
    // Masks are fetched with CORS, and the page's origin differs from ours.
    .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");
  match png {
    Some(png) => builder
      .header(header::CONTENT_TYPE, "image/png")
      .header(header::CACHE_CONTROL, "max-age=31536000, immutable")
      .body(png),
    None => builder.status(StatusCode::NOT_FOUND).body(Vec::new()),
  }
  .expect("valid response")
}

/// The point size and scale a query asks for, within what's drawn. Anything else, NaN or infinity
/// among them (which AppKit aborts on), is the default.
fn sizes(query: &str) -> (f64, f64) {
  let (mut size, mut scale) = (18.0_f64, 2.0_f64);
  for pair in query.split('&') {
    let number = |value: &str| value.parse::<f64>().ok().filter(|value| value.is_finite());
    match pair.split_once('=') {
      Some(("size", value)) => size = number(value).unwrap_or(size),
      Some(("scale", value)) => scale = number(value).unwrap_or(scale),
      _ => {}
    }
  }
  (size.clamp(8.0, 96.0), scale.clamp(1.0, 4.0))
}

/// Share of the square box a symbol's visible shape fills along its longer side: what a Lucide
/// icon's artwork fills (20 of 24), so the two sets look the same size.
const EXTENT: f64 = 0.86;

/// Roughly how much of a symbol's reported size is visible shape; the rest is built-in padding.
/// Only used where we can't measure the shape itself (iOS).
const INK_SHARE: f64 = 0.8;

/// Centers a symbol of `natural` size in a `size`×`size` box at the point size that makes its
/// visible shape fill `EXTENT` of the box, estimated from the padded size.
#[cfg_attr(not(target_os = "ios"), allow(dead_code))]
fn estimated_fit(natural: (f64, f64), size: f64) -> (f64, f64, f64, f64) {
  let factor = size * EXTENT / (natural.0.max(natural.1) * INK_SHARE);
  let (w, h) = (natural.0 * factor, natural.1 * factor);
  ((size - w) / 2.0, (size - h) / 2.0, w, h)
}

/// The smallest rectangle (in pixels, from the top-left) holding every pixel with any ink.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn ink_bounds(rgba: &[u8], width: usize, height: usize, row_bytes: usize) -> Option<(usize, usize, usize, usize)> {
  let (mut left, mut top, mut right, mut bottom) = (width, height, 0, 0);
  for y in 0..height {
    for x in 0..width {
      if rgba[y * row_bytes + x * 4 + 3] > 8 {
        left = left.min(x);
        right = right.max(x);
        top = top.min(y);
        bottom = bottom.max(y);
      }
    }
  }
  (left <= right).then_some((left, top, right + 1, bottom + 1))
}

#[cfg(target_os = "macos")]
fn render(name: &str, size: f64, scale: f64) -> Option<Vec<u8>> {
  use objc2::rc::Retained;
  use objc2::AnyThread;
  use objc2_app_kit::{
    NSBitmapImageFileType, NSBitmapImageRep, NSCompositingOperation, NSDeviceRGBColorSpace, NSFontWeightRegular,
    NSGraphicsContext, NSImage, NSImageSymbolConfiguration,
  };
  use objc2_foundation::{NSDictionary, NSPoint, NSRect, NSSize, NSString};

  let base = NSImage::imageWithSystemSymbolName_accessibilityDescription(&NSString::from_str(name), None)?;
  let config = unsafe { NSImageSymbolConfiguration::configurationWithPointSize_weight(size, NSFontWeightRegular) };
  let symbol = base.imageWithSymbolConfiguration(&config)?;
  let natural = symbol.size();

  // Draws the symbol into `rect` on a `canvas`-point square bitmap. Drawing in points onto
  // `scale`× as many pixels keeps it sharp; symbols are vectors, so any rect stays crisp.
  let draw = |canvas: f64, rect: NSRect| -> Option<Retained<NSBitmapImageRep>> {
    let pixels = (canvas * scale).round() as isize;
    let rep = unsafe {
      NSBitmapImageRep::initWithBitmapDataPlanes_pixelsWide_pixelsHigh_bitsPerSample_samplesPerPixel_hasAlpha_isPlanar_colorSpaceName_bytesPerRow_bitsPerPixel(
        NSBitmapImageRep::alloc(),
        std::ptr::null_mut(),
        pixels,
        pixels,
        8,
        4,
        true,
        false,
        NSDeviceRGBColorSpace,
        0,
        0,
      )
    }?;
    rep.setSize(NSSize::new(canvas, canvas));
    let context = NSGraphicsContext::graphicsContextWithBitmapImageRep(&rep)?;
    NSGraphicsContext::saveGraphicsState_class();
    NSGraphicsContext::setCurrentContext(Some(&context));
    symbol.drawInRect_fromRect_operation_fraction(rect, NSRect::ZERO, NSCompositingOperation::SourceOver, 1.0);
    context.flushGraphics();
    NSGraphicsContext::restoreGraphicsState_class();
    Some(rep)
  };

  // 1. Draw it with room to spare and find its visible shape. Symbols come with padding of
  //    their own, which varies, so measuring the ink is the only way to size them evenly.
  let canvas = size * 2.0;
  let origin = ((canvas - natural.width) / 2.0, (canvas - natural.height) / 2.0);
  let first = draw(canvas, NSRect::new(NSPoint::new(origin.0, origin.1), natural))?;
  let pixels = (canvas * scale).round() as usize;
  let row_bytes = first.bytesPerRow() as usize;
  let data = unsafe { std::slice::from_raw_parts(first.bitmapData(), row_bytes * pixels) };
  let (left, top, right, bottom) = ink_bounds(data, pixels, pixels, row_bytes)?;
  // In points, measured from the bottom-left like AppKit's drawing.
  let ink_x = left as f64 / scale;
  let ink_y = (pixels - bottom) as f64 / scale;
  let ink_w = (right - left) as f64 / scale;
  let ink_h = (bottom - top) as f64 / scale;

  // 2. Draw it again so the shape fills EXTENT of the box, centered by its shape.
  let factor = size * EXTENT / ink_w.max(ink_h);
  let x = (size - ink_w * factor) / 2.0 - (ink_x - origin.0) * factor;
  let y = (size - ink_h * factor) / 2.0 - (ink_y - origin.1) * factor;
  let rect = NSRect::new(NSPoint::new(x, y), NSSize::new(natural.width * factor, natural.height * factor));
  let rep = draw(size, rect)?;

  let png = unsafe { rep.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new()) }?;
  Some(png.to_vec())
}

#[cfg(target_os = "ios")]
fn render(name: &str, size: f64, scale: f64) -> Option<Vec<u8>> {
  use block2::RcBlock;
  use objc2::AnyThread;
  use objc2_core_foundation::{CGPoint, CGRect, CGSize};
  use objc2_foundation::NSString;
  use objc2_ui_kit::{
    UIGraphicsImageRenderer, UIGraphicsImageRendererContext, UIGraphicsImageRendererFormat, UIImage,
    UIImageSymbolConfiguration, UIImageSymbolWeight,
  };

  let config = UIImageSymbolConfiguration::configurationWithPointSize_weight(size, UIImageSymbolWeight::Regular);
  let symbol = UIImage::systemImageNamed_withConfiguration(&NSString::from_str(name), Some(&config))?;
  let natural = unsafe { symbol.size() };
  let (x, y, w, h) = estimated_fit((natural.width, natural.height), size);

  let format = UIGraphicsImageRendererFormat::preferredFormat();
  format.setScale(scale);
  format.setOpaque(false);
  let renderer = UIGraphicsImageRenderer::initWithSize_format(UIGraphicsImageRenderer::alloc(), CGSize::new(size, size), &format);
  let draw = RcBlock::new(move |_: std::ptr::NonNull<UIGraphicsImageRendererContext>| {
    symbol.drawInRect(CGRect::new(CGPoint::new(x, y), CGSize::new(w, h)));
  });
  let image = unsafe { renderer.imageWithActions(RcBlock::as_ptr(&draw)) };
  let png = image.png_representation()?;
  Some(png.to_vec())
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
fn render(_name: &str, _size: f64, _scale: f64) -> Option<Vec<u8>> {
  None
}

#[cfg(all(test, any(target_os = "macos", target_os = "ios")))]
mod tests {
  use super::*;

  #[test]
  fn renders_symbols_as_png() {
    let png = render("trash", 18.0, 2.0).expect("trash renders");
    assert_eq!(&png[1..4], b"PNG");
    // To eyeball sizes: SF_SYMBOLS_OUT=<dir> cargo test renders_symbols
    if let Ok(dir) = std::env::var("SF_SYMBOLS_OUT") {
      for name in ["note.text", "tag", "pin", "trash", "magnifyingglass", "square.and.pencil"] {
        std::fs::write(format!("{dir}/{name}.png"), render(name, 18.0, 4.0).unwrap()).unwrap();
      }
    }
    assert!(render("not.a.real.symbol", 18.0, 2.0).is_none());
  }

  #[test]
  fn sizes_only_finite_numbers() {
    assert_eq!(sizes("size=24&scale=3"), (24.0, 3.0));
    assert_eq!(sizes("size=1000&scale=0"), (96.0, 1.0));
    for bad in ["nan", "NaN", "-nan", "inf", "-infinity", "", "x"] {
      assert_eq!(sizes(&format!("size={bad}&scale={bad}")), (18.0, 2.0), "{bad}");
    }
    let request = Request::builder().uri("sfsymbol://localhost/trash?size=nan").body(Vec::new()).unwrap();
    assert_eq!(handle(request).status(), StatusCode::OK);
  }

  #[test]
  fn rejects_bad_names() {
    let request = Request::builder().uri("sfsymbol://localhost/..%2Fetc?size=18").body(Vec::new()).unwrap();
    assert_eq!(handle(request).status(), StatusCode::NOT_FOUND);
  }
}
