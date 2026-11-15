// Generates the Thanary favicon set (macOS only). Run with:
//   swift scripts/make-favicon.swift
//
//   renderer/assets/favicon-*.png   used by the browser UI (Start Page tab, tab overview)
//   build/favicon/                  the same PNGs plus favicon.ico and favicon.svg for a website
//
// Design: a bold italic T, slanted like the THA wordmark, followed by a blue square (a full
// stop: "T."), white and blue on near-black. Flat and simple so it stays sharp at 16 px.
import AppKit

let root = URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent().deletingLastPathComponent()
let sizes = [16, 32, 48, 64, 180]
let background = (r: 0.043, g: 0.043, b: 0.051) // #0b0b0d
let accent = (r: 0.039, g: 0.518, b: 1.0)       // #0a84ff

// Shapes are described in a 100 x 100 box (y points down). The slant shifts higher points to
// the right; the constant moves the whole mark left so it sits optically centred.
func slant(_ x: Double, _ y: Double) -> (Double, Double) { (x + (80 - y) * 0.2 - 11, y) }
let tShape: [(Double, Double)] = [(22, 22), (80, 22), (80, 37), (57, 37), (57, 80), (41, 80), (41, 37), (22, 37)]
let dotShape: [(Double, Double)] = [(71, 66), (87, 66), (87, 80), (71, 80)]

func points(_ shape: [(Double, Double)], scale: Double, height: Double) -> [CGPoint] {
    shape.map { p in
        let q = slant(p.0, p.1)
        return CGPoint(x: q.0 * scale, y: height - q.1 * scale) // flip: CoreGraphics y points up
    }
}

func render(_ size: Int) -> Data {
    let s = Double(size)
    let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                        space: CGColorSpaceCreateDeviceRGB(),
                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.interpolationQuality = .high
    ctx.setShouldAntialias(true)
    let tile = CGRect(x: 0, y: 0, width: s, height: s)
    let radius = s * 0.22
    ctx.addPath(CGPath(roundedRect: tile, cornerWidth: radius, cornerHeight: radius, transform: nil))
    ctx.clip()
    ctx.setFillColor(CGColor(red: background.r, green: background.g, blue: background.b, alpha: 1))
    ctx.fill(tile)

    func fill(_ shape: [(Double, Double)], _ c: CGColor) {
        let pts = points(shape, scale: s / 100, height: s)
        ctx.beginPath()
        ctx.move(to: pts[0])
        for p in pts.dropFirst() { ctx.addLine(to: p) }
        ctx.closePath()
        ctx.setFillColor(c)
        ctx.fillPath()
    }
    fill(tShape, CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    fill(dotShape, CGColor(red: accent.r, green: accent.g, blue: accent.b, alpha: 1))
    return NSBitmapImageRep(cgImage: ctx.makeImage()!).representation(using: .png, properties: [:])!
}

let fm = FileManager.default
let dirs = [root.appendingPathComponent("renderer/assets"), root.appendingPathComponent("build/favicon")]
for d in dirs { try? fm.createDirectory(at: d, withIntermediateDirectories: true) }

var icoImages: [(Int, Data)] = []
for size in sizes {
    let png = render(size)
    for d in dirs { try! png.write(to: d.appendingPathComponent("favicon-\(size).png")) }
    if size <= 48 { icoImages.append((size, png)) }
}

// A .ico can hold PNG images directly: a small header, one entry per size, then the data.
func le16(_ v: Int) -> [UInt8] { [UInt8(v & 255), UInt8((v >> 8) & 255)] }
func le32(_ v: Int) -> [UInt8] { le16(v & 0xffff) + le16((v >> 16) & 0xffff) }
var ico = Data([0, 0, 1, 0] + le16(icoImages.count))
var offset = 6 + icoImages.count * 16
for (size, png) in icoImages {
    ico.append(contentsOf: [UInt8(size), UInt8(size), 0, 0] + le16(1) + le16(32) + le32(png.count) + le32(offset))
    offset += png.count
}
for (_, png) in icoImages { ico.append(png) }
try! ico.write(to: root.appendingPathComponent("build/favicon/favicon.ico"))

// The same design as a vector, for websites.
func svgPath(_ shape: [(Double, Double)]) -> String {
    shape.enumerated().map { i, p in
        let q = slant(p.0, p.1)
        return String(format: "%@%.2f %.2f", i == 0 ? "M" : "L", q.0 * 5.12, q.1 * 5.12)
    }.joined(separator: " ") + " Z"
}
let svg = """
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="113" fill="#0b0b0d"/>
  <path d="\(svgPath(tShape))" fill="#ffffff"/>
  <path d="\(svgPath(dotShape))" fill="#0a84ff"/>
</svg>
"""
try! svg.write(to: root.appendingPathComponent("build/favicon/favicon.svg"), atomically: true, encoding: .utf8)
print("Wrote favicons to renderer/assets and build/favicon")
