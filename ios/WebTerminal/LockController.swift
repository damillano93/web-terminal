import UIKit
import LocalAuthentication

/// Face ID / passcode lock. Covers the terminal on launch and when the app comes
/// back after "lock_after" minutes (Settings → Terminal). While in the background
/// the terminal is always blurred, so the app switcher never shows its contents.
final class LockController {
    private let cover = UIVisualEffectView(effect: UIBlurEffect(style: .systemThickMaterialDark))
    private let button = UIButton(type: .system)
    private var backgroundedAt: Date?
    private var locked = false
    private var authenticating = false

    func attach(to view: UIView) {
        cover.frame = view.bounds
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.isHidden = true

        var cfg = UIButton.Configuration.filled()
        cfg.title = "Desbloquear"
        cfg.image = UIImage(systemName: "faceid")
        cfg.imagePadding = 8
        cfg.cornerStyle = .capsule
        cfg.baseBackgroundColor = UIColor(red: 0.29, green: 0.87, blue: 0.5, alpha: 1)
        cfg.baseForegroundColor = .black
        button.configuration = cfg
        button.translatesAutoresizingMaskIntoConstraints = false
        button.addAction(UIAction { [weak self] _ in self?.authenticate() }, for: .touchUpInside)
        cover.contentView.addSubview(button)
        NSLayoutConstraint.activate([
            button.centerXAnchor.constraint(equalTo: cover.contentView.centerXAnchor),
            button.centerYAnchor.constraint(equalTo: cover.contentView.centerYAnchor),
        ])
        view.addSubview(cover)
    }

    func lockOnLaunchIfNeeded() {
        guard Preferences.lockEnabled, backgroundedAt == nil, !locked else { return }
        lockNow()
    }

    func didEnterBackground() {
        backgroundedAt = Date()
        cover.superview?.bringSubviewToFront(cover)
        cover.isHidden = false
        button.isHidden = true
    }

    func willEnterForeground() {
        let away = backgroundedAt.map { Date().timeIntervalSince($0) } ?? 0
        backgroundedAt = nil
        if Preferences.lockEnabled && (locked || away >= Preferences.lockAfterSeconds) {
            lockNow()
        } else {
            cover.isHidden = true
        }
    }

    private func lockNow() {
        locked = true
        cover.superview?.bringSubviewToFront(cover)
        cover.isHidden = false
        button.isHidden = false
        authenticate()
    }

    private func authenticate() {
        guard !authenticating else { return }
        let ctx = LAContext()
        var err: NSError?
        // No Face ID / passcode configured on the device: nothing to check against.
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &err) else { unlock(); return }
        authenticating = true
        ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Desbloquear la terminal") { ok, _ in
            DispatchQueue.main.async {
                self.authenticating = false
                if ok { self.unlock() }
            }
        }
    }

    private func unlock() {
        locked = false
        UIView.animate(withDuration: 0.2, animations: { self.cover.alpha = 0 }) { _ in
            self.cover.isHidden = true
            self.cover.alpha = 1
        }
    }
}
