import MixKit
import SwiftUI

/// The bell in the header: new-mix notifications on or off.
struct NotificationsButton: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let isOn = model.alerts.isOn
        Button(isOn ? "Turn off new mix notifications" : "Notify me about new mixes",
               systemImage: isOn ? "bell.fill" : "bell") {
            Task { await model.alerts.toggle() }
        }
        .contentTransition(.symbolEffect(.replace))
        .accessibilityLabel("New mix notifications")
        .accessibilityValue(isOn ? "On" : "Off")
        .accessibilityIdentifier("notifications")
    }
}

/// Offered once, after the first mix has played for a while: leads to the system request.
struct NotificationPrompt: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "bell.badge")
                .font(.title3)
                .symbolRenderingMode(.hierarchical)
                .accessibilityHidden(true)
            Text("Get a notification when a new mix is out?")
                .font(.subheadline.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Button("Not now") { model.alerts.dismissPrompt() }
                .buttonStyle(.plain)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .accessibilityIdentifier("prompt-not-now")
            Button("Notify me") { Task { await model.alerts.acceptPrompt() } }
                .buttonStyle(.glassProminent)
                .font(.subheadline.weight(.semibold))
                .accessibilityIdentifier("prompt-notify")
        }
        .padding(.leading, 16)
        .padding(.trailing, 8)
        .padding(.vertical, 8)
        .glassEffect(.regular, in: .rect(cornerRadius: 24))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("notification-prompt")
    }
}

#Preview {
    NotificationPrompt()
        .padding()
        .environment(AppModel.shared)
}
