import CarPlay
import MixKit
import PlayerKit

/// CarPlay: a list of sessions (newest first) and the system Now Playing screen.
/// Playback state is shared with the phone through AppModel.
@MainActor
final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
    private var interfaceController: CPInterfaceController?
    private var observation: Task<Void, Never>?
    private var artwork: [Int: UIImage] = [:]

    func templateApplicationScene(
        _ scene: CPTemplateApplicationScene,
        didConnect interfaceController: CPInterfaceController
    ) {
        self.interfaceController = interfaceController
        let model = AppModel.shared
        let list = CPListTemplate(title: "OK Sessions", sections: [])
        list.tabImage = UIImage(systemName: "square.grid.2x2.fill")
        list.emptyViewTitleVariants = ["Loading sessions…"]
        interfaceController.setRootTemplate(list, animated: false, completion: nil)

        // Keep the list in step with the library and what's playing
        observation = Task { [weak self] in
            if model.library.mixes.isEmpty { await model.library.refresh() }
            while !Task.isCancelled {
                await withCheckedContinuation { continuation in
                    withObservationTracking {
                        self?.update(list, model: model)
                    } onChange: {
                        continuation.resume()
                    }
                }
            }
        }
    }

    func templateApplicationScene(
        _ scene: CPTemplateApplicationScene,
        didDisconnectInterfaceController interfaceController: CPInterfaceController
    ) {
        observation?.cancel()
        self.interfaceController = nil
    }

    private func update(_ list: CPListTemplate, model: AppModel) {
        if case .failed(let message) = model.library.state, model.library.mixes.isEmpty {
            list.emptyViewTitleVariants = ["Couldn't load sessions"]
            list.emptyViewSubtitleVariants = [message]
        }
        let currentID = model.player.current?.id
        let items = model.library.latestFirst.map { mix in
            let item = CPListItem(
                text: mix.title,
                detailText: [mix.genre, Formatting.time(mix.duration)].compactMap { $0 }.joined(separator: " · "),
                image: image(for: mix)
            )
            item.isPlaying = mix.id == currentID
            item.playingIndicatorLocation = .trailing
            item.handler = { [weak self] _, completion in
                model.play(mix)
                self?.showNowPlaying()
                completion()
            }
            return item
        }
        list.updateSections([CPListSection(items: items)])
    }

    private func image(for mix: Mix) -> UIImage? {
        if let cached = artwork[mix.id] { return cached }
        let image = MixArtwork.image(for: mix, size: CPListItem.maximumImageSize.width * 3)
        artwork[mix.id] = image
        return image
    }

    private func showNowPlaying() {
        guard let interfaceController, interfaceController.topTemplate !== CPNowPlayingTemplate.shared else { return }
        interfaceController.pushTemplate(CPNowPlayingTemplate.shared, animated: true, completion: nil)
    }
}
