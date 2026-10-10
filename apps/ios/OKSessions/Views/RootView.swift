import MixKit
import SwiftUI

/// The sessions grid (#1 first) with a pull-down search, and a floating mini player.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @Namespace private var transition
    @State private var query = ""

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            LibraryContent(mixes: model.library.search(query), isSearching: !query.isEmpty)
                .navigationTitle("OK Sessions")
                .searchable(text: $query, placement: .navigationBarDrawer, prompt: "Number, title or genre")
        }
        .safeAreaInset(edge: .bottom) {
            if model.player.current != nil {
                MiniPlayer { model.isPlayerPresented = true }
                    .matchedTransitionSource(id: "player", in: transition)
                    .padding(.horizontal)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.4), value: model.player.current != nil)
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
    let isSearching: Bool

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
            case .loaded where mixes.isEmpty && isSearching:
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
