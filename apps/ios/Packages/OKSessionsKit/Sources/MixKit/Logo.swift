import SwiftUI

/// The OK logo (ring and chevron), on a 1024-unit canvas like the artwork.
public enum Logo {
    public static let canvas: CGFloat = 1024

    static let ringData =
        "M512 962C263.87 962 62 760.13 62 512C62 263.87 263.87 62 512 62C760.13 62 962 263.87 962 512C962 760.13 760.13 962 512 962ZM512 154.44C314.84 154.44 154.44 314.84 154.44 512C154.44 709.16 314.84 869.56 512 869.56C709.16 869.56 869.56 709.16 869.56 512C869.56 314.84 709.16 154.44 512 154.44Z"
    static let chevronData =
        "M511.26 715.481C499.43 715.481 487.6 710.971 478.58 701.941L321.32 544.681C312.65 536.011 307.78 524.261 307.78 512.001C307.78 499.741 312.65 487.981 321.32 479.321L478.58 322.061C496.63 304.011 525.89 304.011 543.95 322.061C562 340.111 562 369.381 543.95 387.431L419.37 512.011L543.95 636.591C562 654.641 562 683.911 543.95 701.961C534.93 710.981 523.09 715.501 511.27 715.501L511.26 715.481Z"

    /// Ring and chevron as one path in canvas units. Immutable once built, so safe to share.
    nonisolated(unsafe) public static let path: CGPath = {
        let path = CGMutablePath()
        // The path data is constant and covered by tests
        for data in [ringData, chevronData] {
            path.addPath(SVGPath.cgPath((try? SVGPath.parse(data)) ?? []))
        }
        return path
    }()

    /// Where "#<number>" sits on the canvas: left edge and baseline, and its size.
    public static let numberOrigin = CGPoint(x: 497, y: 558.5)
    public static let numberSize: CGFloat = 140
}

/// The logo scaled to fill its frame (keep it square).
public struct LogoShape: Shape {
    public init() {}

    public func path(in rect: CGRect) -> Path {
        let scale = min(rect.width, rect.height) / Logo.canvas
        let transform = CGAffineTransform(translationX: rect.minX, y: rect.minY).scaledBy(x: scale, y: scale)
        return Path(Logo.path).applying(transform)
    }
}
