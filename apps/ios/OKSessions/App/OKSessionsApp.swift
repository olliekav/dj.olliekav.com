import MixKit
import SwiftUI

@main
struct OKSessionsApp: App {
    @State private var model = AppModel.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .task { await model.library.refresh() }
        }
    }
}
