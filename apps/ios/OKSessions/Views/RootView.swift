import MixKit
import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Namespace private var transition
    @State private var query = ""

    var body: some View {
        @Bindable var model = model
        TabView {
            Tab("Sessions", systemImage: "square.grid.2x2.fill") {
                NavigationStack {
                    LibraryContent(mixes: model.library.latestFirst)
                        .navigationTitle("OK Sessions")
                }
            }
            Tab(role: .search) {
                NavigationStack {
                    LibraryContent(mixes: model.library.search(query))
                        .navigationTitle("Search")
                        .searchable(text: $query, prompt: "Number, title or genre")
                }
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .tabViewBottomAccessory(isEnabled: model.player.current != nil) {
            MiniPlayer()
                .matchedTransitionSource(id: "player", in: transition)
                .onTapGesture { model.isPlayerPresented = true }
        }
        .fullScreenCover(isPresented: $model.isPlayerPresented) {
            PlayerView()
                .navigationTransition(.zoom(sourceID: "player", in: transition))
        }
        .tint(model.player.current?.theme.accentColor ?? .primary)
    }
}

/// The grid with loading, empty and error states.
private struct LibraryContent: View {
    @Environment(AppModel.self) private var model
    let mixes: [Mix]

    var body: some View {
        ScrollView {
            MixGridView(mixes: mixes)
        }
        .refreshable { await model.library.refresh() }
        .overlay {
            switch model.library.state {
            case .loading where mixes.isEmpty:
                ProgressView()
            case .failed(let message) where mixes.isEmpty:
                ContentUnavailableView {
                    Label("Couldn't load the mixes", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try Again") { Task { await model.library.refresh() } }
                        .buttonStyle(.glass)
                }
            case .loaded where mixes.isEmpty:
                ContentUnavailableView.search
            default:
                EmptyView()
            }
        }
    }
}

#Preview {
    RootView()
        .environment(AppModel.shared)
}
