import MixKit
import SwiftUI
import UIKit

@main
struct OKSessionsApp: App {
    @UIApplicationDelegateAdaptor private var delegate: AppDelegate
    @State private var model = AppModel.shared
    @Environment(\.scenePhase) private var scenePhase

    init() {
        Self.styleNavigationTitles()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .task { await model.library.refresh() }
                // Catch up with notification settings changed while away
                .onChange(of: scenePhase, initial: true) { _, phase in
                    if phase == .active { Task { await model.alerts.refresh() } }
                }
                #if DEBUG
                .task { Self.rotateIfAsked() }
                .task { await openMixIfAsked() }
                #endif
        }
    }

    #if DEBUG
    /// `-open-mix <number>` opens a mix as tapping its notification does, for UI tests.
    private func openMixIfAsked() async {
        let number = UserDefaults.standard.integer(forKey: "open-mix")
        if number > 0 { await model.openMix(number: number) }
    }

    /// `-landscape` or `-portrait` turns the app at launch, for checking layouts in a headless simulator.
    private static func rotateIfAsked() {
        let arguments = CommandLine.arguments
        let orientations: UIInterfaceOrientationMask? =
            arguments.contains("-landscape") ? .landscapeRight : arguments.contains("-portrait") ? .portrait : nil
        guard let orientations,
              let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first
        else { return }
        scene.requestGeometryUpdate(.iOS(interfaceOrientations: orientations))
    }
    #endif

    /// Titles in SF Rounded, on a transparent bar.
    private static func styleNavigationTitles() {
        func rounded(_ style: UIFont.TextStyle, weight: UIFont.Weight) -> UIFont {
            let base = UIFont.preferredFont(forTextStyle: style)
            let font = UIFont.systemFont(ofSize: base.pointSize, weight: weight)
            guard let descriptor = font.fontDescriptor.withDesign(.rounded) else { return font }
            return UIFontMetrics(forTextStyle: style).scaledFont(for: UIFont(descriptor: descriptor, size: base.pointSize))
        }
        // Transparent, so scrolled content gets only the soft edge fade rather than a bar.
        // Set here with the fonts: hiding the bar from SwiftUI replaces the whole appearance
        let appearance = UINavigationBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.largeTitleTextAttributes = [.font: rounded(.largeTitle, weight: .bold)]
        appearance.titleTextAttributes = [.font: rounded(.headline, weight: .semibold)]
        let bar = UINavigationBar.appearance()
        bar.standardAppearance = appearance
        bar.scrollEdgeAppearance = appearance
        bar.compactAppearance = appearance
    }
}
