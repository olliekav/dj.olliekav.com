import AVFoundation
import PlayerKit

/// Background playback, and pausing/resuming around calls and other apps.
@MainActor
enum AudioSession {
    static func configure(player: PlayerController) {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, policy: .longFormAudio)

        NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification, object: session, queue: .main
        ) { note in
            let info = note.userInfo ?? [:]
            let type = (info[AVAudioSessionInterruptionTypeKey] as? UInt).flatMap(AVAudioSession.InterruptionType.init)
            let options = (info[AVAudioSessionInterruptionOptionKey] as? UInt).map(AVAudioSession.InterruptionOptions.init)
            MainActor.assumeIsolated {
                switch type {
                case .began:
                    player.pause()
                case .ended where options?.contains(.shouldResume) == true:
                    player.resume()
                default:
                    break
                }
            }
        }

        // Headphones unplugged: pause rather than play out loud
        NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification, object: session, queue: .main
        ) { note in
            let reason = (note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt)
                .flatMap(AVAudioSession.RouteChangeReason.init)
            if reason == .oldDeviceUnavailable {
                MainActor.assumeIsolated { player.pause() }
            }
        }
    }

    static func activate() {
        try? AVAudioSession.sharedInstance().setActive(true)
    }
}
