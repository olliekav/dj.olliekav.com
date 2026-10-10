// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "OKSessionsKit",
    // macOS so the tests run with `swift test`, without a simulator
    platforms: [.iOS(.v26), .macOS(.v26)],
    products: [
        .library(name: "MixKit", targets: ["MixKit"]),
        .library(name: "PlayerKit", targets: ["PlayerKit"])
    ],
    targets: [
        .target(name: "MixKit"),
        .target(name: "PlayerKit", dependencies: ["MixKit"]),
        .testTarget(name: "MixKitTests", dependencies: ["MixKit"]),
        .testTarget(name: "PlayerKitTests", dependencies: ["PlayerKit"])
    ]
)
