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
        // The fixture is a symlink to shared/fixtures/mixes.json, copied into the test bundle
        // so the tests don't need the repo when they run (Xcode Cloud tests on another machine)
        .testTarget(name: "MixKitTests", dependencies: ["MixKit"], resources: [.process("Resources")]),
        .testTarget(name: "PlayerKitTests", dependencies: ["PlayerKit"])
    ]
)
