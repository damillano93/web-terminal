import UIKit
import UserNotifications

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        Preferences.registerDefaults()
        UNUserNotificationCenter.current().delegate = Notifier.shared
        return true
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        UISceneConfiguration(name: "Default", sessionRole: connectingSceneSession.role)
    }

    #if targetEnvironment(macCatalyst)
    // Mac menu bar: a "Terminal" menu with the same commands as the iPad, and
    // the standard items whose shortcuts they need (⌘W, ⌘F, ⌘P) taken out.
    override func buildMenu(with builder: UIMenuBuilder) {
        super.buildMenu(with: builder)
        guard builder.system == .main else { return }
        for id in [UIMenu.Identifier.close, .find, .print, .format, .toolbar] { builder.remove(menu: id) }
        let menu = UIMenu(title: "Terminal", identifier: UIMenu.Identifier("webterminal.menu"),
                          children: TerminalViewController.commands(mac: true))
        builder.insertSibling(menu, afterMenu: .edit)
    }
    #endif

    // A window closed for good (swiped away in the iPad app switcher): forget its workspace.
    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
        for s in sceneSessions { WorkspaceStore.forget(scene: s.persistentIdentifier) }
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var terminal: TerminalViewController?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let vc = TerminalViewController(sceneKey: session.persistentIdentifier)
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = vc
        window.makeKeyAndVisible()
        self.window = window
        terminal = vc
        if let item = connectionOptions.shortcutItem { vc.perform(shortcut: item) }
    }

    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem,
                     completionHandler: @escaping (Bool) -> Void) {
        terminal?.perform(shortcut: shortcutItem)
        completionHandler(true)
    }

    func sceneWillEnterForeground(_ scene: UIScene) { terminal?.willEnterForeground() }
    func sceneDidEnterBackground(_ scene: UIScene) { terminal?.didEnterBackground() }
}

/// User settings (iOS Settings → Terminal), backed by Settings.bundle.
enum Preferences {
    static func registerDefaults() {
        #if targetEnvironment(macCatalyst)
        let lock = false   // a Mac is usually already behind its own login
        #else
        let lock = true
        #endif
        UserDefaults.standard.register(defaults: ["lock_enabled": lock, "lock_after": 5, "server_url": "",
                                                  "lan_auto": true, "lan_url": ""])
    }
    static var lockEnabled: Bool { UserDefaults.standard.bool(forKey: "lock_enabled") }
    static var lockAfterSeconds: TimeInterval { TimeInterval(UserDefaults.standard.integer(forKey: "lock_after") * 60) }
    /// A fixed server set in Settings (e.g. http://127.0.0.1:7681 on the server
    /// itself). When set, it is always used and no LAN switching happens.
    static var overrideURL: URL? { url(UserDefaults.standard.string(forKey: "server_url")) }
    static var publicURL: URL {
        url(Bundle.main.object(forInfoDictionaryKey: "WTServerURL") as? String)
            ?? URL(string: "https://terminal.example.com/")!
    }
    static var lanEnabled: Bool { UserDefaults.standard.bool(forKey: "lan_auto") }
    static var lanURL: URL? {
        url(UserDefaults.standard.string(forKey: "lan_url"))
            ?? url(Bundle.main.object(forInfoDictionaryKey: "WTLanURL") as? String)
    }
    private static func url(_ raw: String?) -> URL? {
        guard let s = raw?.trimmingCharacters(in: .whitespaces), !s.isEmpty,
              let u = URL(string: s), u.scheme == "https" || u.scheme == "http", u.host != nil else { return nil }
        return u
    }
}

/// Which web-terminal workspace (?w=…) each window shows, so tabs come back
/// after iOS kills the app instead of starting a fresh workspace every launch.
enum WorkspaceStore {
    private static let lastKey = "ws.last"
    private static func key(_ scene: String) -> String { "ws.scene.\(scene)" }

    static func workspace(scene: String, isOnlyWindow: Bool) -> String? {
        if let w = UserDefaults.standard.string(forKey: key(scene)) { return w }
        // A brand-new window: the first one resumes the last workspace, extra
        // iPad windows start their own.
        return isOnlyWindow ? UserDefaults.standard.string(forKey: lastKey) : nil
    }
    static func remember(_ id: String, scene: String) {
        UserDefaults.standard.set(id, forKey: key(scene))
        UserDefaults.standard.set(id, forKey: lastKey)
    }
    static func forget(scene: String) { UserDefaults.standard.removeObject(forKey: key(scene)) }
}
