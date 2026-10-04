import UIKit
import WebKit
import UserNotifications

/// Full-screen WKWebView on the web-terminal. Over Safari / the PWA it adds: no
/// keyboard bars, iPad keyboard shortcuts, quick reconnect on return, Face ID
/// lock, an expiry warning, home-screen quick actions, native copy/paste
/// (images too) and a haptic bell. It drives the page through `window.wt` and
/// hears from it on the "wtEvent" message handler (see public/app.src.js).
final class TerminalViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private let sceneKey: String
    private var webView: AccessoryFreeWebView!
    private let background = UIColor(red: 0x0d / 255, green: 0x11 / 255, blue: 0x17 / 255, alpha: 1)
    private let lock = LockController()
    private var pageReady = false
    private var pending: [String] = []
    private var workspaceID: String?
    /// The server address in use (LAN at home, public elsewhere; see ConnectionManager).
    private var currentBase: URL = Preferences.publicURL

    init(sceneKey: String) {
        self.sceneKey = sceneKey
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("not used") }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()   // Cloudflare Access + app cookies persist
        config.allowsInlineMediaPlayback = true
        let ucc = config.userContentController
        ucc.add(WeakScriptHandler(self), name: "wtClipboard")
        ucc.add(WeakScriptHandler(self), name: "wtEvent")
        ucc.addUserScript(WKUserScript(source: "window.__WT_NATIVE__ = { platform: 'ios', version: 2 };",
                                       injectionTime: .atDocumentStart, forMainFrameOnly: true))

        webView = AccessoryFreeWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = false
        webView.backgroundColor = background
        webView.scrollView.backgroundColor = background
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        webView.onPasteImage = { [weak self] image in self?.pasteImage(image) }
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        NotificationCenter.default.addObserver(forName: Notifier.openTab, object: nil, queue: .main) { [weak self] n in
            if let id = n.userInfo?["tabId"] as? Int { self?.openFromNotification(tabId: id, workspace: n.userInfo?["workspace"] as? String) }
        }
        view.backgroundColor = background
        lock.attach(to: view)
        NotificationCenter.default.addObserver(forName: ConnectionManager.networkChanged, object: nil, queue: .main) { [weak self] _ in
            self?.recheckConnection()
        }
        let first = WorkspaceStore.workspace(scene: sceneKey, isOnlyWindow: UIApplication.shared.openSessions.count <= 1)
        Task { @MainActor in
            currentBase = await ConnectionManager.shared.chooseBase()
            loadWorkspace(first)
        }
    }

    /// Back in the app or on a different network: switch between the LAN and
    /// the public address if the right one changed. The page reloads on the same
    /// workspace and reattaches its shells, which live on the server.
    private func recheckConnection() {
        Task { @MainActor in
            let base = await ConnectionManager.shared.chooseBase()
            if base != currentBase {
                currentBase = base
                loadWorkspace(workspaceID)
            }
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        #if targetEnvironment(macCatalyst)
        // A plain dark window: no title text or toolbar over the tab bar.
        if let scene = view.window?.windowScene {
            scene.titlebar?.titleVisibility = .hidden
            scene.titlebar?.toolbar = nil
            scene.sizeRestrictions?.minimumSize = CGSize(width: 520, height: 320)
        }
        #endif
        lock.lockOnLaunchIfNeeded()
        ExpiryWatch.check(from: self)
    }

    private func loadWorkspace(_ id: String?) {
        var comps = URLComponents(url: currentBase, resolvingAgainstBaseURL: false)!
        if let id { comps.queryItems = [URLQueryItem(name: "w", value: id)] }
        pageReady = false
        webView.load(URLRequest(url: comps.url!))
    }

    // MARK: Lifecycle (from SceneDelegate)

    func willEnterForeground() {
        lock.willEnterForeground()
        run("wt.reconnect()")
        recheckConnection()
        ExpiryWatch.check(from: self)
    }

    func didEnterBackground() { lock.didEnterBackground() }

    // MARK: Talking to the page

    /// Runs JS against window.wt, queued until the page has booted.
    private func run(_ js: String) {
        guard pageReady else { pending.append(js); return }
        webView.evaluateJavaScript("window.wt && (\(js))", completionHandler: nil)
    }

    private static func jsString(_ s: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: [s])
        let arr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
        return String(arr.dropFirst().dropLast())
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "wtClipboard", let text = message.body as? String {
            UIPasteboard.general.string = text
            return
        }
        guard message.name == "wtEvent", let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }
        switch type {
        case "workspace":
            if let id = body["id"] as? String {
                workspaceID = id
                WorkspaceStore.remember(id, scene: sceneKey)
            }
            pageReady = true
            let queued = pending; pending = []
            queued.forEach(run)
            // On the public address: learn the LAN key (once), then see whether
            // we are at home and could go direct.
            if currentBase == Preferences.publicURL {
                let store = webView.configuration.websiteDataStore.httpCookieStore
                Task { @MainActor in
                    await ConnectionManager.shared.ensureKey(cookies: store)
                    recheckConnection()
                }
            }
        case "tabs":
            QuickActions.update(workspace: body["workspace"] as? String,
                                tabs: (body["tabs"] as? [[String: Any]]) ?? [])
        case "bell":
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case "notify":
            Notifier.post(title: body["title"] as? String ?? "Terminal", body: body["body"] as? String ?? "",
                          tabId: body["tabId"] as? Int, workspace: body["workspace"] as? String)
        case "copy":
            if let text = body["text"] as? String { UIPasteboard.general.string = text }
        case "paste":
            let wantImage = (body["image"] as? Bool) ?? false
            let pb = UIPasteboard.general
            if (wantImage || !pb.hasStrings), let image = pb.image {
                pasteImage(image)
            } else if let text = pb.string {
                run("wt.pasteText(\(Self.jsString(text)))")
            }
        default: break
        }
    }

    private func pasteImage(_ image: UIImage) {
        // PNG keeps screenshots crisp; fall back to JPEG for big photos.
        var data = image.pngData()
        var mime = "image/png"
        if (data?.count ?? 0) > 8_000_000 { data = image.jpegData(compressionQuality: 0.85); mime = "image/jpeg" }
        guard let b64 = data?.base64EncodedString() else { return }
        run("wt.pasteImage('\(b64)', '\(mime)')")
    }

    /// A tapped notification: show its tab if it belongs to this window.
    func openFromNotification(tabId: Int, workspace: String?) {
        guard workspace == nil || workspace == workspaceID else { return }
        run("wt.switchTabId(\(tabId))")
    }

    // MARK: Quick actions

    func perform(shortcut: UIApplicationShortcutItem) {
        switch shortcut.type {
        case QuickActions.newTab:
            run("wt.newTab()")
        case QuickActions.openTab:
            guard let id = shortcut.userInfo?["id"] as? Int else { return }
            let ws = shortcut.userInfo?["workspace"] as? String
            if let ws, ws != workspaceID { loadWorkspace(ws) }
            run("wt.switchTabId(\(id))")
        default: break
        }
    }

    // MARK: Keyboard commands. On iPad they show in the hold-⌘ overlay; on the
    // Mac (Catalyst) the same list becomes the "Terminal" menu, built in
    // AppDelegate.buildMenu, so it is only returned here on iOS.

    static func commands(mac: Bool) -> [UIKeyCommand] {
        func key(_ input: String, _ mods: UIKeyModifierFlags, _ title: String, _ action: Selector) -> UIKeyCommand {
            let c = UIKeyCommand(title: title, action: action, input: input, modifierFlags: mods)
            c.wantsPriorityOverSystemBehavior = true
            return c
        }
        var cmds: [UIKeyCommand] = [
            key("t", .command, "Nueva tab", #selector(newTab)),
            key("w", .command, "Cerrar tab", #selector(closeTab)),
            key("d", .command, "Dividir a la derecha", #selector(splitRight)),
            key("d", [.command, .shift], "Dividir hacia abajo", #selector(splitDown)),
            key("f", .command, "Buscar", #selector(findInTerminal)),
            key("k", .command, "Limpiar", #selector(clear)),
            key("p", .command, "Comandos", #selector(palette)),
            key(UIKeyCommand.inputUpArrow, .command, "Comando anterior", #selector(promptUp)),
            key(UIKeyCommand.inputDownArrow, .command, "Comando siguiente", #selector(promptDown)),
            key("r", [.command, .shift], "Recargar", #selector(reload)),
        ]
        // The Mac has File → New Window (⌘N) already.
        if !mac { cmds.append(key("n", [.command, .shift], "Nueva ventana", #selector(newWindow))) }
        // Same action for all nine: the menu bar needs each told apart, which the
        // propertyList (the tab number) does.
        for n in 1...9 {
            let c = UIKeyCommand(title: n == 9 ? "Última tab" : "Tab \(n)", action: #selector(switchTab(_:)),
                                 input: "\(n)", modifierFlags: .command, propertyList: n)
            c.wantsPriorityOverSystemBehavior = true
            cmds.append(c)
        }
        return cmds
    }

    override var keyCommands: [UIKeyCommand]? {
        #if targetEnvironment(macCatalyst)
        return nil
        #else
        return Self.commands(mac: false)
        #endif
    }

    @objc func newTab() { run("wt.newTab()") }
    @objc func closeTab() { run("wt.closeTab()") }
    @objc func splitRight() { run("wt.split('right')") }
    @objc func splitDown() { run("wt.split('down')") }
    @objc func findInTerminal() { run("wt.find()") }
    @objc func clear() { run("wt.clear()") }
    @objc func reload() { pageReady = false; webView.reload() }
    @objc func newWindow() { openNewWindow() }
    @objc func palette() { run("wt.palette()") }
    @objc func promptUp() { run("wt.jumpPrompt(-1)") }
    @objc func promptDown() { run("wt.jumpPrompt(1)") }
    @objc func switchTab(_ cmd: UIKeyCommand) {
        if let n = (cmd.propertyList as? Int) ?? Int(cmd.input ?? "") { run("wt.switchTab(\(n))") }
    }

    private func openNewWindow() {
        if UIApplication.shared.supportsMultipleScenes {
            UIApplication.shared.requestSceneSessionActivation(nil, userActivity: nil, options: nil, errorHandler: nil)
        } else {
            run("wt.newTab()")
        }
    }

    // MARK: Navigation: stay on the terminal and its login; everything else opens in Safari.

    private func isInternal(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return true }   // about:blank, blob:, data:
        let known = [currentBase, Preferences.publicURL, Preferences.lanURL, Preferences.overrideURL]
        if known.contains(where: { $0?.host?.lowercased() == host }) { return true }
        return host.hasSuffix(".cloudflareaccess.com")
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.allow) }
        if action.targetFrame?.isMainFrame == false || isInternal(url) {
            if action.targetFrame?.isMainFrame == true { pageReady = false }
            decisionHandler(.allow)
        } else {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    // window.open: links (Cmd/Ctrl+click) go to Safari; the menu's "New window"
    // (a bare "/") opens a second iPad window.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = action.request.url else { return nil }
        if isInternal(url) {
            let hasWorkspace = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.contains { $0.name == "w" } ?? false
            if hasWorkspace { webView.load(URLRequest(url: url)) } else { openNewWindow() }
        } else {
            UIApplication.shared.open(url)
        }
        return nil
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { showRetry(error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { showRetry(error) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { pageReady = false; webView.reload() }

    private func showRetry(_ error: Error) {
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled { return }
        let alert = UIAlertController(title: "No se pudo conectar",
                                      message: error.localizedDescription, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Reintentar", style: .default) { [weak self] _ in
            guard let self else { return }
            self.loadWorkspace(self.workspaceID)
        })
        present(alert, animated: true)
    }

    // JS alert/confirm/prompt (tab rename uses prompt()).
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        present(a, animated: true)
    }
}

/// WKUserContentController retains its handlers; this breaks the cycle.
private final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        target?.userContentController(c, didReceive: m)
    }
}

/// Home-screen quick actions: "Nueva tab" plus the first tabs by name.
enum QuickActions {
    static let newTab = "webterminal.newtab"
    static let openTab = "webterminal.tab"

    static func update(workspace: String?, tabs: [[String: Any]]) {
        var items = [UIApplicationShortcutItem(type: newTab, localizedTitle: "Nueva tab", localizedSubtitle: nil,
                                               icon: UIApplicationShortcutIcon(systemImageName: "plus"), userInfo: nil)]
        for t in tabs.prefix(3) {
            guard let id = t["id"] as? Int, let name = t["name"] as? String else { continue }
            var info: [String: NSSecureCoding] = ["id": NSNumber(value: id)]
            if let workspace { info["workspace"] = workspace as NSString }
            items.append(UIApplicationShortcutItem(type: openTab, localizedTitle: name, localizedSubtitle: nil,
                                                   icon: UIApplicationShortcutIcon(systemImageName: "terminal"),
                                                   userInfo: info))
        }
        UIApplication.shared.shortcutItems = items
    }
}

/// Local notifications for terminal events (a long command finished, Claude
/// Code asking for attention, a bell in another tab). The page decides when
/// one is due; this only shows it, also while the app is in front.
final class Notifier: NSObject, UNUserNotificationCenterDelegate {
    static let shared = Notifier()
    static let openTab = Notification.Name("WTOpenTab")
    private static var asked = false

    static func post(title: String, body: String, tabId: Int?, workspace: String?) {
        let center = UNUserNotificationCenter.current()
        center.delegate = shared
        let send = {
            let content = UNMutableNotificationContent()
            content.title = title
            if !body.isEmpty { content.body = body }
            content.sound = .default
            var info: [String: Any] = [:]
            if let tabId { info["tabId"] = tabId }
            if let workspace { info["workspace"] = workspace }
            content.userInfo = info
            center.add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil))
        }
        if asked { send(); return }
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            asked = true
            if granted { send() }
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler done: @escaping (UNNotificationPresentationOptions) -> Void) {
        done([.banner, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler done: @escaping () -> Void) {
        let info = response.notification.request.content.userInfo
        NotificationCenter.default.post(name: Self.openTab, object: nil, userInfo: info)
        done()
    }
}
