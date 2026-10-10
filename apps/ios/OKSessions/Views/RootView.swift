import MixKit
import SwiftUI

/// The sessions grid (#1 first) with a pull-down search, and a floating mini player.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @Namespace private var transition
    @State private var query = ""
    @State private var isSearching = false

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            LibraryContent(mixes: model.library.search(query), isSearching: !query.isEmpty, transition: transition)
                .navigationTitle("OK Sessions")
                // No bar behind the title when scrolled, just the soft fade at the top edge
                .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
                .toolbar(isSearching ? .hidden : .visible, for: .navigationBar)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Search", systemImage: "magnifyingglass") {
                            withAnimation(.spring(duration: 0.35)) { isSearching = true }
                        }
                        .accessibilityIdentifier("search-button")
                    }
                }
                .overlay(alignment: .top) {
                    if isSearching {
                        SearchOverlay(query: $query) {
                            withAnimation(.spring(duration: 0.35)) {
                                isSearching = false
                                query = ""
                            }
                        }
                        .transition(.move(edge: .top).combined(with: .opacity))
                    }
                }
        }
        .safeAreaInset(edge: .bottom) {
            if model.player.current != nil {
                MiniPlayer { model.openPlayer() }
                    .matchedTransitionSource(id: AppModel.miniPlayerSource, in: transition)
                    .padding(.horizontal)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.4), value: model.player.current != nil)
        .fullScreenCover(isPresented: $model.isPlayerPresented) {
            PlayerView()
                .navigationTransition(.zoom(sourceID: model.playerSource, in: transition))
        }
        .tint(model.player.current?.theme.accentColor ?? .primary)
    }
}

/// A glass search field over the top of the grid, focused as it appears.
private struct SearchOverlay: View {
    @Binding var query: String
    var close: () -> Void
    @FocusState private var focused: Bool

    var body: some View {
        GlassEffectContainer(spacing: 8) {
            HStack(spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Number, title or genre", text: $query)
                        .focused($focused)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.search)
                        .accessibilityIdentifier("search-field")
                    if !query.isEmpty {
                        Button("Clear", systemImage: "xmark.circle.fill") { query = "" }
                            .labelStyle(.iconOnly)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal, 16)
                .frame(height: 48)
                .glassEffect(.regular, in: .capsule)

                Button(action: close) {
                    Image(systemName: "xmark")
                        .font(.body.weight(.semibold))
                        .frame(width: 48, height: 48)
                        // The whole circle is tappable, not just the glyph
                        .contentShape(.circle)
                }
                .buttonStyle(.plain)
                .glassEffect(.regular.interactive(), in: .circle)
                .accessibilityLabel("Close search")
                .accessibilityIdentifier("close-search")
            }
        }
        .padding(.horizontal)
        .padding(.top, 8)
        .onAppear { focused = true }
    }
}

/// The grid with loading, empty and error states.
private struct LibraryContent: View {
    @Environment(AppModel.self) private var model
    let mixes: [Mix]
    let isSearching: Bool
    let transition: Namespace.ID

    var body: some View {
        ScrollView {
            MixGridView(mixes: mixes, transition: transition)
        }
        .scrollEdgeEffectStyle(.soft, for: .top)
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
