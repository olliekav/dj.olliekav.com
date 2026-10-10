import MixKit
import SwiftUI
import UIKit

@main
struct OKSessionsApp: App {
    @State private var model = AppModel.shared

    init() {
        Self.styleNavigationTitles()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .task { await model.library.refresh() }
        }
    }

    /// Titles in the rounded heavy of the artwork numbers.
    private static func styleNavigationTitles() {
        func rounded(_ style: UIFont.TextStyle, weight: UIFont.Weight) -> UIFont {
            let base = UIFont.preferredFont(forTextStyle: style)
            let font = UIFont.systemFont(ofSize: base.pointSize, weight: weight)
            guard let descriptor = font.fontDescriptor.withDesign(.rounded) else { return font }
            return UIFontMetrics(forTextStyle: style).scaledFont(for: UIFont(descriptor: descriptor, size: base.pointSize))
        }
        let appearance = UINavigationBar.appearance()
        appearance.largeTitleTextAttributes = [.font: rounded(.largeTitle, weight: .heavy)]
        appearance.titleTextAttributes = [.font: rounded(.headline, weight: .bold)]
    }
}
